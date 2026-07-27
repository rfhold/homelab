# go2rtc Research Evidence

This is a non-authoritative research record. It does not establish an approved image, camera, stream, credentials, network mode, deployment, or live media path.

## Provenance

- No go2rtc version, research date, retrieval date, or explicit source URL was recorded.
- The source named the `alexxit/go2rtc` images and referenced Frigate `0.12+` integration without pinning a Frigate or go2rtc release.

## Evidence Retained

- go2rtc was evaluated as a protocol gateway for RTSP, WebRTC, RTMP, HLS, MSE, HomeKit, and camera integrations.
- WebRTC address discovery, TCP and UDP reachability, hardware transcoding device access, stream credentials, persistent configuration, and Home Assistant or Frigate integration were identified as concerns.
- Host networking was presented as a generic option, not an approved homelab decision.

## Repository Relevance

The research supports evaluation of camera restreaming and protocol conversion. Sample camera URLs and credential-bearing configuration were removed.

## Disposition

No standalone go2rtc contract exists. Current Frigate image evidence is linked from [deployment documentation](../deployment/README.md); any runtime adoption belongs in [Kubernetes workloads](../kubernetes-workloads/README.md).
