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

  /**
   * Ceph distributed storage system
   * @see https://ceph.io/
   */
  CEPH: {
    image: "quay.io/ceph/ceph:v19.2.2",
    description: "Ceph distributed storage system",
  } as DockerImageConfig,

  /**
   * Firecrawl web scraping and crawling service
   * Custom build for multi-arch support (amd64/arm64)
   * @see https://github.com/mendableai/firecrawl
   */
  FIRECRAWL: {
    image: "ghcr.io/rfhold/firecrawl:v1.15.0",
    description: "Web scraping and crawling service with LLM-ready output",
  } as DockerImageConfig,

  /**
   * SearXNG privacy-respecting metasearch engine
   * @see https://github.com/searxng/searxng
   */
  SEARXNG: {
    image: "searxng/searxng:2025.7.25-168fa9b",
    description: "Privacy-respecting metasearch engine",
  } as DockerImageConfig,

  /**
   * Speaches combined STT/TTS service (Faster-Whisper + Kokoro)
   * Custom build combining Faster-Whisper STT and Kokoro TTS
   */
  SPEACHES: {
    image: "ghcr.io/rfhold/speaches:0.8.2-cuda",
    description: "Combined speech-to-text (Faster-Whisper) and text-to-speech (Kokoro) service",
  } as DockerImageConfig,

  /**
   * Playwright service for browser automation
   * Custom build for multi-arch support (amd64/arm64)
   * @see https://github.com/mendableai/firecrawl/tree/main/apps/playwright-service-ts
   */
  PLAYWRIGHT_SERVICE: {
    image: "ghcr.io/rfhold/firecrawl-playwright:v1.15.0",
    description: "Playwright service from Firecrawl for browser automation",
  } as DockerImageConfig,
} as const; 
