## Change Overview

- **Why**: Dot's scheduler deployment pipeline applies a CronJob, but the shared Tekton deployer kubeconfig currently lacks `batch/cronjobs` permissions and cannot deploy that resource.
- **Impact**: Homelab will grant the existing Tekton deployer role permission to manage CronJobs alongside Jobs for deployment workflows.
- **Non-goals**: This change does not deploy homelab, apply the dot scheduler, change dot manifests, or broaden non-batch permissions.
- **Rollback**: Remove `cronjobs` from the Tekton deployer batch resources and redeploy homelab RBAC.

## ADDED Requirements

### Requirement: Tekton Deployer CronJob Permissions

The system MUST allow the shared Tekton deployer credentials to manage Kubernetes CronJobs for deployment workflows.

#### Scenario: Deployer applies CronJob resources

Given a deployment workflow uses the shared Tekton deployer kubeconfig
When the workflow applies a `batch/v1` CronJob manifest
Then the system MUST authorize the deployer to get, list, watch, create, update, patch, and delete CronJobs

#### Scenario: Existing Job permissions remain available

Given a deployment workflow uses the shared Tekton deployer kubeconfig
When the workflow applies a `batch/v1` Job manifest
Then the system MUST continue to authorize the deployer to get, list, watch, create, update, patch, and delete Jobs
