# Gitea Actions Runner Research Evidence

This is a non-authoritative research record. It does not define the repository's current CI runner, execution isolation, registration, image versions, deployment, or live jobs.

## Provenance

- The research stated that Gitea Actions began in Gitea `1.19` and that ephemeral runners require act_runner `0.2.12+`; no research or retrieval date was recorded.
- Consulted sources: [Gitea Actions documentation](https://docs.gitea.com/usage/actions/overview), [act_runner](https://gitea.com/gitea/act_runner), [Docker rootless mode](https://docs.docker.com/engine/security/rootless/), and [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/).

## Evidence Retained

- The evaluation compared ephemeral and persistent act_runner lifecycles and rootless versus privileged Docker-in-Docker.
- Isolation, registration-token handling, image pinning, cache and layer storage, resource controls, network policy, and user namespaces were identified as critical concerns.
- Rootless Docker was preferred in the research for reduced host compromise risk, subject to feature and performance limitations. This was an evaluation conclusion, not an approved repository contract.

## Repository Relevance

This research predates or sits beside the repository's Tekton delivery implementation. Generic runner manifests, apparent sample tokens, floating images, and troubleshooting commands were removed.

## Disposition

Current CI and image delivery authority is [deployment documentation](../deployment/README.md), especially [Tekton specifications](../deployment/spec/tekton.md). No canonical Gitea Actions runner contract exists.
