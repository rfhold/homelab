# Speaches with CUDA Support for ARM64

This Docker image compiles Speaches from source with CUDA-enabled CTranslate2 for ARM64 architecture.

## What's Included

- Speaches v0.8.3
- CTranslate2 v4.5.1 compiled with CUDA support
- CUDA 12.6.3 runtime
- cuDNN support
- ARM64 optimized CUDA architectures (72, 75, 87, 89, 90)

## Building

### Local Build

```bash
docker compose build
```

### GitHub Actions Build

The image can be built via GitHub Actions workflow dispatch with customizable versions.

## Usage

### With Docker Compose

```bash
docker compose up
```

### With Kubernetes

Update the image reference in your Pulumi stack:

```typescript
import { DOCKER_IMAGES } from "../docker-images";

// Use the custom ARM64 CUDA image
const image = "ghcr.io/rfhold/speaches:0.8.3-cuda-12.6.3-arm64";
```

## Environment Variables

- `SPEACHES_PORT`: Port to listen on (default: 8080)
- `SPEACHES_HOST`: Host to bind to (default: 0.0.0.0)
- `SPEACHES_API_KEY`: API key for authentication (optional)
- `SPEACHES_STT_MODEL_TTL`: STT model cache TTL in seconds
- `SPEACHES_TTS_MODEL_TTL`: TTS model cache TTL in seconds
- `SPEACHES_WHISPER_INFERENCE_DEVICE`: Device for inference (cuda, cpu, auto)
- `SPEACHES_WHISPER_COMPUTE_TYPE`: Compute type (default, int8, float16, float32)

## CUDA Architecture Support

The image is compiled with support for the following NVIDIA GPU architectures on ARM64:

- SM 7.2 (Jetson Xavier)
- SM 7.5 (Turing)
- SM 8.7 (Jetson Orin)
- SM 8.9 (Ada Lovelace)
- SM 9.0 (Hopper)

## Notes

- CTranslate2 is compiled with CUDA dynamic loading disabled for better compatibility
- cuDNN support is enabled for optimized neural network operations
- The image uses Ubuntu 22.04 as the base
