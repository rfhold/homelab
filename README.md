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
│  ┌──────────────────────────────────────────────────┐    ┌──────────────────────────────────────────────────┐            │
│  │              ROMULUS CLUSTER                     │    │              PANTHEON CLUSTER                    │            │
│  │              (K3s - 4 nodes)                     │    │              (K3s - 4 nodes)                     │            │
│  │                                                  │    │                                                  │            │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │    │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │            │
│  │  │  sol   │ │ aurora │ │  luna  │ │ terra  │    │    │  │ apollo │ │ vulkan │ │  mars  │ │ agent  │    │            │
│  │  │ server │ │ server │ │ server │ │ agent  │    │    │  │ server │ │ agent  │ │ agent  │ │        │    │            │
│  │  │        │ │        │ │        │ │        │    │    │  │ Intel  │ │AMD GPU │ │CUDA GPU│ │        │    │            │
│  │  └────────┘ └────────┘ └────────┘ └────────┘    │    │  └────────┘ └────────┘ └────────┘ └────────┘    │            │
│  │                                                  │    │                                                  │            │
│  │  Services: Gitea, Authentik, Bitwarden,         │    │  Services: Media Server, AI Inference, Immich,   │            │
│  │            Object Storage, DNS                   │    │            NVR, Monitoring, Grafana              │            │
│  └──────────────────────────────────────────────────┘    └──────────────────────────────────────────────────┘            │
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
3 server nodes + 1 agent node on VLAN 4/5/100. Hosts identity, secrets, and DevOps services.

| Node | Role | VLAN | Hardware |
|------|------|------|----------|
| sol | cluster-init | 4 | - |
| aurora | server | 5 | - |
| luna | server | 100 | - |
| terra | agent | 4 | - |

### Pantheon
1 server node + 3 agent nodes on VLAN 3/4. Hosts GPU workloads, media, and monitoring.

| Node | Role | VLAN | Hardware |
|------|------|------|----------|
| apollo | cluster-init | 3 | Intel CPU |
| vulkan | agent (gpu-inference) | 3 | AMD GPU (gfx1151) |
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
│   └── modules/       # Higher-level component compositions
├── packages/          # Custom Pulumi providers
├── docs/              # Research and reference documentation
├── scripts/           # Utility scripts
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
| `raspberry.py` | Base Raspberry Pi configuration |
| `raspberry-nvme-boot.py` | NVMe boot setup for Raspberry Pi |
| `wyoming-satellite-deploy.py` | Wyoming voice satellite setup |
| `alloy-node-deploy.py` | Grafana Alloy telemetry agent |
| `snapraid-deploy.py` | SnapRAID configuration for NAS |
| `mergerfs-deploy.py` | MergerFS pooling for media storage |
| `zfs.py` | ZFS pool and dataset management |

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

#### Components
Reusable Pulumi ComponentResource classes (~70 components):

| Category | Components |
|----------|------------|
| Databases | `bitnami-postgres`, `bitnami-mongodb`, `bitnami-valkey`, `cloudnative-pg-cluster` |
| Storage | `rook-ceph`, `rook-ceph-cluster`, `ceph-block-pool`, `ceph-filesystem`, `velero` |
| Networking | `kgateway`, `traefik`, `metal-lb`, `cloudflare-tunnel`, `external-dns` |
| Certificates | `cert-manager`, `certificate`, `cluster-issuer` |
| Monitoring | `grafana`, `loki`, `mimir`, `alloy`, `k8s-monitoring`, `nvidia-dcgm-exporter` |
| AI/ML | `vllm`, `kokoro-api`, `speaches`, `inference-pool`, `librechat`, `lobechat` |
| Media | `frigate`, `go2rtc`, `immich` |
| DevOps | `gitea`, `gitea-act-runner`, `docker-registry` |
| Identity | `authentik`, `vaultwarden` |

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
| `ai-workspace` | AI services ecosystem (search, chat, RAG) |
| `grafana-stack` | Monitoring with Grafana, Loki, Mimir |

### Program Layer (`programs/`)

Pulumi micro-stacks - each is independently deployable:

| Program | Cluster | Purpose |
|---------|---------|---------|
| `storage` | pantheon, romulus | Rook-Ceph distributed storage |
| `ingress` | pantheon | Gateway API, MetalLB, ExternalDNS, Certificates |
| `monitoring` | pantheon, romulus, jupiter | K8s monitoring with Grafana Alloy |
| `grafana` | pantheon | Grafana, Loki, Mimir stack |
| `dns` | pantheon, romulus | AdGuard Home with ExternalDNS |
| `git` | romulus | Gitea with Actions runners |
| `gitea-actions` | pantheon, arm-builder | Self-hosted CI runners |
| `authentik` | romulus | Identity provider |
| `bitwarden` | romulus | Vaultwarden password manager |
| `container-registry` | pantheon | Docker registry |
| `backup` | pantheon, romulus, jupiter | Velero backup to S3 |
| `object-storage` | pantheon, romulus | Ceph object storage |
| `media-server` | pantheon | Media server stack |
| `nvr` | pantheon | Frigate NVR with AI detection |
| `immich` | pantheon | Photo management |
| `ai-inference` | pantheon | vLLM inference with GPU nodes |
| `lobechat` | pantheon | AI chat interface |
| `kokoro` | pantheon | TTS service |
| `speaches` | pantheon | STT/TTS with OpenAI API |
| `firecrawl` | pantheon | Web scraping service |
| `opencode` | pantheon | OpenCode AI coding assistant |
| `nvidia-runtime` | pantheon | NVIDIA device plugin |

### Custom Docker Images (`docker/`)

| Image | Purpose |
|-------|---------|
| `bitnami-postgres-pgvector` | PostgreSQL with pgvector extension |
| `bitnami-postgres-documentdb` | PostgreSQL with DocumentDB compatibility |
| `frigate-yolov9` | Frigate with YOLOv9 models |
| `speaches` | STT/TTS with faster-whisper and Kokoro |
| `vllm-rocm` | vLLM for AMD ROCm GPUs |

## CI/CD

### Gitea Actions (`.gitea/workflows/`)
Self-hosted runners for container builds:
- `build-firecrawl.yml` - Firecrawl scraping service
- `build-firecrawl-playwright.yml` - Playwright service for Firecrawl
- `build-vllm-rocm.yml` - vLLM ROCm image

### GitHub Actions (`.github/workflows/`)
Public registry builds:
- `build-bitnami-postgres-pgvector.yml`
- `build-bitnami-postgres-documentdb.yml`
- `build-frigate-yolov9.yml`
- `build-speaches-cuda.yml`

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
- **DNS**: AdGuard Home with ExternalDNS webhook
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

