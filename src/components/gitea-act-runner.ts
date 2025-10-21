import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

export interface GiteaActRunnerArgs {
  namespace: pulumi.Input<string>;

  giteaUrl: pulumi.Input<string>;

  registrationToken: pulumi.Input<string>;

  runnerName?: pulumi.Input<string>;

  runnerLabels?: pulumi.Input<string>;

  replicas?: pulumi.Input<number>;

  ephemeral?: pulumi.Input<boolean>;

  actRunnerImage?: pulumi.Input<string>;

  dindImage?: pulumi.Input<string>;

  dataStorage?: StorageConfig;

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  resources?: {
    actRunner?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    dind?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
  };
}

export class GiteaActRunner extends pulumi.ComponentResource {
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;

  constructor(name: string, args: GiteaActRunnerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:GiteaActRunner", name, args, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "gitea-act-runner", component: name };

    const runnerName = args.runnerName || name;
    const runnerLabels = args.runnerLabels || "ubuntu-latest:docker://node:16-bullseye";
    const actRunnerImage = args.actRunnerImage || "gitea/act_runner:0.2.13";
    const dindImage = args.dindImage || "docker:28.5.1-dind";

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        token: args.registrationToken,
      },
    }, defaultResourceOptions);

    const dataStorageConfig: StorageConfig = {
      size: args.dataStorage?.size || "10Gi",
      storageClass: args.dataStorage?.storageClass,
      accessModes: args.dataStorage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.dataStorage?.volumeMode,
      namespace: args.dataStorage?.namespace,
      labels: args.dataStorage?.labels,
      annotations: args.dataStorage?.annotations,
      selector: args.dataStorage?.selector,
      dataSource: args.dataStorage?.dataSource,
    };



    const headlessService = new k8s.core.v1.Service(`${name}-headless`, {
      metadata: {
        name: `${name}-headless`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        clusterIP: "None",
        selector: labels,
        ports: [{
          port: 2376,
          targetPort: 2376,
          name: "docker",
        }],
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 2376,
          targetPort: 2376,
          name: "docker",
        }],
      },
    }, defaultResourceOptions);

    this.statefulSet = new k8s.apps.v1.StatefulSet(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        serviceName: headlessService.metadata.name,
        replicas: args.replicas || 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            nodeSelector: args.nodeSelector,
            tolerations: args.tolerations,
            containers: [
              {
                name: "runner",
                image: actRunnerImage,
                command: ["sh", "-c", "while ! nc -z localhost 2376 </dev/null; do echo 'waiting for docker daemon...'; sleep 5; done; /sbin/tini -- run.sh"],
                env: [
                  {
                    name: "DOCKER_HOST",
                    value: "tcp://localhost:2376",
                  },
                  {
                    name: "DOCKER_CERT_PATH",
                    value: "/certs/client",
                  },
                  {
                    name: "DOCKER_TLS_VERIFY",
                    value: "1",
                  },
                  {
                    name: "GITEA_INSTANCE_URL",
                    value: args.giteaUrl,
                  },
                  {
                    name: "GITEA_RUNNER_REGISTRATION_TOKEN",
                    valueFrom: {
                      secretKeyRef: {
                        name: this.secret.metadata.name,
                        key: "token",
                      },
                    },
                  },
                  {
                    name: "GITEA_RUNNER_NAME",
                    value: runnerName,
                  },
                  {
                    name: "GITEA_RUNNER_LABELS",
                    value: runnerLabels,
                  },
                ],
                volumeMounts: [
                  {
                    name: "docker-certs",
                    mountPath: "/certs",
                  },
                  {
                    name: "runner-data",
                    mountPath: "/data",
                  },
                ],
                resources: {
                  requests: {
                    memory: args.resources?.actRunner?.requests?.memory || "256Mi",
                    cpu: args.resources?.actRunner?.requests?.cpu || "250m",
                  },
                  limits: {
                    memory: args.resources?.actRunner?.limits?.memory || "1Gi",
                    cpu: args.resources?.actRunner?.limits?.cpu || "1000m",
                  },
                },
              },
              {
                name: "daemon",
                image: dindImage,
                env: [
                  {
                    name: "DOCKER_TLS_CERTDIR",
                    value: "/certs",
                  },
                ],
                volumeMounts: [
                  {
                    name: "docker-certs",
                    mountPath: "/certs",
                  },
                ],
                securityContext: {
                  privileged: true,
                },
                resources: {
                  requests: {
                    memory: args.resources?.dind?.requests?.memory || "512Mi",
                    cpu: args.resources?.dind?.requests?.cpu || "500m",
                  },
                  limits: {
                    memory: args.resources?.dind?.limits?.memory || "2Gi",
                    cpu: args.resources?.dind?.limits?.cpu || "2000m",
                  },
                },
              },
            ],
            volumes: [
              {
                name: "docker-certs",
                emptyDir: {},
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: "runner-data",
              labels,
            },
            spec: createPVCSpec(dataStorageConfig),
          },
        ],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      secret: this.secret,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:2376`;
  }
}
