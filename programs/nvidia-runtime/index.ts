import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { NvidiaDevicePlugin } from "../../src/components/nvidia-device-plugin";

const config = new pulumi.Config();

interface DevicePluginConfig {
  tolerations?: Array<{
    key?: string;
    operator?: string;
    value?: string;
    effect?: string;
  }>;
  nodeSelector?: Record<string, string>;
}

const devicePluginConfig = config.requireObject<DevicePluginConfig>("device-plugin");

const namespace = new k8s.core.v1.Namespace("nvidia-runtime", {
  metadata: {
    name: "nvidia-runtime",
  },
});

new NvidiaDevicePlugin("nvidia-device-plugin", {
  namespace: namespace.metadata.name,
  tolerations: devicePluginConfig.tolerations,
  nodeSelector: devicePluginConfig.nodeSelector,
}, {
  dependsOn: [namespace],
});

export const nvidiaRuntimeNamespace = namespace.metadata.name;
