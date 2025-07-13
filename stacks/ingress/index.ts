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

const namespace = new k8s.core.v1.Namespace("ingress", {
  metadata: {
    name: "ingress",
  },
});

new IngressModule("cluster-ingress", {
  namespace: "ingress",
  loadBalancer: LoadBalancerImplementation.METAL_LB,
  ingressController: IngressControllerImplementation.TRAEFIK,

  ipAddressPools: [
    {
      name: "private-pool",
      addresses: ["172.16.4.51-172.16.4.60"],
    },
    {
      name: "nvr-pool",
      addresses: ["172.16.5.51-172.16.5.60"],
    },
    {
      name: "ap-pool",
      addresses: ["192.168.100.51-192.168.100.60"],
    },
  ],

  // Configure L2 advertisements for VLAN support
  // Each pool can be advertised on specific VLAN interfaces
  l2Advertisements: [
    {
      name: "private-l2-adv",
      ipAddressPools: ["private-pool"],
      nodeSelectors: [
        {
          matchLabels: {
            "rholden.dev/vlan-access": "4",
          }
        }
      ]
    },
    {
      name: "nvr-l2-adv",
      ipAddressPools: ["nvr-pool"],
      nodeSelectors: [
        {
          matchLabels: {
            "rholden.dev/vlan-access": "5",
          }
        }
      ]
    },
    {
      name: "ap-l2-adv",
      ipAddressPools: ["ap-pool"],
      // Optional: Limit to specific nodes if needed
      nodeSelectors: [
        {
          matchLabels: {
            "rholden.dev/vlan-access": "100",
          }
        }
      ]
    },
  ],

  traefik: {
    serviceType: "LoadBalancer",
    loadBalancerIP: "172.16.4.60",
    enableDashboard: true,
    ingressClass: {
      name: "internal",
      isDefaultClass: true,
    },
  },

  dns: {
    txtOwnerId: clusterName,
    providers: [
      {
        provider: DnsProviderImplementation.CLOUDFLARE,
        domainFilters: ["rholden.dev", "*.rholden.dev", "rholden.me", "*.rholden.me"],
        cloudflare: {
          apiToken: config.requireSecret("cloudflare-api-token"),
        },
      },
      {
        provider: DnsProviderImplementation.ADGUARD,
        domainFilters: ["holdenitdown.net", "*.holdenitdown.net"],
        adguard: {
          url: "http://172.16.3.100:3000",
          username: config.require("adguard-username"),
          password: config.requireSecret("adguard-password"),
          setImportantFlag: true,
          dryRun: false,
          logLevel: "info",
        },
      },
      //   {
      //     provider: DnsProviderImplementation.ROUTEROS,
      //     domainFilters: ["rholden.dev", "*.rholden.dev", "rholden.me", "*.rholden.me"],
      //     routeros: {
      //       address: "192.168.1.1:8728",
      //       username: config.requireSecret("routeros-username"),
      //       password: config.requireSecret("routeros-password"),
      //       logLevel: "info",
      //     },
      //   },
    ],
  },

  certManager: {
    installCRDs: true,
  },

  clusterIssuers: [
    {
      name: "letsencrypt-prod",
      implementation: ClusterIssuerImplementation.LETSENCRYPT_PROD,
      email: config.require("letsencrypt-email"),
      dns01: {
        cloudflare: {
          apiToken: config.requireSecret("cloudflare-api-token"),
        },
      },
    },
    {
      name: "letsencrypt-staging",
      implementation: ClusterIssuerImplementation.LETSENCRYPT_STAGING,
      email: config.require("letsencrypt-email"),
      dns01: {
        cloudflare: {
          apiToken: config.requireSecret("cloudflare-api-token"),
        },
      },
    },
  ],

  defaultCertificate: {
    name: "default-certificate",
    secretName: "default-tls-secret",
    dnsNames: [
      "*.rholden.dev",
      "rholden.dev",
      "*.rholden.me",
      "rholden.me",
      "*.holdenitdown.net",
      "holdenitdown.net"
    ],
    issuerRef: "letsencrypt-prod",
  },

  whoami: {
    enabled: true,
    name: "whoami",
    ingress: {
      enabled: true,
      hostname: "whoami.holdenitdown.net",
    },
  },
}, {
  dependsOn: [namespace],
});
