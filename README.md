# Homelab

Infrastructure as Code for a multi-cluster K3s homelab using PyInfra for host provisioning and Pulumi micro-stacks for Kubernetes workloads.

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                        INTERNET                             │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
                                                    Cloudflare Tunnel
                                                              │
┌─────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┐
│                                                      HOMELAB NETWORK                                                      │
│                                                                                                                           │
│  ┌───────────────────────────────────────────────────────┐  ┌──────────────────────────────────────────────────┐          │
│  │              ROMULUS CLUSTER                          │  │              PANTHEON CLUSTER                    │          │
│  │              (K3s - 5 nodes)                          │  │              (K3s - 6 nodes)                     │          │
│  │                                                       │  │                                                  │          │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │          │
│  │  │  sol   │ │ aurora │ │  luna  │ │ terra  │         │  │  │ apollo │ │ athena │ │artemis │ │ vulkan │    │          │
│  │  │ server │ │ server │ │ server │ │ agent  │         │  │  │ server │ │ server │ │ server │ │ agent  │    │          │
│  │  │        │ │        │ │        │ │        │         │  │  │ Intel  │ │        │ │        │ │AMD GPU │    │          │
│  │  └────────┘ └────────┘ └────────┘ └────────┘         │  │  └────────┘ └────────┘ └────────┘ └────────┘    │          │
│  │                         ┌────────┐                    │  │                                                  │          │
│  │                         │polaris │                    │  │  ┌────────┐ ┌────────┐                             │          │
│  │                         │ agent  │                    │  │  │  mars  │ │ agent  │                             │          │
│  │                         └────────┘                    │  │  │ agent  │ │        │                             │          │
│  │                                                       │  │  │CUDA GPU│ │        │                             │          │
│  │  Services: Forgejo, Authentik, Bitwarden,            │  │  └────────┘ └────────┘                             │          │
│  │            Object Storage, DNS                        │  │                                                  │          │
│  └───────────────────────────────────────────────────────┘  │  Services: Media, AI Inference, Photos,          │          │
│                                                             │            NVR, Monitoring, Grafana               │          │
│                                                             └──────────────────────────────────────────────────┘          │
│                                                                                                                           │
│  ┌──────────────────────────────────────────────────┐    ┌──────────────────────────────────────────────────┐            │
│  │                NAS SERVERS                       │    │              VOICE SATELLITES                    │            │
│  │                                                  │    │                                                  │            │
│  │  ┌────────────────────┐ ┌────────────────────┐  │    │  ┌────────────────────┐ ┌────────────────────┐  │            │
│  │  │    172.16.4.10     │ │    172.16.4.11     │  │    │  │      phobos        │ │      deimos        │  │            │
│  │  │    ZFS RAIDZ1      │ │ SnapRAID+MergerFS  │  │    │  │  Wyoming Satellite │ │  Wyoming Satellite │  │            │
│  │  │   (SSD - 24TB)     │ │   (HDD - ~56TB)    │  │    │  │   Raspberry Pi     │ │   Raspberry Pi     │  │            │
│  │  │                    │ │                    │  │    │  │   ReSpeaker HAT    │ │   ReSpeaker HAT    │  │            │
│  │  │  /export/backup    │ │  /export/movies    │  │    │  └────────────────────┘ └────────────────────┘  │            │
│  │  │  /export/downloads │ │  /export/series    │  │    │                                                  │            │
│  │  │  /export/nvr       │ │                    │  │    │  Wake word: "mirror mirror on the wall"          │            │
│  │  └────────────────────┘ └────────────────────┘  │    └──────────────────────────────────────────────────┘            │
│  └──────────────────────────────────────────────────┘                                                                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Tools

