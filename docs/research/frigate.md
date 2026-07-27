# Frigate Runtime Research Evidence

This is a non-authoritative research record. It does not establish the deployed Frigate version, image, cameras, credentials, model, hardware devices, retention, or live recordings.

## Provenance

- The source described Frigate `0.14.x` as stable, `0.13.x` as previous, and `0.15.x` as development, and referenced bundled go2rtc `1.9.x`; no research or retrieval date was recorded.
- No external source URLs were preserved in the original file.

## Evidence Retained

- Frigate was evaluated as a stateful NVR with local detection, recording, embedded go2rtc, MQTT integration, and optional Coral, NVIDIA, Intel, AMD, Hailo, or OpenVINO acceleration.
- Persistent configuration and SQLite metadata, separate recording storage, shared memory sizing, camera-network access, substreams, hardware decoding, and protected versus unauthenticated ports were identified as concerns.
- The research treated a single instance per camera set and independent configuration/database backups as important constraints.

## Repository Relevance

This evidence informed the repository's Frigate image work. Generic camera configuration, credentials, sizing claims, and deployment procedures were removed.

## Disposition

Current image behavior is documented in the [Frigate YOLOv9 image guide](../../docker/frigate-yolov9/README.md) and indexed by [deployment](../deployment/README.md). No canonical Frigate workload deployment contract exists.
