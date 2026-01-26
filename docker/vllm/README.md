# vLLM ROCm for AMD Strix Halo (gfx1151)

Docker image for running vLLM with ROCm support on AMD Strix Halo APUs (gfx1151 / Ryzen AI Max+ 395).

**Image**: `cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151`

## Hardware Target

- AMD Ryzen AI Max+ 395 (Strix Halo)
- GPU Architecture: gfx1151
- Unified Memory: 128GB system RAM with ~96GB available for inference

## Requirements

### Host System

| Requirement | Version | Notes |
|-------------|---------|-------|
| Kernel | 6.16.9+ | Required for full VRAM visibility on unified memory |
| linux-firmware | 20260110+ | Fixes memory access faults (MES regression) |
| ROCm drivers | 7.1+ | gfx1151 support added in ROCm 7.1 |

### Kernel Parameters

These must be set on the host (not in Docker):

```bash
amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432
```

**Fedora/RHEL:**
```bash
sudo grubby --update-kernel=ALL --args="amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432"
```

**Ubuntu/Debian:**
```bash
# Edit /etc/default/grub
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432"
sudo update-grub
```

### Verify Host Setup

```bash
# Check kernel sees full memory allocation
cat /sys/class/drm/card*/device/mem_info_vram_total

# Check ROCm sees the GPU
rocminfo | grep gfx1151

# Verify kernel parameters
cat /proc/cmdline
```

## Usage

### Quick Start

```bash
docker run --rm \
  --device=/dev/kfd \
  --device=/dev/dri \
  --group-add=video \
  --group-add=render \
  --ipc=host \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  --shm-size 8g \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -v vllm-cache:/root/.cache/vllm \
  -e HF_TOKEN=$HF_TOKEN \
  cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151 \
  --model zai-org/GLM-4.7-Flash \
  --gpu-memory-utilization 0.85 \
  --max-model-len 65536 \
  --dtype half
```

### With Docker Compose

```bash
cd docker/vllm
docker compose up -d
```

## Configuration

### Memory Allocation (128GB System)

| Purpose | Allocation | Notes |
|---------|------------|-------|
| System/OS | ~4GB | Reserved |
| LLM Inference | ~80GB | `--gpu-memory-utilization 0.85` |
| KV Cache Swap | ~10GB | `--swap-space 10` |
| Headroom | ~34GB | Buffer for peaks |

### Key vLLM Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--gpu-memory-utilization` | 0.85 | Fraction of GPU memory to use |
| `--max-model-len` | 65536 | Maximum context length (64K) |
| `--swap-space` | 10 | GB of CPU memory for KV cache overflow |
| `--dtype` | half | FP16 - only officially validated on gfx1151 |

### GLM-4.7 Specific Arguments

```bash
--tool-call-parser glm47
--reasoning-parser glm45
--enable-auto-tool-choice
```

## Technical Details

### Environment Variables

These are set in the Dockerfile:

| Variable | Value | Purpose |
|----------|-------|---------|
| `TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL` | 1 | Enables AOTriton kernel compilation for gfx1151 |
| `FLASH_ATTENTION_TRITON_AMD_ENABLE` | TRUE | Enables Flash-Attention AMD Triton backend |
| `HIP_FORCE_DEV_KERNARG` | 1 | Required for gfx1151 kernel argument passing |
| `VLLM_TARGET_DEVICE` | rocm | Configures vLLM for ROCm backend |
| `ROCBLAS_USE_HIPBLASLT` | 1 | Enables hipBLASLt for optimized GEMM |

### Build Details

- **Base Image**: `rocm/vllm-dev:base`
- **vLLM**: Built from main branch with `PYTORCH_ROCM_ARCH=gfx1151`
- **TCMalloc**: Preloaded for clean shutdown
- **Image Size**: ~30.5 GB

### Known Limitations

1. **FP16 Only**: Only FP16 (half precision) is officially validated on gfx1151. FP32 may have BatchNorm/MIOpen assembly errors.

2. **First Inference Slow**: AOTriton compilation can take several minutes on first run. The vLLM cache volume persists compiled kernels.

3. **Do NOT use HSA_OVERRIDE_GFX_VERSION**: AMD explicitly recommends against this. Use TheRock nightlies instead.

## Building

### Standard Build

```bash
docker build -t cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151 .
```

### With BuildKit Cache (Recommended)

```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151 .
```

Build time is approximately 30-60 minutes due to vLLM compilation.

## Troubleshooting

### Memory Access Faults

```
Memory access fault by GPU node-1 on address...
```

**Solution**: Update linux-firmware to 20260110+ and reboot.

### VRAM Limited to 15.5GB

Despite kernel parameters, ROCm only sees ~15.5GB.

**Solution**: Upgrade kernel to 6.16.9+. The fix is in commits:
- https://git.kernel.org/torvalds/c/8b0d068e7dd17
- https://git.kernel.org/torvalds/c/759e764f7d587

### BatchNorm/MIOpen Errors

```
MIOpen Error: Code object build failed
v_add_f32 v4 v4 v4 row_bcast:15 row_mask:0xa
```

**Solution**: Use FP16 (`--dtype half`). FP32 has known issues on gfx1151.

### Slow First Inference

AOTriton compiles kernels on first run. Mount a persistent volume for the cache:

```bash
-v vllm-cache:/root/.cache/vllm
```

## References

- [ROCm Compatibility Matrix](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityryz/native_linux/native_linux_compatibility.html)
- [TheRock Releases](https://github.com/ROCm/TheRock/blob/main/RELEASES.md)
- [vLLM ROCm Documentation](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/#amd-rocm)
- [vLLM GLM-4.X Recipes](https://docs.vllm.ai/projects/recipes/en/latest/GLM/GLM.html)
- [GitHub ROCm Issue #5339](https://github.com/ROCm/ROCm/issues/5339) - gfx1151 support timeline
- [GitHub ROCm Issue #5444](https://github.com/ROCm/ROCm/issues/5444) - VRAM visibility fix
