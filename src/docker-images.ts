/**
 * Centralized Docker image references with pinned versions
 * 
 * This file contains all Docker image references used throughout the homelab infrastructure.
 * Images are pinned to specific versions to ensure reproducible deployments.
 * 
 * @example
 * ```typescript
 * import { DOCKER_IMAGES } from "../docker-images";
 * 
 * const container = {
 *   name: "app",
 *   image: DOCKER_IMAGES.EXTERNAL_DNS_ROUTEROS_WEBHOOK.image,
 * };
 * ```
 */

export interface DockerImageConfig {
  /** Full Docker image reference with tag */
  image: string;
  /** Optional description of the image */
  description?: string;
}

/**
 * Docker image configurations
 */
export const DOCKER_IMAGES = {
  /**
   * ExternalDNS RouterOS webhook provider
   * @see https://github.com/benfiola/external-dns-routeros-provider
   */
  EXTERNAL_DNS_ROUTEROS_WEBHOOK: {
    image: "docker.io/benfiola/external-dns-routeros-provider:v2.0.1",
    description: "ExternalDNS webhook provider for Mikrotik RouterOS devices",
  } as DockerImageConfig,

  /**
   * ExternalDNS AdGuard Home webhook provider
   * @see https://github.com/muhlba91/external-dns-provider-adguard
   */
  EXTERNAL_DNS_ADGUARD_WEBHOOK: {
    image: "ghcr.io/muhlba91/external-dns-provider-adguard:v9.0.0",
    description: "ExternalDNS webhook provider for AdGuard Home",
  } as DockerImageConfig,
} as const; 