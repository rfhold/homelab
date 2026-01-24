import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

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

  dindStorage?: StorageConfig;

  dindHostPath?: pulumi.Input<string>;

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  registryMirrors?: pulumi.Input<string[]>;

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
  public readonly configMap: k8s.core.v1.ConfigMap;

  constructor(name: string, args: GiteaActRunnerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:GiteaActRunner", name, args, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "gitea-act-runner", component: name };

    const runnerName = args.runnerName || name;
    const runnerLabels = args.runnerLabels || "ubuntu-latest:docker://node:16-bullseye";
    const actRunnerImage = args.actRunnerImage || DOCKER_IMAGES.GITEA_ACT_RUNNER.image;
    const dindImage = args.dindImage || DOCKER_IMAGES.DOCKER_DIND.image;

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

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "config.yaml": `log:
  level: info

runner:
  file: .runner
  capacity: 4
  timeout: 1h
  insecure: false
  fetch_timeout: 5s
  fetch_interval: 10s

cache:
  enabled: true
  dir: ""

container:
  network: "host"
  privileged: false
  options: "-e DOCKER_HOST=tcp://localhost:2375"
  workdir_parent: ""
  valid_volumes: []
  docker_host: "tcp://localhost:2375"
  force_pull: false

host:
  workdir_parent: ""
`,
        "daemon.json": pulumi.output(args.registryMirrors).apply(mirrors => 
          JSON.stringify({
            "registry-mirrors": mirrors || []
          }, null, 2)
        ),
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

    const dindStorageConfig: StorageConfig = {
      size: args.dindStorage?.size || "100Gi",
      storageClass: args.dindStorage?.storageClass,
      accessModes: args.dindStorage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.dindStorage?.volumeMode,
      namespace: args.dindStorage?.namespace,
      labels: args.dindStorage?.labels,
      annotations: args.dindStorage?.annotations,
      selector: args.dindStorage?.selector,
      dataSource: args.dindStorage?.dataSource,
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
          port: 2375,
          targetPort: 2375,
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
          port: 2375,
          targetPort: 2375,
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
                command: ["sh", "-c", "while ! nc -z localhost 2375 </dev/null; do echo 'waiting for docker daemon...'; sleep 5; done; /sbin/tini -- run.sh"],
                env: [
                  {
                    name: "DOCKER_HOST",
                    value: "tcp://localhost:2375",
                  },
                  {
                    name: "CONFIG_FILE",
                    value: "/config/config.yaml",
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
                    name: "runner-data",
                    mountPath: "/data",
                  },
                  {
                    name: "runner-config",
                    mountPath: "/config",
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
                    value: "",
                  },
                ],
                volumeMounts: [
                  {
                    name: "dind-storage",
                    mountPath: "/var/lib/docker",
                  },
                  {
                    name: "runner-config",
                    mountPath: "/etc/docker/daemon.json",
                    subPath: "daemon.json",
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
                name: "runner-config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
              ...(args.dindHostPath ? [{
                name: "dind-storage",
                hostPath: {
                  path: args.dindHostPath,
                  type: "DirectoryOrCreate",
                },
              }] : []),
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
          ...(args.dindHostPath ? [] : [{
            metadata: {
              name: "dind-storage",
              labels,
            },
            spec: createPVCSpec(dindStorageConfig),
          }]),
        ],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      secret: this.secret,
      configMap: this.configMap,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:2375`;
  }
}
