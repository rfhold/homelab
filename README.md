# Homelab

A homelab infrastructure project using PyInfra deploy scripts and Pulumi micro-stacks to provision and manage a K3s cluster with various homelab services.

## Tools Used

- **[uv](https://github.com/astral-sh/uv)** - Python package and project manager
- **[PyInfra](https://pyinfra.com/)** - Infrastructure deployment and configuration management
- **[Pulumi](https://www.pulumi.com/)** - Infrastructure as Code platform
- **[K3s](https://k3s.io/)** - Lightweight Kubernetes distribution

## Project Structure

```
homelab/
├── deploys/                         # PyInfra deployment scripts
│   ├── k3s-node.py                  # K3s node deployment
│   ├── mergerfs-snapraid-cluster.py # Storage cluster setup
│   ├── node-exporter.py             # Prometheus node exporterp
│   ├── nvidia-container-host.py     # NVIDIA container runtime
│   └── raspberry.py                 # Raspberry Pi configuration
├── stacks/                          # Pulumi micro-stacks
│   ├── backups/                     # Backup solutions
│   ├── docker-registry/             # Container registry
│   ├── git/                         # Git services
│   ├── ingress/                     # Ingress configuration
│   ├── secrets/                     # Secret management
│   └── storage/                     # Storage configuration
└── src/                             # Source code and components
    ├── components/
    ├── interfaces/
    └── modules/
```

