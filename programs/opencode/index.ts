import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { OpenCode } from "../../src/components/opencode";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config("opencode");

interface IngressConfig {
  enabled: boolean;
  className: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName: string;
  };
}

interface ResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface StorageConfig {
  size: string;
  storageClass: string;
}

interface NodeConfig {
  selector?: { [key: string]: string };
  tolerations?: {
    key: string;
    operator: string;
    value?: string;
    effect: string;
  }[];
}

interface SshConfig {
  enabled: boolean;
  port?: number;
  annotations?: { [key: string]: string };
}

interface DockerConfig {
  enabled: boolean;
  image?: string;
}

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const opencodeStorageConfig = config.requireObject<StorageConfig>("opencodeStorage");
const reposStorageConfig = config.requireObject<StorageConfig>("reposStorage");
const nodeConfig = config.getObject<NodeConfig>("node");
const sshConfig = config.getObject<SshConfig>("ssh");
const dockerConfig = config.getObject<DockerConfig>("docker");
const replicas = config.getNumber("replicas") || 1;

const stackRefConfig = {
  organization: pulumi.getOrganization(),
  project: pulumi.getProject(),
  stack: pulumi.getStack(),
};

function getSecretWithFallback(envVar: string, outputName: string): pulumi.Output<string> {
  const envValue = process.env[envVar];
  if (envValue) {
    return pulumi.secret(envValue);
  }
  
  return getStackOutput<string>(stackRefConfig, outputName).apply(val => {
    if (!val) {
      throw new Error(`${envVar} environment variable not set and no previous value found in stack outputs. Please set ${envVar} for the first run.`);
    }
    return pulumi.secret(val);
  });
}

const serverPasswordSecret = getSecretWithFallback("OPENCODE_SERVER_PASSWORD", "serverPassword");
const sshPublicKeySecret = getSecretWithFallback("SSH_PUBLIC_KEY", "sshPublicKey");
const sshPrivateKeyB64Secret = getSecretWithFallback("SSH_PRIVATE_KEY_B64", "sshPrivateKeyB64");
const sshPrivateKeySecret = sshPrivateKeyB64Secret.apply(b64 => Buffer.from(b64, "base64").toString("utf-8"));

const namespace = new k8s.core.v1.Namespace("opencode", {
  metadata: {
    name: "opencode",
  },
});

const opencode = new OpenCode("opencode", {
  namespace: namespace.metadata.name,

  secrets: {
    serverPassword: serverPasswordSecret,
    sshPublicKey: sshPublicKeySecret,
    sshPrivateKey: sshPrivateKeySecret,
  },

  storage: {
    opencode: {
      size: opencodeStorageConfig.size,
      storageClass: opencodeStorageConfig.storageClass,
    },
    repos: {
      size: reposStorageConfig.size,
      storageClass: reposStorageConfig.storageClass,
    },
  },

  ingress: {
    enabled: ingressConfig.enabled,
    className: ingressConfig.className,
    host: ingressConfig.host,
    annotations: ingressConfig.annotations,
    tls: ingressConfig.tls ? {
      enabled: ingressConfig.tls.enabled,
      secretName: ingressConfig.tls.secretName,
    } : undefined,
  },

  ssh: sshConfig ? {
    enabled: sshConfig.enabled,
    port: sshConfig.port,
    annotations: sshConfig.annotations,
  } : undefined,

  docker: dockerConfig ? {
    enabled: dockerConfig.enabled,
    image: dockerConfig.image,
  } : undefined,

  resources: {
    requests: {
      memory: resourceConfig.requests.memory,
      cpu: resourceConfig.requests.cpu,
    },
    limits: {
      memory: resourceConfig.limits.memory,
      cpu: resourceConfig.limits.cpu,
    },
  },

  user: {
    name: "rfhold",
    uid: 1000,
    gid: 1000,
  },

  nodeSelector: nodeConfig?.selector,
  tolerations: nodeConfig?.tolerations,

  replicas,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const opencodeUrl = opencode.getUrl();
export const serviceUrl = opencode.getServiceUrl();
export const serverPassword = serverPasswordSecret;
export const sshPublicKey = sshPublicKeySecret;
export const sshPrivateKeyB64 = sshPrivateKeyB64Secret;
