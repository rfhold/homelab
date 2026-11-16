# Platform NATS account rollout

This procedure defines platform provisioning, not a completed migration.
Every deployment, credential change, reset, and workflow dispatch requires explicit authorization.

## Source and prerequisites

| Path | Purpose |
| --- | --- |
| [`programs/tekton`](../../programs/tekton) | Pipeline credential exposure |
| [`nats-accounts.ts`](../../src/components/nats-accounts.ts) | Protected NATS identities and application credential outputs |
| [`tekton-nats-credentials.ts`](../../src/components/tekton-nats-credentials.ts) | OpenBao credential exposure for shared CI |
| [`nats-accounts.ts`](../../src/nats-accounts.ts) | JWT generation, quotas, and revocation rules |
| [`programs/nats`](../../programs/nats) | Account declarations, lifecycle, and broker configuration |
| [`service-pulumi-up-v1.yaml`](../../src/components/tekton-tasks/service-pulumi-up-v1.yaml) | Credential environment handoff to application Pulumi |

The [account specification](../secrets-management/spec/nats-accounts.md) defines custody and lifecycle requirements.

Before activation:

1. Select the Tekton, OpenBao, and NATS stacks and their Kubernetes targets.
2. Confirm deployment and migration authority.
3. Verify protected default branches and reviewed PipelineRun definitions.
4. Verify current shared application deployment credentials.
5. Verify protected-release identities and immutable task references.
6. Verify recovery for Pulumi identities, OpenBao records, and broker data.
7. Check aggregate account quotas against broker capacity.

CI retains its trusted shared namespace and deployment credentials.
This change creates no repository namespaces or separate CI deployment identities.
Three brokers on shared-fs do not establish independent storage failure domains.
The current NATS client endpoint lacks TLS; production requires a network isolation review.

## Configuration

| Key | Purpose |
| --- | --- |
| `nats:accounts` | Account declarations, credential generations, and quotas |
| `tekton:nats-credentials-enabled` | Opt-in pipeline credential exposure; default `false` |
| `tekton:natsRepositories` | Selected repository and environment bindings |
| `tekton:openbao-administration-attachment-enabled` | Required OpenBao attachment |
| `tekton:openbaoStack` | OpenBao stack with API management |
| `tekton:natsStack` | NATS stack with application credential outputs |
| `nats:allow-anonymous` | Development-only escape hatch; default and Pantheon value `false` |

The Pantheon NATS declaration contains Inbox preview and production account definitions.
Each account reserves up to 8 GiB disk and 64 MiB memory, with 16 streams and 128 consumers.
Account limits apply per environment, not per repository.
Their activation requires the coordinated rollout below.

Declaration shape:

```yaml
nats:accounts:
  - repository: rfhold/inbox
    environments:
      preview:
        credentialGeneration: 1
      prod:
        credentialGeneration: 1
    maxDisk: 8589934592
    maxMemory: 67108864
    maxStreams: 16
    maxConsumers: 128
    maxConnections: 64
```

Tekton declares exposure bindings separately:

```yaml
tekton:nats-credentials-enabled: false
tekton:natsStack: pantheon
tekton:natsRepositories:
  - repository: rfhold/inbox
    environments: [preview, prod]
```

Tekton validates every exposure against the NATS output's repository and environment.
The Tekton apply needs an explicitly supplied `VAULT_TOKEN`.
No extra tool image, `nsc` installation, service, or queue participates.

## Coordinated application

Within a separately approved rollout:

1. Apply the NATS account declarations with protected platform credentials.
2. Verify broker rollout and account admission on every broker.
3. Verify that old credentials fail after rotation or revocation.
4. Enable the Tekton credential exposure.
5. Apply Tekton against that NATS stack with explicit OpenBao administrator authorization.
6. Verify OpenBao login for the current shared pipeline identity without secret-value output.
7. Deploy the application through the current shared pipeline.

Tekton fails closed if its exposure bindings lack matching NATS credentials.
The next NATS apply changes authentication even if the current broker permits anonymous clients.
The operator model does not migrate streams from the anonymous global account.
Any preview reset needs separate exact deletion authority and a recovery boundary.
No Walter cleanup forms part of this procedure.

NATS publishes outputs before Tekton copies them to OpenBao.
That order does not provide an atomic credential switch or automatic broker readiness status.
A failed platform apply can interrupt application access.
Preserve the same keys and complete the approved rollout; do not generate replacement account identities.
Account JWTs use an in-memory preload; claim changes force a broker pod rollout.
Private account keys and JetStream data identity remain stable.

## Application pipeline interface

NATS and application stacks enable `kubernetes:enableSecretMutable` for in-place Secret updates.
This provider setting preserves deletion protection when JWT bytes change under stable keys.
It does not remove Kubernetes RBAC or grant access to Secret values.

Repository pipelines do not provision accounts.
The deployment Task enables `nats-enabled` and sets `nats-repository`, such as `rfhold/inbox`.
Its TaskRun retains the shared `default` ServiceAccount in `pipelines-as-code`.
A projected token with audience `openbao-nats-v1` authenticates a 600-second, exact-path read session.
The shared `nats-pipeline` ConfigMap supplies the nonsecret OpenBao address and repository/environment role and path.
Shared CI jobs can access all configured roles; this interface does not isolate CI tenants.
The Task holds credential contents in memory and supplies `PULUMI_NATS_CREDENTIALS` only to the Pulumi subprocess environment.
Dependency installation receives no NATS credential environment variable.
Application Pulumi captures that value with a secret `pulumi.Stash` input and validates its resolved output.
Later applies can use retained credentials without the environment variable.
No deployment-side credential file or file reader forms part of this contract.
Process-environment inspection remains privileged; child processes of Pulumi can inherit the credential.
Credentials never enter Results, shared workspaces, plaintext parameters, or command arguments.

Consumer task imports require an approved immutable Homelab commit.
The current Inbox task pins need a separate update after platform publication.
Do not substitute an uncommitted revision or branch URL.

## Rotation, revocation, and recovery

For rotation, increase the environment's `credentialGeneration` through a reviewed platform change.
Keep all prior generations and their protected resources.
Apply NATS, verify admission and denial, apply Tekton, then deploy the application.
For revocation, set `revoked: true` and apply both platform programs.
OpenBao record removal alone does not revoke a credential at the broker.

For restoration, use another generation and clear `revoked` through an approved platform change.
Do not decrease a generation, delete an account declaration, or remove protected state as a lifecycle shortcut.
The implementation limits each account to 100 generations; further rotation requires a reviewed maintenance change.

Backup and restore tests must preserve operator identity, account keys, every prior user key, and JetStream data.
OpenBao application credentials do not replace protected NATS Pulumi state or prove a restore procedure.

## Validation boundary

Source-only typechecks do not prove broker authentication, account isolation, rotation, or revocation.
Production verification must also cover Kubernetes RBAC, PAC provenance, OpenBao admission, storage durability, and complete Inbox delivery before activation.
