import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface OpenBaoEngineConfig {
  enabled?: boolean;
  path?: pulumi.Input<string>;
}

export interface OpenBaoTransitConfig extends OpenBaoEngineConfig {
  keyName?: pulumi.Input<string>;
}

export type OpenBaoMode = "standalone" | "raft";

export interface OpenBaoArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;

  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    labels?: Record<string, pulumi.Input<string>>;
  };

  service?: {
    annotations?: Record<string, pulumi.Input<string>>;
    uiAnnotations?: Record<string, pulumi.Input<string>>;
  };

  engines?: {
    kv?: OpenBaoEngineConfig;
    transit?: OpenBaoTransitConfig;
  };

  server?: {
    mode?: OpenBaoMode;
    replicas?: pulumi.Input<number>;
    nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    annotations?: Record<string, pulumi.Input<string>>;
  };

  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
}

function createStandaloneConfig(name: string, namespace: pulumi.Input<string>): pulumi.Output<string> {
  return pulumi.output(namespace).apply((resolvedNamespace) => [
    "ui = true",
    "",
    "listener \"tcp\" {",
    "  tls_disable = 1",
    "  address = \"[::]:8200\"",
    "  cluster_address = \"[::]:8201\"",
    "}",
    "",
    "storage \"file\" {",
    "  path = \"/openbao/data\"",
    "}",
    "",
    `api_addr = "http://${name}-chart.${resolvedNamespace}.svc:8200"`,
    `cluster_addr = "http://${name}-chart-internal.${resolvedNamespace}.svc:8201"`,
    "",
    "disable_mlock = true",
  ].join("\n"));
}

export class OpenBao extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly kvMountPath: pulumi.Output<string>;
  public readonly transitMountPath: pulumi.Output<string>;
  public readonly transitKeyName: pulumi.Output<string>;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;

  constructor(name: string, args: OpenBaoArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OpenBao", name, args, withWorkloadLabels(opts, args.workloadLabels));

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;
    this.kvMountPath = pulumi.output(args.engines?.kv?.enabled === false ? "" : args.engines?.kv?.path || "kv");
    this.transitMountPath = pulumi.output(args.engines?.transit?.enabled === false ? "" : args.engines?.transit?.path || "transit");
    this.transitKeyName = pulumi.output(args.engines?.transit?.keyName || "pulumi");

    const mode = args.server?.mode ?? "standalone";
    const raftEnabled = mode === "raft";

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(HELM_CHARTS.OPENBAO, args.namespace),
        values: {
          fullnameOverride: this.chartReleaseName,
          global: {
            enabled: true,
            tlsDisable: true,
          },
          injector: {
            enabled: false,
          },
          csi: {
            enabled: false,
          },
          server: {
            authDelegator: {
              enabled: false,
            },
            ingress: {
              enabled: false,
            },
            gateway: {
              tlsRoute: {
                enabled: false,
              },
              httpRoute: {
                enabled: false,
              },
              tlsPolicy: {
                enabled: false,
              },
            },
            route: {
              enabled: false,
            },
            dataStorage: {
              enabled: true,
              size: args.storage?.size || "10Gi",
              mountPath: "/openbao/data",
              storageClass: args.storage?.storageClass,
              accessMode: "ReadWriteOnce",
              annotations: args.storage?.annotations,
              labels: args.storage?.labels,
            },
            persistentVolumeClaimRetentionPolicy: {
              whenDeleted: "Retain",
              whenScaled: "Retain",
            },
            statefulSet: {
              annotations: {
                "pulumi.com/skipAwait": "true",
              },
            },
            auditStorage: {
              enabled: false,
            },
            dev: {
              enabled: false,
            },
            standalone: {
              enabled: !raftEnabled,
              config: createStandaloneConfig(name, args.namespace),
            },
            ha: {
              enabled: raftEnabled,
              replicas: raftEnabled ? args.server?.replicas ?? 3 : 1,
              raft: {
                enabled: raftEnabled,
                setNodeId: raftEnabled,
              },
            },
            service: {
              enabled: true,
              type: "ClusterIP",
              annotations: args.service?.annotations,
              active: {
                enabled: raftEnabled,
              },
              standby: {
                enabled: raftEnabled,
              },
            },
            resources: args.resources,
            nodeSelector: args.server?.nodeSelector,
            tolerations: args.server?.tolerations,
            annotations: args.server?.annotations,
          },
          ui: {
            enabled: true,
            activeOpenbaoPodOnly: raftEnabled,
            serviceType: "ClusterIP",
            annotations: args.service?.uiAnnotations,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
      kvMountPath: this.kvMountPath,
      transitMountPath: this.transitMountPath,
      transitKeyName: this.transitKeyName,
    });
  }

  public getServiceName(): pulumi.Output<string> {
    return pulumi.output(this.chartReleaseName);
  }

  public getUiServiceName(): pulumi.Output<string> {
    return pulumi.output(`${this.chartReleaseName}-ui`);
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}.${this.namespace}.svc:8200`;
  }

  public getUiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-ui.${this.namespace}.svc:8200`;
  }

  public getKvMountPath(): pulumi.Output<string> {
    return this.kvMountPath;
  }

  public getTransitMountPath(): pulumi.Output<string> {
    return this.transitMountPath;
  }

  public getTransitKeyName(): pulumi.Output<string> {
    return this.transitKeyName;
  }
}
