import * as pulumi from "@pulumi/pulumi";
import { MetalLb, IPAddressPool, L2Advertisement, IPAddressPoolConfig, L2AdvertisementConfig } from "../components/metal-lb";
import { Traefik } from "../components/traefik";
import { ExternalDns } from "../components/external-dns";
import { CertManager } from "../components/cert-manager";
import { ClusterIssuer, Dns01SolverConfig } from "../components/cluster-issuer";
import { Certificate } from "../components/certificate";
import { Whoami } from "../components/whoami";
import { ExternalDnsRouterosWebhook } from "../components/external-dns-routeros-webhook";
import { ExternalDnsAdguardWebhook } from "../components/external-dns-adguard-webhook";

/**
 * Available load balancer implementations
 */
export enum LoadBalancerImplementation {
  METAL_LB = "metal-lb",
}

/**
 * Available ingress controller implementations
 */
export enum IngressControllerImplementation {
  TRAEFIK = "traefik",
}

/**
 * Available DNS provider implementations
 */
export enum DnsProviderImplementation {
  CLOUDFLARE = "cloudflare",
  ROUTEROS = "routeros",
  ADGUARD = "adguard",
}

/**
 * Available cluster issuer implementations
 */
export enum ClusterIssuerImplementation {
  LETSENCRYPT_PROD = "letsencrypt-prod",
  LETSENCRYPT_STAGING = "letsencrypt-staging",
}

/**
 * Configuration for a cluster issuer
 */
export interface ClusterIssuerConfig {
  /** The name of the cluster issuer */
  name: pulumi.Input<string>;
  /** The implementation type */
  implementation: ClusterIssuerImplementation;
  /** Email address for ACME registration */
  email: pulumi.Input<string>;
  /** DNS01 solver configuration */
  dns01: Dns01SolverConfig;
}

/**
 * Configuration for a default certificate
 */
export interface DefaultCertificateConfig {
  /** Name of the certificate */
  name: pulumi.Input<string>;
  /** Secret name where the certificate will be stored */
  secretName: pulumi.Input<string>;
  /** List of DNS names for the certificate */
  dnsNames: pulumi.Input<pulumi.Input<string>[]>;
  /** Name of the ClusterIssuer to use for issuing the certificate */
  issuerRef: pulumi.Input<string>;
  /** Duration of the certificate (optional, defaults to 2160h = 90 days) */
  duration?: pulumi.Input<string>;
  /** Renew before expiry (optional, defaults to 360h = 15 days) */
  renewBefore?: pulumi.Input<string>;
}

/**
 * Configuration for the whoami server
 */
export interface WhoamiServerConfig {
  /** Whether to enable the whoami server */
  enabled: pulumi.Input<boolean>;
  /** Name of the whoami deployment */
  name?: pulumi.Input<string>;
  /** Docker image to use for the whoami server */
  image?: pulumi.Input<string>;
  /** Number of replicas */
  replicas?: pulumi.Input<number>;
  /** Ingress configuration */
  ingress?: {
    /** Whether to create an ingress */
    enabled: pulumi.Input<boolean>;
    /** Hostname for the ingress */
    hostname: pulumi.Input<string>;
    /** TLS secret name (optional) */
    tlsSecretName?: pulumi.Input<string>;
    /** Ingress class name (optional) */
    ingressClassName?: pulumi.Input<string>;
    /** Additional annotations */
    annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };
}

/**
 * Configuration for a DNS provider
 */
