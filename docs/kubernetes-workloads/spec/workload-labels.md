# Workload Labels

## Purpose

This specification governs generic workload metadata supplied by stack configuration and the coverage expected from Kubernetes workload programs.

## Requirements

### Requirement: Generic Label Passthrough

Pulumi components, modules, and chart wrappers that accept workload labels MUST propagate supplied labels to Kubernetes resource metadata and to pod-template metadata for controllers that create pods. Existing resource labels MUST take precedence, and omitted workload labels MUST leave existing metadata unchanged.

#### Scenario: A stack supplies operational labels

- Given a stack supplies generic workload labels
- When a component creates labeled Kubernetes resources or controller pod templates
- Then those resources and templates contain the supplied labels without component-specific mapping code

#### Scenario: A stack omits operational labels

- Given a stack does not supply workload labels
- When its component creates Kubernetes resources
- Then existing labels remain unchanged and no workload layer is invented

### Requirement: Standard Workload Identity

Stack configuration MUST support `app.kubernetes.io/name`, `app.kubernetes.io/instance`, `app.kubernetes.io/component`, `app.kubernetes.io/part-of`, `app.kubernetes.io/managed-by`, and `rholden.dev/workload-layer` through the generic label path.

#### Scenario: Identity and layer labels are declared

- Given a stack declares the recommended application labels and an operational layer
- When its workload resources are rendered
- Then the declared keys and values are propagated without translating the layer through component-specific logic

### Requirement: Workload Stack Coverage

Every stack-managed Deployment, StatefulSet, DaemonSet, Job, CronJob, chart-managed pod, and other pod-producing controller MUST expose the generic workload-label path. Drain policy MUST use rendered labels rather than names, namespaces, or hardcoded workload lists as its primary classification.

#### Scenario: A workload-deploying stack is added or modified

- Given the stack manages a pod-producing Kubernetes resource
- When its configuration and component wiring are reviewed
- Then it exposes labels to both resource metadata and the resulting pod template where supported

## References

- [`src/types.ts`](../../../src/types.ts)
- [`tests/test_workload_labels.py`](../../../tests/test_workload_labels.py)
- [Coverage gaps](../verification.md)
