# Grafana Runtime

## Runtime And Access

The platform MUST deploy Grafana chart `12.8.0` with Grafana `13.1.1` and a Pulumi provider capable of managing dashboards, folders, alert rules, and recording rules.

The runtime MUST preserve:

- dashboard access through the configured administrator credentials;
- proxy datasources for Mimir, Loki, Tempo, and Pyroscope;
- the image renderer sidecar when rendering is enabled;
- two Grafana replicas behind one service endpoint; and
- existing ingress and high-availability behavior.

## Dashboard Ownership

[`programs/grafana-dashboards/`](../../../programs/grafana-dashboards/) MUST be the authoritative source for managed Grafana dashboards and shared content folders.

- Dashboard assets MUST remain complete, raw Grafana dashboard JSON documents.
- The dashboard program MUST load each document without reconstructing its model and MUST place it in the shared folder for its domain.
- The dashboard program MUST own the stable domain folders shared by dashboards, alert rules, and recording rules.
- Removing a managed source file and successfully applying its stack MUST remove the corresponding Pulumi resource.
- Direct Grafana edits are drift and MUST NOT be treated as an authoring workflow.

Git polling, direct repository writes from Grafana, and an automatic main-branch apply mechanism MUST NOT be required. Datasources, authentication, database configuration, alerting runtime configuration, and deployment settings remain owned by [`programs/grafana/`](../../../programs/grafana/).

## PostgreSQL

Grafana application state MUST use a CloudNativePG PostgreSQL cluster rather than pod-local storage. The database MUST run three instances with `50Gi` of durable block storage per instance, and Grafana MUST use the generated application credentials.

The `50Gi` requirement replaces the earlier lifecycle value and matches the tracked Pantheon stack configuration.

## Alerting High Availability

The two Grafana replicas MUST coordinate alert evaluation and notification delivery as one high-availability group. If one replica is replaced or unavailable, the remaining replica MUST continue participating rather than operating as an isolated alerting instance.
