import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";
import { WebhookProviderConfig } from "../adapters/webhook";

/**
 * Configuration for the ExternalDNS component
 */
export interface ExternalDnsArgs {
  /** Kubernetes namespace to deploy ExternalDNS into */
  namespace: pulumi.Input<string>;
  /** DNS provider to use (e.g., aws, cloudflare, google, webhook, etc.) */
  provider: pulumi.Input<string>;
  /** Domain filter to limit ExternalDNS to specific domains */
  domainFilters?: pulumi.Input<string[]>;
  /** Unique identifier for TXT records ownership */
  txtOwnerId?: pulumi.Input<string>;
  /** Cloudflare configuration (when provider is 'cloudflare') */
  cloudflare?: {
    /** Cloudflare API token with DNS edit permissions */
    apiToken: pulumi.Input<string>;
    /** Optional: Cloudflare zone ID to limit operations to specific zone */
    zoneId?: pulumi.Input<string>;
  };
  /** Webhook provider configuration (new sidecar-based pattern) */
  webhookProvider?: WebhookProviderConfig;
  /** RFC 2136 provider configuration */
  rfc2136?: {
    host: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    zones?: pulumi.Input<string[]>;
    tsigKeyname: pulumi.Input<string>;
    tsigSecretAlgorithm?: pulumi.Input<string>;
    tsigAxfr?: pulumi.Input<boolean>;
    tsigSecretRef: {
      secretName: pulumi.Input<string>;
      secretKey: string;
    };
  };
}

/**
 * ExternalDNS component
 * 
 * Deploys ExternalDNS to synchronize exposed Kubernetes Services and Ingresses with DNS providers.
 * Supports multiple DNS providers including Cloudflare, AWS Route53, Google Cloud DNS, and webhook providers.
 * 
 * @example
 * ```typescript
 * import { ExternalDns } from "../components/external-dns";
 * 
 * // Cloudflare example
 * const externalDnsCloudflare = new ExternalDns("external-dns-cf", {
 *   namespace: "external-dns-system",
 *   provider: "cloudflare",
 *   domainFilters: ["example.com"],
 *   txtOwnerId: "my-cluster",
 *   cloudflare: {
 *     apiToken: "your-cloudflare-api-token",
 *     zoneId: "optional-zone-id",
 *   },
 * });
 * 
 * // Webhook provider example (new sidecar pattern)
 * const externalDnsWebhook = new ExternalDns("external-dns-webhook", {
 *   namespace: "external-dns-system",
 *   provider: "webhook",
 *   domainFilters: ["example.com"],
 *   txtOwnerId: "my-cluster",
 *   webhookProvider: webhookComponent.getWebhookProviderConfig(),
 * });
 * ```
 * 
 * @see https://kubernetes-sigs.github.io/external-dns/
 */
export class ExternalDns extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: ExternalDnsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ExternalDns", name, args, opts);

    const chartConfig = HELM_CHARTS.EXTERNAL_DNS;

    // Deploy ExternalDNS using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
        values: {
          domainFilters: args.domainFilters || [],
          txtOwnerId: args.txtOwnerId || "default-txt-owner-id",
          sources: [
            "gateway-httproute",
            "gateway-grpcroute",
            "gateway-tcproute",
            "gateway-tlsroute",
            "gateway-udproute",
            "ingress",
            "service",
          ],

          // Provider-specific configuration
          ...(args.webhookProvider ? {
            provider: {
              name: "webhook",
              webhook: {
                image: {
                  repository: args.webhookProvider.sidecar.image.split(':')[0],
                  tag: args.webhookProvider.sidecar.image.split(':')[1] || "latest",
                  pullPolicy: "IfNotPresent",
                },
                env: args.webhookProvider.sidecar.env,
                livenessProbe: args.webhookProvider.sidecar.livenessProbe,
                readinessProbe: args.webhookProvider.sidecar.readinessProbe,
                resources: {},
                securityContext: {},
                service: {
                  port: 8080,
                },
              },
            },
          } : args.rfc2136 ? {
            provider: {
              name: "rfc2136",
            },
            extraArgs: pulumi.output(args.rfc2136.zones ?? []).apply(zones => [
              pulumi.interpolate`--rfc2136-host=${args.rfc2136!.host}`,
              `--rfc2136-port=${args.rfc2136!.port ?? 53}`,
              ...zones.map(z => `--rfc2136-zone=${z}`),
              `--rfc2136-tsig-secret-alg=${args.rfc2136!.tsigSecretAlgorithm ?? "hmac-sha256"}`,
              pulumi.interpolate`--rfc2136-tsig-keyname=${args.rfc2136!.tsigKeyname}`,
              ...((args.rfc2136!.tsigAxfr ?? false) ? ["--rfc2136-tsig-axfr"] : []),
              "--rfc2136-batch-change-size=10",
              "--txt-wildcard-replacement=wildcard",
            ]),
          } : {
            provider: {
              name: args.provider,
            },
          }),

          // Environment variables for provider-specific configuration
          env: [
            // Cloudflare provider configuration
            ...(args.cloudflare?.apiToken ? [
              {
                name: "CF_API_TOKEN",
                value: args.cloudflare.apiToken,
              },
            ] : []),
            ...(args.rfc2136 ? [
              {
                name: "EXTERNAL_DNS_RFC2136_TSIG_SECRET",
                valueFrom: {
                  secretKeyRef: {
                    name: args.rfc2136.tsigSecretRef.secretName,
                    key: args.rfc2136.tsigSecretRef.secretKey,
                  },
                },
              },
            ] : []),
          ],

          serviceMonitor: {
            enabled: true,
          },
        },
      },
      { parent: this }
    );
  }
}
