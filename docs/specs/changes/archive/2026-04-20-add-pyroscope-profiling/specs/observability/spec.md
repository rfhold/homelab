# Observability Delta Spec

Delta spec at `docs/specs/changes/add-pyroscope-profiling/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why
The homelab observability stack already provides metrics, logs, and traces, but it does not yet provide a production-grade continuous profiling backend. This leaves custom services without a supported way to capture and inspect CPU and memory hot paths alongside the rest of the Grafana stack.

This change adds Pyroscope on the pantheon cluster and routes SDK-generated profiles through the existing Alloy gateway. It also defines the supported SDK runtime matrix for the custom application languages currently in scope.

### Impact
- **Breaking changes**: none
- **Migration**: custom services that adopt profiling will send profile traffic to the shared Alloy profiling endpoint instead of connecting directly to a profiling backend
- **Cross-change dependencies**: none

### Non-goals
- Cluster-wide eBPF profiling for all workloads
- Profiling support for third-party or off-the-shelf applications without maintained SDK integration
- Bun-based JavaScript profiling through the Node.js SDK path

### Rollback
Rollback is performed by removing the Pyroscope deployment, removing the Alloy profiling relay, removing the Grafana datasource, and reverting any application SDK configuration that points at the shared profiling endpoint.

---

## ADDED Requirements

### Requirement: Production Profiling Backend
The observability platform MUST deploy a continuous profiling backend on the pantheon cluster with durable object storage and separate read and write endpoints.

#### Scenario: Persistent profiling storage
Given the observability stack is deployed on the pantheon cluster
When the profiling backend is provisioned
Then the system MUST persist profile data in shared object storage rather than ephemeral pod storage
And the system MUST expose a write endpoint for profile ingestion
And the system MUST expose a read endpoint for profile queries

#### Scenario: Grafana query access
Given the profiling backend is deployed
When Grafana provisions observability datasources
Then the system MUST provision a Pyroscope datasource that queries the profiling backend through Grafana proxy access

### Requirement: Alloy-Mediated Profile Ingestion
The observability platform MUST accept SDK-generated profile traffic through the shared Alloy gateway and forward that traffic to the profiling backend.

#### Scenario: Applications use the shared gateway
Given a custom application is configured for profiling
When the application sends profile traffic to the shared telemetry gateway
Then the system MUST accept profiling traffic at the gateway
And the system MUST forward that traffic to the profiling backend
And the system MUST NOT require the application to address profiling backend internals directly

#### Scenario: Profiling traffic follows the existing observability entry point model
Given the observability stack already uses the shared Alloy gateway for telemetry ingestion
When profiling is added to the platform
Then the system MUST add profiling ingestion to that gateway model instead of introducing a separate application-facing ingress path

### Requirement: Supported SDK Profiling Runtimes
The observability platform MUST provide a supported SDK-based profiling path for custom Go, Node.js, and Rust applications, and MUST exclude unsupported runtimes from that support matrix.

#### Scenario: Go service profiling
Given a custom Go service enables profiling against the shared profiling endpoint
When the service starts sending profiles
Then the system MUST accept continuous profiling data from that service
And the system MUST support CPU and memory-oriented Go profiles

#### Scenario: Node.js service profiling
Given a custom JavaScript service runs on Node.js and enables the supported profiling SDK configuration
When the service sends profiles to the shared profiling endpoint
Then the system MUST accept wall, CPU, and heap profiles from that service

#### Scenario: Bun service evaluation
Given a custom JavaScript service runs on Bun
When operators evaluate it for the SDK-based profiling path
Then the system MUST NOT treat Bun as supported by the Node.js profiling SDK path
And the system MUST require a separate profiling approach before Bun services are added to this capability

#### Scenario: Rust service profiling
Given a custom Rust service enables profiling against the shared profiling endpoint
When the service sends profiles to the platform
Then the system MUST accept CPU profiles from that service
And the system MAY accept Rust memory profiles when the service enables the required allocator integration

#### Scenario: Selective application adoption
Given the profiling capability is deployed on the platform
When an application does not have maintained SDK profiling support or is not selected for profiling
Then the system MUST allow that application to remain uninstrumented
And the system MUST NOT require platform-wide profiling enablement as part of this change
