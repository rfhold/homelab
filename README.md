# Homelab

A homelab infrastructure project using PyInfra deploy scripts and Pulumi micro-stacks to provision and manage a K3s cluster with various homelab services.

## Tools Used

- **[uv](https://github.com/astral-sh/uv)** - Python package and project manager
- **[PyInfra](https://pyinfra.com/)** - Infrastructure deployment and configuration management
- **[Pulumi](https://www.pulumi.com/)** - Infrastructure as Code platform
- **[K3s](https://k3s.io/)** - Lightweight Kubernetes distribution
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager for TypeScript development

## Project Structure

```
homelab/
├── deploys/                           # PyInfra deployment scripts
│   ├── dev-mode.py                    # Development mode configuration
│   ├── prod-mode.py                   # Production mode configuration
│   ├── k3s-node.py                    # K3s node deployment
│   ├── nvidia-container-host.py       # NVIDIA container runtime setup
│   ├── raspberry.py                   # Raspberry Pi base configuration
│   ├── raspberry-nvme-boot.py         # Raspberry Pi NVMe boot configuration
│   ├── raspberry-sd-boot.py           # Raspberry Pi SD card boot configuration
│   ├── k3s/                           # K3s cluster deployment utilities
│   └── util/                          # Deployment utility functions
├── programs/                          # Pulumi micro-stacks
│   ├── ai-workspace/                  # AI services ecosystem (SearXNG, future: LibreChat)
│   ├── git/                           # Git service (Gitea)
│   ├── ingress/                       # Ingress controller and load balancer
│   └── storage/                       # Storage configuration
├── src/                               # Source code and infrastructure definitions
│   ├── adapters/                      # Service connection configuration interfaces
│   │   ├── docker.ts                  # Docker registry connection config
│   │   ├── postgres.ts                # PostgreSQL connection config
│   │   ├── redis.ts                   # Redis/Valkey connection config
│   │   ├── s3.ts                      # S3 storage connection config
│   │   ├── storage.ts                 # Kubernetes storage config
│   │   └── webhook.ts                 # Webhook configuration utilities
│   ├── components/                    # Reusable Pulumi components
│   │   ├── bitnami-postgres.ts        # PostgreSQL database component
│   │   ├── bitnami-valkey.ts          # Valkey/Redis cache component
│   │   ├── cert-manager.ts            # Certificate management
│   │   ├── certificate.ts             # TLS certificate component
│   │   ├── cluster-issuer.ts          # Certificate cluster issuer
│   │   ├── external-dns.ts            # External DNS management
│   │   ├── external-dns-adguard-webhook.ts  # AdGuard Home DNS webhook
│   │   ├── external-dns-routeros-webhook.ts # RouterOS DNS webhook
│   │   ├── external-snapshotter.ts    # Volume snapshot controller
│   │   ├── gitea.ts                   # Gitea Git service component
│   │   ├── metal-lb.ts                # MetalLB load balancer
│   │   ├── rook-ceph.ts               # Rook Ceph operator
│   │   ├── rook-ceph-cluster.ts       # Rook Ceph storage cluster
│   │   ├── searxng.ts                 # SearXNG privacy-respecting metasearch engine
│   │   ├── traefik.ts                 # Traefik ingress controller
│   │   ├── velero.ts                  # Backup and disaster recovery
│   │   └── whoami.ts                  # Test service component
│   ├── modules/                       # Higher-level abstraction modules
│   │   ├── ai-workspace.ts            # AI services ecosystem module
│   │   ├── git.ts                     # Git service module
│   │   ├── ingress.ts                 # Complete ingress solution
│   │   ├── postgres.ts                # PostgreSQL database module
│   │   ├── redis-cache.ts             # Redis cache module
│   │   └── storage.ts                 # Storage solution module
│   ├── utils/                         # Utility functions
│   │   └── charts.ts                  # Helm chart utilities
│   ├── docker-images.ts               # Docker image definitions
│   └── helm-charts.ts                 # Centralized Helm chart configurations
├── bin/                               # Build and utility scripts
├── docs/                              # Documentation
├── inventory.py                       # PyInfra inventory configuration
├── maskfile.md                        # Task automation definitions
├── package.json                       # TypeScript/Bun dependencies
├── pyproject.toml                     # Python dependencies and configuration
├── tsconfig.json                      # TypeScript configuration
└── uv.lock                            # Python dependency lock file
```

## Architecture Overview

The project is structured in three main layers:

### 1. **Deployment Layer** (`deploys/`)
PyInfra scripts for server configuration and application deployment. These scripts are idempotent and inventory-driven, handling:
- Server provisioning and configuration
- K3s cluster setup
- Hardware-specific configurations (NVIDIA, Raspberry Pi)
- Environment-specific settings (dev/prod modes)

### 2. **Infrastructure Layer** (`src/`)
Pulumi-based infrastructure definitions organized by abstraction level:

- **Adapters**: Service connection configuration interfaces and utilities
- **Components**: Reusable Pulumi components for individual services
- **Modules**: Higher-level abstractions that combine components
- **Utils**: Shared utility functions and configurations

### 3. **Program Layer** (`programs/`)
Pulumi micro-stacks that deploy complete infrastructure solutions:
- **AI Workspace**: AI services ecosystem with SearXNG search (future: LibreChat, Firecrawl, STT/TTS)
- **Git**: Self-hosted Git service with Gitea, including web interface and SSH access
- **Ingress**: Load balancer, ingress controller, DNS, and certificate management
- **Storage**: Distributed storage and backup solutions

## Key Features

### Service Connection Management
Standardized connection configuration interfaces across all infrastructure services with type-safe utilities for:
- Connection string generation
- Environment variable creation
- Credential management
- Client configuration objects

### Implementation Flexibility
Modules provide abstraction layers that allow switching between different implementations:
- **Redis**: Choose between Valkey, Redis, or clustered variants
- **Ingress**: Configurable load balancer and ingress controller implementations
- **Storage**: Multiple storage backend options with unified interface

### Helm Chart Integration
Centralized Helm chart management with:
- Version consistency across deployments
- OCI and traditional chart support
- Standardized chart configuration patterns

## Getting Started

### Dependencies
```bash
# Install Python dependencies
uv sync

# Install TypeScript dependencies
bun install
```

### Basic Usage

**Deploy infrastructure (PyInfra):**
```bash
# Deploy to specific host
uv run pyinfra inventory.py --limit <hostname> <script.py>

# Example: Configure K3s node
uv run pyinfra inventory.py --limit k3s-master k3s-node.py
```

**Deploy Pulumi stacks:**
```bash
# Deploy stack
pulumi --cwd programs/ingress up
```

## Development

### Project Standards
- **TypeScript**: Strict typing, no comments unless requested
- **Python**: Follow PyInfra patterns with explicit imports
- **Documentation**: Maintain README files in sync with codebase
- **Testing**: Manual testing and code review required

### Adding New Components
1. Create component in `src/components/`
2. Add to `src/helm-charts.ts` if using Helm
3. Consider creating a module abstraction in `src/modules/`
4. Update relevant README files
5. Add to appropriate program in `programs/`

For detailed patterns and guidelines, see the `AGENTS.md` files in each directory.

