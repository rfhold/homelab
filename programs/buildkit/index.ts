import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { BuildKit } from "../../src/components/buildkit";

const config = new pulumi.Config("buildkit");

interface BuilderConfig {
  nodeSelector: { [key: string]: string };
  tolerations?: {
    key: string;
    operator: string;
    value?: string;
    effect: string;
  }[];
  storage: {
    size: string;
    storageClass: string;
  };
  resources?: {
    requests?: {
      memory?: string;
      cpu?: string;
    };
    limits?: {
      memory?: string;
      cpu?: string;
    };
  };
}

const amd64Config = config.requireObject<BuilderConfig>("amd64");
const arm64Config = config.requireObject<BuilderConfig>("arm64");

const namespace = new k8s.core.v1.Namespace("buildkit", {
  metadata: {
    name: "buildkit",
  },
});

const amd64Builder = new BuildKit("buildkit-amd64", {
  namespace: namespace.metadata.name,
  platform: "linux/amd64",
  nodeSelector: amd64Config.nodeSelector,
  tolerations: amd64Config.tolerations,
  storage: amd64Config.storage,
  resources: amd64Config.resources,
}, {
  dependsOn: [namespace],
});

const arm64Builder = new BuildKit("buildkit-arm64", {
  namespace: namespace.metadata.name,
  platform: "linux/arm64",
  nodeSelector: arm64Config.nodeSelector,
  tolerations: arm64Config.tolerations,
  storage: arm64Config.storage,
  resources: arm64Config.resources,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const amd64Host = amd64Builder.getHost();
export const arm64Host = arm64Builder.getHost();
export const hosts = {
  amd64: amd64Host,
  arm64: arm64Host,
};
