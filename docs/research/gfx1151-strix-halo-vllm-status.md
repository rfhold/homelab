# gfx1151 (AMD Strix Halo/Ryzen AI Max+) vLLM Support Status

## Current Status and Compatibility

### Official Support Status
As of October 2025, **vLLM does not officially support gfx1151** (AMD Strix Halo/Ryzen AI Max+ 395). The GitHub issue [#25634](https://github.com/vllm-project/vllm/issues/25634) tracks this request but has been closed with no immediate plans for official support.

### ROCm Support
- **ROCm 6.4.4**: Added formal support for Strix Halo on both Windows and Linux
- **ROCm 6.5+**: TheRock nightly builds include gfx1151 support
- **ROCm 7.0.1**: Has significant performance regressions for gfx1151 (avoid)
- **Known Issue**: gfx1151 kernels underperform gfx1100 kernels by 2.5-6X ([ROCm Issue #4748](https://github.com/ROCm/ROCm/issues/4748))

## Community Solutions

### 1. AMD Strix Halo vLLM Toolboxes
**Repository**: [kyuz0/amd-strix-halo-vllm-toolboxes](https://github.com/kyuz0/amd-strix-halo-vllm-toolboxes)

A community-maintained Docker/Podman container that provides:
- Arch-based Docker container (Toolbox-compatible)
- PyTorch + AOTriton base for ROCm on Strix Halo
- vLLM with experimental gfx1151 support
- Flash Attention support (with rocWMMA)

#### Installation Methods

**Fedora Toolbox (Development)**:
```bash
toolbox create vllm \
  --image docker.io/kyuz0/vllm-therock-gfx1151-aotriton:latest \
  -- --device /dev/dri --device /dev/kfd \
  --group-add video --group-add render --security-opt seccomp=unconfined

toolbox enter vllm
mkdir -p ~/vllm-models
start-vllm  # Helper script to launch vLLM
```

**Docker/Podman (Production)**:
```bash
podman run -d --name vllm-qwen2p5-7b \
  --ipc=host \
  --network host \
  --device /dev/kfd \
  --device /dev/dri \
  --group-add video \
  --group-add render \
  -v ~/vllm-models:/models \
  -v ~/.cache/vllm:/root/.cache/vllm \
  docker.io/kyuz0/vllm-therock-gfx1151-aotriton:latest \
  bash -lc 'source /torch-therock/.venv/bin/activate; \
    TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1 \
    vllm serve Qwen/Qwen2.5-7B-Instruct --dtype float16 \
      --host 0.0.0.0 --port 8000 --download-dir /models'
```

### 2. Build from Source Requirements

If building vLLM from source for gfx1151:

**Prerequisites**:
- ROCm 6.4.4 or TheRock nightlies (NOT ROCm 7.0.1)
- PyTorch built with gfx1151 support
- AOTriton compiled for gfx1151
- hipBLASLt with gfx1151 kernels
- rocWMMA for Flash Attention

**Critical Environment Variables**:
```bash
export TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1
export ROCBLAS_USE_HIPBLASLT=1
export HIPBLASLT_TENSILE_LIBPATH=/opt/rocm/lib/hipblaslt/library
export PYTORCH_ROCM_ARCH="gfx1151"
```

## Performance Expectations and Benchmarks

### Current Performance (Community Testing)

Based on testing with Qwen models on Framework Desktop with Ryzen AI Max+ 395:

| Model | Backend | Flags | PP512 (tok/s) | TG128 (tok/s) | Memory (MiB) |
|-------|---------|-------|---------------|---------------|--------------|
| Qwen2.5-7B | Vulkan | FA | 884 | 52.7 | 3,923 |
| Qwen2.5-7B | HIP | hipBLASLt | 986 | 50.6 | 4,218 |
| Qwen3-30B-A3B | Vulkan | FA, b=256 | 604 | 72.0 | 17,527 |
| Qwen3-8B BF16 | HIP | hipBLASLt, FA | 1,132 | 13 | ~15,000 |

### Performance Issues

1. **Kernel Performance**: gfx1151 specific kernels severely underperform
   - Using gfx1100 kernels can be 2.5-6X faster
   - hipBLASLt performance is 1.5-3X slower than gfx1100 path

2. **Memory Bandwidth**: ~215 GB/s effective (out of 256 GB/s theoretical)

3. **Compute Efficiency**: 
   - Theoretical: 59 FP16 TFLOPS
   - Actual: 5-36 TFLOPS depending on workload

## Known Issues and Limitations

### Critical Issues
1. **No official vLLM support** - Must use community solutions
2. **Performance regression** in gfx1151 kernels vs gfx1100
3. **ROCm 7.0.1 breaks performance** - 3-4X slower than 6.4.4
4. **Limited Flash Attention support** - Requires rocWMMA compilation
5. **AWQ quantization issues** - Requires `--enforce-eager` flag
6. **MXFP4 not supported** - Missing kernel implementations

### Working Configurations

**Confirmed Working Models** (with toolbox):
- Qwen2.5 series (7B-72B) with FP16/BF16
- Llama 2/3 models with standard quantizations
- Gemma models with appropriate flags
- AWQ models with `--enforce-eager` flag

**Non-working**:
- MXFP4 quantized models
- FP8 models (only fp8e5 supported, not fp8e4nv)
- Some Marlin kernel dependent models

## Recommended Configurations

### Memory Configuration (VRAM Allocation)

For AMD Ryzen AI Max+ 395 with 128GB RAM:

```bash
# Kernel parameters (GRUB)
amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432

# BIOS: Set minimal VRAM (512MB) and rely on unified memory
```

### Optimal Setup for vLLM

1. **Use ROCm 6.4.4** or TheRock nightlies (avoid 7.0.1)
2. **Enable hipBLASLt**: `export ROCBLAS_USE_HIPBLASLT=1`
3. **Use Docker toolbox** for easier management
4. **Set appropriate dtype**: `--dtype float16` or `--dtype bfloat16`
5. **For AWQ models**: Add `--quantization awq --enforce-eager`

### Example Working Configuration

```bash
# Using the toolbox
docker run -d \
  --ipc=host \
  --network host \
  --device /dev/kfd \
  --device /dev/dri \
  --group-add video \
  --group-add render \
  -v ~/models:/models \
  docker.io/kyuz0/vllm-therock-gfx1151-aotriton:latest \
  bash -lc 'source /torch-therock/.venv/bin/activate; \
    TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1 \
    ROCBLAS_USE_HIPBLASLT=1 \
    vllm serve meta-llama/Llama-2-7b-chat-hf \
      --dtype float16 \
      --host 0.0.0.0 \
      --port 8000 \
      --download-dir /models \
      --gpu-memory-utilization 0.95'
```

## Comparison with Other Solutions

### vLLM vs llama.cpp on gfx1151

| Aspect | vLLM | llama.cpp |
|--------|------|-----------|
| **Official Support** | No | Partial (Vulkan/HIP) |
| **Performance (PP)** | Lower | Higher with Vulkan |
| **Performance (TG)** | Comparable | Better with optimizations |
| **Flash Attention** | Experimental | Working with rocWMMA |
| **Ease of Setup** | Complex | Simpler |
| **Model Support** | Limited | Broader |

### Alternative: llama.cpp
Given the current state of vLLM support, many users find **llama.cpp with Vulkan backend** provides better performance and stability for gfx1151:
- Vulkan backend: 2-3X better prompt processing
- HIP backend available but underperforms
- Flash Attention works with rocWMMA compilation
- More active community support for Strix Halo

## Workarounds and Optimizations

### Performance Workarounds

1. **Use gfx1100 override** (risky but can improve performance):
   ```bash
   export HSA_OVERRIDE_GFX_VERSION=11.0.0
   ```

2. **Enable hipBLASLt**:
   ```bash
   export ROCBLAS_USE_HIPBLASLT=1
   ```

3. **Optimize batch sizes** for MoE models:
   ```bash
   --max-num-seqs 256  # For better MoE performance
   ```

### Memory Optimizations

1. **GTT Configuration**:
   ```bash
   # Enable large GTT for unified memory
   echo "options amdgpu gttsize=131072" | sudo tee /etc/modprobe.d/amdgpu.conf
   ```

2. **Memory allocation**:
   ```bash
   --gpu-memory-utilization 0.95  # Use most available VRAM
   --max-model-len 32768  # Limit context to reduce memory
   ```

## Future Outlook

### Expected Improvements
- Official ROCm support continues to improve (6.4.4 added formal support)
- Community working on optimized kernels for gfx1151
- vLLM team may add support once ROCm stabilizes
- Performance parity with gfx1100 expected in future ROCm releases

### Current Recommendations
1. **For production**: Use llama.cpp with Vulkan backend
2. **For experimentation**: Try the community Docker toolbox
3. **For development**: Build from source with TheRock nightlies
4. **Avoid**: ROCm 7.0.1 due to performance regressions

## Resources

- [Strix Halo Toolboxes](https://github.com/kyuz0/amd-strix-halo-vllm-toolboxes)
- [Strix Halo Testing](https://github.com/lhl/strix-halo-testing)
- [LLM Tracker - Strix Halo](https://llm-tracker.info/_TOORG/Strix-Halo)
- [ROCm TheRock Releases](https://github.com/ROCm/TheRock/releases/)
- [Framework Community Discussion](https://community.frame.work/t/amd-strix-halo-ryzen-ai-max-395-gpu-llm-performance-tests/72521)
- [Level1Techs Forum](https://forum.level1techs.com/t/strix-halo-ryzen-ai-max-395-llm-benchmark-results/233796)

## Summary

While vLLM doesn't officially support gfx1151, the community has developed working solutions through Docker containers and custom builds. Performance is currently suboptimal due to kernel issues, with ROCm 6.4.4 or TheRock nightlies providing the best results. For most users, llama.cpp with Vulkan backend may be a more reliable alternative until official support materializes. The situation is actively evolving with ongoing community efforts to improve support and performance.