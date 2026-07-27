# CI Helper Images

This specification defines intended behavior for reusable workflow images. It does not govern application runtime images under `docker/`.

## General CI

### Tooling

The general CI image MUST provide pinned Rust, Node.js, pnpm, Bun, Go, Pulumi, Buf, staticcheck, and wasm-bindgen toolchains for Linux amd64 and arm64. It MUST include rustfmt, Clippy, the `wasm32-unknown-unknown` target, native compiler tooling, Git, GnuPG, an SSH client, and CA certificates. Supported apt, Cargo, npm, Bun-compatible, and Go package sources MUST use the internal mirrors.

The image MUST run its tracked version contract while building each architecture. It is a shared verifier and infrastructure toolchain; Android, Tauri E2E, BuildKit, Git policy, and registry-operation requirements remain in purpose-built images.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST build and verify native `general-ci:latest-amd64` and `general-ci:latest-arm64` images before publishing the `general-ci:latest` manifest. Consumers of the mutable manifest MUST request an image pull on every TaskRun. Initial adoption is limited to Kuri while the existing focused CI images remain supported.

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
