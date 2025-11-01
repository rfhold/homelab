# vLLM ROCm Docker Image for gfx1151

Experimental Docker image for running vLLM with ROCm 6.4.4 on AMD gfx1151 (Strix Halo) GPUs.

## Prerequisites

### Host System Requirements
- AMD GPU with gfx1151 architecture (Ryzen AI Max+ 395)
- ROCm 6.4.4 installed on host
- At least 16GB VRAM
- 64GB+ system RAM recommended
- Docker with GPU passthrough support

### Kernel Parameters
Add to GRUB configuration for optimal performance:
```bash
amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432
```

### Verify ROCm Installation
```bash
rocm-smi
rocminfo | grep gfx
```

## Build

```bash
docker compose build
```

Or with custom args:
```bash
docker build \
  --build-arg ROCM_VERSION=6.4.4 \
  --build-arg PYTHON_VERSION=3.10 \
  --build-arg VLLM_VERSION=main \
  --build-arg FLASH_ATTENTION_BRANCH=main_perf \
  -t homelab/vllm-rocm:latest .
```

## Usage

### Test GPU Detection
```bash
docker compose run --rm vllm-rocm test-gpu
```

### Test vLLM Basic Functionality
```bash
docker compose run --rm --profile test vllm-rocm-test
```

### Start Qwen3-Omni Server
```bash
# Set Hugging Face token if needed
export HF_TOKEN=your_token_here
export HF_HOME=/path/to/models

docker compose up -d
```

### Custom Model
```bash
docker run --rm \
  --device=/dev/kfd \
  --device=/dev/dri \
  --group-add video \
  -v /path/to/models:/models \
  -p 8901:8901 \
  homelab/vllm-rocm:latest \
  serve meta-llama/Llama-2-7b-chat-hf \
  --dtype float16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.8
```

### Interactive Shell
```bash
docker compose run --rm --profile debug vllm-rocm-shell
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HF_TOKEN` | - | Hugging Face API token |
| `PYTORCH_ROCM_ARCH` | `gfx1151` | Target GPU architecture |
| `HSA_OVERRIDE_GFX_VERSION` | `11.0.0` | Fallback to gfx1100 kernels |
| `VLLM_ATTENTION_BACKEND` | `ROCM_TRITON` | Attention backend (required for RDNA3) |
| `VLLM_USE_V1` | `1` | Use V1 architecture |
| `FLASH_ATTENTION_TRITON_AMD_ENABLE` | `TRUE` | Enable Triton backend for Flash Attention |

## API Usage

Once running, the server exposes an OpenAI-compatible API:

```bash
curl http://localhost:8901/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-Omni-30B-A3B-Instruct",
    "prompt": "Hello, my name is",
    "max_tokens": 50,
    "temperature": 0.7
  }'
```

## Performance Benchmarking

```bash
docker compose run --rm vllm-rocm benchmark meta-llama/Llama-2-7b-chat-hf
```

## Known Limitations

- **gfx1151 is NOT officially supported** by vLLM - using fallback to gfx1100
- **Expected 2.5-6X performance degradation** compared to officially supported architectures
- Flash Attention uses experimental Triton backend for RDNA3
- Qwen3-Omni audio processing is **untested on ROCm**
- Maximum model length limited by available VRAM
- May encounter stability issues with large models

## Troubleshooting

### GPU Not Detected
```bash
# Verify devices are accessible
ls -la /dev/kfd /dev/dri

# Check user groups
groups

# Add user to video/render groups
sudo usermod -a -G video,render $USER
```

### Out of Memory Errors
Reduce memory utilization or model length:
```bash
--gpu-memory-utilization 0.8
--max-model-len 8192
```

### Flash Attention Crashes
Disable Flash Attention as fallback:
```bash
--enforce-eager
```

### Performance Issues
Monitor GPU usage:
```bash
watch -n 1 rocm-smi
```

## Architecture

This image uses a multi-stage build:

1. **rocm-base**: Base ROCm 6.4.4 with PyTorch
2. **flash-attention-builder**: AOTriton + Flash Attention with Triton backend
3. **vllm-builder**: vLLM main branch with ROCm support
4. **qwen3-omni-integration**: Qwen3-Omni model files from fork
5. **final**: Audio libraries + runtime configuration

## References

- [vLLM ROCm Documentation](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/index.html)
- [ROCm Flash Attention](https://github.com/ROCm/flash-attention)
- [Qwen3-Omni Repository](https://github.com/QwenLM/Qwen3-Omni)
- [Implementation Plan](../../docs/research/qwen3-omni-rocm-gfx1151-implementation-plan.md)

## Warning

This is **EXPERIMENTAL SOFTWARE** running on **UNSUPPORTED HARDWARE**. Use at your own risk. Not recommended for production deployments.
