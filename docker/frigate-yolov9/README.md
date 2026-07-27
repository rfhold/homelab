# Frigate With YOLOv9 ONNX Models

This is a Frigate application image, not a generic [CI helper image](../../docs/deployment/spec/ci-images.md). Its build stage exports six YOLOv9 models to ONNX and copies them into the selected Frigate runtime.

Repository source describes how to build the image; it does not prove that a corresponding registry tag exists, that Frigate is deployed, or that a model is suitable for a particular detector.

## Output

| Model family | Input sizes | Image paths |
| --- | --- | --- |
| YOLOv9-T | 320 and 640 | `/models/yolov9/yolov9-t-320.onnx`, `/models/yolov9/yolov9-t-640.onnx` |
| YOLOv9-S | 320 and 640 | `/models/yolov9/yolov9-s-320.onnx`, `/models/yolov9/yolov9-s-640.onnx` |
| YOLOv9-M | 320 and 640 | `/models/yolov9/yolov9-m-320.onnx`, `/models/yolov9/yolov9-m-640.onnx` |

`FRIGATE_VERSION` defaults to `0.16.1` and selects `ghcr.io/blakeblackshear/frigate:${FRIGATE_VERSION}`.

## Reproducibility Boundary

The final Frigate tag, uv image, and released model-weight URLs are versioned, but the build is not fully pinned:

- `python:3.11` is a mutable tag;
- the YOLOv9 repository is fetched without a branch, tag, or commit;
- apt packages and several Python packages resolve at build time; and
- upstream image tags are not locked by digest.

Do not describe two builds with the same `FRIGATE_VERSION` as necessarily identical.

## Build And Inspect

From the repository root:

```bash
docker build \
  --build-arg FRIGATE_VERSION=0.16.1 \
  --tag frigate-yolov9:local \
  docker/frigate-yolov9

docker run --rm --entrypoint /bin/sh frigate-yolov9:local \
  -c 'ls -1 /models/yolov9/*.onnx'
```

Configure Frigate's ONNX detector to use one of the image paths and the matching input dimensions. Hardware devices, media mounts, and detector settings remain deployment-specific.

The file listing is only a structural check. Functional acceptance requires loading the selected ONNX model through Frigate's detector and processing a representative frame on the target detector hardware. That service- and hardware-dependent check was not run for this documentation change.

## Publication

[`build-frigate-yolov9.yml`](../../.github/workflows/build-frigate-yolov9.yml) is manual (`workflow_dispatch`). It builds `linux/amd64` and publishes:

```text
ghcr.io/<repository-owner>/frigate-yolov9:<frigate-version>
```

The workflow controls only `FRIGATE_VERSION`; the floating YOLOv9 and package inputs still resolve during each build.
