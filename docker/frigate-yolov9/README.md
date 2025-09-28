# Frigate NVR with YOLOv9 Models

This Docker image combines Frigate NVR with pre-built YOLOv9 ONNX models for enhanced object detection performance.

## Current Versions
- **Frigate**: `0.16.1`
- **YOLOv9**: Latest from [WongKinYiu/yolov9](https://github.com/WongKinYiu/yolov9)
- **Models**: t, s, m sizes with 320x320 and 640x640 input resolutions

## Available Models

The image includes 6 pre-built YOLOv9 ONNX models:

| Model | Input Size | Location | Performance |
|-------|------------|----------|-------------|
| `yolov9-t-320.onnx` | 320x320 | `/models/yolov9/` | Fastest, lowest accuracy |
| `yolov9-t-640.onnx` | 640x640 | `/models/yolov9/` | Fast, good accuracy |
| `yolov9-s-320.onnx` | 320x320 | `/models/yolov9/` | Balanced speed/accuracy |
| `yolov9-s-640.onnx` | 640x640 | `/models/yolov9/` | Good accuracy, moderate speed |
| `yolov9-m-320.onnx` | 320x320 | `/models/yolov9/` | High accuracy, slower |
| `yolov9-m-640.onnx` | 640x640 | `/models/yolov9/` | Highest accuracy, slowest |

## Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `FRIGATE_VERSION` | `0.16.1` | Frigate base image version |

## Usage

### Build the Image
```bash
docker build -t frigate-yolov9:latest .
```

### Build with Custom Frigate Version
```bash
docker build \
  --build-arg FRIGATE_VERSION=0.16.1 \
  -t frigate-yolov9:custom .
```

### Run with Docker Compose
```bash
docker-compose up -d
```

### Run Standalone
```bash
docker run -d \
  --name frigate-yolov9 \
  --restart=unless-stopped \
  --mount type=tmpfs,target=/tmp/cache,tmpfs-size=1000000000 \
  --device /dev/bus/usb:/dev/bus/usb \
  --device /dev/dri/renderD128 \
  -v /path/to/config:/config \
  -v /path/to/storage:/media/frigate \
  -v /etc/localtime:/etc/localtime:ro \
  -p 5000:5000 \
  -p 8971:8971 \
  frigate-yolov9:latest
```

## Frigate Configuration

To use YOLOv9 models in your Frigate configuration, update your `config.yml`:

```yaml
model:
  # For balanced performance
  path: /models/yolov9/yolov9-s-640.onnx
  input_tensor: nhwc
  input_pixel_format: bgr
  width: 640
  height: 640

# Or for fastest detection
# model:
#   path: /models/yolov9/yolov9-t-320.onnx
#   input_tensor: nhwc
#   input_pixel_format: bgr
#   width: 320
#   height: 320

detectors:
  onnx:
    type: onnx
    device: auto  # Use CPU, or 'gpu' if available
```

## Model Selection Guide

### For CPU-only systems:
- **Low-end**: `yolov9-t-320.onnx` - Fastest inference
- **Mid-range**: `yolov9-s-320.onnx` - Good balance
- **High-end**: `yolov9-s-640.onnx` - Better accuracy

### For GPU-accelerated systems:
- **Balanced**: `yolov9-s-640.onnx` - Good accuracy with acceptable speed
- **High accuracy**: `yolov9-m-640.onnx` - Best detection quality

## Features

- **Pre-built Models**: All YOLOv9 models are built during image creation for immediate use
- **Multi-stage Build**: Optimized Docker layers for faster builds and smaller final image
- **ONNX Runtime**: Uses ONNX for cross-platform compatibility and performance
- **Frigate Integration**: Drop-in replacement for standard Frigate image
- **Model Flexibility**: Choose the right model for your hardware and accuracy needs

## Performance Notes

- YOLOv9 models generally provide better accuracy than YOLOv5/YOLOv8 at similar speeds
- 320x320 models are ~4x faster than 640x640 but with reduced small object detection
- 't' models are optimized for speed, 's' for balance, 'm' for accuracy
- GPU acceleration significantly improves performance for all models

## Build Time

This image takes longer to build due to model compilation (~10-15 minutes depending on hardware). The models are cached in Docker layers for subsequent builds.

## Troubleshooting

### Model Loading Issues
```bash
# Verify models exist in container
docker exec frigate-yolov9 ls -la /models/yolov9/

# Check Frigate logs for model loading
docker logs frigate-yolov9
```

### Performance Issues
- Start with `yolov9-t-320.onnx` to verify functionality
- Monitor CPU/GPU usage and adjust model size accordingly
- Consider enabling hardware acceleration in Frigate detector config