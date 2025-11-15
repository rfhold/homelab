import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as cloudflare from "@pulumi/cloudflare";
import {
  IngressModule,
  LoadBalancerImplementation,
  IngressControllerImplementation,
  GatewayImplementation,
  DnsProviderImplementation,
  ClusterIssuerImplementation,
  CloudflareTunnelRoute
} from "../../src/modules/ingress";
import { CloudflareApiToken, CloudflareTokenUsage } from "../../src/components/cloudflare-account-token";

const config = new pulumi.Config();

const clusterName = config.require("cluster-name");
const cloudflareConfig = config.getObject("cloudflare");

// Parse structured configuration
const traefikConfig = config.requireObject("traefik");
const gatewayConfig = config.getObject("gateway");
const ipAddressPools = config.requireObject("ipAddressPools");
const l2Advertisements = config.requireObject("l2Advertisements");
const dnsProvidersConfig = config.requireObject("dnsProviders");
const clusterIssuersConfig = config.requireObject("clusterIssuers");
const defaultCertificateConfig = config.requireObject("defaultCertificate");
const whoamiConfig = config.requireObject("whoami");
const cloudflareTunnelConfig = config.getObject("cloudflareTunnel");

// Parse DNS providers configuration to determine which zones are managed by Cloudflare
const cloudflareProvider = (dnsProvidersConfig as any[]).find(provider => provider.provider === "cloudflare");
const cloudflareZones = cloudflareProvider ?
  cloudflareProvider.domainFilters.filter((domain: string) => !domain.startsWith("*")) :
  [];

// Create Cloudflare DNS token for ingress operations (only for zones managed by Cloudflare)
const cloudflareToken = new CloudflareApiToken("ingress-dns", {
  usage: CloudflareTokenUsage.DNS,
  zones: cloudflareZones,
  name: "Ingress DNS Management Token",
});

// Transform DNS providers configuration
const dnsProviders = (dnsProvidersConfig as any[]).map((provider: any) => {
  if (!Object.values(DnsProviderImplementation).includes(provider.provider as DnsProviderImplementation)) {
    throw new Error(`Unsupported DNS provider: ${provider.provider}. Supported providers: ${Object.values(DnsProviderImplementation).join(", ")}`);
  }

  const result: any = {
    provider: provider.provider as DnsProviderImplementation,
    domainFilters: provider.domainFilters,
  };

  if (provider.provider === "cloudflare") {
    result.cloudflare = {
      apiToken: cloudflareToken.value,
    };
  } else if (provider.provider === "adguard") {
    result.adguard = {
      url: provider.adguard.url,
      username: config.require(provider.adguard.usernameConfig),
      password: config.requireSecret(provider.adguard.passwordSecret),
      setImportantFlag: provider.adguard.setImportantFlag,
      dryRun: provider.adguard.dryRun,
      logLevel: provider.adguard.logLevel,
    };
  }

  return result;
});

// Transform cluster issuers configuration
const clusterIssuers = (clusterIssuersConfig as any[]).map((issuer: any) => {
  if (!Object.values(ClusterIssuerImplementation).includes(issuer.implementation as ClusterIssuerImplementation)) {
    throw new Error(`Unsupported cluster issuer implementation: ${issuer.implementation}. Supported implementations: ${Object.values(ClusterIssuerImplementation).join(", ")}`);
  }

  return {
    name: issuer.name,
    implementation: issuer.implementation as ClusterIssuerImplementation,
    email: config.require(issuer.emailConfig),
    dns01: {
      cloudflare: {
        apiToken: cloudflareToken.value,
      },
    },
  };
});

const namespace = new k8s.core.v1.Namespace("ingress", {
  metadata: {
    name: "ingress",
  },
});

const cloudflareZoneIds: Record<string, pulumi.Input<string | undefined>> = {};
let cloudflareAccountId: pulumi.Input<string> | undefined;
if (cloudflareConfig && (cloudflareConfig as any).zones) {
  const zones = (cloudflareConfig as any).zones as string[];
  zones.forEach(zoneName => {
    const zone = cloudflare.getZoneOutput({
      filter: {
        name: zoneName,
      },
    });
    cloudflareZoneIds[zoneName] = zone.zoneId;
    if (!cloudflareAccountId) {
      cloudflareAccountId = zone.account.apply(account => account.id);
    }
  });
}

new IngressModule("cluster-ingress", {
  namespace: "ingress",
  loadBalancer: LoadBalancerImplementation.METAL_LB,
  ingressController: IngressControllerImplementation.TRAEFIK,

  ipAddressPools: ipAddressPools as any,
  l2Advertisements: l2Advertisements as any,

  traefik: traefikConfig as any,

  gateway: gatewayConfig ? {
    implementation: (gatewayConfig as any).implementation as GatewayImplementation,
    kgateway: (gatewayConfig as any).kgateway,
    defaultGateway: (gatewayConfig as any).defaultGateway,
  } : undefined,

  dns: {
    txtOwnerId: clusterName,
    providers: dnsProviders,
  },

  certManager: {
    installCRDs: true,
  },

  clusterIssuers: clusterIssuers,

  defaultCertificate: defaultCertificateConfig as any,

  whoami: whoamiConfig as any,

  cloudflareTunnel: cloudflareTunnelConfig ? {
    enabled: (cloudflareTunnelConfig as any).enabled,
    cloudflareAccountId: (cloudflareTunnelConfig as any).cloudflareAccountId || cloudflareAccountId!,
    tunnelName: (cloudflareTunnelConfig as any).tunnelName,
    routes: (cloudflareTunnelConfig as any).routes as CloudflareTunnelRoute[],
    zoneIds: (cloudflareZoneIds as any),
    replicas: (cloudflareTunnelConfig as any).replicas,
    resources: (cloudflareTunnelConfig as any).resources,
    enableMetrics: (cloudflareTunnelConfig as any).enableMetrics,
  } : undefined,
}, {
  dependsOn: [namespace],
});
