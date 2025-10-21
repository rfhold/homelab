import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { GiteaActRunner } from "../../src/components/gitea-act-runner";

const config = new pulumi.Config("gitea-actions");

interface RunnerConfig {
  name: string;
  labels: string;
  replicas: number;
}

interface NodeConfig {
  selector: { [key: string]: string };
  tolerations: k8s.types.input.core.v1.Toleration[];
}

interface ResourceConfig {
  actRunner: {
    requests: {
      memory: string;
      cpu: string;
    };
    limits: {
      memory: string;
      cpu: string;
    };
  };
  dind: {
    requests: {
      memory: string;
      cpu: string;
    };
    limits: {
      memory: string;
      cpu: string;
    };
  };
}

interface StorageConfig {
  storageClass?: string;
  runnerDataSize: string;
}

interface GiteaInstanceConfig {
  url: string;
}

const giteaStackRef = config.requireObject<GiteaInstanceConfig>("instance");
const runnerConfig = config.requireObject<RunnerConfig>("runner");
const nodeConfig = config.requireObject<NodeConfig>("node");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const storageConfig = config.requireObject<StorageConfig>("storage");

const runnerToken = config.requireSecret("runner-token");

export const namespaceName = `gitea-actions-${pulumi.getStack()}`;

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const runner = new GiteaActRunner(runnerConfig.name, {
  namespace: namespace.metadata.name,
  giteaUrl: giteaStackRef.url,
  registrationToken: runnerToken,
  runnerName: runnerConfig.name,
  runnerLabels: runnerConfig.labels,
  replicas: runnerConfig.replicas,
  nodeSelector: nodeConfig.selector,
  tolerations: nodeConfig.tolerations,
  dataStorage: {
    size: storageConfig.runnerDataSize,
    storageClass: storageConfig.storageClass,
  },
  resources: {
    actRunner: {
      requests: {
        memory: resourceConfig.actRunner.requests.memory,
        cpu: resourceConfig.actRunner.requests.cpu,
      },
      limits: {
        memory: resourceConfig.actRunner.limits.memory,
        cpu: resourceConfig.actRunner.limits.cpu,
      },
    },
    dind: {
      requests: {
        memory: resourceConfig.dind.requests.memory,
        cpu: resourceConfig.dind.requests.cpu,
      },
      limits: {
        memory: resourceConfig.dind.limits.memory,
        cpu: resourceConfig.dind.limits.cpu,
      },
    },
  },
}, {
  dependsOn: [namespace],
});

export const runnerName = runner.statefulSet.metadata.name;
export const runnerServiceName = runner.service.metadata.name;
export const runnerServiceEndpoint = runner.getServiceEndpoint();
export const runnerReplicas = runnerConfig.replicas;
export const runnerLabels = runnerConfig.labels;
export const nodeSelector = nodeConfig.selector;
