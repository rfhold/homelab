# Secrets Verification

No live OpenBao, Authentik, Kubernetes, Tekton, or Pulumi backend inspection was performed during this conversion.

| Topic | Tracked evidence | Unresolved verification |
| --- | --- | --- |
| OpenBao deployment | Source defines a Romulus stack, chart, PVC, Services, and HTTPRoute | Confirm the stack was applied, the PVC is bound, the workload is ready, and the route is reachable only through intended internal paths. |
| Initialization and unseal | Source and the runbook require manual operation | Confirm whether the storage is initialized, whether the server is currently sealed, and where recovery material is held without recording that material here. |
| KV and Transit | Source exports default mount and key names | Confirm the engines are enabled, the Transit key exists, and required policies are present. Outputs alone are not evidence that any of these operations occurred. |
| Authentik OIDC | Authentik source defines the application and secret output; OpenBao source exports matching defaults | Confirm the Authentik resources were applied, OpenBao's OIDC auth method and role were configured, redirect URIs match, and operator login succeeds. |
| Automation token | Tekton source reads `OPENBAO_PULUMI_TOKEN` or `VAULT_TOKEN` but falls back to an empty string | Confirm a non-root, least-privilege token exists, is non-empty during reconciliation, reaches only the approved Transit path, and is present in the live Tekton Secret. Do not expose it while verifying. |
| Pulumi backend prerequisites | Tekton reads `PULUMI_BACKEND_URL`, object-store outputs, and local kubeconfig metadata | Confirm all required values and contexts were present during reconciliation; source permits an empty backend URL. |
| Pulumi secrets-provider migration | Tekton constructs a `hashivault://` path, while tracked stack files contain no migration evidence | Inventory each stack's actual secrets provider and migration result. Do not infer repository-wide migration from Tekton wiring or historical previews. |
| Workload source of truth | The intended contract makes OpenBao the secret source while Pulumi remains delivery | Confirm which values, if any, have moved into OpenBao. Existing Pulumi config and Kubernetes Secrets may still be authoritative until migration is verified. |

Until these checks are completed, describe OpenBao as tracked and intended infrastructure, not as the established live source of truth.
