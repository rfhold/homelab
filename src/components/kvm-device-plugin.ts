import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface KvmDevicePluginArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  image?: pulumi.Input<string>;
  nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  kvmCount?: pulumi.Input<number>;
}

export class KvmDevicePlugin extends pulumi.ComponentResource {
  public readonly daemonSet: k8s.apps.v1.DaemonSet;

  constructor(name: string, args: KvmDevicePluginArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:KvmDevicePlugin", name, {}, withWorkloadLabels(opts, args.workloadLabels));

    const labels = { "app.kubernetes.io/name": "kvm-device-plugin", "app.kubernetes.io/instance": name };
    const image = args.image ?? DOCKER_IMAGES.GENERIC_DEVICE_PLUGIN.image;
    const kvmCount = args.kvmCount ?? 100;

    this.daemonSet = new k8s.apps.v1.DaemonSet(
      `${name}-daemonset`,
      {
        metadata: {
          name: "kvm-device-plugin",
          namespace: args.namespace,
          labels,
        },
        spec: {
          selector: { matchLabels: labels },
          updateStrategy: { type: "RollingUpdate" },
          template: {
            metadata: { labels },
            spec: {
              priorityClassName: "system-node-critical",
              nodeSelector: args.nodeSelector ?? { "kvm.node.kubernetes.io/enabled": "true" },
              tolerations: args.tolerations ?? [],
              containers: [
                {
                  name: "kvm-device-plugin",
                  image,
                  args: [
                    "--device",
                    `name: kvm\ngroups:\n  - count: ${kvmCount}\n    paths:\n      - path: /dev/kvm`,
                    "--device",
                    `name: vhost-net\ngroups:\n  - paths:\n      - path: /dev/vhost-net`,
                  ],
                  resources: {
                    requests: { cpu: "50m", memory: "10Mi" },
                    limits: { cpu: "50m", memory: "20Mi" },
                  },
                  securityContext: { privileged: true },
                  volumeMounts: [
                    { name: "device-plugin", mountPath: "/var/lib/kubelet/device-plugins" },
                    { name: "dev", mountPath: "/dev" },
                  ],
                },
              ],
              volumes: [
                {
                  name: "device-plugin",
                  hostPath: { path: "/var/lib/kubelet/device-plugins" },
                },
                {
                  name: "dev",
                  hostPath: { path: "/dev" },
                },
              ],
            },
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({ daemonSet: this.daemonSet });
  }
}
