# Grafana Alert Rules

The sync command mutates the local rule tree. The apply command destructively reconciles remote Grafana-managed rules. Neither command commits or pushes Git changes.

## Prerequisites

- Run from the repository root with `gcx` installed; local export also requires Bun.
- Load Grafana credentials into the environment through an approved secret source. Do not place credential values in documentation, command arguments, or captured output.
- Set `GRAFANA_SERVER` and either `GRAFANA_TOKEN` or both `GRAFANA_USER` and `GRAFANA_PASSWORD`. `GRAFANA_ORG_ID` defaults to `1`.
- Inspect `git status --short -- grafana/alert-rules` before any operation. Stop if existing changes are not understood.

## Export Grafana To Files

```bash
GRAFANA_ORG_ID=1 ./scripts/sync-grafana-alert-rules.sh
git diff -- grafana/alert-rules
```

[`scripts/sync-grafana-alert-rules.sh`](../../../scripts/sync-grafana-alert-rules.sh) pulls only these exact resource selectors:

- `alertrules.v0alpha1.rules.alerting.grafana.app`
- `recordingrules.v0alpha1.rules.alerting.grafana.app`

The long selectors are required because the ambiguous `rules` selector can address an unrelated Grafana API. Export replaces the local `grafana/alert-rules/` tree with normalized managed resources and folder files. Review the complete diff; the script does not commit or push it.

## Apply Files To Grafana

Applying requires explicit approval for remote Grafana mutation and confirmation that the complete tracked rule tree is authoritative.

```bash
GRAFANA_ORG_ID=1 ./scripts/apply-grafana-alert-rules.sh
```

[`scripts/apply-grafana-alert-rules.sh`](../../../scripts/apply-grafana-alert-rules.sh) intentionally:

1. pushes folder resources first because alert resources require their destination folders;
2. deletes all managed alert and recording resources using the exact long selectors;
3. ignores absence of the retired `alert-rules` folder; and
4. pushes the complete local tree with managed resources included.

Failure after deletion can leave Grafana partially reconciled. Preserve the local tree, correct the cause, and rerun the same forward reconciliation. Do not manually create duplicate rule ownership in Mimir.

The PAC workflow invokes this apply path. Its currently over-broad trigger is recorded in [`../../deployment/verification.md`](../../deployment/verification.md).
