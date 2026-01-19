import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface BuildKitArgs {
  namespace: pulumi.Input<string>;

  platform: "linux/amd64" | "linux/arm64";

  image?: pulumi.Input<string>;

  nodeSelector: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  storage: {
    size: pulumi.Input<string>;
    storageClass: pulumi.Input<string>;
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

export class BuildKit extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;

  constructor(name: string, args: BuildKitArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:BuildKit", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "buildkit", component: name };

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-cache`, {
      metadata: {
        name: `${name}-cache`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: args.storage.storageClass,
        resources: {
          requests: {
            storage: args.storage.size,
          },
        },
      },
    }, defaultResourceOptions);

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
        },
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
                name: "buildkitd",
                image: args.image || DOCKER_IMAGES.BUILDKIT.image,
                args: [
                  "--addr",
                  "tcp://0.0.0.0:1234",
                ],
                ports: [
                  {
                    containerPort: 1234,
                    name: "buildkit",
                    protocol: "TCP",
                  },
                ],
                securityContext: {
                  privileged: true,
                },
                readinessProbe: {
                  exec: {
                    command: ["buildctl", "--addr", "tcp://127.0.0.1:1234", "debug", "workers"],
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                livenessProbe: {
                  exec: {
                    command: ["buildctl", "--addr", "tcp://127.0.0.1:1234", "debug", "workers"],
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 30,
                },
                volumeMounts: [
                  {
                    name: "cache",
                    mountPath: "/var/lib/buildkit",
                  },
                ],
                resources: {
                  requests: {
                    memory: args.resources?.requests?.memory || "512Mi",
                    cpu: args.resources?.requests?.cpu || "250m",
                  },
                  limits: {
                    memory: args.resources?.limits?.memory || "4Gi",
                    cpu: args.resources?.limits?.cpu || "4000m",
                  },
                },
              },
            ],
            volumes: [
              {
                name: "cache",
                persistentVolumeClaim: {
                  claimName: this.pvc.metadata.name,
                },
              },
            ],
          },
        },
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
          port: 1234,
          targetPort: 1234,
          protocol: "TCP",
          name: "buildkit",
        }],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      pvc: this.pvc,
    });
  }

  public getHost(): pulumi.Output<string> {
    return pulumi.interpolate`tcp://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1234`;
  }
}
