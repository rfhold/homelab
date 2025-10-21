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
   * Custom build with CUDA-enabled CTranslate2 for ARM64
   * @see https://github.com/rfhold/homelab/tree/main/docker/speaches
   */
  SPEACHES: {
    image: "ghcr.io/rfhold/speaches:0.8.3-cuda-12.6.3",
    description: "Combined speech-to-text (Faster-Whisper) and text-to-speech (Kokoro) service with CUDA support for ARM64",
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

  /**
   * LibreChat - Open-source AI chat platform
   * @see https://github.com/danny-avila/LibreChat
   */
  LIBRECHAT: {
    image: "ghcr.io/danny-avila/librechat:v0.7.9",
    description: "Open-source AI chat platform with multi-model support",
  } as DockerImageConfig,

  /**
   * LibreChat RAG API - Lite version
   * Lightweight RAG (Retrieval-Augmented Generation) API for LibreChat
   * @see https://github.com/danny-avila/LibreChat
   */
  LIBRECHAT_RAG_API_LITE: {
    image: "ghcr.io/danny-avila/librechat-rag-api-dev-lite:v0.5.0",
    description: "Lightweight RAG API for LibreChat with minimal dependencies",
  } as DockerImageConfig,

  /**
   * LibreChat RAG API - Full version
   * Full-featured RAG (Retrieval-Augmented Generation) API for LibreChat
   * @see https://github.com/danny-avila/LibreChat
   */
  LIBRECHAT_RAG_API: {
    image: "ghcr.io/danny-avila/librechat-rag-api-dev:v0.5.0",
    description: "Full-featured RAG API for LibreChat with all capabilities",
  } as DockerImageConfig,

  /**
   * Meilisearch - Lightning-fast search engine
   * @see https://www.meilisearch.com/
   */
  MEILISEARCH: {
    image: "getmeili/meilisearch:v1.15",
    description: "Lightning-fast search engine with built-in persistence and typo tolerance",
  } as DockerImageConfig,

  /**
   * AdGuard Home - Network-wide ads & trackers blocking DNS server
   * @see https://github.com/AdguardTeam/AdGuardHome
   */
  ADGUARD_HOME: {
    image: "adguard/adguardhome:v0.107.56",
    description: "Network-wide ads & trackers blocking DNS server",
  } as DockerImageConfig,

  /**
   * AdGuardHome Sync - Synchronize AdGuardHome instances
   * @see https://github.com/bakito/adguardhome-sync
   */
  ADGUARD_HOME_SYNC: {
    image: "ghcr.io/bakito/adguardhome-sync:v0.6.14",
    description: "Synchronize AdGuardHome config between instances",
  } as DockerImageConfig,

  /**
   * MongoDB - NoSQL document database
   * Official MongoDB image with multi-arch support (amd64/arm64)
   * @see https://www.mongodb.com/
   */
  MONGODB: {
    image: "mongo:8.0.12-noble",
    description: "Official MongoDB NoSQL document database",
  } as DockerImageConfig,

  /**
   * Bitnami PostgreSQL with DocumentDB compatibility
   * Custom build for MongoDB compatibility layer
   * @see https://github.com/rfhold/homelab/tree/main/docker/bitnami-postgres-documentdb
   */
  BITNAMI_POSTGRES_DOCUMENTDB: {
    image: "ghcr.io/rfhold/bitnami-postgres-documentdb:17.5.0-debian-12-r12",
    description: "PostgreSQL with DocumentDB/MongoDB compatibility for LibreChat",
  } as DockerImageConfig,

  /**
   * Bitnami PostgreSQL with pgvector extension
   * Custom build for vector similarity search
   * @see https://github.com/rfhold/homelab/tree/main/docker/bitnami-postgres-pgvector
   */
  BITNAMI_POSTGRES_PGVECTOR: {
    image: "ghcr.io/rfhold/bitnami-postgres-pgvector:17.5.0-debian-12-r12",
    description: "PostgreSQL with pgvector extension for RAG/vector search",
  } as DockerImageConfig,

  /**
   * Grocy - Self-hosted ERP system for household management
   * LinuxServer.io official image with multi-arch support
   * @see https://docs.linuxserver.io/images/docker-grocy/
   */
  GROCY: {
    image: "lscr.io/linuxserver/grocy:4.5.0",
    description: "Self-hosted ERP system for household management - tracks groceries, chores, battery life",
  } as DockerImageConfig,

  /**
   * go2rtc - Ultimate camera streaming application
   * Official multi-arch Docker image
   * @see https://github.com/AlexxIT/go2rtc
   */
  GO2RTC: {
    image: "alexxit/go2rtc:1.9.9",
    description: "Zero-dependency, high-performance media gateway for camera streaming with WebRTC support",
  } as DockerImageConfig,

  /**
   * FreshRSS - Free, self-hosted RSS and Atom feed aggregator
   * Official multi-arch Docker image
   * @see https://github.com/FreshRSS/FreshRSS
   */
  FRESHRSS: {
    image: "freshrss/freshrss:1.27.0-alpine",
    description: "Free, self-hosted RSS and Atom feed aggregator with multi-user support",
  } as DockerImageConfig,

  /**
   * Frigate - Open-source Network Video Recorder (NVR)
   * Official multi-arch Docker image optimized for Home Assistant integration
   * @see https://github.com/blakeblackshear/frigate
   */
  FRIGATE: {
    image: "ghcr.io/rfhold/frigate-yolov9:0.16.1",
    description: "Open-source NVR with AI object detection for Home Assistant integration",
  } as DockerImageConfig,
} as const; 
