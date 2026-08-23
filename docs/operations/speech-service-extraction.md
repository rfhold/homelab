# Speech Service Extraction

This runbook moves WhisperX and Kokoro ownership from Walter to their standalone repositories. It permits downtime to avoid two HTTPRoutes claiming the same direct hostname. It does not authorize a push, image publication, Pulumi update, PipelineRun, or Kubernetes mutation.

## Scope

| Service  | New repository           | New namespace | New cache                    | Retained Walter cache        |
| -------- | ------------------------ | ------------- | ---------------------------- | ---------------------------- |
| WhisperX | `rfhold/whisperx-server` | `whisperx`    | `whisper-model-cache`, 20 Gi | `walter/whisper-model-cache` |
| Kokoro   | `rfhold/kokoro-server`   | `kokoro`      | `kokoro-model-cache`, 5 Gi   | `walter/kokoro-model-cache`  |

The new repositories retain Service and Deployment names but own fresh namespace-scoped resources. The old Walter PVCs and `walter/whisper-secrets` MUST NOT be deleted. WhisperX diarization requires an approved secret-management process to provision `whisperx/whisper-secrets`; no token is copied through Git or command output.

## Preconditions

1. Review and commit the standalone repository, Walter retirement, and homelab ownership changes.
2. Confirm both standalone Deployments render with zero replicas and immutable revision image deployment.
3. Confirm the Agent Gateway model-extraction policy excludes `/v1/audio/transcriptions` and `/v1/audio/speech` before attaching either audio route.
4. Confirm PAC enrollment names `rfhold/whisperx-server` and `rfhold/kokoro-server` and that each repository has exactly one push workflow.
5. Capture sanitized complete definitions of the old Deployment, Service, and HTTPRoute as rollback evidence. Remove status, managed metadata, and Secret values while preserving environment references, probes, resources, placement, runtime class, tolerations, volumes, image, selectors, and replica count.
6. Record the old ready state and confirm both old PVCs remain Bound. Do not read or record Secret data.

Stop if any precondition fails. Perform the remaining procedure for one service at a time.

## Prepare Platform Routing

1. Preview and apply the authorized `agent-gateway/pantheon` change.
2. Preview and apply the authorized `tekton/pantheon` PAC enrollment change.
3. Verify the Agent Gateway policy is accepted and the two model-extraction exclusions are present.
4. Verify the standalone repository appears in PAC before its first push.

## Build At Zero Replicas

1. Obtain explicit authorization to scale down the old Deployment and remove its direct-host HTTPRoute.
2. Scale the old Walter Deployment to zero. Downtime begins here.
3. Confirm the old Deployment has no pod or ready Service endpoint.
4. Remove the old Walter direct-host HTTPRoute for the service.
5. Leave the old Walter Deployment and Service present at zero replicas for immediate rollback.
6. Push the standalone repository and wait for its PipelineRun to build the AMD64 CUDA image and deploy the immutable revision.
7. Verify the new namespace, zero-replica Deployment, Service, fresh PVC, direct-host HTTPRoute, and Agent Gateway HTTPRoute.
8. Require `Accepted=True` and `ResolvedRefs=True` on both new HTTPRoutes. At zero replicas, the Service is expected to have no ready endpoint.

Do not continue if the image build, deployment, route attachment, or fresh PVC binding fails.

## Activate And Verify

1. Change the standalone manifest to one replica, review it, and push the activation revision.
2. Wait for the immutable image rollout and a ready Service endpoint.
3. Verify the health endpoint and the preserved direct hostname.
4. Verify the standard Agent Gateway endpoint:
   - WhisperX: multipart `POST /v1/audio/transcriptions`, including a recording larger than 2 MiB.
   - Kokoro: JSON `POST /v1/audio/speech` and streamed audio output.
5. Verify GPU memory, temperature, pod restarts, PVC mounts, and model cache behavior on Athena.
6. For WhisperX, verify `/transcribe` remains compatible. Verify diarization only after `whisperx/whisper-secrets` is provisioned through the approved secret owner.

## Retire Walter Resources

After an explicit acceptance gate:

1. Delete only the old Walter Deployment, Service, and HTTPRoute for the accepted service.
2. Preserve the `walter` namespace, old PVC, Whisper Secret, and unrelated Walter objects.
3. Confirm no old Service endpoint or direct-host route remains.
4. Repeat the build, activation, verification, and retirement sequence for the other service.

Removing Walter source does not remove live resources. Do not use namespace deletion or `kubectl delete -k` against the historical Walter manifests.

## Rollback

Before old resource retirement:

1. Scale the new Deployment to zero.
2. Remove the new direct-host HTTPRoute so it cannot conflict with the old route.
3. Reapply the captured old Walter HTTPRoute if needed and scale the preserved old Deployment to its recorded replica count.
4. Verify the direct hostname and old cache before removing any new resource.

After old resource retirement, recreate only the captured old Deployment, Service, and HTTPRoute from the pre-cutover evidence, then follow the same rollback sequence. Never recreate or replace the retained Walter PVC or Whisper Secret.

Record the failure and resulting live state in the applicable verification ledger. A successful rollback does not prove the new image or route contract.
