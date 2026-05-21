## Change Overview

- **Why**: Desktop Tauri/WebDriver CI jobs currently need to install large Linux GUI, WebKit, Rust, and Docker client dependencies inside each PipelineRun. A reusable Homelab-built image will make those jobs faster, less fragile, and easier to share across projects such as Cuthulu and Walter.
- **Impact**: Homelab will publish a general-purpose `rfhold/tauri-e2e-ci:latest` image through the existing Tekton BuildKit image pipeline pattern. Consumers can replace inline dependency installation with this image while continuing to provide project-specific commands and any DinD sidecars they need.
- **Non-goals**: This change does not modify Cuthulu or Walter pipelines to consume the image, does not replace the existing `bun-ci` image, and does not define project-specific WebDriver assertions.
- **Rollback**: Remove the `tauri-e2e-ci` image build workflow and Dockerfile; consumers can keep or return to per-workflow dependency installation.

## ADDED Requirements

### Requirement: Generic Tauri E2E CI Image

The system MUST provide a generic Tauri e2e CI container image for repository workflows that run Tauri desktop WebDriver tests in Linux CI.

#### Scenario: Tauri e2e tooling is available

Given a workflow uses the generic Tauri e2e CI image
When the workflow starts a shell step inside the image
Then the system MUST provide Bun, Rust/Cargo, Git, SSH, CA certificates, Tauri Linux build dependencies, WebKit/GTK runtime dependencies, Xvfb headless display support, and a Docker CLI in the image

#### Scenario: Image supports DinD consumers

Given a workflow uses the generic Tauri e2e CI image with a Docker-in-Docker sidecar
When the workflow configures Docker client environment variables for the sidecar
Then the system MUST provide Docker client tooling capable of talking to the sidecar
And the image MUST NOT require its own Docker daemon to be running inside the step container

#### Scenario: Internal package mirrors configured

Given the generic Tauri e2e CI image definition is inspected
When operating system or Bun package dependencies are installed or resolved
Then the system MUST use the internal package mirrors for supported package sources

### Requirement: Tauri E2E CI Image Build Pipeline

The system MUST build and publish the generic Tauri e2e CI image from homelab using the existing Tekton BuildKit image build pattern.

#### Scenario: Tauri e2e CI image pipeline publishes to rfhold registry namespace

Given the Tauri e2e CI image build pipeline runs on the homelab main branch
When the BuildKit build task publishes the image
Then the system MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-e2e-ci:latest`

#### Scenario: Tauri e2e CI image pipeline is scoped to image changes

Given the Tauri e2e CI Dockerfile or its build pipeline changes
When the changes are pushed to the homelab main branch
Then the system MUST run the Tauri e2e CI image build pipeline
And the system MUST NOT require unrelated homelab changes to build the image
