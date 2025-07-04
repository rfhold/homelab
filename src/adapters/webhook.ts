import * as pulumi from "@pulumi/pulumi";

/**
 * Configuration for webhook URL
 */
export interface WebhookConfig {
  /** The webhook URL */
  url: pulumi.Input<string>;
}

/**
 * Sidecar container configuration for webhook providers
 */
export interface SidecarConfig {
  /** Container name */
  name: string;
  /** Container image */
  image: string;
  /** Container ports */
  ports: Array<{
    containerPort: number;
    name: string;
  }>;
  /** Environment variables */
  env: Array<{
    name: string;
    value?: string;
    valueFrom?: {
      secretKeyRef: {
        name: string;
        key: string;
      };
    };
  }>;
  /** Liveness probe */
  livenessProbe?: {
    httpGet: {
      path: string;
      port: number;
    };
    initialDelaySeconds: number;
    timeoutSeconds: number;
  };
  /** Readiness probe */
  readinessProbe?: {
    httpGet: {
      path: string;
      port: number;
    };
    initialDelaySeconds: number;
    timeoutSeconds: number;
  };
}

/**
 * Configuration for webhook provider (new sidecar-based pattern)
 */
export interface WebhookProviderConfig {
  /** Webhook provider name */
  name: string;
  /** Webhook URL (typically localhost for sidecars) */
  url: string;
  /** Sidecar container configuration */
  sidecar: SidecarConfig;
}

/**
 * Creates a webhook configuration
 * @param url The webhook URL
 * @returns WebhookConfig object
 */
export function createWebhookConfig(url: pulumi.Input<string>): WebhookConfig {
  return {
    url,
  };
}

/**
 * Creates a webhook provider configuration with sidecar
 * @param name The webhook provider name
 * @param sidecar The sidecar container configuration
 * @returns WebhookProviderConfig object
 */
export function createWebhookProviderConfig(name: string, sidecar: SidecarConfig): WebhookProviderConfig {
  return {
    name,
    url: "http://localhost:8888",
    sidecar,
  };
} 