import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface BuildKitArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;

  platform: "linux/amd64" | "linux/arm64";

  image?: pulumi.Input<string>;

  nodeSelector: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  hostPath: pulumi.Input<string>;

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
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;

  constructor(name: string, args: BuildKitArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:BuildKit", name, {}, withWorkloadLabels(opts, args.workloadLabels));

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "buildkit", component: name };

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "buildkitd.toml": [
          "[worker.oci]",
          '  snapshotter = "overlayfs"',
          "  gc = true",
          '  reservedSpace = "20%"',
          '  maxUsedSpace = "80%"',
          "",
          "  [[worker.oci.gcpolicy]]",
          '    keepDuration = "168h"',
          '    reservedSpace = "1GB"',
          '    filters = ["type==source.local", "type==exec.cachemount", "type==source.git.checkout"]',
          "",
          "  [[worker.oci.gcpolicy]]",
          "    all = true",
          '    reservedSpace = "2GB"',
          "",
          '[registry."docker.io"]',
          '  mirrors = ["cr.holdenitdown.net/docker-hub"]',
          "",
          '[registry."ghcr.io"]',
          '  mirrors = ["cr.holdenitdown.net/ghcr"]',
          "",
          '[registry."nvcr.io"]',
          '  mirrors = ["cr.holdenitdown.net/nvcr"]',
          "",
          '[registry."gcr.io"]',
          '  mirrors = ["cr.holdenitdown.net/gcr"]',
          "",
          '[registry."quay.io"]',
          '  mirrors = ["cr.holdenitdown.net/quay"]',
          '',
          '[registry."registry.k8s.io"]',
          '  mirrors = ["cr.holdenitdown.net/k8s"]',
        ].join("\n"),
      },
    }, defaultResourceOptions);

    this.statefulSet = new k8s.apps.v1.StatefulSet(`${name}-statefulset`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        serviceName: name,
        replicas: 1,
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
            terminationGracePeriodSeconds: 30,
            initContainers: [
              {
                name: "db-recovery",
                image: DOCKER_IMAGES.ALPINE.image,
                command: ["sh", "-c", [
                  'SNAP_DIR="/var/lib/buildkit/runc-overlayfs/snapshots/snapshots"',
                  'mkdir -p "$SNAP_DIR"',
                  'echo "Removing orphaned in-progress and staged-for-deletion snapshot dirs..."',
                  'find "$SNAP_DIR" -maxdepth 1 \\( -name "new-*" -o -name "rm-*" \\) -type d -exec rm -rf {} + 2>/dev/null || true',
                  'echo "db-recovery complete"',
                ].join("\n")],
                volumeMounts: [
                  {
                    name: "cache",
                    mountPath: "/var/lib/buildkit",
                  },
                ],
              },
            ],
            containers: [
              {
                name: "buildkitd",
                image: args.image || DOCKER_IMAGES.BUILDKIT.image,
                args: [
                  "--addr",
                  "tcp://0.0.0.0:1234",
                  "--config",
                  "/etc/buildkit/buildkitd.toml",
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
                lifecycle: {
                  preStop: {
                    exec: {
                      command: ["sh", "-c", "sleep 5"],
                    },
                  },
                },
                volumeMounts: [
                  {
                    name: "cache",
                    mountPath: "/var/lib/buildkit",
                  },
                  {
                    name: "config",
                    mountPath: "/etc/buildkit",
                    readOnly: true,
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
                name: "config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
              {
                name: "cache",
                hostPath: {
                  path: args.hostPath,
                  type: "DirectoryOrCreate",
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
      statefulSet: this.statefulSet,
      service: this.service,
      configMap: this.configMap,
    });
  }

  public getHost(): pulumi.Output<string> {
    return pulumi.interpolate`tcp://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1234`;
  }
}
