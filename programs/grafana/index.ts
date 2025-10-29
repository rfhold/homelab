import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as command from "@pulumi/command";
import * as fs from "fs";
import * as path from "path";
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
}

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const objectStorageConfig = config.requireObject<ObjectStorageConfig>("objectStorage");
const alloyConfig = config.getObject<AlloyConfig>("alloy");
const tolerations = config.getObject<TolerationConfig[]>("tolerations");
const replicas = config.getNumber("replicas") || 1;
const adminUser = config.get("adminUser") || "admin";
const kubernetesMixinVersion = config.get("kubernetesMixinVersion") || "1.3.1";

const updateKubernetesMixin = new command.local.Command("update-kubernetes-mixin", {
  create: `bash ${path.join(__dirname, "update-kubernetes-mixin.sh")} ${kubernetesMixinVersion}`,
  triggers: [kubernetesMixinVersion],
});

const loadDashboards = (dir: string, prefix: string = ""): Record<string, unknown> => {
  const dashboards: Record<string, unknown> = {};

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const dashboardName = file.replace(".json", "");
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        dashboards[prefix + dashboardName] = {
          json: content,
        };
      }
    }
  }

  return dashboards;
};

const dashboards: Record<string, unknown> = {
  ...loadDashboards(path.join(__dirname, "dashboards")),
  ...loadDashboards(path.join(__dirname, "kubernetes-mixin", "dashboards"), "k8s-mixin-"),
};

const loadRules = (baseDir: string, prefix: string = ""): Record<string, Record<string, string>> => {
  const rules: Record<string, Record<string, string>> = {};

  const alertsDir = path.join(baseDir, "alerts");
  const recordingRulesDir = path.join(baseDir, "recording-rules");

  if (fs.existsSync(alertsDir)) {
    const files = fs.readdirSync(alertsDir);
    for (const file of files) {
      if (file.endsWith(".yaml")) {
        const groupName = prefix + file.replace(".yaml", "");
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
        const groupName = prefix + file.replace(".yaml", "");
        const content = fs.readFileSync(path.join(recordingRulesDir, file), "utf-8");
        if (!rules["recording-rules"]) rules["recording-rules"] = {};
        rules["recording-rules"][groupName] = content;
      }
    }
  }

  return rules;
};

const mimirRules: Record<string, Record<string, string>> = {
  alerts: {
    ...loadRules(__dirname)["alerts"],
    ...loadRules(path.join(__dirname, "kubernetes-mixin"), "k8s-mixin-")["alerts"],
  },
  "recording-rules": {
    ...loadRules(__dirname)["recording-rules"],
    ...loadRules(path.join(__dirname, "kubernetes-mixin"), "k8s-mixin-")["recording-rules"],
  },
};

const namespace = new k8s.core.v1.Namespace("monitoring", {
  metadata: {
    name: "monitoring",
  },
});


const grafanaStack = new GrafanaStack("grafana-stack", {
  namespace: namespace.metadata.name,
  objectStorage: {
    implementation: ObjectStorageImplementation.CEPH,
    cluster: objectStorageConfig.cluster,
    storageClassName: objectStorageConfig.storageClassName,
    endpoint: objectStorageConfig.endpoint,
    userNamespace: objectStorageConfig.userNamespace,
  },
  grafana: {
    adminUsername: adminUser,
    dashboards: Object.keys(dashboards).length > 0 ? dashboards : undefined,
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
  },
  mimir: {
    rules: Object.keys(mimirRules).length > 0 ? mimirRules : undefined,
  },
  loki: {},
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
    },
  }),
  ...(tolerations && { tolerations }),
}, {
  dependsOn: [namespace, updateKubernetesMixin],
});

export const namespaceName = namespace.metadata.name;
export const grafanaServiceUrl = grafanaStack.getGrafanaServiceUrl();
export const grafanaAdminPassword = grafanaStack.getGrafanaAdminPassword();
export const grafanaAdminUser = adminUser;
export const mimirQueryFrontendUrl = grafanaStack.getMimirQueryFrontendUrl();
export const lokiGatewayUrl = grafanaStack.getLokiGatewayUrl();
export const alloyOtlpGrpcEndpoint = grafanaStack.getAlloyOtlpGrpcEndpoint();
export const alloyOtlpHttpEndpoint = grafanaStack.getAlloyOtlpHttpEndpoint();
export const alloyLokiPushEndpoint = grafanaStack.getAlloyLokiPushEndpoint();
export const alloyPrometheusRemoteWriteEndpoint = grafanaStack.getAlloyPrometheusRemoteWriteEndpoint();
