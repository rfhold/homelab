# Deployment Delta Spec

Delta spec at `docs/specs/changes/move-buildkit-amd64-to-artemis/specs/deployment/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why
Vulkan is being shut down for disk relocation work, but Pantheon still needs the amd64 BuildKit builder available for CI image builds. The amd64 builder needs to move to Artemis before Vulkan is powered off.

### Impact
- **Breaking changes**: none
- **Migration**: the amd64 BuildKit cache starts fresh on Artemis because the builder uses node-local hostPath storage
- **Contract surfaces**: none known
- **Cross-change dependencies**: none

### Non-goals
- Moving the arm64 BuildKit builder.
- Copying or preserving Vulkan's node-local BuildKit cache.
- Changing BuildKit resource limits, service names, or Tekton BuildKit addresses.

### Rollback
Revert the Pantheon BuildKit amd64 node selector back to Vulkan and re-apply the BuildKit stack.

---

## ADDED Requirements

### Requirement: Pantheon AMD64 BuildKit Placement
The system MUST schedule the Pantheon amd64 BuildKit builder on Artemis while preserving its existing service identity and node-local cache mount path.

#### Scenario: AMD64 builder targets Artemis
Given the Pantheon BuildKit stack is rendered
When the amd64 BuildKit StatefulSet pod template is inspected
Then the system MUST select `kubernetes.io/hostname=artemis`
And the system MUST mount the amd64 BuildKit cache from `/var/lib/buildkit-cache/amd64`

#### Scenario: BuildKit service identity remains stable
Given the Pantheon BuildKit stack is rendered
When clients resolve the amd64 BuildKit endpoint
Then the system MUST continue to expose the existing amd64 BuildKit service identity
