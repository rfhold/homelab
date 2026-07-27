# Index

| Path | Info |
| --- | --- |
| [`../programs/tekton/`](../programs/tekton/) | Pulumi program that installs and configures Tekton services |
| [`../src/components/tekton.ts`](../src/components/tekton.ts) | Shared Tekton installation component |
| [`../src/components/tekton-tasks/`](../src/components/tekton-tasks/) | Cluster-installed tasks referenced by PipelineRuns |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | CI inspection and external-mutation boundaries |

# Boundaries

- This subtree owns Pipelines as Code `PipelineRun` definitions, event filters, workspaces, and task wiring.
- Cluster installation and credentials belong to the Tekton Pulumi program; reusable task implementations belong under `src/components/tekton-tasks/`.

# Contracts

- Treat every YAML change as automation behavior. Trigger annotations, branch and path filters, task references, parameters, workspaces, and `when` conditions jointly determine what executes.
- Some runs publish images, reconcile external services, or push Git refs. Do not dispatch an `incoming` event, rerun a pipeline, or push a matching branch or tag without explicit authorization for that effect.
- Keep secret values in referenced Kubernetes secrets or Pipelines as Code substitutions. Never embed resolved credentials in pipeline source or validation output.
- Review a pipeline with every Docker context, script, source path, and cluster task it invokes. Update both sides when an interface changes.
- Read-only CI inspection can still contact external systems and expose operational context; authorization to inspect does not authorize dispatch or release.

# Hints

- Validate YAML and source relationships locally. Live pipeline status is evidence of a particular run, not proof of current desired state.
