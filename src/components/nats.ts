import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";
import { createHash } from "node:crypto";

/**
 * Configuration for the NATS component
 */
export interface NatsArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  storage?: StorageConfig;
  memStorageSize?: pulumi.Input<string>;
  cpu?: pulumi.Input<string>;
  memory?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  allowAnonymous?: boolean;
  operator?: {
    jwt: pulumi.Input<string>;
    systemAccount: pulumi.Input<string>;
    systemJwt: pulumi.Input<string>;
    routePassword: pulumi.Input<string>;
    accounts: pulumi.Input<Record<string, string>>;
  };
}

/**
 * NATS component - cloud native messaging system with JetStream persistence
 */
export class Nats extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly clientUrl: pulumi.Output<string>;

  constructor(name: string, args: NatsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Nats", name, args, withWorkloadLabels(opts, args.workloadLabels));
    if (!args.operator && args.allowAnonymous !== true) throw new Error("NATS requires operator authentication");
    if (args.operator && args.allowAnonymous) throw new Error("Operator authentication cannot allow anonymous clients");

    const chartConfig = HELM_CHARTS.NATS;

    const cpu = args.cpu || "500m";
    const memory = args.memory || "1Gi";
    const memStorageSize = args.memStorageSize || "512Mi";
    const replicas = args.replicas || 1;
    const goMemLimit = pulumi.output(memory).apply(m => `${m}B`);

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "10Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    const pvcSpec = createPVCSpec(storageConfig);

    const chartReleaseName = name;

    this.chart = new k8s.helm.v4.Chart(
      chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          config: {
            ...(args.operator ? {
              merge: {
                operator: args.operator.jwt,
                system_account: args.operator.systemAccount,
                resolver: "MEMORY",
                resolver_preload: pulumi.all([args.operator.systemAccount, args.operator.systemJwt, args.operator.accounts])
                  .apply(([account, jwt, accounts]) => {
                    if (account in accounts) throw new Error("Application accounts cannot replace the NATS system account");
                    return { ...accounts, [account]: jwt };
                  }),
              },
            } : {}),
            cluster: {
              enabled: pulumi.output(replicas).apply(r => r > 1),
              replicas: replicas,
              ...(args.operator ? { routeURLs: { user: "nats-route", password: args.operator.routePassword } } : {}),
            },
            jetstream: {
              enabled: true,
              memoryStore: {
                enabled: true,
                maxSize: memStorageSize,
              },
              fileStore: {
                enabled: true,
                pvc: {
                  size: storageConfig.size,
                  storageClassName: storageConfig.storageClass,
                },
              },
            },
          },
          container: {
            image: {
              tag: "2.12.4",
            },
            env: {
              GOMEMLIMIT: goMemLimit,
            },
            resources: {
              requests: { cpu, memory },
              limits: { cpu, memory },
            },
          },
          podTemplate: {
            topologySpreadConstraints: {
              "kubernetes.io/hostname": {
                maxSkew: 1,
                whenUnsatisfiable: pulumi.output(replicas).apply(r =>
                  r > 1 ? "DoNotSchedule" : "ScheduleAnyway"
                ),
              },
            },
            merge: {
              metadata: {
                annotations: {
                  "k8s.grafana.com/scrape": "true",
                  "k8s.grafana.com/job": "nats",
                  "k8s.grafana.com/metrics.portNumber": "7777",
                  "k8s.grafana.com/metrics.path": "/metrics",
                  "k8s.grafana.com/metrics.scheme": "http",
                  ...(args.operator ? {
                    "messaging.holdenitdown.net/claims": pulumi.all([
                      args.operator.jwt, args.operator.systemJwt, args.operator.accounts,
                    ]).apply(values => createHash("sha256").update(JSON.stringify(values)).digest("hex")),
                  } : {}),
                },
              },
              spec: {
                terminationGracePeriodSeconds: 60,
                ...(args.tolerations && { tolerations: args.tolerations }),
              },
            },
          },
          promExporter: {
            enabled: true,
            port: 7777,
          },
          natsBox: {
            enabled: !args.operator,
          },
        },
      },
      { parent: this }
    );

    this.clientUrl = pulumi.interpolate`nats://${chartReleaseName}.${args.namespace}.svc.cluster.local:4222`;

    this.registerOutputs({
      chart: this.chart,
      clientUrl: this.clientUrl,
    });
  }
}
