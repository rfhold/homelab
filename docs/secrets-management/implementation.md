# Tracked Secrets Implementation

This document describes the settled tracked target. It does not prove that OpenBao is deployed, initialized, unsealed, configured, or used by a live Pulumi stack. Concurrent source cleanup may not yet be visible in every file.

## OpenBao Program

[`src/helm-charts.ts`](../../src/helm-charts.ts) pins the official OpenBao chart to `0.27.2`. [`src/components/openbao.ts`](../../src/components/openbao.ts) supports two explicit storage topologies while keeping injector, CSI, audit storage, chart-owned ingress, and chart-owned Gateway routes disabled:

| Mode | Tracked behavior |
| --- | --- |
| `standalone` | Supported one-server file storage topology; no tracked OpenBao stack currently selects it |
| `raft` | Three configurable HA replicas with integrated Raft, pod-name node IDs, active and standby Services, active-only UI routing, a chart-managed disruption budget, and one retained PVC per ordinal |

[`programs/openbao/Pulumi.pantheon.yaml`](../../programs/openbao/Pulumi.pantheon.yaml) selects three-member Raft on Pantheon with `10Gi` `database` volumes and moderate per-member resources. The canonical Pantheon HTTPRoute binds to the Gateway's `https-0` listener and relies on the Gateway for client-facing TLS termination. Its backend API connection remains HTTP. OpenBao advertises its separate server-to-server cluster channel as HTTPS and manages that channel's mutual TLS internally. Pantheon is the only tracked OpenBao stack configuration; the legacy Romulus configuration was deleted after the 2026-08-13 retirement.

The chart-generated StatefulSet carries `pulumi.com/skipAwait: "true"` because a manually sealed or uninitialized OpenBao pod intentionally fails readiness. Pulumi still creates and tracks the StatefulSet, but update completion does not establish pod readiness; the guarded bootstrap and verification procedure owns that transition.

[`programs/openbao/index.ts`](../../programs/openbao/index.ts) validates topology and route configuration, creates the selected namespace and optional HTTPRoute, and exports service, storage, topology, mount-name, OIDC, and operator-runbook outputs. Authentik registration and OpenBao API management default to disabled and are enabled for Pantheon. API management fails program evaluation unless registration is enabled, `VAULT_TOKEN` is non-empty after trimming, and `oidc-client-secret-version` is an integer greater than zero. The explicit environment guard prevents the provider from silently falling back to `~/.vault-token`.

## Authentik OIDC

[`programs/authentik/index.ts`](../../programs/authentik/index.ts) owns the Authentik platform and shared flows. The Pantheon composition in [`programs/openbao/index.ts`](../../programs/openbao/index.ts) owns `AuthentikOIDCApp("openbao-oidc")`, the component's random client secret, OAuth2 provider and application, a policy binding to a lookup of the existing group named exactly `cyber`, and a dedicated OpenBao OIDC signing key. It does not create or mutate the group.

[`src/components/authentik-oidc-app.ts`](../../src/components/authentik-oidc-app.ts) supplies confidential-client behavior, strict redirect matching, and an optional Authentik certificate-pair UUID as the OAuth2 provider signing key. The OpenBao registration uses only the canonical UI callback and localhost CLI callback, and its application uses policy engine mode `all`. When registration is enabled, [`programs/openbao/index.ts`](../../programs/openbao/index.ts) creates a dedicated RSA-4096 `tls.PrivateKey`, a self-signed certificate with only `digital_signature` usage and 87600-hour validity, and an Authentik `CertificateKeyPair` named `OpenBao OIDC Signing Key`. The pair's UUID flows to the existing OAuth2 provider so Authentik is configured for RS256 signing. The private key is passed to Authentik as a Pulumi secret and neither key nor certificate body is exported. The Pantheon stack exports the client ID, secret, issuer and discovery URLs, and both redirect URIs. These statements describe tracked source; dated reconciliation and login evidence is recorded separately in [`verification.md`](verification.md).

