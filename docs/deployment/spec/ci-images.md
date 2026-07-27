# CI Helper Images

This specification defines intended behavior for reusable workflow images. It does not govern application runtime images under `docker/`.

## Bun CI

### Tooling

The generic Bun CI image MUST:

- use `oven/bun:1.3` as its base image;
- provide `bun`, `git`, an SSH client, and CA certificates; and
- use the internal apt and Bun-compatible package mirrors for supported package sources.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest` for main-branch changes to `docker/bun-ci/**` or its own pipeline definition. Unrelated homelab changes MUST NOT be required to build the image.

## Tauri E2E CI

### Tooling

The generic Tauri E2E CI image MUST provide:

- Bun, Rust and Cargo, Git, an SSH client, and CA certificates;
- the Linux build and WebKit/GTK runtime dependencies needed by Tauri desktop tests;
- Xvfb headless-display support; and
- a Docker CLI that can communicate with a separately supplied Docker-in-Docker sidecar.

The image MUST NOT require a Docker daemon inside its own step container. Supported apt, Bun-compatible, and Cargo package sources MUST use the internal mirrors.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-e2e-ci:latest` for main-branch changes to `docker/tauri-e2e-ci/**` or its own pipeline definition. Unrelated homelab changes MUST NOT be required to build the image.