export interface DnsProviderConfig {
  /** DNS provider implementation to use */
  provider: DnsProviderImplementation;
  /** Domain filters that this provider should handle */
  domainFilters: pulumi.Input<string[]>;
  /** Cloudflare configuration (when provider is CLOUDFLARE) */
  cloudflare?: {
    /** Cloudflare API token with DNS edit permissions */
    apiToken: pulumi.Input<string>;
    /** Optional: Cloudflare zone ID to limit operations to specific zone */
    zoneId?: pulumi.Input<string>;
  };
  /** RouterOS configuration (when provider is ROUTEROS) */
  routeros?: {
    /** RouterOS device address (host:port) */
    address: pulumi.Input<string>;
    /** RouterOS username */
    username: pulumi.Input<string>;
    /** RouterOS password */
    password: pulumi.Input<string>;
    /** Domain filters to include (optional) */
    filterInclude?: pulumi.Input<string[]>;
    /** Domain filters to exclude (optional) */
    filterExclude?: pulumi.Input<string[]>;
    /** Log level (error, warning, info, debug) */
    logLevel?: pulumi.Input<string>;
  };
  /** AdGuard Home configuration (when provider is ADGUARD) */
  adguard?: {
    /** AdGuard Home URL (e.g., http://adguard.local:3000) */
    url: pulumi.Input<string>;
    /** AdGuard Home username */
    username: pulumi.Input<string>;
    /** AdGuard Home password */
    password: pulumi.Input<string>;
    /** Set the important flag for AdGuard rules (default: true) */
    setImportantFlag?: pulumi.Input<boolean>;
    /** Enable dry run mode (default: false) */
    dryRun?: pulumi.Input<boolean>;
    /** Log level (error, warning, info, debug) */
    logLevel?: pulumi.Input<string>;
  };
  /** Webhook configuration (when provider is WEBHOOK_ROUTEROS or WEBHOOK_ADGUARD) */
  webhook?: {
    /** Webhook server URL (e.g., http://localhost:8888) */
    url: pulumi.Input<string>;
    /** Optional headers to send with webhook requests */
    headers?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };
}

/**
 * Configuration for the Ingress module
 */
export interface IngressModuleArgs {
  /** Kubernetes namespace to deploy ingress components into */
  namespace: pulumi.Input<string>;

  /** Load balancer implementation to use */
  loadBalancer: LoadBalancerImplementation;

  /** Ingress controller implementation to use */
  ingressController: IngressControllerImplementation;

  /** IP address pools for load balancer (MetalLB) */
  ipAddressPools?: IPAddressPoolConfig[];

  /** L2 advertisement configurations for VLAN support */
  l2Advertisements?: L2AdvertisementConfig[];

  /** Traefik ingress controller configuration */
  traefik?: {
    /** Service type for Traefik (LoadBalancer, NodePort, ClusterIP) */
    serviceType?: pulumi.Input<string>;
    /** Load balancer IP address (when serviceType is LoadBalancer) */
    loadBalancerIP?: pulumi.Input<string>;
    /** Enable Traefik dashboard */
    enableDashboard?: pulumi.Input<boolean>;
    /** Ingress class configuration */
    ingressClass?: {
      /** Name of the ingress class (defaults to release name) */
      name?: pulumi.Input<string>;
      /** Whether to create the ingress class (defaults to true) */
      enabled?: pulumi.Input<boolean>;
      /** Whether this ingress class should be the default (defaults to false) */
      isDefaultClass?: pulumi.Input<boolean>;
    };
  };

  /** External DNS configuration */
  dns?: {
    /** DNS provider configurations - allows multiple providers for different domains */
    providers: DnsProviderConfig[];
    /** Unique identifier for TXT records ownership */
    txtOwnerId?: pulumi.Input<string>;
  };

  /** Certificate manager configuration */
  certManager?: {
    /** Whether to install Custom Resource Definitions (CRDs) */
    installCRDs?: pulumi.Input<boolean>;
  };

  /** Cluster issuer configuration */
  clusterIssuers?: ClusterIssuerConfig[];

  /** Default certificate configuration */
  defaultCertificate?: DefaultCertificateConfig;

  /** Whoami server configuration */
  whoami?: WhoamiServerConfig;
}

