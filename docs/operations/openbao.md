# OpenBao Operations

## Purpose

This runbook covers the v1 operator workflow for OpenBao on `romulus`.

- Bootstrap is manual.
- Unseal is manual.
- Authentik OIDC is the primary human login path after OpenBao is initialized and unsealed.
- Auto-unseal, PKI, dynamic credentials, public internet exposure, External Secrets Operator, CSI secrets, and injector usage are out of scope for v1.

## Deployment Ordering

OpenBao does not read Authentik stack outputs during deployment.

1. Deploy Authentik so the OpenBao OIDC application exists and exports its values.

```bash
pulumi up -C programs/authentik -s romulus
```

2. Deploy OpenBao independently.

```bash
pulumi up -C programs/openbao -s romulus
```

3. Initialize and unseal OpenBao manually.
4. Enable Authentik OIDC inside OpenBao with operator-run `bao` commands.

## Deployment Surfaces

Use the `openbao` Pulumi stack outputs for the current deployed values:

```bash
pulumi stack output -C programs/openbao -s romulus openbaoUrl
pulumi stack output -C programs/openbao -s romulus openbaoOperations
```

Use the `authentik` Pulumi stack outputs for the Authentik-side OIDC values:

```bash
pulumi stack output -C programs/authentik -s romulus openbaoOidcClientId
pulumi stack output -C programs/authentik -s romulus openbaoOidcIssuerUrl
pulumi stack output -C programs/authentik -s romulus openbaoOidcDiscoveryUrl
pulumi stack output -C programs/authentik -s romulus openbaoOidcUiRedirectUri
pulumi stack output -C programs/authentik -s romulus openbaoOidcCliRedirectUri
pulumi stack output -C programs/authentik -s romulus --show-secrets openbaoOidcClientSecret
```

Keep the client secret and root token in an approved secret handling location. Do not commit them to this repository.

The important v1 surfaces are:

- UI URL: `openbaoUrl`
- Internal service URL: `openbaoServiceUrl`
- OIDC auth mount: `auth/<openbaoOidcMountPath>`
- OIDC default role: `openbaoOidcDefaultRole`
- Approved KV mount: `<openbaoKvMountPath>/`
- Approved Transit key path: `<openbaoTransitMountPath>/keys/<openbaoTransitKeyName>`

## Bootstrap A New Cluster

1. Port-forward the UI service from a trusted operator workstation.

```bash
kubectl -n openbao port-forward service/openbao-chart-ui 8200:8200
```

2. In another shell, target the local forwarded address.

```bash
export BAO_ADDR=http://127.0.0.1:8200
bao status
```

3. Initialize OpenBao once.

```bash
bao operator init
```

4. Record the generated unseal keys and initial root token in approved offline storage.
5. Unseal OpenBao manually with the threshold number of unseal keys.

```bash
bao operator unseal
bao operator unseal
bao operator unseal
```

6. Log in with the initial root token only for bootstrap tasks.

```bash
bao login
```

This deployment does not automate initialization or unseal. If OpenBao restarts in a sealed state, repeat the manual unseal flow.

## Configure Approved Secret Paths

Approved v1 storage is intentionally narrow:

- `kv/`: operator and workload secret values
- `transit/keys/pulumi`: Pulumi secrets-provider migration support

Enable only those v1 paths during bootstrap:

```bash
bao secrets enable -path=kv kv-v2
bao secrets enable -path=transit transit
bao write -f transit/keys/pulumi
```

Anything outside those mounts needs a separate change if it expands the approved scope.

## Workload Secret Handoff

OpenBao is the v1 source of truth for secret values, but Pulumi remains the delivery boundary for workloads. Workloads continue to consume Kubernetes `Secret` resources rendered by Pulumi, and operators source the values from the approved OpenBao workflow before Pulumi materializes those `Secret` resources.

Use `kv/` for operator-managed workload secret values. Do not commit exported values, Pulumi config secrets, root tokens, unseal keys, or OIDC client secrets to this repository.

Pulumi state encryption uses OpenBao through the Vault-compatible Transit API. Keep the Pulumi secrets provider string in the `hashivault://<transit-key>` form while targeting the approved OpenBao Transit key path.

Direct pod-side OpenBao consumption is intentionally deferred for v1. Do not introduce External Secrets Operator, CSI-mounted secrets, or OpenBao injector sidecars without a separate change.

## Configure Authentik OIDC After Bootstrap

Authentik provisions the OIDC application and exports the values OpenBao needs, but OpenBao auth is enabled only after initialization and unseal.

1. Read the OIDC settings from stack outputs on a trusted operator workstation.
2. Enable the OIDC auth method at the configured mount path.

```bash
bao auth enable -path=oidc oidc
```

3. Configure the OIDC auth method with the deployed Authentik values.

```bash
bao write auth/oidc/config \
  oidc_discovery_url="<from openbaoOidcDiscoveryUrl>" \
  oidc_client_id="<from openbaoOidcClientId>" \
  oidc_client_secret="<from openbaoOidcClientSecret>" \
  default_role="operator"
```

4. Create the default OIDC role.

```bash
bao write auth/oidc/role/operator \
  role_type="oidc" \
  user_claim="sub" \
  allowed_redirect_uris="<from openbaoOidcUiRedirectUri>" \
  allowed_redirect_uris="<from openbaoOidcCliRedirectUri>" \
  policies="default"
```

5. Verify operator login.

CLI:

```bash
bao login -method=oidc -path=oidc role=operator
```

UI:

Open `https://openbao.holdenitdown.net` and sign in with the Authentik-backed OIDC method.

Local OpenBao users are not the primary v1 path for human operators.

## V1 Boundaries

The following remain out of scope for this rollout:

- Auto-unseal with a second OpenBao deployment or external KMS
- PKI
- Dynamic database or cloud credentials
- Public internet exposure
- External Secrets Operator
- CSI-mounted OpenBao secrets
- OpenBao injector usage

Workloads may source values from OpenBao, but Pulumi remains the v1 mechanism that renders Kubernetes `Secret` resources for workloads.
