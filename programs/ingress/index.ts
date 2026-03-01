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

const dnsStackName = config.get("dns-stack-name") ?? clusterName;
const dnsStack = new pulumi.StackReference(`organization/dns/${dnsStackName}`);
const tsigKeyValue = dnsStack.getOutput("tsigKeyValue");
const tsigKeyname = dnsStack.getOutput("tsigKeyname");

const cloudflareTokenStash = new pulumi.Stash("cloudflare-token", {
  input: pulumi.secret(process.env.CLOUDFLARE_ZONE_ACCOUNT_TOKEN!),
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
        apiToken: cloudflareTokenStash.output.apply(v => String(v)),
      },
    },
  };
});

const namespace = new k8s.core.v1.Namespace("ingress", {
  metadata: {
    name: "ingress",
  },
});

const tsigSecret = new k8s.core.v1.Secret("rfc2136-tsig", {
  metadata: {
    name: "rfc2136-tsig",
    namespace: "ingress",
  },
  type: "Opaque",
  stringData: {
    "tsig-key": tsigKeyValue.apply(v => String(v)),
  },
}, { dependsOn: [namespace] });

const dnsProviders = (dnsProvidersConfig as any[]).map((provider: any) => {
  if (!Object.values(DnsProviderImplementation).includes(provider.provider as DnsProviderImplementation)) {
    throw new Error(`Unsupported DNS provider: ${provider.provider}. Supported providers: ${Object.values(DnsProviderImplementation).join(", ")}`);
  }

  const result: any = {
    provider: provider.provider as DnsProviderImplementation,
    domainFilters: provider.domainFilters,
  };

  if (provider.provider === "rfc2136") {
    result.rfc2136 = {
      host: provider.rfc2136.host,
      zones: provider.rfc2136.zones,
      tsigKeyname: tsigKeyname.apply(v => String(v)),
      tsigSecretRef: {
        secretName: tsigSecret.metadata.name,
        secretKey: "tsig-key",
      },
    };
  }

  return result;
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
  dependsOn: [namespace, tsigSecret],
});
