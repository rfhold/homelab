import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {
  IngressModule,
  LoadBalancerImplementation,
  IngressControllerImplementation,
  DnsProviderImplementation,
  ClusterIssuerImplementation
} from "../../src/modules/ingress";

const config = new pulumi.Config();

const clusterName = config.require("cluster-name");

// Parse structured configuration
const traefikConfig = config.requireObject("traefik");
const ipAddressPools = config.requireObject("ipAddressPools");
const l2Advertisements = config.requireObject("l2Advertisements");
const dnsProvidersConfig = config.requireObject("dnsProviders");
const clusterIssuersConfig = config.requireObject("clusterIssuers");
const defaultCertificateConfig = config.requireObject("defaultCertificate");
const whoamiConfig = config.requireObject("whoami");

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
      apiToken: config.requireSecret(provider.cloudflare.apiTokenSecret),
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
        apiToken: config.requireSecret(issuer.dns01.cloudflare.apiTokenSecret),
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
