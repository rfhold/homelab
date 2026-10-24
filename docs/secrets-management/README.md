# Secrets Management

Specifications define the approved OpenBao and secret-delivery contracts. Source-backed implementation, guarded operations, and unresolved adoption state remain separate.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Tracked Pantheon, Authentik, Transit, Pulumi, Tekton, Kuri release identities, canary, and cleanup boundaries |
| [`verification.md`](verification.md) | Dated Pantheon, OIDC, Transit, canary, cleanup, and Romulus retirement evidence |
| [`spec/openbao.md`](spec/openbao.md) | Pantheon HA, OIDC, OpenCode prefix-wide catalog/read grants, Transit, no-backup/no-DR boundary, and retired Romulus boundary |
| [`spec/secret-delivery.md`](spec/secret-delivery.md) | Pulumi delivery, Transit ownership, isolated canary initialization, and credential boundaries |
| [`../operations/openbao.md`](../operations/openbao.md) | Guarded Pantheon bootstrap, OIDC, Transit, maintenance, and retirement evidence boundaries |
| [`../operations/kuri-release-secret-bootstrap.md`](../operations/kuri-release-secret-bootstrap.md) | Guarded Kuri and ESP release secret import, rotation, and recovery |
| [`../operations/shared-release-secret-bootstrap.md`](../operations/shared-release-secret-bootstrap.md) | Additive shared release bootstrap, public trust, repository fingerprints, and identity isolation |
