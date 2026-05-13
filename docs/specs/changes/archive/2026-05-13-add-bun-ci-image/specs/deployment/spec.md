## Change Overview

- **Why**: Dot's OpenCode plugin pin updater needs a reusable Bun CI image that includes SSH-capable Git tooling for `git+ssh` plugin tag lookups.
- **Impact**: Homelab will publish a generic `rfhold/bun-ci:latest` image through the existing Tekton BuildKit image pipeline pattern, configured to use internal package mirrors.
- **Non-goals**: This change does not update dot workflows, change OpenCode plugin reference semantics, alter the pin updater script, or reuse the Pulumi-specific Bun image.
- **Rollback**: Remove the `bun-ci` image build workflow and Dockerfile; consumers can return to their previous per-workflow image setup.

## ADDED Requirements

### Requirement: Generic Bun CI Image

The system MUST provide a generic Bun CI container image for repository workflows that need Bun plus SSH-capable Git operations.

#### Scenario: Bun CI tooling is available

Given a workflow uses the generic Bun CI image
When the workflow starts a shell step inside the image
Then the system MUST provide `bun`, `git`, `ssh`, and CA certificates in the image

#### Scenario: Pinned Bun base image

Given the generic Bun CI image definition is inspected
When the image base is resolved
Then the system MUST use a pinned `oven/bun:1.3` base image

#### Scenario: Internal package mirrors configured

Given the generic Bun CI image definition is inspected
When operating system or Bun package dependencies are installed or resolved
Then the system MUST use the internal package mirrors for supported package sources

### Requirement: Bun CI Image Build Pipeline

The system MUST build and publish the generic Bun CI image from homelab using the existing Tekton BuildKit image build pattern.

#### Scenario: Bun CI image pipeline publishes to rfhold registry namespace

Given the Bun CI image build pipeline runs on the homelab main branch
When the BuildKit build task publishes the image
Then the system MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest`

#### Scenario: Bun CI image pipeline is scoped to image changes

Given the Bun CI Dockerfile or its build pipeline changes
When the changes are pushed to the homelab main branch
Then the system MUST run the Bun CI image build pipeline
And the system MUST NOT require unrelated homelab changes to build the image
