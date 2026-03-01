import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { Tekton, ClusterProviderConfig } from "../../src/components/tekton";
import { KvmDevicePlugin } from "../../src/components/kvm-device-plugin";

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

const dashboardIngress = config.requireObject<IngressConfig>("dashboardIngress");
const pacIngress = config.requireObject<IngressConfig>("pacIngress");
const gitConfig = config.requireObject<GitConfig>("git");
const gitToken = config.requireSecret("gitToken");
const globalParams = config.getObject<GlobalParamsConfig>("globalParams");
const androidKeystoreJks = config.getSecret("androidKeystore.jks");
const androidKeystorePassword = config.getSecret("androidKeystore.password");
const androidKeystoreAlias = config.get("androidKeystore.alias");

const clusterNames = config.getObject<string[]>("clusters") ?? [];

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
  },
  clusters: clusterProviders,
});

new KvmDevicePlugin("kvm-device-plugin", {
  namespace: "kube-system",
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
export const clusterKubeconfig = tekton.kubeconfigSecret;
