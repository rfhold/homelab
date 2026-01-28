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
    image: "git.holdenitdown.net/rfhold/firecrawl:v2.6.0",
    description: "Web scraping and crawling service with LLM-ready output",
  } as DockerImageConfig,

  /**
   * Firecrawl NUQ PostgreSQL database
   * Custom build for multi-arch support (amd64/arm64)
   * @see https://github.com/mendableai/firecrawl/tree/main/apps/nuq-postgres
   */
  FIRECRAWL_NUQ_POSTGRES: {
    image: "git.holdenitdown.net/rfhold/firecrawl-nuq-postgres:v2.6.0",
    description: "PostgreSQL database for Firecrawl NUQ queue system",
  } as DockerImageConfig,

  /**
   * SearXNG privacy-respecting metasearch engine
   * @see https://github.com/searxng/searxng
   */
  SEARXNG: {
    image: "docker.io/searxng/searxng:2025.7.25-168fa9b",
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
    image: "git.holdenitdown.net/rfhold/firecrawl-playwright:v2.6.0",
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
    image: "docker.io/getmeili/meilisearch:v1.15",
    description: "Lightning-fast search engine with built-in persistence and typo tolerance",
  } as DockerImageConfig,

  /**
   * AdGuard Home - Network-wide ads & trackers blocking DNS server
   * @see https://github.com/AdguardTeam/AdGuardHome
   */
  ADGUARD_HOME: {
    image: "docker.io/adguard/adguardhome:v0.107.56",
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
    image: "docker.io/library/mongo:8.0.12-noble",
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
    image: "docker.io/alexxit/go2rtc:1.9.9",
    description: "Zero-dependency, high-performance media gateway for camera streaming with WebRTC support",
  } as DockerImageConfig,

  /**
   * FreshRSS - Free, self-hosted RSS and Atom feed aggregator
   * Official multi-arch Docker image
   * @see https://github.com/FreshRSS/FreshRSS
   */
  FRESHRSS: {
    image: "docker.io/freshrss/freshrss:1.27.0-alpine",
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

  /**
   * Kokoro-82M TTS - Text-to-speech model with GPU acceleration
   * Custom build with FastAPI server and OpenAI-compatible endpoints
   * @see https://github.com/remsky/Kokoro-FastAPI
   */
  KOKORO_FASTAPI_GPU: {
    image: "ghcr.io/rfhold/kokoro-fastapi-gpu:latest",
    description: "Kokoro-82M text-to-speech model with OpenAI-compatible API endpoints and GPU acceleration",
  } as DockerImageConfig,

  /**
   * MKTXP - Prometheus exporter for Mikrotik RouterOS
   * @see https://github.com/akpw/mktxp
   */
  MKTXP: {
    image: "ghcr.io/akpw/mktxp:1.2",
    description: "Prometheus exporter for Mikrotik RouterOS devices",
  } as DockerImageConfig,

  /**
   * Docker Distribution Registry - Official Docker registry implementation
   * Supports both pull-through caching and private registry modes
   * @see https://distribution.github.io/distribution/
   */
  DOCKER_REGISTRY: {
    image: "docker.io/library/registry:3.0.0",
    description: "Official Docker Distribution registry v3.0.0 with multi-arch support (amd64/arm64)",
  } as DockerImageConfig,

  /**
   * OpenCode Dot - Dev container with OpenCode CLI
   * @see https://github.com/rfhold/dot
   */
  OPENCODE_DOT: {
    image: "cr.holdenitdown.net/rfhold/dot:latest",
    description: "Dev container with OpenCode CLI for AI-powered coding assistance",
  } as DockerImageConfig,

  /**
   * Cloudflare Tunnel (cloudflared) - Secure outbound tunnel to Cloudflare
   * @see https://github.com/cloudflare/cloudflared
   */
  CLOUDFLARED: {
    image: "docker.io/cloudflare/cloudflared:2025.11.1",
    description: "Cloudflare Tunnel daemon for secure ingress without opening firewall ports",
  } as DockerImageConfig,

  /**
   * TRMNL BYOS Laravel - Self-hosted TRMNL e-ink display server
   * @see https://github.com/usetrmnl/byos_laravel
   */
  TRMNL_BYOS_LARAVEL: {
    image: "ghcr.io/usetrmnl/byos_laravel:0.21.0",
    description: "Self-hosted TRMNL e-ink display server with device management and screen generation",
  } as DockerImageConfig,

  /**
   * LobeChat Database - AI chat platform with server-side database support
   * @see https://github.com/lobehub/lobe-chat
   */
  LOBECHAT_DATABASE: {
    image: "docker.io/lobehub/lobe-chat-database:1.142.9",
    description: "LobeChat with PostgreSQL server-side database support for multi-user deployments",
  } as DockerImageConfig,

  /**
   * Valkey - High-performance data structure server (Redis fork)
   * Official Alpine-based image for smaller footprint
   * @see https://valkey.io/
   * @see https://hub.docker.com/r/valkey/valkey
   */
  VALKEY: {
    image: "docker.io/valkey/valkey:8.0-alpine",
    description: "High-performance Redis-compatible data structure server",
  } as DockerImageConfig,

  /**
   * TP-Link Omada Controller - SDN management platform for Omada network devices
   * @see https://github.com/mbentley/docker-omada-controller
   */
  OMADA_CONTROLLER: {
    image: "docker.io/mbentley/omada-controller:6.0",
    description: "TP-Link Omada SDN Controller for managing EAPs, switches, and routers",
  } as DockerImageConfig,

  /**
   * Coturn - TURN/STUN server for WebRTC NAT traversal
   * @see https://github.com/coturn/coturn
   */
  COTURN: {
    image: "docker.io/coturn/coturn:4.7.0-r2-alpine",
    description: "TURN/STUN server for WebRTC NAT traversal and VoIP media relay",
  } as DockerImageConfig,

  /**
   * NanoMQ - Ultra-lightweight MQTT messaging broker for IoT edge computing
   * @see https://nanomq.io/
   * @see https://hub.docker.com/r/emqx/nanomq
   */
  NANOMQ: {
    image: "docker.io/emqx/nanomq:0.24.6-slim",
    description: "Ultra-lightweight MQTT 5.0/3.1.1 broker with built-in bridges and HTTP APIs",
  } as DockerImageConfig,

  /**
   * BuildKit - Concurrent, cache-efficient, and Dockerfile-agnostic builder toolkit
   * @see https://github.com/moby/buildkit
   */
  BUILDKIT: {
    image: "docker.io/moby/buildkit:v0.26.3",
    description: "BuildKit daemon for efficient container image builds with multi-arch support",
  } as DockerImageConfig,

  VECTORCHORD: {
    image: "ghcr.io/tensorchord/cloudnative-vectorchord:16-0.5.3",
    description: "CloudNative PostgreSQL with VectorChord extension for vector similarity search",
  } as DockerImageConfig,

  VLLM: {
    image: "nvcr.io/nvidia/vllm:25.09-py3",
    description: "NVIDIA vLLM container for high-throughput LLM inference",
  } as DockerImageConfig,

  VLLM_ROCM_GFX1151: {
    image: "cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151",
    description: "vLLM with ROCm 7.2 for AMD Strix Halo APU (gfx1151)",
  } as DockerImageConfig,

  NVIDIA_DCGM_EXPORTER: {
    image: "nvcr.io/nvidia/k8s/dcgm-exporter:4.4.1-4.6.0-ubuntu22.04",
    description: "NVIDIA DCGM Exporter for GPU metrics in Prometheus format",
  } as DockerImageConfig,

  VELERO_AWS_PLUGIN: {
    image: "docker.io/velero/velero-plugin-for-aws:v1.13.0",
    description: "Velero plugin for AWS S3-compatible backup storage",
  } as DockerImageConfig,

  RCLONE: {
    image: "docker.io/rclone/rclone:latest",
    description: "Rclone for syncing files to cloud storage",
  } as DockerImageConfig,

  KOPIA: {
    image: "docker.io/kopia/kopia:latest",
    description: "Kopia backup tool for fast and secure backups",
  } as DockerImageConfig,

  GITEA_ACT_RUNNER: {
    image: "docker.io/gitea/act_runner:0.2.13",
    description: "Gitea Actions runner for CI/CD workflows",
  } as DockerImageConfig,

  DOCKER_DIND: {
    image: "docker.io/library/docker:28.5.1-dind",
    description: "Docker-in-Docker for containerized build environments",
  } as DockerImageConfig,

  GO2RTC_HARDWARE: {
    image: "docker.io/alexxit/go2rtc:latest-hardware",
    description: "go2rtc with hardware acceleration support",
  } as DockerImageConfig,

  GO2RTC_ROCKCHIP: {
    image: "docker.io/alexxit/go2rtc:latest-rockchip",
    description: "go2rtc optimized for Rockchip SoCs",
  } as DockerImageConfig,

  WHOAMI: {
    image: "docker.io/traefik/whoami:latest",
    description: "Tiny Go webserver that prints OS information and HTTP request",
  } as DockerImageConfig,

  ALPINE: {
    image: "docker.io/library/alpine:latest",
    description: "Minimal Alpine Linux base image",
  } as DockerImageConfig,

  BUSYBOX: {
    image: "docker.io/library/busybox:latest",
    description: "Minimal BusyBox base image for init containers",
  } as DockerImageConfig,

  BUSYBOX_1_35: {
    image: "docker.io/library/busybox:1.35",
    description: "BusyBox 1.35 for init containers requiring specific version",
  } as DockerImageConfig,

  BUSYBOX_1_36: {
    image: "docker.io/library/busybox:1.36",
    description: "BusyBox 1.36 for init containers requiring specific version",
  } as DockerImageConfig,

  DOCKER_DIND_LATEST: {
    image: "docker.io/library/docker:dind",
    description: "Docker-in-Docker latest for dev environments",
  } as DockerImageConfig,

  LITELLM: {
    image: "ghcr.io/berriai/litellm:v1.81.0-stable",
    description: "LiteLLM proxy for unified LLM API with Prometheus metrics",
  } as DockerImageConfig,
} as const; 
