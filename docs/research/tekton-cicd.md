# Tekton CI/CD

Tekton is an open-source, Kubernetes-native CI/CD framework that uses Custom Resource Definitions (CRDs) to define pipelines. It is part of the CD Foundation (Linux Foundation project) and uses a serverless execution model with no centralized CI server.

## Core Components

- Tekton Pipelines: Core component for Tasks and Pipelines
- Tekton Triggers: Event-driven automation
- Tekton Dashboard: Web UI for monitoring
- Tekton CLI (tkn): Command-line interface
- Tekton Chains: Supply chain security
- Tekton Hub: Catalog of reusable Tasks

## Resource Hierarchy

- Step: Single container operation
- Task: Collection of Steps (runs as a Pod)
- Pipeline: DAG of Tasks
- TaskRun/PipelineRun: Execution instances

## Prerequisites

- Kubernetes 1.28 or later
- kubectl configured
- cluster-admin privileges

## Installation

### Tekton Pipelines

```shell
kubectl apply --filename https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml
```

### Tekton Triggers

```shell
kubectl apply --filename https://storage.googleapis.com/tekton-releases/triggers/latest/release.yaml
kubectl apply --filename https://storage.googleapis.com/tekton-releases/triggers/latest/interceptors.yaml
```

### Tekton Dashboard

```shell
kubectl apply --filename https://storage.googleapis.com/tekton-releases/dashboard/latest/release.yaml
```

### CLI (macOS)

```shell
brew install tektoncd-cli
```

## Basic Task Example

```yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: hello-world
spec:
  params:
    - name: username
      type: string
      default: "World"
  steps:
    - name: say-hello
      image: ubuntu
      script: |
        #!/usr/bin/env bash
        echo "Hello $(params.username)!"
```

## Basic Pipeline Example

```yaml
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: build-and-deploy
spec:
  params:
    - name: repo-url
      type: string
    - name: image-reference
      type: string
  workspaces:
    - name: shared-data
    - name: docker-credentials
  tasks:
    - name: fetch-source
      taskRef:
        name: git-clone
      workspaces:
        - name: output
          workspace: shared-data
      params:
        - name: url
          value: $(params.repo-url)
    - name: build-image
      runAfter: ["fetch-source"]
      taskRef:
        name: kaniko
      workspaces:
        - name: source
          workspace: shared-data
        - name: dockerconfig
          workspace: docker-credentials
      params:
        - name: IMAGE
          value: $(params.image-reference)
```

## PipelineRun Example

```yaml
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: build-and-deploy-run-
spec:
  pipelineRef:
    name: build-and-deploy
  params:
    - name: repo-url
      value: https://github.com/example/app.git
    - name: image-reference
      value: registry.example.com/app:latest
  workspaces:
    - name: shared-data
      volumeClaimTemplate:
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 1Gi
    - name: docker-credentials
      secret:
        secretName: docker-credentials
```

## Workspaces

Workspace types:

- emptyDir
- persistentVolumeClaim
- volumeClaimTemplate
- configMap
- secret

Workspace variables:

- $(workspaces.<name>.path)
- $(workspaces.<name>.bound)
- $(workspaces.<name>.claim)

## Triggers

### Components

- EventListener: HTTP endpoint for events
- TriggerBinding: Extracts data from event payload
- TriggerTemplate: Creates TaskRun/PipelineRun resources
- Interceptor: Validates/transforms events

### GitHub TriggerBinding Example

```yaml
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerBinding
metadata:
  name: github-push-binding
spec:
  params:
    - name: gitrevision
      value: $(body.head_commit.id)
    - name: gitrepositoryurl
      value: $(body.repository.clone_url)
    - name: gitbranch
      value: $(body.ref)
```

### EventListener Example

```yaml
apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: github-listener
spec:
  serviceAccountName: tekton-triggers-sa
  triggers:
    - name: github-push
      interceptors:
        - ref:
            name: github
          params:
            - name: secretRef
              value:
                secretName: github-secret
                secretKey: secretToken
            - name: eventTypes
              value: ["push"]
      bindings:
        - ref: github-push-binding
      template:
        ref: github-push-template
```

## CLI Commands

```shell
tkn task list
tkn task start <task-name> --showlog
tkn pipeline list
tkn pipeline start <pipeline-name> --showlog
tkn pipelinerun list
tkn pipelinerun logs <pipelinerun-name> -f
tkn hub install task git-clone
tkn hub search kaniko
```

## Best Practices

- Use dedicated ServiceAccounts with RBAC
- Use Workspaces (PVCs) for data sharing between Tasks, not emptyDir
- Results are limited to ~4KB - use Workspaces for larger data
- Set appropriate timeouts on Tasks
- Run containers as non-root when possible
- Use Tekton Hub for reusable Tasks (git-clone, kaniko, etc.)
- Use Tekton Chains for supply chain security (SLSA compliance)

## Comparison

- vs Jenkins: More Kubernetes-native, serverless, but fewer plugins
- vs GitHub Actions: Self-hosted, portable, no vendor lock-in
- vs ArgoCD: Tekton for CI (build), ArgoCD for CD (GitOps deploy) - often used together
