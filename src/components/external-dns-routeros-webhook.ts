import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { WebhookConfig, WebhookProviderConfig, SidecarConfig, createWebhookConfig, createWebhookProviderConfig } from "../adapters/webhook";

/**
 * Configuration for the ExternalDNS RouterOS webhook provider
 */
export interface ExternalDnsRouterosWebhookArgs {
  /** Kubernetes namespace to deploy the webhook provider into */
  namespace: pulumi.Input<string>;
  /** RouterOS device address (host:port) */
  routerosAddress: pulumi.Input<string>;
  /** RouterOS username */
  routerosUsername: pulumi.Input<string>;
  /** RouterOS password */
  routerosPassword: pulumi.Input<string>;
  /** Domain filters to include (optional) */
  filterInclude?: pulumi.Input<string[]>;
  /** Domain filters to exclude (optional) */
  filterExclude?: pulumi.Input<string[]>;
  /** Log level (error, warning, info, debug) */
  logLevel?: pulumi.Input<string>;
}

/**
 * ExternalDNS RouterOS webhook provider component
 * 
 * Deploys the RouterOS webhook provider that enables ExternalDNS to manage DNS records
 * on Mikrotik RouterOS devices using the new sidecar pattern.
 * 
 * @example
 * ```typescript
 * import { ExternalDnsRouterosWebhook } from "../components/external-dns-routeros-webhook";
 * 
 * const routerosWebhook = new ExternalDnsRouterosWebhook("routeros-webhook", {
 *   namespace: "external-dns-system",
 *   routerosAddress: "192.168.1.1:8728",
 *   routerosUsername: "admin",
 *   routerosPassword: "your-password",
 *   filterInclude: ["example.com"],
 *   logLevel: "info",
 * });
 * ```
 * 
 * @see https://github.com/benfiola/external-dns-routeros-provider
 */
export class ExternalDnsRouterosWebhook extends pulumi.ComponentResource {
  /** The secret containing webhook provider credentials */
  public readonly secret: k8s.core.v1.Secret;

  /** Private webhook provider configuration - single source of truth */
  private readonly webhookProviderConfig: WebhookProviderConfig;

  constructor(name: string, args: ExternalDnsRouterosWebhookArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ExternalDnsRouterosWebhook", name, args, opts);

    const secretName = `${name}-routeros-webhook-secret`;

    // Create secret for RouterOS webhook provider credentials
    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: secretName,
          namespace: args.namespace,
        },
        type: "Opaque",
        stringData: {
          "routeros-address": args.routerosAddress,
          "routeros-username": args.routerosUsername,
          "routeros-password": args.routerosPassword,
          "filter-include": args.filterInclude ? 
            pulumi.output(args.filterInclude).apply(filters => filters.join(",")) : 
            "",
          "filter-exclude": args.filterExclude ? 
            pulumi.output(args.filterExclude).apply(filters => filters.join(",")) : 
            "",
          "log-level": args.logLevel || "info",
        },
      },
      { parent: this }
    );

    // Create sidecar configuration for the webhook provider
    const sidecarConfig: SidecarConfig = {
      name: "routeros-webhook",
      image: DOCKER_IMAGES.EXTERNAL_DNS_ROUTEROS_WEBHOOK.image,
      ports: [
        {
          containerPort: 8888,
          name: "webhook",
        },
        {
          containerPort: 8080,
          name: "healthz",
        },
      ],
      env: [
        {
          name: "ROUTEROS_ADDRESS",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "routeros-address",
            },
          },
        },
        {
          name: "ROUTEROS_USERNAME",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "routeros-username",
            },
          },
        },
        {
          name: "ROUTEROS_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "routeros-password",
            },
          },
        },
        {
          name: "FILTER_INCLUDE",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "filter-include",
            },
          },
        },
        {
          name: "FILTER_EXCLUDE",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "filter-exclude",
            },
          },
        },
        {
          name: "LOG_LEVEL",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "log-level",
            },
          },
        },
      ],
      livenessProbe: {
        httpGet: {
          path: "/healthz",
          port: 8080,
        },
        initialDelaySeconds: 10,
        timeoutSeconds: 5,
      },
      readinessProbe: {
        httpGet: {
          path: "/healthz",
          port: 8080,
        },
        initialDelaySeconds: 10,
        timeoutSeconds: 5,
      },
    };

    // Complete webhook provider configuration with sidecar
    this.webhookProviderConfig = createWebhookProviderConfig("routeros", sidecarConfig);

    this.registerOutputs({
      secret: this.secret,
    });
  }

  /**
   * Returns webhook configuration (legacy support)
   * @returns A copy of the webhook configuration to prevent accidental modification
   * @deprecated Use getWebhookProviderConfig() instead
   */
  public getWebhookConfig(): WebhookConfig {
    return createWebhookConfig(this.webhookProviderConfig.url);
  }

  /**
   * Returns webhook provider configuration for sidecar pattern
   * @returns A copy of the webhook provider configuration
   */
  public getWebhookProviderConfig(): WebhookProviderConfig {
    return {
      name: this.webhookProviderConfig.name,
      url: this.webhookProviderConfig.url,
      sidecar: this.webhookProviderConfig.sidecar,
    };
  }
} 