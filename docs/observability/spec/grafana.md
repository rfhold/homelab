# Grafana Runtime

## Runtime And Access

The platform MUST deploy Grafana chart `12.8.0` with Grafana `13.1.1` and a Pulumi provider schema capable of managing Grafana 13 Git Sync repository resources.

The runtime MUST preserve:

- dashboard access through the configured administrator credentials;
- proxy datasources for Mimir, Loki, Tempo, and Pyroscope;
- the image renderer sidecar when rendering is enabled;
- two Grafana replicas behind one service endpoint; and
- existing ingress and high-availability behavior.

## Git-Synced Dashboards

Grafana Git Sync MUST manage dashboards and folders from the homelab repository path `grafana/` without a separate dashboard repository.

- Grafana-originated dashboard edits MUST use the direct write workflow and MUST NOT require a pull request.
- Pulumi MUST NOT also provision Git-synced dashboards and folders through the retired dashboard mechanism.
- Datasources, authentication, database configuration, alerting runtime configuration, and deployment settings MUST remain outside Git Sync ownership.

Git authentication MUST come from `FORGEJO_ACCESS_TOKEN` captured as a secret Pulumi Stash input. Later deployments MUST reuse the stashed output when that environment variable is absent. The token MUST remain secret and MUST NOT appear in non-secret outputs or ConfigMaps.

## PostgreSQL

Grafana application state MUST use a CloudNativePG PostgreSQL cluster rather than pod-local storage. The database MUST run three instances with `50Gi` of durable block storage per instance, and Grafana MUST use the generated application credentials.

The `50Gi` requirement replaces the earlier lifecycle value and matches the tracked Pantheon stack configuration.

## Alerting High Availability

The two Grafana replicas MUST coordinate alert evaluation and notification delivery as one high-availability group. If one replica is replaced or unavailable, the remaining replica MUST continue participating rather than operating as an isolated alerting instance.
