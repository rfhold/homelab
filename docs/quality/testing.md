# Testing And Verification

## Local Checks

| Command | Covers | Does Not Prove |
| --- | --- | --- |
| `bun run typecheck` | TypeScript paths included by `tsconfig.json` | Every program entry point or deployed resources |
| `git diff --check` | Whitespace errors in the diff | Markdown links, factual accuracy, or runtime behavior |
| `bun test src/components/native-ci-image-contract.test.ts` | Native CI Dockerfile contracts and mock-backed verifier success/failure paths | Actual image builds, packages, SDK contents, or ALSA linkage |
| `python3 docker/general-ci/test_protobuf_image_contract.py /path/to/kuri` | General CI plugin pins, Kuri preflight agreement, and mock-backed version rejection | Image execution or byte-exact protobuf regeneration |

### Focused CI Image Checks

Run these commands from the homelab repository root:

| Command | Covers | Does Not Prove |
| --- | --- | --- |
| `bun test src/components/rust-web-ci.test.ts` | Rust/web source and mock-backed contracts; default functional fixture skip | Native image builds or full pinned toolchain execution |
| `RUST_WEB_CI_FUNCTIONAL=1 bun test src/components/rust-web-ci.test.ts` | Actual offline WASM fixture compilation and wasm-bindgen web glue execution with host tools | Image-pinned Node.js or either native container architecture |
| `bun test docker/playwright-ci/browser-image-contract.test.ts` | Browser image, metadata, sandbox, and publication source contracts | Image build, Chromium launch, or kernel sandbox compatibility |
| `bun test src/components/tauri-appimage-links-contract.test.ts` | AppImage extraction/main ELF closure fixture cases and conditional ALSA resolution | Actual builder commands, release artifact linkage, or target-OS runtime acceptance |

The opt-in Rust/web fixture check requires local Rust 1.96.0, the WASM target, wasm-bindgen CLI 0.2.122, and cached dependencies. Do not install tools or fetch dependencies without separate authorization.

Run Kuri's launcher unit tests from its repository root with `node --test scripts/test-browser-image.test.mjs`. These tests validate source and mock behavior; they do not launch an image browser.

See [deployment verification](../deployment/verification.md#focused-image-and-appimage-verification) for local evidence and open acceptance checks.

Run only checks relevant to the changed surface. Dependency installation may update local environments and caches.

## Credentialed Checks

Pulumi previews, PyInfra check mode, Kubernetes queries, Grafana queries, DNS queries, and CI inspection may contact external systems or expose operational context. They require an explicit target and authorization. A preview or dry run is not permission to apply changes.

When a required check cannot run safely, record it as not verified. Never substitute an apply, deployment, restart, reconciliation, or publication action for missing validation.

## Evidence

Verification records identify the command or inspection, scope, result, date when relevant, and limits. Source inspection proves tracked configuration only. Historical execution output is not current health evidence.
