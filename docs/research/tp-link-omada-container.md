# TP-Link Omada Controller Research Evidence

This is a non-authoritative research record. It does not establish an approved controller image, version, network exposure, adopted devices, database state, deployment, or health.

## Provenance

- The source recorded community image versions `6.0.0.24` and `5.15.24.19`, stated that controller `6.0+` requires MongoDB 8, and referenced controller `5.4.6+` capacity claims. No research or retrieval date was recorded.
- Consulted sources: [mbentley container repository](https://github.com/mbentley/docker-omada-controller), [container image](https://hub.docker.com/r/mbentley/omada-controller), [Helm chart](https://github.com/mbentley/docker-omada-controller/blob/master/helm/omada-controller-helm/README.md), and TP-Link FAQs [3281](https://www.tp-link.com/us/support/faq/3281/), [2967](https://www.tp-link.com/us/support/faq/2967/), and [3087](https://www.tp-link.com/us/support/faq/3087/).

## Evidence Retained

- The community `mbentley/omada-controller` image was evaluated for centralized Omada hardware management.
- TCP and UDP service exposure, non-broadcast Kubernetes adoption, persistent data and logs, clean shutdown, built-in backups, explicit image pins, and CPU instruction requirements were key concerns.
- The research identified a 60-second graceful stop and tested restore capability as protections against embedded MongoDB corruption, but recorded no homelab test evidence.

## Repository Relevance

This is network-management workload research only. Default device credentials, full port manifests, direct backup commands, and sizing tables were removed.

## Disposition

No canonical Omada controller contract exists. [Edge networking](../edge-networking/README.md) governs current network-facing services; any future controller workload belongs under [Kubernetes workloads](../kubernetes-workloads/README.md).
