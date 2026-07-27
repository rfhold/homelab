# Index

| Path | Info |
| --- | --- |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | Local checks, credentialed checks, and evidence boundaries |
| [`../.tekton/grafana-alert-rules.yaml`](../.tekton/grafana-alert-rules.yaml) | Pipeline caller for Grafana alert-rule reconciliation |

# Boundaries

- This subtree contains operational entry points that can change hosts, clusters, external services, or tracked local data.
- Desired configuration remains owned by its source directory; scripts should transport, reconcile, or perform a bounded operation rather than become a second configuration authority.

# Contracts

- Read a script in full before invoking it. Require explicit authorization for its action and exact target, even when the script has defaults or discovers a current context.
- A dry run or preflight can still read local data and contact external systems. Authorization to dry-run does not authorize the mutating mode or apply.
- Preserve fail-fast behavior, argument validation, explicit context selection, confirmations, temporary-file cleanup, and context restoration where the operation needs them. Do not silently broaden defaults.
- Never print, persist, or interpolate credentials into diagnostics. Keep secret inputs in the mechanism expected by the caller.
- When a script has a pipeline or source-data caller, review those interfaces together and keep paths, arguments, and environment contracts aligned.

# Hints

- Use syntax checks and repository tests for local validation. Do not substitute an operational invocation for a missing test.
- Treat scripts that rewrite tracked directories as destructive to local work; inspect existing changes before any authorized run.
