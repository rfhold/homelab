# CI Helper Images

This specification defines intended behavior for reusable workflow images. It does not govern application runtime images under `docker/`.

## General CI

### Tooling

The general CI image MUST provide pinned Rust, Node.js, pnpm, Bun, Go, CPython 3.13, uv, Pulumi, Buf, staticcheck, and wasm-bindgen toolchains for Linux amd64 and arm64. It MUST expose CPython through both `python` and `python3` and include rustfmt, Clippy, the `wasm32-unknown-unknown` target, native compiler tooling, Git, GnuPG, an SSH client, and CA certificates. Supported apt, Cargo, npm, Bun-compatible, Go, and PyPI package sources MUST use the internal mirrors.

The image MUST run its tracked version contract while building each architecture. It is a shared verifier and infrastructure toolchain; Android, Tauri E2E, BuildKit, Git policy, and registry-operation requirements remain in purpose-built images.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST build and verify native `general-ci:latest-amd64` and `general-ci:latest-arm64` images before publishing the `general-ci:latest` manifest. Consumers of the mutable manifest MUST request an image pull on every TaskRun. Repositories whose CI requirements are covered by the General CI toolchain SHOULD use it, while focused CI images remain supported for specialized requirements.

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

## Tauri Release CI

### Tooling

The Tauri release CI image MUST be a purpose-built Linux amd64 release environment. It MUST pin Rust 1.96.0, `tauri-cli` 2.10.1, pnpm 11.5.0, Android API 36, Android build-tools 36.0.0, and NDK 29.0.14206865. It MUST include Java 17, all four Android Rust targets, the Linux x86_64 Rust target, GTK and WebKit development libraries, AppImage packaging tools, and `jq`, `curl`, `zipalign`, and `apksigner`.

The image MUST use internal Cargo and npm-compatible package mirrors for supported package sources. It MUST NOT contain application signing material or Forgejo credentials. Its tracked build MUST verify the pinned Rust, Tauri CLI, pnpm, Android SDK, NDK, `zipalign`, and `apksigner` contracts before the image is published.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-release-ci:rust1.96.0-tauri2.10.1-pnpm11.5.0-android36` for main-branch changes to `docker/tauri-release-ci/**` or its own pipeline definition. Release consumers MUST supply this version-pinned image reference, or a digest-pinned equivalent built from the same contract, to `tauri-release-build`. Unrelated homelab changes MUST NOT be required to build the image.
