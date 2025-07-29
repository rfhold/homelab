# Homelab

A homelab infrastructure project using PyInfra deploy scripts and Pulumi micro-stacks to provision and manage a K3s cluster with various homelab services.

## Tools Used

- **[uv](https://github.com/astral-sh/uv)** - Python package and project manager
- **[PyInfra](https://pyinfra.com/)** - Infrastructure deployment and configuration management
- **[Pulumi](https://www.pulumi.com/)** - Infrastructure as Code platform
- **[K3s](https://k3s.io/)** - Lightweight Kubernetes distribution
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager for TypeScript development

## Architecture Overview

The project is structured in three main layers:

### 1. **Deployment Layer** (`deploys/`)
PyInfra scripts for server configuration and application deployment.

### 2. **Infrastructure Layer** (`src/`)
Pulumi-based infrastructure definitions organized by abstraction level:
- **Adapters**: Service connection configuration interfaces and utilities
- **Components**: Reusable Pulumi components for individual services
- **Modules**: Higher-level abstractions that combine components

### 3. **Program Layer** (`programs/`)
Pulumi micro-stacks that deploy complete infrastructure solutions.

## Getting Started

### Dependencies
```bash
# Install Python dependencies
uv sync

# Install TypeScript dependencies
bun install
```

