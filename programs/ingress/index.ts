import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {
  IngressModule,
  LoadBalancerImplementation,
  IngressControllerImplementation,
  GatewayImplementation,
  DnsProviderImplementation,
  ClusterIssuerImplementation
} from "../../src/modules/ingress";
import { CloudflareApiToken, CloudflareTokenUsage } from "../../src/components/cloudflare-account-token";

const config = new pulumi.Config();

const clusterName = config.require("cluster-name");

// Parse structured configuration
const traefikConfig = config.requireObject("traefik");
const gatewayConfig = config.getObject("gateway");
const ipAddressPools = config.requireObject("ipAddressPools");
const l2Advertisements = config.requireObject("l2Advertisements");
const dnsProvidersConfig = config.requireObject("dnsProviders");
const clusterIssuersConfig = config.requireObject("clusterIssuers");
const defaultCertificateConfig = config.requireObject("defaultCertificate");
const whoamiConfig = config.requireObject("whoami");

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
}, {
  dependsOn: [namespace],
});
