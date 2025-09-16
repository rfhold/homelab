# Components

Pulumi ComponentResource classes that encapsulate infrastructure resources. Components provide reusable, composable building blocks for infrastructure deployment.

## Purpose & Responsibility

Components are responsible for:
- Encapsulating related infrastructure resources into logical units
- Providing type-safe configuration interfaces
- Exposing key resources for consumption by modules and programs
- Integrating with centralized Helm chart management
- Implementing service connection patterns for databases and caches

## Available Components

| Component | File | Purpose |
|-----------|------|---------|
| `BitnamiMongoDB` | `bitnami-mongodb.ts` | NoSQL document database with support for standalone and replicaset architectures |
| `BitnamiPostgreSQL` | `bitnami-postgres.ts` | Open source object-relational database system with automatic password generation |
| `BitnamiValkey` | `bitnami-valkey.ts` | High-performance data structure server (Redis-compatible) with automatic password generation |
| `CephBlockPool` | `ceph-block-pool.ts` | Ceph block storage pool configuration for persistent volumes |
| `CephFilesystem` | `ceph-filesystem.ts` | Ceph filesystem configuration for shared storage |
| `CertManager` | `cert-manager.ts` | X.509 certificate management for Kubernetes |
| `Certificate` | `certificate.ts` | TLS certificate resource for cert-manager |
| `CloudflareAccountToken` | `cloudflare-account-token.ts` | Cloudflare API token management for DNS operations |
| `ClusterIssuer` | `cluster-issuer.ts` | Certificate issuer configuration for cert-manager |
| `ExternalDns` | `external-dns.ts` | Synchronizes exposed Kubernetes Services and Ingresses with DNS providers |
| `ExternalDnsAdguardWebhook` | `external-dns-adguard-webhook.ts` | AdGuard Home webhook provider for ExternalDNS |
| `ExternalDnsRouterosWebhook` | `external-dns-routeros-webhook.ts` | RouterOS webhook provider for ExternalDNS |
| `ExternalSnapshotter` | `external-snapshotter.ts` | Kubernetes Volume Snapshot functionality for K3s clusters |
| `Firecrawl` | `firecrawl.ts` | Web scraping and crawling service with LLM-ready output, includes API, Worker, and Playwright services |
| `Gitea` | `gitea.ts` | Self-hosted Git service with web interface, SSH access, and integrated database |
| `Grocy` | `grocy.ts` | Self-hosted ERP system for household management - tracks groceries, chores, battery life, and reduces food waste |
| `LibreChat` | `librechat.ts` | Open-source ChatGPT alternative with multi-model support |
| `LibreChatRag` | `librechat-rag.ts` | Retrieval-Augmented Generation API for LibreChat with pgvector support and OpenAI embeddings |
| `Meilisearch` | `meilisearch.ts` | Lightning-fast search engine with built-in persistence and configurable indexing settings |
| `MetalLb` | `metal-lb.ts` | Load balancer for bare metal Kubernetes clusters |
| `RookCeph` | `rook-ceph.ts` | Cloud-native storage operator for Kubernetes using Ceph |
| `RookCephCluster` | `rook-ceph-cluster.ts` | Ceph storage cluster with configurable storage layout |
| `SearXNG` | `searxng.ts` | Privacy-respecting metasearch engine with configurable search engines and UI settings |
| `Traefik` | `traefik.ts` | Modern HTTP reverse proxy and load balancer |
| `Vaultwarden` | `vaultwarden.ts` | Unofficial Bitwarden compatible server for password management |
| `Velero` | `velero.ts` | Backup and disaster recovery for Kubernetes with support for both snapshot and filesystem backups |
| `Whoami` | `whoami.ts` | Simple test service for validating ingress and routing configuration |

## Standard Structure

All components must follow this structure:

### ComponentResource Class
- Extend `pulumi.ComponentResource`
- Use resource type pattern: `"homelab:components:ComponentName"`
- Accept `pulumi.ComponentResourceOptions` parameter

### Configuration Interface
- Named with `Args` suffix (e.g., `MetalLbArgs`)
- Use `pulumi.Input<T>` for all configuration properties
- Provide sensible defaults for optional parameters

### Resource Management
- Set `{ parent: this }` on all child resources
- Expose key resources as `public readonly` properties
- Call `this.registerOutputs()` with important resources

### Service Components
Components that provide services (databases, caches) must include:
- `getConnectionConfig(): ServiceConfig` method
- Automatic password generation using connection-safe characters
- Proper service discovery from Helm chart outputs

## Guidelines

### Helm Integration
- Reference charts via `HELM_CHARTS.COMPONENT_NAME` from `../helm-charts.ts`
- Use `createHelmChartArgs()` helper for proper OCI chart handling
- Ensure version consistency across deployments

### Docker Image Integration
- Reference images via `DOCKER_IMAGES.COMPONENT_NAME` from `../docker-images.ts`
- Use pinned versions to ensure reproducible deployments
- Maintain consistency across all container deployments

### Configuration Design
- Keep configuration minimal and focused on common use cases
- Use generic configuration that works across similar implementations
- Avoid exposing every possible Helm chart value

### Resource Naming
- Use consistent naming patterns for child resources
- Pattern: `pulumi.interpolate\`\${name}-resource-type\``
- Ensure names are unique within the component scope

### Security
- Generate connection-safe passwords for service components
- Never expose secrets in plain text
- Use proper Kubernetes secret management

### Documentation
- Include JSDoc comments for all public APIs
- Document configuration options and their defaults
- Provide clear examples of expected usage patterns
