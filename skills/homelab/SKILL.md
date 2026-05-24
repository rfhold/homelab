---
name: homelab
description: Reference for the rfhold homelab infrastructure at holdenitdown.net. Use when working with Kubernetes clusters (romulus, pantheon), deploying services, writing Pulumi stacks, configuring ingress or DNS, referencing service URLs, understanding storage (Ceph, NAS, S3), or asking about any homelab host or node. Trigger phrases: "deploy to homelab", "what namespace", "which cluster", "homelab service", "holdenitdown.net", "romulus", "pantheon", "Pulumi stack".
metadata:
  author: rfhold
  category: infrastructure
  source-repo: rfhold/homelab
  last-updated: "2026-04-19"
---

# Homelab Infrastructure Reference

> Last updated: 2026-03-03 | Source: [rfhold/homelab](https://git.holdenitdown.net/rfhold/homelab) @ `9f1f88b8`

Primary domain: `holdenitdown.net`. Two K3s clusters managed with Pulumi (TypeScript micro-stacks) and PyInfra.

## Clusters

### ROMULUS — identity, storage, DevOps, home services
- API: `romulus.holdenitdown.net:6443` | kubectl context: `romulus`
- Load balancer pool: `172.16.4.51–172.16.4.60` | DNS IP: `172.16.4.8`
- Traefik LB: `172.16.4.60`

| Node    | Role         | VLAN |
| ------- | ------------ | ---- |
| sol     | cluster-init | 4    |
| aurora  | server       | 5    |
| luna    | server       | 100  |
| terra   | agent        | 4    |
| polaris | agent        | 4    |

### PANTHEON — GPU/AI workloads, CI/CD, media
- API: `pantheon.holdenitdown.net:6443` | kubectl context: `pantheon`
- Load balancer pool: `172.16.3.51–172.16.3.69` | DNS IP: `172.16.3.8`
- Traefik LB: `172.16.3.60`

| Node   | Role          | Hardware           | Notes                              |
| ------ | ------------- | ------------------ | ---------------------------------- |
| apollo | cluster-init  | Intel CPU          | KVM enabled; CI pipeline node      |
| vulkan | agent         | AMD GPU (gfx1151)  | KVM enabled; BuildKit amd64        |
| mars   | agent (CUDA)  | NVIDIA ARM         | ZFS NVMe mirror; BuildKit arm64    |

GPU nodes carry taint `workload-type=gpu-inference:NoSchedule` and label `rholden.dev/gpu: cuda`. NVIDIA runtime class: `nvidia`.

### JUPITER — third cluster, backup/monitoring only (partial inventory)

## Services by Cluster

### Romulus

| Service        | URL / Address                          | Namespace        |
| -------------- | -------------------------------------- | ---------------- |
| Forgejo         | `git.holdenitdown.net`                  | `forgejo`         |
| Authentik (SSO) | `auth.holdenitdown.net`                 | `authentik`       |
| Vaultwarden     | `bitwarden.holdenitdown.net`            | `bitwarden`       |
| Technitium DNS  | `primary.dns.holdenitdown.net` (:5380)  | `dns`             |
| MeiliSearch     | `meilisearch.holdenitdown.net`          | `meilisearch`     |
| SearXNG         | `searxng.holdenitdown.net`              | `searxng`         |
| FreshRSS        | `freshrss.holdenitdown.net`             | `rss`             |
| Radicale DAV    | `dav.holdenitdown.net`                  | `dav`             |
| Grocy           | `grocy.holdenitdown.net`                | `home-management` |
| Kiwix           | `kiwix.holdenitdown.net`                | `kiwix`           |
| TRMNL           | `trmnl.holdenitdown.net`                | `trmnl`           |
| Omada           | `omada.holdenitdown.net`                | `omada`           |
| Romulus S3      | `s3.romulus.holdenitdown.net`           | `storage`         |

### Pantheon

| Service              | URL / Address                              | Namespace            |
| -------------------- | ------------------------------------------ | -------------------- |
| Container Registry   | `cr.holdenitdown.net`                       | `container-registry` |
| Docker Hub cache     | `docker.cr.holdenitdown.net`                | `container-registry` |
| GHCR cache           | `ghcr.cr.holdenitdown.net`                  | `container-registry` |
| NVIDIA cache         | `nvcr.cr.holdenitdown.net`                  | `container-registry` |
| Grafana              | `grafana.holdenitdown.net`                  | `monitoring`         |
| Telemetry (OTLP)     | `telemetry.holdenitdown.net` (:4317 OTLP)  | `monitoring`         |
| Tekton dashboard     | `tekton.holdenitdown.net`                   | `tekton-pipelines`   |
| Tekton PAC webhook   | `pac.holdenitdown.net`                      | `tekton-pac`         |
| Agent Gateway        | `agent-gateway.holdenitdown.net`            | `agentgateway-system` |
| Qwen3-Embedding      | `qwen3-embedding.holdenitdown.net`          | `ai-inference`       |
| Qwen3-Coder          | `qwen3-coder.holdenitdown.net`              | `ai-inference`       |
| Inference gateway    | `inference.holdenitdown.net`                | `ai-inference`       |
| Kokoro TTS           | `kokoro.holdenitdown.net`                   | `ai-inference`       |
| Speaches STT/TTS     | `speaches.holdenitdown.net`                 | `ai-inference`       |
| LobeChat             | `lobechat.holdenitdown.net`                 | `lobechat`           |
| Firecrawl            | `firecrawl.holdenitdown.net`                | `firecrawl`          |
| Immich               | `immich.holdenitdown.net`                   | `immich`             |
| Frigate NVR          | `frigate.holdenitdown.net`                  | `nvr`                |
| COTURN               | `turn.holdenitdown.net`                     | `nvr`                |
| OpenCode (web)       | `opencode.holdenitdown.net`                 | `opencode`           |
| OpenCode (SSH:2200)  | `devbox.holdenitdown.net`                   | `opencode`           |
| Cuthulu server       | `cuthulu.holdenitdown.net`                  | `cuthulu`            |
| Pantheon S3          | `s3.pantheon.holdenitdown.net`              | `storage`            |
| NATS                 | `nats.nats.svc:4222` (in-cluster)           | `nats`               |
| Walter (prod)        | `walter.holdenitdown.net`                   | `walter`             |
| Walter (preview)     | `preview-walter.holdenitdown.net`           | `walter-preview`     |

### External / Physical

| Host                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `172.16.1.10`             | Home Assistant → `home.holdenitdown.net`            |
| `tmux.holdenitdown.net`   | Tmux session API server                           |
| `172.16.4.10`             | NAS — ZFS SSD RAIDZ1 (backups, downloads, NVR)   |
| `172.16.4.11`             | NAS — SnapRAID/MergerFS HDD (~40TB, media)        |
| `mars:/export/models`     | NFS model cache (ZFS NVMe mirror, 1T quota)       |
| `phobos.holdenitdown.net` | Voice satellite (Raspberry Pi + ReSpeaker)        |
| `deimos.holdenitdown.net` | Voice satellite (Raspberry Pi + ReSpeaker)        |

## Networking & DNS

- **Primary DNS:** `172.16.4.8` (Technitium, romulus) — authoritative for `holdenitdown.net`, `rholden.dev`, `rholden.me`
- **Secondary DNS:** `172.16.3.8` (Technitium, pantheon) — replicates from primary
- **ExternalDNS:** RFC2136 TSIG to primary at `172.16.4.8` (TSIG key: `external-dns`)
- **TLS:** cert-manager + Let's Encrypt, DNS-01 via Cloudflare; wildcards for `*.holdenitdown.net`, `*.romulus.holdenitdown.net`, `*.pantheon.holdenitdown.net`, `*.rholden.dev`, `*.rholden.me`
- **Ingress:** Traefik (class `internal`) + kgateway/Envoy (GatewayClass `kgateway`) with Gateway API
  - Both clusters have a `default-gateway` in namespace `ingress`
  - Use `HTTPRoute` (Gateway API) for new services, not `Ingress`
- **Cloudflare Tunnel** (romulus): exposes `overseerr.rholden.dev` and `home.rholden.dev` to the public internet

## Storage

- **Ceph RGW S3 (romulus):** `s3.romulus.holdenitdown.net` and `*.s3.romulus.holdenitdown.net`
- **Ceph RGW S3 (pantheon):** `s3.pantheon.holdenitdown.net` and `*.s3.pantheon.holdenitdown.net`
- **Pulumi state bucket:** `pulumi-state` on both Ceph RGWs
- **Velero backup bucket:** `cluster-backup` on Ceph RGW + NFS at `172.16.4.10:/export/backup/cluster`
- **Walter session storage:** S3 buckets on `s3.pantheon.holdenitdown.net`

## Pulumi Stacks

Managed as TypeScript micro-stacks in the `homelab` repo. Stack names are `<program>.<cluster>`, e.g. `grafana.pantheon`.

Key programs: `ingress`, `dns`, `storage`, `forgejo`, `authentik`, `bitwarden`, `monitoring`, `tekton`, `buildkit`, `nats`, `walter`, `ai-inference`, `agent-gateway`, `firecrawl`, `immich`, `nvr`, `opencode`, `cuthulu`, `lobechat`, `vpn`.

Run stacks via `p5` (workspace manager) or `pulumi up` from within the program directory.

## HTTPRoute Pattern (Gateway API)

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-service
  namespace: my-namespace
spec:
  parentRefs:
    - name: default-gateway
      namespace: ingress
  hostnames:
    - my-service.holdenitdown.net
  rules:
    - backendRefs:
        - name: my-service
          port: 8080
```

For gRPC (h2c): set `appProtocol: kubernetes.io/h2c` on the Service port and add `timeouts: { request: "0s" }` on the HTTPRoute rule for streaming connections.

## Agent Gateway Models (self-hosted + external)

Agent Gateway at `agent-gateway.holdenitdown.net` routes to:
- `chutes/kimi-k2`, `chutes/qwen3-235b`, `chutes/glm-5`
- `Qwen/Qwen3-Embedding-4B` — self-hosted NVIDIA CUDA (mars node)
- Cloud: Anthropic Claude, OpenAI GPT via API keys

## External LLM / AI Services Referenced

| Service       | URL                              | Notes                              |
| ------------- | -------------------------------- | ---------------------------------- |
| Agent Gateway | `agent-gateway.holdenitdown.net`  | OpenAI-compatible gateway          |
| Qwen3-Coder   | `qwen3-coder.holdenitdown.net/v1` | Used by Firecrawl AI extraction    |
| Ollama        | `ollama.holdenitdown.net`         | Referenced in dev tools            |
| Kokoro TTS    | `kokoro.holdenitdown.net/v1/audio/speech` | OpenAI-compatible TTS      |
| WhisperX STT  | `whisperx.holdenitdown.net/transcribe`    | STT endpoint                |
