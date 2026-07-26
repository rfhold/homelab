# Observability Capability Spec

Stable spec at `docs/specs/observability/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

## Requirements

### Requirement: Production Profiling Backend
The observability platform MUST deploy a continuous profiling backend on the pantheon cluster with durable object storage, separate read and write endpoints, and v2-only Pyroscope storage.

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

#### Scenario: Pyroscope v2 storage cutover
Given the profiling backend is upgraded to Pyroscope 2.x
When the Pyroscope chart is deployed
Then the system MUST enable v2 storage
And the system MUST disable v1 storage
And the system MUST NOT require dual-writing profile data to both v1 and v2 storage paths

#### Scenario: Historical profile queryability
Given profile data was written before the Pyroscope v2-only cutover
When the v1 storage components are disabled
Then the system MUST NOT require that historical v1 profile data remain queryable through Pyroscope

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

### Requirement: Current Grafana Runtime
The observability platform MUST deploy Grafana using the selected current Grafana Helm chart, application runtime, and Pulumi provider capability while preserving existing operator access, observability integrations, and high availability runtime configuration.

#### Scenario: Grafana dashboard access after upgrade
Given the Grafana Helm chart is upgraded
When operators access the Grafana service
Then the system MUST provide Grafana dashboard access with the configured administrator credentials
And the system MUST preserve provisioned observability datasource access

#### Scenario: Grafana rendering support after upgrade
Given image rendering is enabled for Grafana
When the Grafana Helm chart is upgraded
Then the system MUST continue to configure the Grafana image renderer sidecar

#### Scenario: Grafana replica availability
Given the observability stack is deployed on the pantheon cluster
When Grafana is provisioned
Then the system MUST run two Grafana application replicas
And the system MUST keep Grafana service access available through a single service endpoint

#### Scenario: Grafana Git Sync provider support
Given Grafana 13 Git Sync resources are required
When the observability stack is provisioned with Pulumi
Then the system MUST use a Grafana Pulumi provider version or schema that can manage Grafana Git Sync repository resources

### Requirement: Grafana Git-Synced Dashboards
The observability platform MUST manage Grafana dashboards and folders through Grafana Git Sync using the homelab repository path `grafana/`.

#### Scenario: Homelab repository dashboard sync
Given the observability stack is deployed on the pantheon cluster
When Grafana Git Sync is configured
Then the system MUST synchronize dashboards and folders from the homelab repository path `grafana/`
And the system MUST NOT require a separate dashboard repository

#### Scenario: Direct dashboard writes
Given an operator edits a Git-synced dashboard in Grafana
When the operator saves the dashboard through the Grafana UI
Then the system MUST allow Grafana to write the dashboard change directly to the homelab repository
And the system MUST NOT require a pull request workflow for Grafana-originated dashboard edits

#### Scenario: Dashboard provisioning ownership
Given dashboards and folders are managed by Grafana Git Sync
When the observability stack provisions Grafana resources
Then the system MUST NOT also manage those dashboards and folders through the prior dashboard provisioning mechanism
And the system MUST continue to manage datasources, authentication, database configuration, alerting runtime configuration, and Grafana deployment settings outside Git Sync

### Requirement: Grafana Git Sync Token Stash
The observability platform MUST source Grafana Git Sync Git authentication from `FORGEJO_ACCESS_TOKEN` through a Pulumi Stash-backed secret.

#### Scenario: Initial token capture
Given `FORGEJO_ACCESS_TOKEN` is set in the Pulumi deployment environment
When the observability stack provisions Grafana Git Sync
Then the system MUST capture the token in a Pulumi Stash input as a secret
And the system MUST use the stashed secret output for Grafana Git Sync repository authentication

#### Scenario: Subsequent deployments without token environment
Given the Git Sync token was captured by Pulumi Stash during a previous deployment
When a later Pulumi deployment runs without `FORGEJO_ACCESS_TOKEN` set
Then the system MUST reuse the stashed token output for Grafana Git Sync repository authentication
And the system MUST NOT require the operator to provide `FORGEJO_ACCESS_TOKEN` again

#### Scenario: Token secrecy
Given Grafana Git Sync repository authentication is configured
When Pulumi stores or passes the Git authentication token
Then the system MUST treat the token as secret material
And the system MUST NOT expose the token in non-secret stack outputs or Kubernetes ConfigMaps

### Requirement: Grafana PostgreSQL Backend
The observability platform MUST store Grafana application state in a clustered CloudNativePG PostgreSQL backend instead of the Grafana pod filesystem.

#### Scenario: Grafana database provisioning
Given the observability stack is deployed on the pantheon cluster
When Grafana is provisioned
Then the system MUST provision a CloudNativePG PostgreSQL database for Grafana application state
And the system MUST configure Grafana to use that PostgreSQL database
And the system MUST NOT rely on pod-local storage as the authoritative Grafana application database

#### Scenario: Clustered PostgreSQL durability
Given the Grafana PostgreSQL backend is provisioned
When the database cluster is created
Then the system MUST run three CloudNativePG instances
And the system MUST allocate 10Gi of durable block storage for each PostgreSQL instance

### Requirement: Grafana Alerting High Availability
The observability platform MUST configure Grafana alerting so multiple Grafana replicas coordinate alert evaluation and notification delivery as one high availability group.

#### Scenario: Alerting replica coordination
Given Grafana is running with multiple application replicas
When Grafana evaluates alert rules
Then the system MUST configure the replicas to coordinate alerting through Grafana high availability clustering
And the system MUST NOT allow the replicas to operate as isolated alerting instances

#### Scenario: Alerting continuity during pod replacement
Given one Grafana application replica is unavailable
When alert rules continue to be evaluated
Then the system MUST allow the remaining Grafana replica to continue participating in alert evaluation and notification delivery

### Requirement: Grafana Managed Alert Rule Files
The observability platform MUST store Grafana-managed alert rule definitions as Grafana-native files under `grafana/alert-rules/`.

#### Scenario: Alert rule files are the source of truth
Given operators manage Grafana alert rules for the homelab observability platform
When alert rule definitions are changed in version control
Then the system MUST treat `grafana/alert-rules/` as the authoritative source for Grafana-managed alert rules
And the system MUST store those definitions in a Grafana-native format compatible with `gcx`

#### Scenario: Removed files remove rules
Given a Grafana-managed alert rule or rule group exists in Grafana from a file under `grafana/alert-rules/`
When the corresponding file is removed and the alert-rule reconciliation workflow runs
Then the system MUST remove the corresponding Grafana-managed alert rule or rule group from Grafana

### Requirement: Mimir Alert Rule Migration
The observability platform MUST migrate all currently provisioned Mimir alert rules into Grafana-managed alert rule files and MUST stop provisioning those rules into Mimir through Infrastructure as Code.

#### Scenario: Existing Mimir rules become Grafana rules
Given Mimir alert or recording rules are currently provisioned by the observability stack
When the migration to Grafana-managed alert rules is implemented
Then the system MUST create equivalent Grafana-managed alert rule definitions under `grafana/alert-rules/`
And the system MUST include all currently provisioned Mimir rule groups in the migration

#### Scenario: Mimir rule provisioning is removed
Given alert rules have been migrated into Grafana-managed alert rule files
When the observability stack is provisioned
Then the system MUST NOT wire those alert rule files into Mimir rule provisioning
And the system MUST keep Mimir ruler capability available for future use

### Requirement: Grafana Alert Rule State Export
The observability platform MUST provide an operator script that exports the current Grafana-managed alert rule state into `grafana/alert-rules/` without committing or pushing changes.

#### Scenario: Operator syncs Grafana state to files
Given Grafana contains managed alert rules
When an operator runs the alert-rule sync script with standard Grafana connection environment variables
Then the system MUST write the current Grafana-managed alert rule state into `grafana/alert-rules/`
And the system MUST NOT commit or push the resulting file changes

#### Scenario: Standard Grafana connection variables
Given an operator or automation runs the alert-rule sync script
When the script connects to Grafana through `gcx`
Then the system MUST rely on standard Grafana environment variables including `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_ORG_ID=1`, and optional `GRAFANA_TOKEN`
And the system MUST NOT require custom repository-specific Grafana credential variable names

### Requirement: Current Observability Backend Charts
The observability platform MUST deploy Tempo, Loki, and Mimir from current maintained Helm chart sources selected for OSS operation.

#### Scenario: Mimir chart freshness
Given the observability stack is deployed on the pantheon cluster
When Mimir is provisioned
Then the system MUST use a maintained Mimir distributed chart version compatible with the selected Mimir application architecture
And the system MUST NOT pin Mimir to an older patch release when a newer stable patch release is selected for the change

#### Scenario: Loki OSS chart source
Given the observability stack is deployed for OSS Loki
When Loki is provisioned
Then the system MUST use the current OSS-maintained Loki chart source
And the system MUST NOT rely on a chart source that upstream identifies as maintained for Grafana Enterprise Logs only

#### Scenario: Tempo chart freshness
Given the observability stack is deployed on the pantheon cluster
When Tempo is provisioned
Then the system MUST use Tempo distributed chart 3.0.6 with Tempo 3.0.2 and its released application architecture
And the system MUST use the Grafana Community chart source

#### Scenario: Grafana chart freshness
Given the observability stack is deployed on the pantheon cluster
When Grafana is provisioned
Then the system MUST use Grafana chart 12.8.0 with Grafana 13.1.1
And the system MUST preserve the existing HA database, persistence, ingress, and image-renderer configuration

### Requirement: Shared Observability Kafka Cluster
The observability platform MUST provision one Strimzi-managed Kafka cluster for observability backend ingest paths that currently require Kafka.

#### Scenario: Shared backend dependency
Given the observability stack is deployed on the pantheon cluster
When Kafka-backed observability backends are provisioned
Then the system MUST create a Kafka cluster for observability ingest
And the system MUST configure Mimir to use that cluster for ingest storage

#### Scenario: Backend-owned topics
Given the observability Kafka cluster exists
When Mimir and Tempo are provisioned
Then the system MUST provision or configure a Kafka topic for Mimir ingest data
And the system MUST provision a distinct Kafka topic for Tempo trace data
And the system MUST NOT expose either topic as an application-facing telemetry endpoint

#### Scenario: Object storage remains durable backend storage
Given the observability Kafka cluster is used for ingest
When Mimir, Tempo, and Loki store durable telemetry data
Then the system MUST continue to use the configured Pantheon object storage buckets for long-term backend storage
And the system MUST NOT replace object storage durability with Kafka retention

### Requirement: Mimir Ingest Storage
The observability platform MUST run Mimir using ingest storage backed by the shared observability Kafka cluster.

#### Scenario: Mimir Kafka ingest path
Given the shared observability Kafka cluster is available
When Mimir is deployed
Then the system MUST enable Mimir ingest storage
And the system MUST configure Mimir distributors and ingesters to use the shared observability Kafka cluster

#### Scenario: Mimir remote write compatibility
Given applications and collectors send metrics through the existing telemetry path
When Mimir is migrated to ingest storage
Then the system MUST preserve the existing Mimir remote write endpoint exposed through Alloy
And the system MUST NOT require telemetry clients to connect directly to Mimir internals or Kafka

### Requirement: Tempo Kafka Write Path
The observability platform MUST run Tempo 3 using its Kafka-backed distributed write path.

#### Scenario: Tempo uses the released Kafka architecture
Given Tempo distributed chart 3.0.6 carries a Tempo 3 application version
When Tempo is deployed
Then the system MUST configure the distributor to write traces to the shared observability Kafka cluster
And the system MUST configure block-builder and live-store to consume the `tempo-traces` topic
And the system MUST disable ingesters and the old compactor
And the system MUST enable the backend scheduler and backend worker

#### Scenario: Tempo topic and consumer sizing
Given the `tempo-traces` topic is managed by Strimzi
When Tempo is deployed
Then the topic MUST have three partitions and three replicas
And Tempo MUST disable automatic topic creation
And block-builder and live-store MUST each run exactly three replicas

#### Scenario: Tempo durable storage
Given Tempo uses Kafka for its write path
When block-builder persists trace blocks
Then the system MUST continue using the configured Pantheon object storage bucket
And the system MUST retain trace blocks for 168 hours

#### Scenario: Tempo telemetry endpoint compatibility
Given applications and collectors send traces through the existing telemetry path
When Tempo is migrated to its Kafka write path
Then the system MUST preserve OTLP ingestion through the shared Alloy telemetry endpoint
And the system MUST NOT require telemetry clients to connect directly to Tempo internals or Kafka

#### Scenario: Metrics generator continuity
Given Tempo metrics generation is enabled
When Tempo consumes traces from Kafka
Then the system MUST continue to remote write generated metrics to Mimir through the configured Mimir endpoint
And the system MUST generate service graphs and span metrics without the removed `local-blocks` processor

### Requirement: Loki Distributed TSDB Storage
The observability platform MUST keep Loki on distributed microservices mode with TSDB object storage while updating it through the selected OSS chart path.

#### Scenario: Loki deployment mode
Given the observability stack is deployed on the pantheon cluster
When Loki is provisioned
Then the system MUST run Loki in distributed microservices mode
And the system MUST keep Loki using TSDB object storage for durable log data

#### Scenario: Loki Kafka exclusion
Given the shared observability Kafka cluster exists
When Loki is provisioned
Then the system MUST NOT require Loki log ingestion, indexing, or storage to depend on Kafka
And the system MUST keep Loki client ingestion available through the existing Alloy log path

### Requirement: Existing Observability Entry Points
The observability platform MUST preserve existing Grafana and telemetry entry points while modernizing backend ingest internals.

#### Scenario: Grafana access remains stable
Given the observability stack is upgraded
When operators access Grafana
Then the system MUST keep Grafana reachable through the configured public Grafana hostname
And the system MUST preserve provisioned datasources for Mimir, Loki, Tempo, and Pyroscope

#### Scenario: Telemetry gateway remains stable
Given applications and cluster collectors send telemetry through the shared telemetry gateway
When backend ingest internals are modernized
Then the system MUST keep accepting metrics, logs, traces, and profiles through the existing telemetry gateway model
And the system MUST NOT expose Kafka as an application-facing telemetry endpoint