The OpenBao program uses `@pulumi/vault@7.11.0` as a HashiCorp Vault-compatible client because no native OpenBao Pulumi provider exists. An explicit `vault.Provider` targets `https://openbao.holdenitdown.net`, skips provider-created child tokens, and leaves its token argument unset so authentication comes from `VAULT_TOKEN` at preview or apply time. `vault.jwt.AuthBackend` owns the `oidc` mount and configuration, sets `operator` as the default role, uses the stack-owned issuer, client ID, and write-only secret input, binds the issuer, and takes its write-only version from `oidc-client-secret-version`. `vault.jwt.AuthBackendRole` owns `operator` with `sub`, the exact UI and CLI callbacks, and only `default`; automatic default-policy attachment is disabled so the explicit list is authoritative. Both API resources depend on the OpenBao deployment and completed Authentik registration. No provider token is stored in Pulumi config or exported, and the OIDC client secret remains a Pulumi secret. Any Authentik client-secret rotation or replacement must increment the version in the same change; retaining the version cannot reliably propagate a changed write-only input.

Tracked source alone is not evidence of OpenBao compatibility, live API ownership, or absence of pre-existing API objects. The dated [verification record](verification.md) separately establishes completed OIDC API and signing-key reconciliation, RS256 metadata, and successful member UI and CLI login while retaining the unresolved token-policy and non-member checks.

## Pulumi And Tekton

Pulumi remains the tracked mechanism that creates Kubernetes `Secret` resources for workloads. OpenBao injector and CSI delivery are disabled, and no External Secrets Operator integration is present in this scope.

[`programs/tekton/index.ts`](../../programs/tekton/index.ts) requires the Pulumi passphrase and backend URL from the environment and reads object-storage credentials from the Romulus object-storage stack. [`src/components/tekton.ts`](../../src/components/tekton.ts) writes those values to the `pulumi-credentials` Kubernetes Secret used by Pipelines as Code.

Current Tekton source does not read an OpenBao token, set `VAULT_ADDR`, or construct a `hashivault://` secrets-provider path. The isolated `openbao-secrets-canary/canary` stack declares `hashivault://pulumi`; no workload stack uses OpenBao for Pulumi state secrets.

## Transit And Canary

The settled tracked target extends `openbao/pantheon` with Transit mount `transit`, key `pulumi`, policy `pulumi-transit`, and a `cyber` CLI OIDC role. The policy grants only encrypt and decrypt updates for key `pulumi`. The no-infrastructure [`programs/openbao-secrets-canary/`](../../programs/openbao-secrets-canary/) program has one required secret input and one secret export. Its `canary` stack was initialized directly with `hashivault://pulumi` and created no provider-managed infrastructure.

The canary verifies only that Pulumi can use Pantheon Transit as its secrets provider. It provides no backup, restoration, failover, or DR evidence.

## Removed Backup And DR Direction

The settled target contains no OpenBao snapshot workload, backup bucket or identity contract, backup image or publication pipeline source, backup alert, age helper, Romulus DR workload, recovery route, or restore procedure. Integrated Raft and Ceph RBD replication provide Pantheon availability but are not backups.

Snapshot policy, Kubernetes auth and role, and the chart TokenReview delegation binding are not retained behavior. An authorized 2026-08-13 Pantheon apply removed those obsolete resources without replacement while preserving Transit, OIDC, route, storage, and canary behavior. Source cleanup removed their declarations and all abandoned backup and DR source. A previously published image artifact and two historical commits may remain in external and Git history, but the repository has no active maintenance contract for that artifact.

Romulus was retained during the Pantheon rollout and intentionally destroyed on 2026-08-13 after the Pantheon-only decision. The retained empty Pulumi stack history and configuration record manages zero resources and remains until a separately authorized `pulumi stack rm romulus`; it is not a retained deployment or recovery target.
