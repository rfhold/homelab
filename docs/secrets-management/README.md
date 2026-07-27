# Secrets Management

Specifications define the approved OpenBao and secret-delivery contracts. Source-backed implementation, guarded operations, and unresolved adoption state remain separate.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Tracked OpenBao, Authentik, Pulumi, and Tekton integration surfaces |
| [`verification.md`](verification.md) | Deployment, initialization, unseal, OIDC, engine, policy, credential, and migration gaps |
| [`spec/openbao.md`](spec/openbao.md) | OpenBao topology, authentication, engines, bootstrap, and scope |
| [`spec/secret-delivery.md`](spec/secret-delivery.md) | Pulumi workload delivery, Transit encryption, and automation credential boundaries |
| [`../operations/openbao.md`](../operations/openbao.md) | Guarded bootstrap, unseal, OIDC, Tekton prerequisite, and migration runbook |
