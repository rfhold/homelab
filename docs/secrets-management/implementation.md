# Tracked Secrets Implementation

This document describes repository source inspected during the conversion based on `316959090d82d223693858ad8690f4d6f1561f4c`. It does not prove that OpenBao is deployed, initialized, unsealed, configured, or used by a live Pulumi stack.

## OpenBao Program

[`src/helm-charts.ts`](../../src/helm-charts.ts) pins the official OpenBao chart to `0.27.2`. [`src/components/openbao.ts`](../../src/components/openbao.ts) configures standalone file storage, one server replica, `ReadWriteOnce` persistent data, the UI, and ClusterIP Services. HA, Raft, auto-unseal, injector, CSI, chart-owned ingress, and chart-owned Gateway routes are disabled.

[`programs/openbao/Pulumi.romulus.yaml`](../../programs/openbao/Pulumi.romulus.yaml) targets Romulus with `10Gi` on `shared-fs`. [`programs/openbao/index.ts`](../../programs/openbao/index.ts) creates an HTTPRoute for `openbao.holdenitdown.net` through `ingress/default-gateway` and exports service, storage, mount-name, OIDC-default, and operator-runbook outputs.

The component's KV and Transit configuration currently determines output names only. It does not enable either engine or create the Transit key. The program similarly exports OIDC expectations but does not configure an OpenBao auth method, role, policy, initialization, or unseal.

## Authentik OIDC

[`programs/authentik/index.ts`](../../programs/authentik/index.ts) creates an Authentik OAuth2 provider and application for OpenBao. It exports the client ID, secret, issuer and discovery URLs, plus strict UI and CLI redirect URIs. The OpenBao program intentionally has no Authentik StackReference, so Authentik-side resources and OpenBao-side auth configuration have independent reconciliation and a manual handoff.

## Pulumi And Tekton

Pulumi remains the tracked mechanism that creates Kubernetes `Secret` resources for workloads. OpenBao injector and CSI delivery are disabled, and no External Secrets Operator integration is present in this scope.

[`programs/tekton/index.ts`](../../programs/tekton/index.ts) reads the Pulumi passphrase and backend URL from the environment and object-storage credentials from the Romulus object-storage stack. [`src/components/tekton.ts`](../../src/components/tekton.ts) writes those values to the `pulumi-credentials` Kubernetes Secret used by Pipelines as Code.

`PULUMI_CONFIG_PASSPHRASE`, `PULUMI_BACKEND_URL`, `AUTHENTIK_URL`, and `AUTHENTIK_TOKEN` are required environment inputs. Program evaluation fails before creating resources when any of them is absent. A future OpenBao secrets-provider migration remains governed by the [OpenBao runbook](../operations/openbao.md).
