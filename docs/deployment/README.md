# Deployment

Deployment specifications define intended behavior. The implementation summary describes tracked repository source; it does not establish that a pipeline, image, or cluster resource is live.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Tracked Tekton, BuildKit, and container-image implementation |
| [`spec/ci-images.md`](spec/ci-images.md) | Generic Bun and Tauri CI helper image contracts |
| [`spec/tekton.md`](spec/tekton.md) | Deployer RBAC and PAC enrollment contracts |
| [`spec/buildkit.md`](spec/buildkit.md) | Pantheon amd64 BuildKit placement contract |
| [`verification.md`](verification.md) | Source drift, historical evidence, and live-state gaps |
| [`../../docker/bitnami-postgres-documentdb/README.md`](../../docker/bitnami-postgres-documentdb/README.md) | DocumentDB application database image |
| [`../../docker/bitnami-postgres-pgvector/README.md`](../../docker/bitnami-postgres-pgvector/README.md) | pgvector application database image |
| [`../../docker/frigate-yolov9/README.md`](../../docker/frigate-yolov9/README.md) | Frigate application image with YOLOv9 models |
| [`../../docker/vllm/README.md`](../../docker/vllm/README.md) | vLLM application image variants for gfx1151 |