/**
 * Ingress module - provides a complete ingress solution with load balancing, ingress control, DNS management, and certificate automation
 * 
 * @example
 * ```typescript
 * import { IngressModule, LoadBalancerImplementation, IngressControllerImplementation, DnsProviderImplementation, ClusterIssuerImplementation } from "../modules/ingress";
 * 
 * const ingress = new IngressModule("cluster-ingress", {
 *   namespace: "ingress-system",
 *   loadBalancer: LoadBalancerImplementation.METAL_LB,
 *   ingressController: IngressControllerImplementation.TRAEFIK,
 *   ipAddressPools: [
 *     {
 *       name: "vlan100-pool",
 *       addresses: ["192.168.100.10-192.168.100.20"],
 *     },
 *     {
 *       name: "vlan200-pool",
 *       addresses: ["192.168.200.10-192.168.200.20"],
 *     },
 *   ],
 *   l2Advertisements: [
 *     {
 *       name: "vlan100-adv",
 *       ipAddressPools: ["vlan100-pool"],
 *       interfaces: ["eth0.100"],
 *     },
 *     {
 *       name: "vlan200-adv",
 *       ipAddressPools: ["vlan200-pool"],
 *       interfaces: ["eth0.200"],
 *     },
 *   ],
 *   traefik: {
 *     serviceType: "LoadBalancer",
 *     enableDashboard: true,
 *   },
 *   dns: {
 *     txtOwnerId: "my-cluster",
 *     providers: [
 *       {
 *         provider: DnsProviderImplementation.CLOUDFLARE,
 *         domainFilters: ["example.com", "*.example.com"],
 *         cloudflare: {
 *           apiToken: "your-cloudflare-api-token",
 *         },
 *       },
 *     ],
 *   },
 *   certManager: {
 *     installCRDs: true,
 *   },
 *   clusterIssuers: [
 *     {
 *       name: "letsencrypt-prod",
 *       implementation: ClusterIssuerImplementation.LETSENCRYPT_PROD,
 *       email: "admin@example.com",
 *       dns01: {
 *         cloudflare: {
 *           apiToken: "your-cloudflare-api-token",
 *         },
 *       },
 *     },
 *   ],
 *   defaultCertificate: {
 *     name: "default-certificate",
 *     secretName: "default-tls-secret",
 *     dnsNames: ["*.example.com", "example.com"],
 *     issuerRef: "letsencrypt-prod",
 *   },
 *   whoami: {
 *     enabled: true,
 *     name: "whoami",
 *     ingress: {
 *       enabled: true,
 *       hostname: "whoami.example.com",
 *       tlsSecretName: "default-tls-secret",
 *       ingressClassName: "traefik",
 *     },
 *   },
 * });
 * 
 * // Access individual components if needed
 * const traefikChart = ingress.traefik.chart;
 * const certManagerChart = ingress.certManager.chart;
 * const dnsProviders = ingress.dnsProviders;
 * const ipPools = ingress.ipAddressPools; // Array of IPAddressPool components
 * const l2Advs = ingress.l2Advertisements; // Array of L2Advertisement components
 * const defaultCert = ingress.defaultCertificate; // Certificate component
 * const whoamiServer = ingress.whoami; // Whoami component
 * ```
 */
export class IngressModule extends pulumi.ComponentResource {
  /** MetalLB load balancer instance */
  public readonly metalLb: MetalLb;

  /** IP address pool components */
  public readonly ipAddressPools: IPAddressPool[];

  /** L2 advertisement components */
  public readonly l2Advertisements: L2Advertisement[];

  /** Traefik ingress controller instance */
  public readonly traefik: Traefik;

  /** ExternalDNS instances - one per DNS provider */
  public readonly dnsProviders: ExternalDns[];

  /** RouterOS webhook providers */
  public readonly routerosWebhooks: ExternalDnsRouterosWebhook[];

  /** AdGuard webhook providers */
  public readonly adguardWebhooks: ExternalDnsAdguardWebhook[];

  /** CertManager instance */
  public readonly certManager: CertManager;

  /** ClusterIssuer instance */
  public readonly clusterIssuers?: ClusterIssuer[];

  /** Default certificate instance */
  public readonly defaultCertificate?: Certificate;

  /** Whoami server instance */
  public readonly whoami?: Whoami;

