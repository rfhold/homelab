# Grafana Provisioning Research Evidence

This is a non-authoritative research record. It does not define current Grafana provisioning, storage, authentication, alerting, or live state.

## Provenance

- No Grafana or chart version, research date, or retrieval date was recorded.
- Consulted sources: [Grafana Helm chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana), [provisioning documentation](https://grafana.com/docs/grafana/latest/administration/provisioning/), [configuration documentation](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/), and [alerting documentation](https://grafana.com/docs/grafana/latest/alerting/).

## Evidence Retained

- The research compared direct chart values, mounted ConfigMaps, file provisioning, and label-discovering sidecars for datasources and dashboards.
- It also evaluated declarative alert resources, environment-backed secrets, persistent storage, and high-availability alerting.
- Generic dashboards, manifests, credential placeholders, and debugging commands were removed.

## Repository Relevance

The record explains alternatives considered around statically managed Grafana configuration. It does not show which mechanism the repository implements.

## Disposition

Use [Grafana specifications](../observability/spec/grafana.md), [alerting specifications](../observability/spec/alerting.md), and [observability implementation](../observability/implementation.md). These supersede the research for current repository behavior.
