# GitHub Images and Repository Dependencies

This document outlines the GitHub Container Registry images, OCI Helm charts, and repository dependencies used in the homelab setup.

## GitHub Container Registry (ghcr.io) Images

### Custom Builds by rfhold

These images are built and maintained specifically for this homelab setup with custom optimizations and multi-architecture support.

#### AI/ML Services
```yaml
ghcr.io/rfhold/firecrawl:v1.15.0
```
Web scraping and crawling service with LLM-ready output. Used for content extraction and preparation for AI processing.

```yaml
ghcr.io/rfhold/speaches:0.8.3-cuda-12.6.3
```
Combined STT/TTS service using Faster-Whisper for speech-to-text and Kokoro for text-to-speech. Built with CUDA support for ARM64 architecture.

```yaml
ghcr.io/rfhold/kokoro-fastapi-gpu:latest
```
Kokoro-82M text-to-speech service with OpenAI-compatible API and GPU acceleration. Provides high-quality voice synthesis.

#### Database Services
```yaml
ghcr.io/rfhold/bitnami-postgres-documentdb:17.5.0-debian-12-r12
```
PostgreSQL with DocumentDB/MongoDB compatibility layer. Enables MongoDB-style queries on PostgreSQL.

```yaml
ghcr.io/rfhold/bitnami-postgres-pgvector:17.5.0-debian-12-r12
```
PostgreSQL with pgvector extension for vector similarity search. Essential for RAG (Retrieval-Augmented Generation) applications.

#### Automation and Monitoring
```yaml
ghcr.io/rfhold/firecrawl-playwright:v1.15.0
```
Playwright service for browser automation with multi-architecture support. Used for web scraping and testing.

```yaml
ghcr.io/rfhold/frigate-yolov9:0.16.1
```
Frigate NVR with YOLOv9 object detection model. Provides advanced video surveillance and object recognition.

### Third-party ghcr.io Images

Curated third-party images from the GitHub Container Registry.

#### DNS and Network Services
```yaml
ghcr.io/muhlba91/external-dns-provider-adguard:v9.0.0
```
ExternalDNS webhook provider for AdGuard Home. Automatically manages DNS records for services.

```yaml
ghcr.io/bakito/adguardhome-sync:v0.6.14
```
Synchronizes AdGuardHome configuration between multiple instances for high availability.

```yaml
ghcr.io/akpw/mktxp:1.2
```
Prometheus exporter for Mikrotik RouterOS devices. Collects network statistics and metrics.

#### AI Chat Platform
```yaml
ghcr.io/danny-avila/librechat:v0.7.9
```
Open-source AI chat platform with multi-model support. Provides a unified interface for various LLM providers.

```yaml
ghcr.io/danny-avila/librechat-rag-api-dev-lite:v0.5.0
```
Lightweight RAG API for LibreChat. Provides basic retrieval-augmented generation capabilities.

```yaml
ghcr.io/danny-avila/librechat-rag-api-dev:v0.5.0
```
Full-featured RAG API for LibreChat with advanced retrieval and generation features.

