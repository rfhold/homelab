# CI Helper Images

This specification defines intended behavior for reusable workflow images. It does not govern application runtime images under `docker/`.

## CI Tool Image References

Maintained CI images under `cr.holdenitdown.net/rfhold/` MUST use `latest` and `imagePullPolicy: Always`. The configured `{{ CONTAINER_REGISTRY }}/rfhold/` prefix represents the same maintained images. Architecture-specific publication and verification retain `latest-amd64` and `latest-arm64` where required.

Third-party CI tools MUST retain their current image references and pull policies. This migration does not alter Alpine, Git, BuildKit, Crane, manifest-tool, curl, or kustomize references.

Parameterized maintained CI tools MUST preserve caller overrides and always pull. The `openbao-kubernetes-login` StepAction has no image-pull-policy field; its consumer Task steps MUST set `imagePullPolicy: Always`.

This policy does not float application image parameters, deployment controller/operator/pruner images, Dockerfile base images, or unique candidate images under verification. Rust/Web and Playwright CI publication MUST retain their native verification, exact promotion, and digest-result contracts below.

## General CI

### Tooling

The general CI image MUST provide pinned Rust, Node.js, pnpm, Bun, Go, CPython 3.13, uv, Pulumi, Buf, staticcheck, and wasm-bindgen toolchains for Linux amd64 and arm64. It MUST include Espressif Rust support through espup 0.17.1, espflash 4.2.0, Xtensa Rust release 1.97.0.0, and Xtensa GCC 15.2.0_20250920. The Espressif toolchain MUST support `xtensa-esp32s3-none-elf` no_std builds.

The image MUST expose CPython through both `python` and `python3`. It MUST include rustfmt, Clippy, the `wasm32-unknown-unknown` target, native compiler tooling, Git, GnuPG, an SSH client, and CA certificates. Supported apt, Cargo, npm, Bun-compatible, Go, and PyPI package sources MUST use the internal mirrors. Every consumer step MUST receive the Espressif GCC path and `LIBCLANG_PATH` without an espup export-file source command.

The image MUST run its tracked version contract for each architecture. The contract MUST verify espup, espflash, Xtensa Rust, the ESP32-S3 target, Xtensa GCC, and Rust source availability. It is a shared verifier and infrastructure toolchain; Android, Tauri E2E, BuildKit, Git policy, and registry-operation requirements remain in purpose-built images.

### Protobuf Tools

The image MUST install `protoc-gen-prost` 0.5.0 and `protoc-gen-tonic` 0.5.0 through exact-version `cargo install --locked` commands. Its version contract MUST check both generator versions alongside Buf 1.47.2. Generator versions differ from Prost and Tonic runtime crate versions.

Kuri consumers run `sh scripts/check-protobuf-tools.sh` before `buf lint` and `buf generate` from the Kuri repository root. The script's `--versions` interface reports the required plugin versions without a tool probe. Ordinary application builds consume committed generated Rust; they do not regenerate protobuf code.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST build and verify native `general-ci:latest-amd64` and `general-ci:latest-arm64` images before publishing the `general-ci:latest` manifest. Consumers of the mutable manifest MUST request an image pull on every TaskRun. Repositories whose CI requirements are covered by the General CI toolchain SHOULD use it, while focused CI images remain supported for specialized requirements.

## Rust/Web CI

### Toolchain And Functional Contract

`rust-web-ci` MUST use Debian Bookworm with Rust 1.96.0, Clippy, rustfmt, `wasm32-unknown-unknown`, Node.js 24.18.0, pnpm 11.5.0, and wasm-bindgen CLI 0.2.122. It MUST provide native compiler tools, Git, CA certificates, and `pkg-config`.

The image MUST run as root with `/workspace` as its work directory. It MUST expose `CARGO_HOME=/usr/local/cargo`, `RUSTUP_HOME=/usr/local/rustup`, and `PNPM_HOME=/pnpm`. It MUST NOT embed application dependencies, application caches, audio libraries, or desktop libraries.

The final Dockerfile MUST run `rust-web-ci-verify`. The verifier MUST build and execute native Rust offline, check Clippy and rustfmt, and compile for the WASM target. It MUST generate web glue from a valid wasm-bindgen fixture and execute the output through Node.js with an assertion of `42`.

A separate build stage MUST compile the tool-owned fixture from its exact wasm-bindgen 0.2.122 dependency and committed lockfile. Only the fixture WASM artifact enters the final image.

### Publication Contract

The contract identifier is `bw-r1.96.0-n24.18.0-p11.5.0-w0.2.122-v1`. Architecture tags append `-${REVISION}-${PIPELINE_RUN_UID}-${ARCH}`; the multi-architecture tag omits the final architecture suffix.

Native amd64 and arm64 BuildKit builds MUST each pass verification on a node with the same architecture before manifest creation. Manifest creation MUST retain the unique tag and `push-latest: "false"`. The digest resolver MUST validate that manifest's exact SHA-256 digest before it copies the digest reference to `latest`. Its `image-reference` result MUST retain the repository and verified `sha256` digest with 64 hexadecimal characters.

