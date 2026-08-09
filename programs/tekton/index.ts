import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as grafana from "@pulumiverse/grafana";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { Tekton, ClusterProviderConfig } from "../../src/components/tekton";
import { KvmDevicePlugin } from "../../src/components/kvm-device-plugin";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config("tekton");

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

interface GitConfig {
  host: string;
  repositories?: string[];
}

interface GlobalParamsConfig {
  buildkitAmd64Addr: string;
  buildkitArm64Addr: string;
  containerRegistry: string;
  gitUrl: string;
}

interface AndroidKeystoreConfig {
  jks: string;
  password: string;
  alias: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const dashboardIngress = config.requireObject<IngressConfig>("dashboardIngress");
const pacIngress = config.requireObject<IngressConfig>("pacIngress");
const gitConfig = config.requireObject<GitConfig>("git");
const gitToken = config.requireSecret("gitToken");
const globalParams = config.getObject<GlobalParamsConfig>("globalParams");
const androidKeystoreJks = config.getSecret("androidKeystore.jks");
const androidKeystorePassword = config.getSecret("androidKeystore.password");
const androidKeystoreAlias = config.get("androidKeystore.alias");

const clusterNames = config.getObject<string[]>("clusters") ?? [];
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const organization = pulumi.getOrganization();
const grafanaStack = {
  organization,
  project: "grafana",
  stack: config.require("grafanaStack"),
};
const grafanaApiUrl = getStackOutput<string>(grafanaStack, "grafanaApiUrl");
const grafanaProvider = new grafana.Provider("tekton-grafana", {
  url: grafanaApiUrl,
  auth: pulumi.interpolate`${getStackOutput<string>(grafanaStack, "grafanaAdminUser")}:${getStackOutput<string>(grafanaStack, "grafanaAdminPassword")}`,
});
const grafanaServiceAccount = new grafana.oss.ServiceAccount("tekton-pipelines-service-account", {
  name: "tekton-pipelines",
  role: "Admin",
}, { provider: grafanaProvider });
const grafanaServiceAccountToken = new grafana.oss.ServiceAccountToken("tekton-pipelines-token", {
  name: "tekton-pipelines",
  serviceAccountId: grafanaServiceAccount.id,
}, { provider: grafanaProvider });
const objectStores = getStackOutput(
  { organization, project: "object-storage", stack: "romulus" },
  "objectStores"
);
const pulumiS3Creds = objectStores.apply((stores: any) => ({
  accessKeyId: stores["default"].users["tekton-ci"].accessKey as string,
  secretAccessKey: stores["default"].users["tekton-ci"].secretKey as string,
}));

interface KubeconfigCluster {
  name: string;
  cluster: { server: string; "certificate-authority-data"?: string };
}

interface KubeconfigContext {
  name: string;
  context: { cluster: string; user: string };
}

interface KubeconfigFile {
  clusters: KubeconfigCluster[];
  contexts: KubeconfigContext[];
}

function loadClusterMetadata(contextName: string): { server: string; caData: string } {
  const kubeconfigPath = process.env.KUBECONFIG || path.join(process.env.HOME!, ".kube", "config");
  const kubeconfigContent = fs.readFileSync(kubeconfigPath, "utf-8");
  const kubeconfig: KubeconfigFile = yaml.parse(kubeconfigContent);

  const ctx = kubeconfig.contexts.find(c => c.name === contextName);
  if (!ctx) throw new Error(`Context '${contextName}' not found in kubeconfig`);

  const cluster = kubeconfig.clusters.find(c => c.name === ctx.context.cluster);
  if (!cluster) throw new Error(`Cluster '${ctx.context.cluster}' not found in kubeconfig`);

  return {
    server: cluster.cluster.server,
    caData: cluster.cluster["certificate-authority-data"] ?? "",
  };
}

const clusterProviders: ClusterProviderConfig[] = clusterNames.map(name => {
  const metadata = loadClusterMetadata(name);
  return {
    name,
    provider: new k8s.Provider(`tekton-cluster-${name}`, {
      context: name,
    }),
    server: metadata.server,
    caData: metadata.caData,
  };
});

const tekton = new Tekton("tekton", {
  workloadLabels: workloadLabels["tekton"],
  dashboard: {
    ingress: dashboardIngress,
  },
  pac: {
    ingress: pacIngress,
    git: {
      host: gitConfig.host,
      token: gitToken,
      repositories: gitConfig.repositories,
    },
    globalParams: globalParams,
    androidKeystore: androidKeystoreJks && androidKeystorePassword && androidKeystoreAlias ? {
      jks: androidKeystoreJks,
      password: androidKeystorePassword,
      alias: androidKeystoreAlias,
    } : undefined,
    pulumiCredentials: {
      passphrase: pulumi.secret(requireEnv("PULUMI_CONFIG_PASSPHRASE")),
      backendUrl: requireEnv("PULUMI_BACKEND_URL"),
      accessKeyId: pulumiS3Creds.accessKeyId,
      secretAccessKey: pulumiS3Creds.secretAccessKey,
    },
    authentikCredentials: {
      url: requireEnv("AUTHENTIK_URL"),
      token: pulumi.secret(requireEnv("AUTHENTIK_TOKEN")),
    },
    grafanaCredentials: {
      url: grafanaApiUrl,
      token: pulumi.secret(grafanaServiceAccountToken.key),
    },
  },
  clusters: clusterProviders,
});

new KvmDevicePlugin("kvm-device-plugin", {
  namespace: "kube-system",
  workloadLabels: workloadLabels["kvm-device-plugin"],
  nodeSelector: { "kvm.node.kubernetes.io/enabled": "true" },
  tolerations: [
    {
      key: "workload-type",
      operator: "Equal",
      value: "gpu-inference",
      effect: "NoSchedule",
    },
  ],
});

export const dashboardUrl = tekton.dashboardUrl;
export const pacWebhookUrl = tekton.pacWebhookUrl;
export const pacWebhookSecret = tekton.pacWebhookSecret;
export const pacIncomingSecret = tekton.pacIncomingSecret;
export const clusterKubeconfig = tekton.kubeconfigSecret;
