import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { WebhookConfig, WebhookProviderConfig, SidecarConfig, createWebhookConfig, createWebhookProviderConfig } from "../adapters/webhook";

/**
 * Configuration for the ExternalDNS AdGuard Home webhook provider
 */
export interface ExternalDnsAdguardWebhookArgs {
  /** Kubernetes namespace to deploy the webhook provider into */
  namespace: pulumi.Input<string>;
  /** AdGuard Home URL (e.g., http://adguard.local:3000) */
  adguardUrl: pulumi.Input<string>;
  /** AdGuard Home username */
  adguardUsername: pulumi.Input<string>;
  /** AdGuard Home password */
  adguardPassword: pulumi.Input<string>;
  /** Set the important flag for AdGuard rules (default: true) */
  setImportantFlag?: pulumi.Input<boolean>;
  /** Enable dry run mode (default: false) */
  dryRun?: pulumi.Input<boolean>;
  /** Log level (error, warning, info, debug) */
  logLevel?: pulumi.Input<string>;
}

/**
 * ExternalDNS AdGuard Home webhook provider component
 * 
 * Deploys the AdGuard Home webhook provider that enables ExternalDNS to manage DNS records
 * in AdGuard Home using filtering rules with the new sidecar pattern.
 * 
 * @example
 * ```typescript
 * import { ExternalDnsAdguardWebhook } from "../components/external-dns-adguard-webhook";
 * 
 * const adguardWebhook = new ExternalDnsAdguardWebhook("adguard-webhook", {
 *   namespace: "external-dns-system",
 *   adguardUrl: "http://adguard.local:3000",
 *   adguardUsername: "admin",
 *   adguardPassword: "your-password",
 *   logLevel: "info",
 * });
 * ```
 * 
 * @see https://github.com/muhlba91/external-dns-provider-adguard
 */
export class ExternalDnsAdguardWebhook extends pulumi.ComponentResource {
  /** The secret containing webhook provider credentials */
  public readonly secret: k8s.core.v1.Secret;

  /** Private webhook provider configuration - single source of truth */
  private readonly webhookProviderConfig: WebhookProviderConfig;

  constructor(name: string, args: ExternalDnsAdguardWebhookArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ExternalDnsAdguardWebhook", name, args, opts);

    const secretName = `${name}-adguard-webhook-secret`;

    // Create secret for AdGuard Home webhook provider credentials
    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: secretName,
          namespace: args.namespace,
        },
        type: "Opaque",
        stringData: {
          "adguard-url": args.adguardUrl,
          "adguard-username": args.adguardUsername,
          "adguard-password": args.adguardPassword,
          "set-important-flag": args.setImportantFlag !== undefined ? 
            pulumi.output(args.setImportantFlag).apply(flag => flag.toString()) : 
            "true",
          "dry-run": args.dryRun !== undefined ? 
            pulumi.output(args.dryRun).apply(flag => flag.toString()) : 
            "false",
          "log-level": args.logLevel || "info",
        },
      },
      { parent: this }
    );

    // Create sidecar configuration for the webhook provider
    const sidecarConfig: SidecarConfig = {
      name: "adguard-webhook",
      image: DOCKER_IMAGES.EXTERNAL_DNS_ADGUARD_WEBHOOK.image,
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
          name: "ADGUARD_URL",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "adguard-url",
            },
          },
        },
        {
          name: "ADGUARD_USER",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "adguard-username",
            },
          },
        },
        {
          name: "ADGUARD_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "adguard-password",
            },
          },
        },
        {
          name: "ADGUARD_SET_IMPORTANT_FLAG",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "set-important-flag",
            },
          },
        },
        {
          name: "DRY_RUN",
          valueFrom: {
            secretKeyRef: {
              name: secretName,
              key: "dry-run",
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
        {
          name: "HEALTHZ_ADDRESS",
          value: "0.0.0.0",
        },
        {
          name: "HEALTHZ_PORT",
          value: "8080",
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
    this.webhookProviderConfig = createWebhookProviderConfig("adguard", sidecarConfig);

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