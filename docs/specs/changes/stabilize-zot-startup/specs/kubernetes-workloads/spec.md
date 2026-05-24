# Kubernetes Workloads Delta Spec

## Change Overview

### Why

The `pantheon` Zot registry at `cr.holdenitdown.net` has grown a large enough S3-backed mirror cache that cold start now spends minutes rebuilding repository metadata before the process begins serving `https://:5000/v2/`. The current workload health behavior allows kubelet to treat that initialization window as a failure, which causes restart pressure during otherwise valid startup.

The same deployment is also carrying forward a migrated TLS secret without a declared cert-manager `Certificate` resource in the current stack. That leaves the registry dependent on an expired certificate and manual secret handling even though the workload already expects a Kubernetes TLS secret.

### Impact
- **Breaking changes**: the Zot web UI and repository search will no longer be available on `cr.holdenitdown.net`
- **Migration**: operators will need to deploy the updated container-registry stack so the workload health configuration, Zot feature set, and managed TLS certificate are reconciled
- **Cross-change dependencies**: none

### Non-goals
- Pruning existing mirrored repositories or blobs from the S3-backed cache
- Changing the S3 backend, bucket, or Zot root directory
- Expanding TLS coverage to mirror subdomains beyond `cr.holdenitdown.net`

### Rollback

Rollback consists of reverting the container-registry change so the previous Zot feature flags, workload health settings, and TLS secret handling are restored. If the managed certificate path causes issues, operators can roll back the stack and temporarily return to a manually supplied TLS secret while a follow-up change is prepared.

---

## ADDED Requirements

### Requirement: Zot Cold Start Tolerance
The system MUST allow the `pantheon` Zot pull-through cache to finish cold-start repository initialization before kubelet restart behavior treats startup as a failure.

#### Scenario: Existing mirrored content extends startup
Given the Zot registry has existing S3-backed mirrored repositories to reconcile during process startup
When the Zot pod starts after a restart or rollout
Then the system MUST allow initialization to continue until the registry can serve successful HTTPS responses from `/v2/`
And the system MUST NOT restart the pod solely because `/v2/` is unavailable during that approved startup window

#### Scenario: Registry remains unready during initialization
Given the Zot process is still rebuilding repository metadata
When Kubernetes evaluates service readiness before the registry starts accepting HTTPS traffic
Then the system MUST keep the pod out of ready endpoints until `/v2/` succeeds
And the system MUST preserve liveness enforcement only after startup has completed

### Requirement: Zot Pull-Through Cache Feature Scope
The system MUST disable optional Zot UI and search features for the `cr.holdenitdown.net` deployment when the approved use case is pull-through cache behavior only.

#### Scenario: Pull-through cache deployment is rendered
Given operators do not rely on the Zot web UI or repository search
When the container-registry stack renders the Zot configuration
Then the system MUST disable the Zot UI extension
And the system MUST disable the Zot search extension

#### Scenario: Mirror behavior remains available without UI or search
Given the Zot deployment has UI and search disabled
When cluster workloads or CI systems pull images through the configured mirror paths
Then the system MUST preserve pull-through cache behavior for the approved upstream registries
And the system MUST preserve access to existing S3-backed cached content through the registry API

### Requirement: Zot Managed TLS Renewal
The system MUST manage the TLS secret for `cr.holdenitdown.net` through a cert-manager `Certificate` resource instead of relying on a migrated one-off secret.

#### Scenario: Zot TLS is declared for the registry endpoint
Given the `cr.holdenitdown.net` Zot endpoint is deployed with TLS enabled
When the container-registry stack reconciles Kubernetes resources
Then the system MUST declare a cert-manager `Certificate` for `cr.holdenitdown.net`
And the system MUST store the issued certificate material in the TLS secret mounted by the Zot pod

#### Scenario: Certificate renewal is required
Given the active certificate for `cr.holdenitdown.net` approaches expiration
When cert-manager reconciles the declared certificate
Then the system MUST renew the certificate through the configured cluster issuer without requiring manual secret migration
And the system MUST keep the certificate scope limited to `cr.holdenitdown.net`
