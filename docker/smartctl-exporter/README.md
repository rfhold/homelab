# smartctl-exporter Multi-Arch Docker Image

Multi-architecture Docker image for [smartctl-exporter](https://github.com/prometheus-community/smartctl_exporter) that supports AMD64 and ARM64.

## Why This Exists

The official `quay.io/prometheuscommunity/smartctl-exporter` images only support AMD64. This custom build enables deployment on ARM-based systems by downloading the official ARM binaries and packaging them into multi-arch Docker images.

## Supported Architectures

- `linux/amd64`
- `linux/arm64`

## Usage

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/rfhold/smartctl-exporter:v0.14.0
```

### Run Locally

```bash
docker run -d \
  --privileged \
  -p 9633:9633 \
  -v /dev:/dev:ro \
  -v /run/udev:/run/udev:ro \
  ghcr.io/rfhold/smartctl-exporter:v0.14.0
```

### Docker Compose

```bash
docker compose up -d
```

### Kubernetes DaemonSet

See `src/components/smartctl-exporter.ts` for the Pulumi component implementation.

## Build Arguments

- `VERSION`: smartctl_exporter version (default: `0.14.0`)
- `ARCH`: Target architecture (default: `arm64`, auto-detected in multi-arch builds)
- `OS`: Target OS (default: `linux`)

## Local Build

```bash
docker build -t smartctl-exporter:local .
```

## Multi-Arch Build

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=0.14.0 \
  -t ghcr.io/rfhold/smartctl-exporter:v0.14.0 \
  --push \
  .
```

## Metrics Endpoint

Metrics are exposed at `http://localhost:9633/metrics`

## Requirements

- Container must run with `privileged: true` to access disk devices
- Host `/dev` and `/run/udev` must be mounted

## Source

- Upstream: https://github.com/prometheus-community/smartctl_exporter
- Binaries: https://github.com/prometheus-community/smartctl_exporter/releases
