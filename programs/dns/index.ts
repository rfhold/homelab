import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DnsModule, DnsZoneConfig, DnsClusterConfig, DnsClusterSecondaryConfig } from "../../src/modules/dns";

const config = new pulumi.Config();

interface TechnitiumDnsServiceConfig {
  type: string;
  annotations?: { [key: string]: string };
  externalTrafficPolicy?: string;
  ports: {
    dns: number;
    dnsUdp: number;
    webUi: number;
    cluster: number;
  };
}

interface TechnitiumDnsStorageConfig {
  size: string;
  storageClass?: string;
}

interface TechnitiumDnsResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface ClusterSecondaryStackConfig {
  primaryStackName: string;
  nodeIpAddresses: string;
  nodeHostname: string;
  nodePort: number;
  primaryNodeDomain?: string;
  primaryNodeIp?: string;
  primaryNodeMgmtUrl?: string;
  ignoreCertificateErrors?: boolean;
}

const technitiumDnsConfig = config.requireObject<{
  forwarders: string;
  service: TechnitiumDnsServiceConfig;
  storage: TechnitiumDnsStorageConfig;
  resources: TechnitiumDnsResourceConfig;
  nodeSelector?: { [key: string]: string };
  hostAliases?: Array<{ ip: string; hostnames: string[] }>;
}>("technitiumDns");

const zones = config.getObject<DnsZoneConfig[]>("zones") ?? [];
const blocklists = config.getObject<string[]>("blocklists") ?? [];
const dnssecValidation = config.getBoolean("dnssecValidation");
const dnsServerDomain = config.get("dnsServerDomain");
const clusterConfig = config.getObject<DnsClusterConfig>("cluster");
const clusterSecondaryStackConfig = config.getObject<ClusterSecondaryStackConfig>("clusterSecondary");
const notifyAllowedNetworks = config.getObject<string[]>("notifyAllowedNetworks");
const configAdminPassword = config.getSecret("adminPassword");

let clusterSecondaryConfig: DnsClusterSecondaryConfig | undefined;
let clusterAdminPassword: pulumi.Output<string> | undefined;

if (configAdminPassword) {
  clusterAdminPassword = configAdminPassword;
}

if (clusterSecondaryStackConfig) {
  const primaryStack = new pulumi.StackReference(clusterSecondaryStackConfig.primaryStackName);
  const primaryStackUrl = primaryStack.requireOutput("clusterPrimaryUrl") as pulumi.Output<string>;
  const primaryNodePassword = primaryStack.requireOutput("technitiumAdminPassword") as pulumi.Output<string>;
  const primaryNodeUrl = clusterSecondaryStackConfig.primaryNodeDomain
    ? pulumi.output(`https://${clusterSecondaryStackConfig.primaryNodeDomain}:53443/`)
    : primaryStackUrl;
  const primaryNodeIpAddress = clusterSecondaryStackConfig.primaryNodeIp
    ? pulumi.output(clusterSecondaryStackConfig.primaryNodeIp)
    : primaryStackUrl.apply(url => {
        const match = url.match(/https?:\/\/([^/:]+)/);
        return match ? match[1] : url;
      });

  const primaryNodeMgmtUrl = clusterSecondaryStackConfig.primaryNodeMgmtUrl
    ? pulumi.output(clusterSecondaryStackConfig.primaryNodeMgmtUrl)
    : primaryNodeIpAddress.apply(ip => `http://${ip}:5380`);

  if (!clusterAdminPassword) {
    clusterAdminPassword = primaryNodePassword;
  }
  clusterSecondaryConfig = {
    nodeIpAddresses: clusterSecondaryStackConfig.nodeIpAddresses,
    nodeHostname: clusterSecondaryStackConfig.nodeHostname,
    nodePort: clusterSecondaryStackConfig.nodePort,
    primaryNodeUrl,
    primaryNodeMgmtUrl,
    primaryNodeIpAddress,
    primaryNodePassword,
    ignoreCertificateErrors: clusterSecondaryStackConfig.ignoreCertificateErrors,
  };
}

const namespaceName = "dns";
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const dns = new DnsModule("dns", {
  namespace: namespaceName,
  workloadLabels: workloadLabels["dns"],

  technitiumDns: {
    forwarders: technitiumDnsConfig.forwarders,
    service: technitiumDnsConfig.service,
    storage: technitiumDnsConfig.storage,
    resources: technitiumDnsConfig.resources,
    nodeSelector: technitiumDnsConfig.nodeSelector,
    hostAliases: technitiumDnsConfig.hostAliases,
    adminPassword: clusterAdminPassword,
  },
  zones,
  blocklists,
  dnssecValidation,
  dnsServerDomain,
  notifyAllowedNetworks,
  cluster: clusterConfig,
  clusterSecondary: clusterSecondaryConfig,
}, {
  dependsOn: [namespace],
});

export const tsigSecretName = dns.getTsigSecretName();
export const tsigSecretNamespace = namespaceName;
export const tsigKeyValue = pulumi.secret(dns.getTsigKeyValue());
export const tsigKeyname = "external-dns";
export const clusterPrimaryUrl = dns.clusterPrimaryUrl;
export const technitiumAdminPassword = pulumi.secret(
  dns.technitiumDns.getConnectionConfig().adminPassword,
);