Kuri adoption remains separate from publication. Its Dockerfile MUST retain current toolchain provisioning until a published, native-verified multi-architecture digest exists. Adoption MUST preserve runtime ABI and application cache mounts.

## Playwright CI

### Browser Contract

`playwright-ci` MUST support Linux amd64 only on Debian Bookworm. It MUST provide Rust 1.96.0, Clippy, rustfmt, Node.js 24.18.0, and pnpm 11.5.0.

The image MUST install exact `playwright-core` 1.63.0 locally under `/opt/playwright`. It MUST install only Chromium through `install --with-deps --no-shell chromium`. `/opt/playwright/contract.json` MUST derive Chromium revision, version, and executable path from that package's metadata. No independent browser revision pin applies.

The image MUST use UID/GID `10001:10001`. Its verifier MUST launch Chromium with `chromiumSandbox: true` and validate a local page without external traffic. The image supplies browser installation and verification, not application dependencies.

The image version is `bw-pw1.63.0-r1.96.0-n24.18.0-p11.5.0-v1-amd64`.

### Publication And Sandbox Contract

The candidate tag is `c-bw-pw1.63.0-r1.96.0-n24.18.0-p11.5.0-v1-${REVISION}-${PIPELINE_RUN_UID}-amd64`. The final unique tag removes only `c-`. With a 40-character revision and 36-character UID, these tags contain 125 and 123 characters, respectively.

The pipeline MUST verify the candidate on an explicit amd64 node before promotion by digest. The verifier MUST run nonroot, drop all capabilities, disable privilege escalation, and use `RuntimeDefault` seccomp. It MUST mount a 1 GiB memory-backed `/dev/shm`.

Sandbox incompatibility MUST fail closed. Root, `Unconfined` seccomp, and `--no-sandbox` fallbacks MUST NOT bypass verification. After native verification and digest validation, the pipeline MUST copy the candidate digest to both the unique final tag and `latest`. The pipeline MUST return that same verified digest through `image-reference`. It MUST NOT publish arm64 images or a generic multi-architecture manifest.

## Bun CI

### Tooling

The generic Bun CI image MUST:

- use `oven/bun:1.3` as its base image;
- provide `bun`, `git`, an SSH client, and CA certificates; and
- use the internal apt and Bun-compatible package mirrors for supported package sources.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest` for main-branch changes to `docker/bun-ci/**` or its own pipeline definition. Unrelated homelab changes MUST NOT be required to build the image.

## Native Rust CI Contracts

`rust-ci`, `android-ci`, `tauri-e2e-ci`, and `tauri-release-ci` MUST pin Rust 1.96.0 and explicitly install Clippy and rustfmt. Each final Dockerfile MUST copy and run its tracked `verify.sh`. The publication build MUST execute that final-stage verifier, not a separate unchecked target.

The verifiers MUST check Rust, Cargo, installed components, and required Rust targets. Each image MUST preserve its operating-system baseline and purpose-specific tools.

| Image | Baseline and target contract |
| --- | --- |
| `rust-ci` | Rust 1.96.0 on Debian Trixie; native host target |
| `android-ci` | `cimg/android:2026.02`; NDK 29.0.13846066, build-tools 35.0.0, and four Android Rust targets |
| `tauri-e2e-ci` | Current Bun base and Linux desktop dependencies; native host target |
| `tauri-release-ci` | Release SDK and target contract below; distinct from `android-ci` |

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

The Tauri release CI image MUST be a purpose-built Linux amd64 release environment. It MUST pin Rust 1.96.0, `tauri-cli` 2.10.1, `wasm-bindgen-cli` 0.2.122, pnpm 11.5.0, Android API 36, Android build-tools 36.0.0, and NDK 29.0.14206865. It MUST include Java 17, all four Android Rust targets, the WebAssembly and Linux x86_64 Rust targets, GTK and WebKit development libraries, AppImage packaging tools including `xdg-open`, and `jq`, `curl`, `zipalign`, and `apksigner`.

The image MUST use internal Cargo and npm-compatible package mirrors for supported package sources. It MUST NOT contain application signing material or Forgejo credentials. Its tracked build MUST verify the pinned Rust, Tauri CLI, wasm-bindgen CLI, pnpm, Android SDK, NDK, `xdg-open`, `zipalign`, and `apksigner` contracts before the image is published.

The image MUST include `libasound2-dev` and `pkg-config` for native ALSA dependencies. Its verifier MUST compile, link, and execute a C program that calls `snd_asoundlib_version()` through `pkg-config` ALSA flags. This check requires no audio hardware and does not prove audio-device access.

### Build Pipeline

The homelab Tekton BuildKit pattern MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-release-ci:latest` for main-branch changes to `docker/tauri-release-ci/**` or its own pipeline definition. Release consumers SHOULD supply this floating tooling image to `tauri-release-build`; the Task MUST preserve explicit caller-supplied image overrides and MUST always pull the builder image. This tooling reference does not change application release tags, artifact verification, or digest-based promotion. Unrelated homelab changes MUST NOT be required to build the image.
