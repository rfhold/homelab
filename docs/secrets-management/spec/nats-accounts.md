# Platform NATS accounts

## Ownership and identity

The NATS Pulumi program declares repository/environment accounts through `nats:accounts`.
Tekton exposes selected accounts through `tekton:natsRepositories` and `tekton:natsStack`.
`tekton:nats-credentials-enabled` defaults to `false`.
CI remains a trusted platform in the shared `pipelines-as-code` namespace.
No repository namespace or separate deployment identity forms part of NATS provisioning.
Unknown repository/environment credential bindings fail validation.

The NATS program owns operator, system, administrator, account, user, and route identities.
Protected random resources preserve their private keys.
Tekton reads only the secret `natsPipelineCredentials` output from the NATS stack.
That output contains application credentials and binding metadata, not account, operator, or administrator keys.
NATS does not depend on Tekton or OpenBao.
Repository pipelines receive neither operator keys nor administrator credentials.

No custom runtime package, account-request CRD, dispatcher, CronJob, Lease, or account-provisioning Task exists.
NATS JWT and NKey libraries generate claims inside the platform Pulumi program.
Repository pipelines consume accounts; they cannot issue accounts or change quotas.

## Account scope

Each declared repository/environment pair receives a separate NATS account.
Claims contain no imports or exports.
Each declaration fixes disk, memory, stream, consumer, and connection limits.
The service user can use all account-local subjects except `$SYS.>`.
This scope includes JetStream APIs, reply inboxes, acknowledgements, and object-store subjects.
Subject prefixes remain application names, not isolation boundaries.
Application credentials have no automatic expiry.

The authoritative account set resides in the broker's in-memory JWT resolver.
Every broker receives the full preload through its platform configuration.
Account and system claim changes also change a pod-template checksum.
Broker rollout activates changes; OpenBao delivery alone does not establish admission or revocation.
The resolver has no persistent account cache that could retain a retired claim.
JetStream volumes remain persistent, and stable account keys preserve data identity.

## Rotation and revocation

Each environment declares `credentialGeneration`, initially `1`, with a maximum of `100`.
Every generation has a separate protected user-key resource.
The latest generation receives credentials; every prior generation receives a permanent revocation.
The revocation cutoff is Unix timestamp `253402300799`, the end of year 9999.
Retired user keys cannot issue another valid credential before that cutoff.

An explicit generation increase rotates the user without a new account identity.
Prior generation resources remain in Pulumi state.
A generation decrease or declaration removal would delete protected resources and requires separate destructive authority.
Do not remove those protections to bypass credential history.

`revoked: true` includes the current user in revocations and empties its exported credentials.
The account remains declared, so brokers retain its revocation claim and data.
For access restoration, increase the generation and clear `revoked` through an approved platform change.
A deliberate `revoked: false` change alone restores the same user; platform reviewers must reject accidental reactivation.

Pulumi applies re-sign JWTs under the same keys.
JWT bytes and OpenBao credential records can change without a user-key rotation.
Only a generation increase creates another user identity.
An application Secret update does not restart application pods.
Rotation requires coordinated Tekton, NATS, and application updates.

## Namespace and credential boundaries

Tekton preserves the shared CI namespace, current deployment credentials, and PAC repository placement.
Tekton validates each repository/environment binding against NATS credential metadata before OpenBao exposure.
It writes protected OpenBao KV v2 records at `ci/nats/OWNER/REPOSITORY/ENVIRONMENT`.
Each record contains only application credentials, account public identity, revocation state, and generation.
OpenBao roles bind the current shared `default` ServiceAccount in `pipelines-as-code` with audience `openbao-nats-v1`.
Its batch token lasts at most 600 seconds and has one exact-path read policy without the default policy.
Neither wildcard credential access nor NATS administrator credentials enter this contract.
No tenant account-request or platform TaskRun permissions exist.

All CI workloads retain platform trust and can select any configured repository/environment credential role.
Exact-path policies prevent accidental credential selection; they do not establish CI tenant isolation.
PAC Repository resources and shared Pulumi, Kubernetes, Authentik, and Grafana credentials remain unchanged.
Production retains signed-release verification, ancestry checks, and immutable task references.
NATS account separation protects broker subjects and JetStream data, not access among trusted CI jobs.

## Custody and recovery

Pulumi secret outputs protect private material in state.
Protected random resources retain operator, account, and historical user entropy in NATS Pulumi secret state.
Tekton stores no operator or account signing keys in its state or OpenBao.
OpenBao application credentials contain the current user key; they cannot sign account claims.
The Tekton Pulumi run requires explicit OpenBao administration authorization.
Repository Tasks receive no OpenBao administrator token.

Pulumi backend locks serialize platform applies; no custom compare-and-set loop exists.
Operators must not publish competing claim sets from another stack.
The NATS namespace retains a protected administrator credentials Secret.
Broker configuration contains route credentials, so access to that namespace remains privileged.

OpenBao persistence does not establish a backup or disaster-recovery guarantee.
Recovery must preserve protected Pulumi identity state, account history, and JetStream volumes.
Lost state never authorizes automatic replacement identities.
See the [rollout procedure](../../operations/nats-accounts.md) for activation gates.
