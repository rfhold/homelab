import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";
import { TechnitiumDns, TechnitiumDnsArgs } from "../components/technitium-dns";
import {
  TechnitiumZone,
  TechnitiumTsigKey,
  TechnitiumZoneOptions,
  TechnitiumBlocklists,
  TechnitiumCluster,
  TechnitiumClusterSecondary,
  TechnitiumCatalogZoneOptions,
  TechnitiumServerSettings,
  UpdateSecurityPolicy,
} from "../providers/technitium";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface DnsZoneConfig {
  name: string;
  type?: "Primary" | "Secondary" | "Forwarder" | "Stub";
}

export interface DnsClusterConfig {
  clusterDomain: string;
  nodeIpAddresses: string;
}

export interface DnsClusterSecondaryConfig {
  nodeIpAddresses: string;
  nodeHostname: string;
  nodePort: number;
  primaryNodeUrl: pulumi.Input<string>;
  primaryNodeMgmtUrl: pulumi.Input<string>;
  primaryNodeIpAddress: pulumi.Input<string>;
  primaryNodePassword: pulumi.Input<string>;
  ignoreCertificateErrors?: boolean;
}

export interface DnsModuleArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  technitiumDns: Omit<TechnitiumDnsArgs, "namespace">;
  zones?: DnsZoneConfig[];
  blocklists?: string[];
  dnssecValidation?: boolean;
  dnsServerDomain?: string;
  notifyAllowedNetworks?: string[];
  cluster?: DnsClusterConfig;
  clusterSecondary?: DnsClusterSecondaryConfig;
}

export class DnsModule extends pulumi.ComponentResource {
  public readonly technitiumDns: TechnitiumDns;
  public readonly tsigSecret: k8s.core.v1.Secret;
  public readonly tsigKeyValue: pulumi.Output<string>;
  public readonly clusterPrimaryUrl?: pulumi.Output<string>;

  constructor(name: string, args: DnsModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Dns", name, args, withWorkloadLabels(opts, args.workloadLabels));

    this.technitiumDns = new TechnitiumDns(`${name}-technitium`, {
      namespace: args.namespace,
      ...args.technitiumDns,
      clusterNodeDomain: args.dnsServerDomain,
    }, { parent: this });

    const connection = this.technitiumDns.getConnectionConfig();

    const tsigKeyBytes = new random.RandomBytes(`${name}-tsig-key`, {
      length: 32,
    }, { parent: this });
    this.tsigKeyValue = tsigKeyBytes.base64;

    this.tsigSecret = new k8s.core.v1.Secret(`${name}-tsig-secret`, {
      metadata: {
        name: `${name}-rfc2136-tsig`,
        namespace: args.namespace,
      },
      type: "Opaque",
      stringData: {
        "tsig-key": tsigKeyBytes.base64,
      },
    }, { parent: this });

    const tsigKey = new TechnitiumTsigKey(`${name}-tsig-key-resource`, {
      serverUrl: connection.webUiUrl,
      adminPassword: connection.adminPassword,
      keyName: "external-dns",
      sharedSecret: tsigKeyBytes.base64,
      algorithm: "hmac-sha256",
    }, { parent: this, dependsOn: [this.technitiumDns.deployment] });

    if (args.blocklists && args.blocklists.length > 0) {
      new TechnitiumBlocklists(`${name}-blocklists`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        urls: args.blocklists,
      }, { parent: this, dependsOn: [this.technitiumDns.deployment] });
    }

    let serverSettingsResource: TechnitiumServerSettings | undefined;

    if (args.dnssecValidation !== undefined || args.dnsServerDomain !== undefined || args.notifyAllowedNetworks !== undefined) {
      serverSettingsResource = new TechnitiumServerSettings(`${name}-server-settings`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        dnssecValidation: args.dnssecValidation ?? false,
        dnsServerDomain: args.dnsServerDomain,
        notifyAllowedNetworks: args.notifyAllowedNetworks,
      }, { parent: this, dependsOn: [this.technitiumDns.deployment] });
    }

    let clusterResource: TechnitiumCluster | undefined;
    let clusterCatalogZone: string | undefined;

    if (args.cluster) {
      clusterCatalogZone = `cluster-catalog.${args.cluster.clusterDomain}`;
      const clusterDeps = [
        this.technitiumDns.deployment,
        ...(serverSettingsResource ? [serverSettingsResource] : []),
      ];
      clusterResource = new TechnitiumCluster(`${name}-cluster`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        clusterDomain: args.cluster.clusterDomain,
        nodeIpAddresses: args.cluster.nodeIpAddresses,
      }, { parent: this, dependsOn: clusterDeps });
      this.clusterPrimaryUrl = clusterResource.primaryNodeUrl;

      new TechnitiumCatalogZoneOptions(`${name}-cluster-catalog-opts`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        zoneName: clusterCatalogZone,
        zoneTransferTsigKeyNames: [clusterCatalogZone],
      }, { parent: this, dependsOn: [clusterResource] });
    }

    if (args.clusterSecondary) {
      const secondaryDeps = [
        this.technitiumDns.deployment,
        ...(serverSettingsResource ? [serverSettingsResource] : []),
      ];
      new TechnitiumClusterSecondary(`${name}-cluster-secondary`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        nodeIpAddresses: args.clusterSecondary.nodeIpAddresses,
        nodeHostname: args.clusterSecondary.nodeHostname,
        nodePort: args.clusterSecondary.nodePort,
        primaryNodeUrl: args.clusterSecondary.primaryNodeUrl,
        primaryNodeMgmtUrl: args.clusterSecondary.primaryNodeMgmtUrl,
        primaryNodeIpAddress: args.clusterSecondary.primaryNodeIpAddress,
        primaryNodeUsername: "admin",
        primaryNodePassword: args.clusterSecondary.primaryNodePassword,
        ignoreCertificateErrors: args.clusterSecondary.ignoreCertificateErrors ?? false,
      }, { parent: this, dependsOn: secondaryDeps });
    }

    const zones = args.zones ?? [];
    const clusterDeps = clusterResource ? [clusterResource] : [];

    zones.forEach(zone => {
      const zoneResource = new TechnitiumZone(`${name}-zone-${zone.name}`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        zoneName: zone.name,
        zoneType: zone.type ?? "Primary",
      }, { parent: this, dependsOn: [this.technitiumDns.deployment, ...clusterDeps] });

      const policies: UpdateSecurityPolicy[] = [
        { tsigKeyName: "external-dns", domain: zone.name, allowedTypes: ["ANY"] },
        { tsigKeyName: "external-dns", domain: `*.${zone.name}`, allowedTypes: ["ANY"] },
      ];

      new TechnitiumZoneOptions(`${name}-zone-opts-${zone.name}`, {
        serverUrl: connection.webUiUrl,
        adminPassword: connection.adminPassword,
        zoneName: zone.name,
        update: "UseSpecifiedNetworkACL",
        updateNetworkACL: ["0.0.0.0/0"],
        updateSecurityPolicies: policies,
        catalog: clusterCatalogZone,
      }, { parent: this, dependsOn: [zoneResource, tsigKey, ...clusterDeps] });
    });

    this.registerOutputs({
      technitiumDns: this.technitiumDns,
      tsigSecret: this.tsigSecret,
      tsigKeyValue: this.tsigKeyValue,
      clusterPrimaryUrl: this.clusterPrimaryUrl,
    });
  }

  getTsigSecretName(): pulumi.Output<string> {
    return this.tsigSecret.metadata.name;
  }

  getTsigKeyValue(): pulumi.Output<string> {
    return this.tsigKeyValue;
  }
}
