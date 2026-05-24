import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import * as path from "path";
import * as grafanaProvider from "@pulumiverse/grafana";
import { GrafanaStack, ObjectStorageImplementation } from "../../src/modules/grafana-stack";

const config = new pulumi.Config("grafana");

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

interface DatabaseConfig {
  instances?: number;
  storage: {
    size?: string;
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

interface ObjectStorageConfig {
  cluster: string;
  storageClassName: string;
  endpoint: string;
  userNamespace?: string;
}

interface TolerationConfig {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

interface AlloyConfig {
  enabled: boolean;
  hostname: string;
  clusterIssuer: string;
  serviceAnnotations?: { [key: string]: string };
  faroHostname?: string;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
}

interface ImageRendererConfig {
  enabled: boolean;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  env?: Record<string, string>;
}

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const databaseConfig = config.requireObject<DatabaseConfig>("database");
const objectStorageConfig = config.requireObject<ObjectStorageConfig>("objectStorage");
const alloyConfig = config.getObject<AlloyConfig>("alloy");
const tolerations = config.getObject<TolerationConfig[]>("tolerations");
const imageRendererConfig = config.getObject<ImageRendererConfig>("imageRenderer");
const adminUser = config.get("adminUser") || "admin";
const grafanaReplicas = config.getNumber("replicas") ?? 2;
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const loadRules = (baseDir: string): Record<string, Record<string, string>> => {
  const rules: Record<string, Record<string, string>> = {};

  const alertsDir = path.join(baseDir, "alerts");
  const recordingRulesDir = path.join(baseDir, "recording-rules");

  if (fs.existsSync(alertsDir)) {
    const files = fs.readdirSync(alertsDir);
    for (const file of files) {
      if (file.endsWith(".yaml")) {
        const groupName = file.replace(".yaml", "");
        const content = fs.readFileSync(path.join(alertsDir, file), "utf-8");
        if (!rules["alerts"]) rules["alerts"] = {};
        rules["alerts"][groupName] = content;
      }
    }
  }

  if (fs.existsSync(recordingRulesDir)) {
    const files = fs.readdirSync(recordingRulesDir);
    for (const file of files) {
      if (file.endsWith(".yaml")) {
        const groupName = file.replace(".yaml", "");
        const content = fs.readFileSync(path.join(recordingRulesDir, file), "utf-8");
        if (!rules["recording-rules"]) rules["recording-rules"] = {};
        rules["recording-rules"][groupName] = content;
      }
    }
  }

  return rules;
};

const mimirRules = loadRules(__dirname);

const grafanaNamespace = new k8s.core.v1.Namespace("grafana", {
  metadata: {
    name: "grafana",
  },
});

const lokiNamespace = new k8s.core.v1.Namespace("loki", {
  metadata: {
    name: "loki",
  },
});

const mimirNamespace = new k8s.core.v1.Namespace("mimir", {
  metadata: {
    name: "mimir",
  },
});

const alloyNamespace = new k8s.core.v1.Namespace("alloy", {
  metadata: {
    name: "alloy",
  },
});

const tempoNamespace = new k8s.core.v1.Namespace("tempo", {
  metadata: {
    name: "tempo",
  },
});

const pyroscopeNamespace = new k8s.core.v1.Namespace("pyroscope", {
  metadata: {
    name: "pyroscope",
  },
});

const grafanaStack = new GrafanaStack("grafana-stack", {
  workloadLabels: workloadLabels["grafana-stack"],
  namespaces: {
    grafana: grafanaNamespace.metadata.name,
    mimir: mimirNamespace.metadata.name,
    loki: lokiNamespace.metadata.name,
    alloy: alloyNamespace.metadata.name,
    tempo: tempoNamespace.metadata.name,
    pyroscope: pyroscopeNamespace.metadata.name,
  },
  objectStorage: {
    implementation: ObjectStorageImplementation.CEPH,
    cluster: objectStorageConfig.cluster,
    storageClassName: objectStorageConfig.storageClassName,
    endpoint: objectStorageConfig.endpoint,
    userNamespace: objectStorageConfig.userNamespace,
  },
  database: {
    instances: databaseConfig.instances ?? 3,
    storage: {
      size: databaseConfig.storage.size ?? "10Gi",
      storageClass: databaseConfig.storage.storageClass,
    },
    resources: databaseConfig.resources,
  },
  grafana: {
    adminUsername: adminUser,
    replicas: grafanaReplicas,
    headlessService: true,
    alertingHa: {
      enabled: true,
    },
    ingress: {
      enabled: ingressConfig.enabled,
      className: ingressConfig.className,
      hostname: ingressConfig.host,
      annotations: ingressConfig.annotations,
      tls: ingressConfig.tls ? {
        secretName: ingressConfig.tls.secretName,
      } : undefined,
    },
    memoryRequest: resourceConfig.requests.memory,
    cpuRequest: resourceConfig.requests.cpu,
    memoryLimit: resourceConfig.limits.memory,
    cpuLimit: resourceConfig.limits.cpu,
    ...(imageRendererConfig && { imageRenderer: imageRendererConfig }),
  },
  mimir: {
    rules: Object.keys(mimirRules).length > 0 ? mimirRules : undefined,
  },
  loki: {},
  tempo: {},
  pyroscope: {},
  ...(alloyConfig?.enabled && {
    alloy: {
      service: {
        type: "LoadBalancer" as const,
        annotations: alloyConfig.serviceAnnotations || {},
      },
      certificate: {
        enabled: true,
        hostname: alloyConfig.hostname,
        issuerRef: alloyConfig.clusterIssuer,
      },
      ...(alloyConfig.faroHostname && { httpRoute: { hostname: alloyConfig.faroHostname } }),
      ...(alloyConfig.resources && { resources: alloyConfig.resources }),
    },
  }),
  ...(tolerations && { tolerations }),
}, {
  dependsOn: [grafanaNamespace],
});

const provider = grafanaStack.getGrafanaProvider();

const forgejoAccessTokenStash = new pulumi.Stash("grafana-git-sync-forgejo-token", {
  input: pulumi.secret(process.env.FORGEJO_ACCESS_TOKEN ?? ""),
});

new grafanaProvider.apps.v0alpha1.ProvisioningRepository("grafana-git-sync-homelab", {
  metadata: {
    uid: "homelab-grafana",
  },
  spec: {
    title: "Homelab Grafana",
    description: "Grafana dashboards from the homelab repository",
    type: "git",
    workflows: ["write"],
    sync: {
      enabled: true,
      target: "folder",
      intervalSeconds: 60,
    },
    git: {
      url: "https://git.holdenitdown.net/rfhold/homelab.git",
      branch: "main",
      path: "grafana/",
      tokenUser: "git",
    },
  },
  secure: {
    token: {
      create: forgejoAccessTokenStash.output.apply(v => String(v)),
    },
  },
  secureVersion: 1,
}, { provider, dependsOn: [grafanaStack.grafana] });

export const grafanaNamespaceName = grafanaNamespace.metadata.name;
export const lokiNamespaceName = lokiNamespace.metadata.name;
export const mimirNamespaceName = mimirNamespace.metadata.name;
export const alloyNamespaceName = alloyNamespace.metadata.name;
export const grafanaServiceUrl = grafanaStack.getGrafanaServiceUrl();
export const grafanaAdminPassword = grafanaStack.getGrafanaAdminPassword();
export const grafanaAdminUser = adminUser;
export const mimirQueryFrontendUrl = grafanaStack.getMimirQueryFrontendUrl();
export const lokiGatewayUrl = grafanaStack.getLokiGatewayUrl();
export const alloyOtlpGrpcEndpoint = grafanaStack.getAlloyOtlpGrpcEndpoint();
export const alloyOtlpHttpEndpoint = grafanaStack.getAlloyOtlpHttpEndpoint();
export const alloyLokiPushEndpoint = grafanaStack.getAlloyLokiPushEndpoint();
export const alloyPrometheusRemoteWriteEndpoint = grafanaStack.getAlloyPrometheusRemoteWriteEndpoint();
export const alloyFaroEndpoint = grafanaStack.getAlloyFaroCollectEndpoint();
export const alloyProfilingEndpoint = grafanaStack.getAlloyProfilingEndpoint();
export const tempoNamespaceName = tempoNamespace.metadata.name;
export const tempoQueryFrontendUrl = grafanaStack.getTempoQueryFrontendUrl();
export const pyroscopeNamespaceName = pyroscopeNamespace.metadata.name;
export const pyroscopeReadUrl = grafanaStack.getPyroscopeReadUrl();
export const pyroscopeWriteUrl = grafanaStack.getPyroscopeWriteUrl();
