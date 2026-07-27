# NanoMQ Kubernetes Research Evidence

This is a non-authoritative research record. It does not establish an approved broker, image, listener, authentication policy, persistence, deployment, or live MQTT traffic.

## Provenance

- The research recorded NanoMQ `0.24.6`; no research or retrieval date was recorded.
- Consulted sources: [NanoMQ documentation](https://nanomq.io/docs/en/latest/), [container image](https://hub.docker.com/r/emqx/nanomq), [repository](https://github.com/nanomq/nanomq), and [HTTP API](https://nanomq.io/docs/en/latest/api/v4.html).

## Evidence Retained

- NanoMQ was evaluated as a lightweight MQTT 3.1.1 and 5.0 broker with TCP, TLS, WebSocket, and management listeners.
- The evaluation found no official Helm chart and considered custom Kubernetes resources, optional SQLite persistence, HTTP health and metrics, and MQTT bridging.
- Authentication, removal of default management credentials, TLS, NetworkPolicy, and secret-backed credentials were identified as required safeguards.
- The research stated that NanoMQ lacked built-in clustering at the evaluated version.

## Repository Relevance

The topic is relevant to IoT and voice messaging, but no adoption decision or source implementation was recorded. Generic manifests and encoded default credentials were removed.

## Disposition

No canonical NanoMQ contract exists. Any future deployment belongs in [Kubernetes workloads](../kubernetes-workloads/README.md), with credentials governed by [secrets management](../secrets-management/README.md).