| Tool | Purpose |
|------|---------|
| [uv](https://github.com/astral-sh/uv) | Python package and project manager |
| [PyInfra](https://pyinfra.com/) | Host provisioning and configuration management |
| [Pulumi](https://www.pulumi.com/) | Infrastructure as Code for Kubernetes |
| [K3s](https://k3s.io/) | Lightweight Kubernetes distribution |
| [Bun](https://bun.sh/) | JavaScript runtime and package manager |
| [mask](https://github.com/jacobdeichert/mask) | Task runner using `maskfile.md` |
| [p5](https://github.com/pulumi/p5) | Pulumi workspace manager via `p5.toml` |

## Clusters

### Romulus
3 server nodes + 2 agent nodes on VLAN 4/5/100. Hosts identity, secrets, and DevOps services.

| Node | Role | VLAN | Hardware |
|------|------|------|----------|
| sol | cluster-init | 4 | - |
| aurora | server | 5 | - |
| luna | server | 100 | - |
| terra | agent | 4 | - |
| polaris | agent | 4 | - |

### Pantheon
3 server nodes + 3 agent nodes on VLAN 3/4. Hosts GPU workloads, media, and monitoring.

| Node | Role | VLAN | Hardware |
|------|------|------|----------|
| apollo | cluster-init | 3 | Intel CPU, KVM |
| athena | server | 3 | - |
| artemis | server | 3 | - |
| vulkan | agent (gpu-inference) | 3 | AMD GPU (gfx1151), KVM |
| mars | agent (gpu-inference) | 3 | NVIDIA CUDA (ARM), ZFS storage |
| 172.16.4.202 | agent | 4 | - |

## Project Structure

```
homelab/
├── deploys/           # PyInfra host provisioning scripts
├── docker/            # Custom Docker image builds
├── programs/          # Pulumi micro-stacks (deployable units)
├── src/
│   ├── adapters/      # Connection configuration interfaces
│   ├── components/    # Reusable Pulumi ComponentResources
│   ├── modules/       # Higher-level component compositions
│   ├── providers/     # Custom Pulumi dynamic providers
│   └── utils/         # Shared utility modules
├── packages/          # Custom Pulumi providers
├── docs/              # Research and reference documentation
├── scripts/           # Utility scripts
├── .tekton/           # Tekton Pipelines as Code definitions
├── inventory.py       # PyInfra host inventory
├── maskfile.md        # Task runner commands
└── p5.toml            # Pulumi workspace configuration
```

### Deployment Layer (`deploys/`)

PyInfra scripts for bare-metal host configuration:

| Script | Purpose |
|--------|---------|
| `k3s-node.py` | K3s cluster node setup |
| `nvidia-container-host.py` | NVIDIA container runtime for GPU workloads |
| `ryzen-apu-host.py` | Ryzen APU host configuration |
| `raspberry.py` | Base Raspberry Pi configuration |
| `raspberry-nvme-boot.py` | NVMe boot setup for Raspberry Pi |
| `raspberry-sd-boot.py` | SD card boot setup for Raspberry Pi |
| `wyoming-satellite-deploy.py` | Wyoming voice satellite setup |
| `alloy-node-deploy.py` | Grafana Alloy telemetry agent |
| `snapraid-deploy.py` | SnapRAID configuration for NAS |
| `mergerfs-deploy.py` | MergerFS pooling for media storage |
| `nfs-deploy.py` | NFS server and export configuration |
| `zfs.py` | ZFS pool and dataset management |
| `install-zfs.py` | ZFS package installation |
| `mount-disks.py` | Disk mounting configuration |
| `dev-mode.py` | Enable development mode on a node |
| `prod-mode.py` | Enable production mode on a node |
| `disable-nvme-pcie-power-control.py` | Disable NVMe PCIe power management |
| `drive-debug.py` | Disk debugging utilities |
| `wipe-disk.py` | Disk wipe utility |

### Infrastructure Layer (`src/`)

#### Adapters
Standardized connection configuration interfaces:

| Adapter | Purpose |
|---------|---------|
| `postgres.ts` | PostgreSQL connection config with SSL support |
| `mongodb.ts` | MongoDB connection config with replica sets |
| `redis.ts` | Redis/Valkey connection config |
| `s3.ts` | S3-compatible storage configuration |
| `docker.ts` | Docker registry authentication |
| `storage.ts` | Kubernetes PVC configuration |
| `stack-reference.ts` | Cross-stack reference configuration |
| `webhook.ts` | Webhook endpoint configuration |

#### Components
Reusable Pulumi ComponentResource classes (74 components):

| Category | Components |
|----------|------------|
| Databases | `bitnami-postgres`, `bitnami-mongodb`, `bitnami-valkey`, `basic-mongodb`, `cloudnative-pg`, `cloudnative-pg-cluster`, `meilisearch`, `valkey` |
| Storage | `rook-ceph`, `rook-ceph-cluster`, `rook-ceph-bucket`, `rook-ceph-object-store`, `rook-ceph-object-store-user`, `ceph-block-pool`, `ceph-filesystem`, `velero`, `external-snapshotter`, `kopia-repository-sync`, `s3-sync-cronjob` |
| Networking | `kgateway`, `traefik`, `metal-lb`, `cloudflare-tunnel`, `cloudflare-account-token`, `external-dns`, `external-dns-routeros-webhook`, `gateway-reverse-proxy`, `coturn`, `nanomq`, `nats` |
| Certificates | `cert-manager`, `certificate`, `cluster-issuer` |
| DNS | `technitium-dns` |
| Monitoring | `grafana`, `loki`, `mimir`, `alloy`, `k8s-monitoring`, `nvidia-dcgm-exporter`, `nvidia-device-plugin`, `prometheus-exporter`, `mktxp` |
| AI/ML | `agent-gateway`, `vllm`, `kokoro-api`, `inference-pool`, `librechat`, `librechat-rag` |
| Media | `frigate`, `go2rtc`, `immich` |
| DevOps | `forgejo`, `docker-registry`, `buildkit`, `tekton` |
| Identity | `authentik`, `authentik-oidc-app`, `vaultwarden` |
| Virtualization | `kvm-device-plugin` |
| Home | `omada-controller`, `freshrss`, `radicale`, `trmnl-laravel`, `kiwix`, `searxng`, `sourcebot` |
| Cluster | `k3s-etcd-s3-config`, `whoami` |

#### Modules
Higher-level abstractions combining multiple components:

| Module | Purpose |
|--------|---------|
| `ingress` | Complete ingress with Gateway API, DNS, and certificates |
| `storage` | Ceph storage with block pools, filesystems, and backup |
| `postgres` | PostgreSQL with connection management |
| `mongodb` | MongoDB with architecture options |
| `redis-cache` | Redis-compatible caching |
| `ai-inference` | Multi-model vLLM with Gateway API routing |
| `grafana-stack` | Monitoring with Grafana, Loki, Mimir |
| `dns` | DNS server with zone management |
| `git` | Git hosting with CI runners |
| `authentik` | Identity provider with OIDC |
| `bitwarden` | Password management |
| `docker-registry` | Container image registry |
| `firecrawl` | Web scraping service |
| `immich` | Photo management |

#### Providers
Custom Pulumi dynamic providers:

| Provider | Purpose |
|----------|---------|
| `argon2.ts` | Argon2 password hashing |
| `technitium/` | Technitium DNS server management (zones, records, blocklists, settings) |

### Program Layer (`programs/`)

Pulumi micro-stacks - each is independently deployable:

| Program | Cluster | Purpose |
|---------|---------|---------|
| `storage` | pantheon, romulus | Rook-Ceph distributed storage |
| `ingress` | pantheon, romulus | Gateway API, MetalLB, ExternalDNS, Certificates |
| `monitoring` | pantheon, romulus, jupiter | K8s monitoring with Grafana Alloy |
| `grafana` | pantheon | Grafana, Loki, Mimir stack |
| `dns` | pantheon, romulus | Technitium DNS with ExternalDNS |
| `forgejo` | romulus | Forgejo git hosting with Actions runners |
| `authentik` | romulus | Identity provider |
| `bitwarden` | romulus | Vaultwarden password manager |
| `container-registry` | pantheon | Docker registry |
| `backup` | pantheon, romulus, jupiter | Velero backup to S3 |
| `object-storage` | pantheon, romulus | Ceph object storage |
| `media-server` | prod | Media server stack |
| `nvr` | pantheon | NVR with AI detection |
| `immich` | pantheon | Photo management |
| `ai-inference` | pantheon | vLLM inference with GPU nodes |
| `agent-gateway` | pantheon | LLM gateway and routing |
| `kokoro` | pantheon | TTS service |
| `firecrawl` | pantheon | Web scraping service |
| `nvidia-runtime` | pantheon | NVIDIA device plugin |
| `cloudnative-pg` | pantheon, romulus | CloudNativePG operator |
| `buildkit` | pantheon | BuildKit container builder |
| `tekton` | pantheon | Tekton CI/CD pipelines |
| `openbao` | romulus | Internal-only OpenBao secrets management |
| `hetzner-server` | vpn | Hetzner cloud VPN server |
| `reverse-proxy` | home-assistant | Gateway reverse proxy |
| `tplink-omada` | romulus | TP-Link Omada network controller |
| `nats` | pantheon | NATS messaging |
| `searxng` | romulus | Metasearch engine |
| `sourcebot` | romulus | Code search engine |
| `kiwix` | romulus | Offline content server |
| `meilisearch` | romulus | Search engine |
| `dav` | romulus | CalDAV/CardDAV server |
| `rss` | romulus | RSS feed reader |
| `trmnl` | romulus | TRMNL dashboard |

### Custom Docker Images (`docker/`)

| Image | Purpose |
|-------|---------|
| `bitnami-postgres-pgvector` | PostgreSQL with pgvector extension |
| `bitnami-postgres-documentdb` | PostgreSQL with DocumentDB compatibility |
| `frigate-yolov9` | Frigate with YOLOv9 models |
| `vllm` | vLLM for AMD ROCm GPUs |

## CI/CD

### Tekton Pipelines as Code (`.tekton/`)
Self-hosted pipelines on Forgejo via Tekton PAC:
- `pull-request.yaml` - Pull request validation
- `push-main.yaml` - Main branch pipeline
- `tag-release.yaml` - Tag release pipeline
- `build-firecrawl.yaml` - Firecrawl container build
- `build-firecrawl-playwright.yaml` - Firecrawl Playwright container build
- `build-firecrawl-nuq-postgres.yaml` - Firecrawl NUQ PostgreSQL container build

### GitHub Actions (`.github/workflows/`)
Public registry builds:
- `build-bitnami-postgres-pgvector.yml`
- `build-bitnami-postgres-documentdb.yml`
- `build-frigate-yolov9.yml`
- `build-firecrawl.yml`
- `build-firecrawl-playwright.yml`

## Storage Architecture

### Kubernetes Storage (Rook-Ceph)
Distributed storage across cluster nodes with:
- Block storage (RBD) for databases
- Shared filesystem (CephFS) for multi-pod access
- Object storage (RGW) for S3-compatible buckets

### NAS Storage
| Server | Technology | Capacity | Exports |
|--------|------------|----------|---------|
| 172.16.4.10 | ZFS RAIDZ1 (SSD) | ~16TB usable | `/export/backup`, `/export/downloads`, `/export/nvr` |
| 172.16.4.11 | SnapRAID + MergerFS (HDD) | ~40TB usable | `/export/movies`, `/export/series` |

## Networking

- **Domain**: `holdenitdown.net`
- **Load Balancing**: MetalLB with `default-pool`
- **Ingress**: Gateway API via kgateway (Envoy-based)
- **DNS**: Technitium DNS with ExternalDNS RFC2136 webhook
- **Certificates**: cert-manager with Let's Encrypt
- **External Access**: Cloudflare Tunnel

## Monitoring

Observability stack via Grafana Alloy:
- **Metrics**: Prometheus remote write to Mimir
- **Logs**: Loki for log aggregation
- **Dashboards**: Grafana with pre-configured Kubernetes dashboards
- **Host Metrics**: smartctl exporter for disk health
- **GPU Metrics**: NVIDIA DCGM exporter

## Getting Started

### Prerequisites
- [uv](https://github.com/astral-sh/uv) for Python
- [Bun](https://bun.sh/) for TypeScript
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [mask](https://github.com/jacobdeichert/mask) (optional, for task runner)

### Installation
```bash
uv sync
bun install
```

### PyInfra Commands
```bash
# Debug inventory
mask pyinfra debug

# Deploy to specific node
mask pyinfra deploy-node --node sol --script deploys/k3s-node.py

# Execute command on cluster
mask pyinfra exec --command "uptime"

# Pull kubeconfig
mask pyinfra pull-kubeconfig --cluster pantheon
```

### Pulumi Commands
```bash
# Preview changes
pulumi preview -C programs/monitoring -s pantheon

# Deploy stack
pulumi up -C programs/monitoring -s pantheon

# Using p5 workspace manager
p5 select monitoring:pantheon
p5 up
```

## Configuration

### Pulumi Stack Config
Each program has stack-specific configuration in `Pulumi.<stack>.yaml`:
```yaml
config:
  monitoring:clusterName: pantheon
  monitoring:telemetryEndpoint: telemetry.holdenitdown.net
```

### PyInfra Inventory
Host configuration in `inventory.py` with per-host data:
```python
romulus = [
    ("sol.holdenitdown.net", {
        "k3s_cluster": { ... },
        "alloy": { ... },
    }),
]
```

## Operations

- OpenBao bootstrap, manual unseal, and Authentik OIDC setup: `docs/operations/openbao.md`
- OpenBao is the v1 source of truth for secret values, while Pulumi remains responsible for rendering workload Kubernetes `Secret` resources. Pulumi uses OpenBao through the Vault-compatible Transit API with `hashivault://<transit-key>` provider strings; direct pod-side injection with External Secrets Operator, CSI, or injector sidecars is deferred.
