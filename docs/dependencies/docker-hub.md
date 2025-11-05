# Docker Hub Images Documentation

## Overview

This document provides comprehensive documentation of Docker Hub images used in the homelab infrastructure. The setup utilizes a multi-registry strategy with 40+ Docker images across various categories including databases, monitoring, networking, storage, and utilities.

## Database & Storage Images

Official and community-maintained database and storage solutions:

- **mongo:8.0.12-noble** - Official MongoDB database
- **docker.io/bitnami/postgresql:17.5.0-debian-12-r12** - PostgreSQL database (Bitnami)
- **docker.io/bitnami/postgresql:17.5.0-debian-12-r16** - PostgreSQL database (Bitnami)
- **docker.io/bitnami/valkey:8.1.2-debian-12-r0** - Redis-compatible data store (Bitnami)
- **memcached:1.6.39-alpine** - Memcached in-memory caching system

## Monitoring & Observability

Grafana ecosystem and observability tools:

- **docker.io/grafana/alloy:v1.11.0** - Grafana observability agent
- **docker.io/grafana/alloy:v1.11.2** - Grafana observability agent
- **docker.io/grafana/grafana:12.2.0** - Grafana analytics and monitoring platform
- **docker.io/grafana/loki:3.5.5** - Grafana Loki log aggregation system
- **grafana/mimir:2.17.0** - Grafana Mimir scalable time-series database
- **grafana/rollout-operator:v0.28.0** - Grafana rollout operator

## Networking & Load Balancing

Edge routing and web server solutions:

- **docker.io/traefik:v3.4.3** - Cloud-native edge router
- **traefik/whoami:latest** - Traefik test application
- **docker.io/nginxinc/nginx-unprivileged:1.28-alpine** - Nginx web server (unprivileged)
- **docker.io/nginxinc/nginx-unprivileged:1.29-alpine** - Nginx web server (unprivileged)

## Storage & Backup

Storage orchestration and backup solutions:

- **docker.io/rook/ceph:v1.17.5** - Ceph storage orchestrator
- **velero/velero:v1.16.1** - Kubernetes backup and restore solution
- **kopia/kopia:latest** - Kopia backup and disaster recovery
- **rclone/rclone:latest** - Rclone file synchronization tool

## Security & Privacy

Security-focused applications and privacy tools:

- **adguard/adguardhome:v0.107.56** - DNS ad blocking and privacy protection
- **docker.io/vaultwarden/server:1.34.1-alpine** - Bitwarden password manager server

## Utilities & Tools

General-purpose utilities and management tools:

- **busybox** - Swiss army knife of embedded Linux (various versions for utilities)
- **lscr.io/linuxserver/grocy:4.5.0** - Grocy pantry management system
- **registry:3.0.0** - Docker Distribution registry server

## Search & Discovery

Search engines and discovery tools:

- **getmeili/meilisearch:v1.15** - Lightning-fast search engine
- **searxng/searxng:2025.7.25-168fa9b** - Privacy-respecting metasearch engine

## Content Management

RSS and content aggregation:

- **freshrss/freshrss:1.27.0-alpine** - RSS feed aggregator (Alpine-based)

## Infrastructure & Networking

Infrastructure components and networking tools:

- **benfiola/external-dns-routeros-provider:v2.0.1** - ExternalDNS provider for RouterOS devices
- **alexxit/go2rtc:1.9.9** - Camera streaming gateway and WebRTC server