  constructor(name: string, args: IngressModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Ingress", name, args, opts);

    // Deploy Load Balancer (switchable)
    switch (args.loadBalancer) {
      case LoadBalancerImplementation.METAL_LB:
        // Deploy MetalLB Helm chart
        this.metalLb = new MetalLb(`${name}-lb`, {
          namespace: args.namespace,
        }, { parent: this });

        // Create IP address pools
        this.ipAddressPools = [];
        if (args.ipAddressPools && args.ipAddressPools.length > 0) {
          args.ipAddressPools.forEach((poolConfig) => {
            const ipPool = new IPAddressPool(`${name}-pool-${poolConfig.name}`, {
              namespace: args.namespace,
              poolConfig: poolConfig,
            }, { parent: this, dependsOn: [this.metalLb.chart] });
            this.ipAddressPools.push(ipPool);
          });
        }

        // Create L2 advertisements
        this.l2Advertisements = [];
        if (args.l2Advertisements && args.l2Advertisements.length > 0) {
          args.l2Advertisements.forEach((advConfig) => {
            const l2Adv = new L2Advertisement(`${name}-l2adv-${advConfig.name}`, {
              namespace: args.namespace,
              advertisementConfig: advConfig,
            }, { parent: this, dependsOn: this.ipAddressPools });
            this.l2Advertisements.push(l2Adv);
          });
        } else if (args.ipAddressPools && args.ipAddressPools.length > 0) {
          // Create default L2Advertisement for all pools if no custom advertisements specified
          const defaultL2Adv = new L2Advertisement(`${name}-l2adv-default`, {
            namespace: args.namespace,
            advertisementConfig: {
              name: "default-advertisement",
              ipAddressPools: args.ipAddressPools.map(pool => pool.name),
            },
          }, { parent: this, dependsOn: this.ipAddressPools });
          this.l2Advertisements.push(defaultL2Adv);
        }
        break;
      default:
        throw new Error(`Unknown LoadBalancer implementation: ${args.loadBalancer}`);
    }

    // Deploy CertManager (always included) - must be before certificates
    this.certManager = new CertManager(`${name}-certs`, {
      namespace: args.namespace,
      installCRDs: args.certManager?.installCRDs,
    }, { parent: this });

    // Deploy ClusterIssuers (if configured) - must be before certificates
    if (args.clusterIssuers && args.clusterIssuers.length > 0) {
      this.clusterIssuers = args.clusterIssuers.map((issuerConfig, index) => {
        // Determine ACME server URL based on implementation
        let acmeServer: string;
        switch (issuerConfig.implementation) {
          case ClusterIssuerImplementation.LETSENCRYPT_PROD:
            acmeServer = "https://acme-v02.api.letsencrypt.org/directory";
            break;
          case ClusterIssuerImplementation.LETSENCRYPT_STAGING:
            acmeServer = "https://acme-staging-v02.api.letsencrypt.org/directory";
            break;
          default:
            throw new Error(`Unknown ClusterIssuer implementation: ${issuerConfig.implementation}`);
        }

        // Create individual ClusterIssuer component
        return new ClusterIssuer(`${name}-cluster-issuer-${index}`, {
          namespace: args.namespace,
          name: issuerConfig.name,
          acmeServer: acmeServer,
          email: issuerConfig.email,
          dns01: issuerConfig.dns01,
        }, { parent: this, dependsOn: [this.certManager] });
      });
    }

    // Deploy Default Certificate (if configured) - must be before Traefik to ensure cert is available
    if (args.defaultCertificate) {
      const certDependencies: pulumi.Resource[] = [this.certManager];
      if (this.clusterIssuers) {
        certDependencies.push(...this.clusterIssuers);
      }
      
      this.defaultCertificate = new Certificate(`${name}-default-cert`, {
        namespace: args.namespace,
        name: args.defaultCertificate.name,
        secretName: args.defaultCertificate.secretName,
        dnsNames: args.defaultCertificate.dnsNames,
        issuerRef: args.defaultCertificate.issuerRef,
        duration: args.defaultCertificate.duration,
        renewBefore: args.defaultCertificate.renewBefore,
      }, { parent: this, dependsOn: certDependencies });
    }

    // Deploy Ingress Controller (switchable)
    switch (args.ingressController) {
      case IngressControllerImplementation.TRAEFIK:
        this.traefik = new Traefik(`${name}-ingress`, {
          namespace: args.namespace,
          serviceType: args.traefik?.serviceType || "LoadBalancer",
          loadBalancerIP: args.traefik?.loadBalancerIP,
          enableDashboard: args.traefik?.enableDashboard,
          defaultCertificate: args.defaultCertificate ? {
            secretName: args.defaultCertificate.secretName,
          } : undefined,
          ingressClass: args.traefik?.ingressClass,
        }, { 
          parent: this,
          dependsOn: this.defaultCertificate ? [this.defaultCertificate] : undefined,
        });
        break;
      default:
        throw new Error(`Unknown IngressController implementation: ${args.ingressController}`);
    }

    // Create webhook provider components first
    this.routerosWebhooks = [];
    this.adguardWebhooks = [];

    const routerosProviders = (args.dns?.providers || []).filter(
      provider => provider.provider === DnsProviderImplementation.ROUTEROS
    );

    const adguardProviders = (args.dns?.providers || []).filter(
      provider => provider.provider === DnsProviderImplementation.ADGUARD
    );

    routerosProviders.forEach((providerConfig, index) => {
      if (!providerConfig.routeros) {
        throw new Error("RouterOS configuration is required for ROUTEROS provider");
      }

      this.routerosWebhooks.push(
        new ExternalDnsRouterosWebhook(`${name}-routeros-webhook-${index}`, {
          namespace: args.namespace,
          routerosAddress: providerConfig.routeros.address,
          routerosUsername: providerConfig.routeros.username,
          routerosPassword: providerConfig.routeros.password,
          filterInclude: providerConfig.routeros.filterInclude,
          filterExclude: providerConfig.routeros.filterExclude,
          logLevel: providerConfig.routeros.logLevel,
        }, { parent: this })
      );
    });

    adguardProviders.forEach((providerConfig, index) => {
      if (!providerConfig.adguard) {
        throw new Error("AdGuard configuration is required for ADGUARD provider");
      }

      this.adguardWebhooks.push(
        new ExternalDnsAdguardWebhook(`${name}-adguard-webhook-${index}`, {
          namespace: args.namespace,
          adguardUrl: providerConfig.adguard.url,
          adguardUsername: providerConfig.adguard.username,
          adguardPassword: providerConfig.adguard.password,
          setImportantFlag: providerConfig.adguard.setImportantFlag,
          dryRun: providerConfig.adguard.dryRun,
          logLevel: providerConfig.adguard.logLevel,
        }, { parent: this })
      );
    });

    // Deploy ExternalDNS providers (always included)
    this.dnsProviders = (args.dns?.providers || []).map((providerConfig, index) => {
      const providerName = `${name}-dns-${index}`;

      // Map provider enum to ExternalDNS provider string
      let dnsProvider: string;

      switch (providerConfig.provider) {
        case DnsProviderImplementation.CLOUDFLARE:
          dnsProvider = "cloudflare";
          return new ExternalDns(providerName, {
            namespace: args.namespace,
            provider: dnsProvider,
            domainFilters: providerConfig.domainFilters,
            txtOwnerId: args.dns?.txtOwnerId,
            cloudflare: providerConfig.cloudflare,
          }, { parent: this });

        case DnsProviderImplementation.ROUTEROS:
          dnsProvider = "webhook";
          const routerosIndex = routerosProviders.findIndex(p => p === providerConfig);
          return new ExternalDns(providerName, {
            namespace: args.namespace,
            provider: dnsProvider,
            domainFilters: providerConfig.domainFilters,
            txtOwnerId: args.dns?.txtOwnerId,
            webhookProvider: this.routerosWebhooks[routerosIndex].getWebhookProviderConfig(),
          }, { parent: this });

        case DnsProviderImplementation.ADGUARD:
          dnsProvider = "webhook";
          const adguardIndex = adguardProviders.findIndex(p => p === providerConfig);
          return new ExternalDns(providerName, {
            namespace: args.namespace,
            provider: dnsProvider,
            domainFilters: providerConfig.domainFilters,
            txtOwnerId: args.dns?.txtOwnerId,
            webhookProvider: this.adguardWebhooks[adguardIndex].getWebhookProviderConfig(),
          }, { parent: this });

        default:
          throw new Error(`Unknown DNS provider implementation: ${providerConfig.provider}`);
      }
    });



    // Deploy Whoami Server (if configured)
    if (args.whoami?.enabled) {
      // Use the configured ingress class name from traefik, or default to the whoami config
      const whoamiIngress = args.whoami.ingress ? {
        ...args.whoami.ingress,
        ingressClassName: args.whoami.ingress.ingressClassName || this.traefik.ingressClassName,
      } : undefined;

      this.whoami = new Whoami(`${name}-whoami`, {
        namespace: args.namespace,
        name: args.whoami.name,
        image: args.whoami.image,
        replicas: args.whoami.replicas,
        ingress: whoamiIngress,
      }, { parent: this });
    }

    this.registerOutputs({
      metalLb: this.metalLb,
      ipAddressPools: this.ipAddressPools,
      l2Advertisements: this.l2Advertisements,
      traefik: this.traefik,
      dnsProviders: this.dnsProviders,
      routerosWebhooks: this.routerosWebhooks,
      adguardWebhooks: this.adguardWebhooks,
      certManager: this.certManager,
      clusterIssuers: this.clusterIssuers,
      defaultCertificate: this.defaultCertificate,
      whoami: this.whoami,
    });
  }
}
