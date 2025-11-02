# vLLM Docker Images Analysis for AMD GPUs

## Executive Summary

This document provides a comprehensive analysis of vLLM Docker images for AMD ROCm GPUs, focusing on the available images, compatibility matrices, architectural differences between vLLM V0 and V1, and recommendations for specific GPU architectures like gfx1151.

## Docker Image Inventory

### Production Images (rocm/vllm)

| Image Tag | Size | ROCm Version | vLLM Version | Last Updated | Architecture Support |
|-----------|------|--------------|--------------|--------------|---------------------|
| `rocm7.0.0_vllm_0.10.2_20251006` | 8.59 GB | 7.0.0 | 0.10.2 | 2025-10-07 | CDNA3/4, RDNA3/4, gfx90a-gfx1201 |
| `rocm6.4.1_vllm_0.10.1_20250909` | 7.44 GB | 6.4.1 | 0.10.1 | 2025-09-09 | CDNA2/3, RDNA3, gfx90a-gfx1101 |
| `rocm6.4.1_vllm_0.10.0_20250812` | 7.42 GB | 6.4.1 | 0.10.0 | 2025-08-13 | CDNA2/3, RDNA3, gfx90a-gfx1101 |
| `rocm6.4.1_vllm_0.9.1_20250715` | 7.86 GB | 6.4.1 | 0.9.1 | 2025-07-16 | CDNA2/3, RDNA3, gfx90a-gfx1101 |
| `rocm6.3.1_vllm_0.8.5_20250521` | 9.40 GB | 6.3.1 | 0.8.5 | 2025-05-29 | CDNA2/3, RDNA3, gfx90a-gfx1101 |
| `rocm6.3.1_instinct_vllm0.8.3_20250415` | 8.97 GB | 6.3.1 | 0.8.3 | 2025-04-29 | CDNA2/3 (Instinct only) |
| `rocm6.2_mi300_ubuntu22.04_py3.12_vllm_0.6.6` | 7.73 GB | 6.2 | 0.6.6 | 2025-02-04 | MI300 series (gfx942) |

### Development Images (rocm/vllm-dev)

| Image Tag | Size | Purpose | Last Updated | Features |
|-----------|------|---------|--------------|----------|
| `nightly` | 8.76 GB | Latest development | Daily | Latest vLLM main branch |
| `base` | 7.36 GB | Base development image | 2025-10-27 | Minimal dependencies |
| `preview_1020_rc3_20251024` | 8.72 GB | Release candidate | 2025-10-24 | v1.0.20 RC3 |
| `base_custom_main_20251023_tuned_20251023` | 7.36 GB | Custom tuned build | 2025-10-24 | Performance optimizations |
| `rocm7.0.2_navi_ubuntu22.04_py3.10_pytorch_2.8_vllm_0.10.2rc1` | 14.47 GB | RDNA3 optimized | 2025-10-15 | Navi/RDNA3 specific |
| `dsfp4_exp_1017` | 13.98 GB | FP4 experimental | 2025-10-17 | FP4 quantization support |

## Compatibility Matrix

### ROCm Version Compatibility

| ROCm Version | Supported GPUs | vLLM Versions | PyTorch Versions | Key Features |
|--------------|----------------|---------------|------------------|--------------|
| **7.0.0-7.0.2** | MI300X/A, MI325X, MI350X/355X, RDNA3/4 | 0.10.0+ | 2.7.0-2.8.0 | V1 architecture, Triton kernels |
| **6.4.1** | MI200 series, MI300X/A, RDNA3 | 0.9.0-0.10.1 | 2.6.0-2.7.0 | V0 and V1 support |
| **6.3.1** | MI200 series, MI300X/A, RDNA3 | 0.8.0-0.8.5 | 2.5.0-2.6.0 | V0 architecture |
| **6.2** | MI100, MI200 series, MI300X | 0.6.0-0.7.x | 2.4.0-2.5.0 | Legacy V0 only |

### GPU Architecture Support

| GPU Architecture | LLVM Target | Recommended ROCm | vLLM Support | Notes |
|-----------------|-------------|------------------|--------------|-------|
| **CDNA4** (MI350X/355X) | gfx950 | 7.0.0+ | V1 only | Latest Instinct |
| **CDNA3** (MI300X/A, MI325X) | gfx942 | 6.2+ | V0/V1 | Full support |
| **CDNA2** (MI250X/250/210) | gfx90a | 6.2+ | V0/V1 | Mature support |
| **CDNA** (MI100) | gfx908 | 6.2+ | V0 only | Limited V1 |
| **RDNA4** (RX 9000 series) | gfx1200/1201 | 7.0.0+ | V1 only | Consumer GPUs |
| **RDNA3** (RX 7900 series) | gfx1100/1101 | 6.3+ | V0/V1 | Including gfx1151 |
| **RDNA2** (RX 6000 series) | gfx1030 | 6.2+ | V0 only | Limited support |

## vLLM V1 Architecture with Triton Support

### Key Architectural Improvements

#### vLLM V1 vs V0 Comparison

| Feature | V0 Architecture | V1 Architecture | Performance Impact |
|---------|-----------------|-----------------|-------------------|
| **Batch Formation** | Separate prefill/decode batches | Mixed batches (prefill + decode + speculative) | 10-15% throughput improvement |
| **Kernel Implementation** | C++/HIP custom kernels | Triton-based portable kernels | Better maintainability, 10% faster |
| **Attention Backend** | Platform-specific (CUDA/HIP) | Unified Triton implementation | Cross-platform compatibility |
| **Optimization Support** | Some features incompatible | All optimizations enabled by default | Full feature utilization |
| **Memory Access** | Standard paged attention | Optimized tile-based access patterns | Improved cache efficiency |
| **GQA Support** | Basic implementation | Optimized grouped query attention | 25% boost for GQA models |

### Triton Kernel Benefits for AMD

1. **Platform Portability**
   - Single kernel implementation for both NVIDIA and AMD GPUs
   - Reduced maintenance overhead (239 lines vs thousands for C++/HIP)
   - Easier optimization and debugging

2. **Performance Optimizations**
   - Reduced warp count (8 → 4) eliminating register spilling
   - Vectorized memory loads for better bandwidth utilization
   - Optimized online softmax with fewer intermediate registers
   - Cache-aligned memory access patterns

3. **Unified Attention Kernels**
   - `unified_attention_2d`: Single kernel for all batch types
   - `unified_attention_3d`: Flash-Decoding for long contexts
   - Dynamic kernel selection based on workload characteristics

4. **AMD-Specific Optimizations**
   - XCD (cross-compute die) optimized grid mapping
   - 'cg' cache modifiers for improved memory access
   - Specialized configurations for MI300 series architecture
   - Sliding window attention (SWA) boundary adjustments

## Recommended Images for gfx1151 (RDNA3)

### Primary Recommendations

1. **Production Use**
   ```bash
   docker pull rocm/vllm:rocm7.0.0_vllm_0.10.2_20251006
   ```
   - Latest stable release with V1 support
   - Full RDNA3 optimization
   - 8.59 GB size
   - Triton kernel support

2. **Development/Testing**
   ```bash
   docker pull rocm/vllm-dev:nightly
   ```
   - Latest features and fixes
   - Daily updates
   - 8.76 GB size
   - Experimental features access

3. **RDNA3-Specific Optimized**
   ```bash
   docker pull rocm/vllm-dev:rocm7.0.2_navi_ubuntu22.04_py3.10_pytorch_2.8_vllm_0.10.2rc1
   ```
   - Navi/RDNA3 specific optimizations
   - 14.47 GB size (includes additional tools)
   - PyTorch 2.8 support

### Compatibility Notes for gfx1151

- **Supported ROCm versions**: 6.3.1+, recommended 7.0.0+
- **vLLM versions**: 0.8.0+ for V0, 0.10.0+ for V1
- **Architecture**: RDNA3 (Navi 31)
- **LLVM target**: Compiles to gfx1100 with gfx1101 compatibility

## Size and Performance Tradeoffs

### Image Size Analysis

| Category | Size Range | Contents | Use Case |
|----------|------------|----------|----------|
| **Minimal Base** | 7.3-7.5 GB | Core vLLM, minimal deps | CI/CD, basic inference |
| **Standard** | 7.5-9.0 GB | Full vLLM, common models | Production deployment |
| **Development** | 8.5-9.0 GB | Debug tools, profilers | Development, testing |
| **Specialized** | 13-15 GB | Extra frameworks, tools | Research, experimentation |

### Performance Characteristics

#### V0 vs V1 Performance (MI300X Benchmark)

| Metric | V0 Default | V0 Optimized | V1 Default | Improvement |
|--------|------------|--------------|------------|-------------|
| **Token Throughput** | Baseline | +5% | +15% | 10% over V0 opt |
| **TTFT (seconds)** | Baseline | -5% | -15% | 10% better |
| **ITL (milliseconds)** | Baseline | -3% | -12% | 9% better |

#### Key Performance Factors

1. **Batch Size Impact**
   - V0: max-num-seqs=256 (default)
   - V1: max-num-seqs=1024 (default)
   - Higher batch sizes improve throughput

2. **Chunked Prefill**
   - Disabled by default in V0
   - Enabled by default in V1 (8192 tokens)
   - Significant impact on long sequence handling

3. **Kernel Selection**
   - 2D kernels for high parallelism workloads
   - 3D kernels for long context/low batch scenarios
   - Automatic selection based on heuristics

## Build Instructions

### Building Custom vLLM Docker Image for ROCm

```dockerfile
# Base image selection based on ROCm version
FROM rocm/dev-ubuntu-22.04:7.0.0-complete

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip git \
    rocm-dev hipblas hipfft rocblas rocsparse \
    hipsparse rocthrust rocprim hipcub rocrand \
    rccl rocfft rocsolver

# Install PyTorch for ROCm
RUN pip3 install torch==2.7.0 --index-url https://download.pytorch.org/whl/rocm7.0

# Clone and install vLLM
RUN git clone https://github.com/vllm-project/vllm.git /vllm
WORKDIR /vllm

# Install with ROCm support
ENV ROCM_HOME=/opt/rocm
ENV VLLM_TARGET_DEVICE=rocm
RUN pip3 install -e . --no-build-isolation

# Set environment variables for runtime
ENV VLLM_USE_V1=1
ENV HIP_VISIBLE_DEVICES=0
```

### Environment Variables

```bash
# Enable V1 architecture
export VLLM_USE_V1=1

# Set GPU target for compilation
export PYTORCH_ROCM_ARCH="gfx1100;gfx1101;gfx1151"

# Optimize for specific GPU
export HSA_OVERRIDE_GFX_VERSION=11.0.0

# Memory management
export PYTORCH_HIP_ALLOC_CONF=expandable_segments:True

# Performance tuning
export VLLM_ATTENTION_BACKEND=ROCM_TRITON
```

## Performance Tuning Recommendations

### For gfx1151 (RDNA3) GPUs

1. **Use V1 Architecture**
   - Enable with `VLLM_USE_V1=1`
   - Benefits from Triton optimizations
   - Better mixed batch handling

2. **Optimal Launch Parameters**
   ```bash
   vllm serve model_name \
     --max-num-seqs 1024 \
     --enable-chunked-prefill \
     --max-num-batched-tokens 8192 \
     --gpu-memory-utilization 0.95 \
     --num-gpu-blocks-override <calculated_value>
   ```

3. **Memory Configuration**
   - Use 95% GPU memory utilization for production
   - Enable expandable segments for dynamic allocation
   - Monitor VRAM usage and adjust block size

4. **Kernel Selection**
   - Let auto-heuristics choose 2D vs 3D kernels
   - For long contexts (>8K), 3D kernels may perform better
   - For high batch sizes, 2D kernels are optimal

## Troubleshooting

### Common Issues and Solutions

1. **Register Spilling on RDNA3**
   - Solution: Use ROCm 7.0.0+ with V1 kernels
   - Reduced warp count optimization addresses this

2. **Poor GQA Performance**
   - Solution: Ensure vLLM 0.10.0+ with V1 enabled
   - GQA optimizations provide 25% improvement

3. **Memory Allocation Failures**
   - Set `PYTORCH_HIP_ALLOC_CONF=expandable_segments:True`
   - Reduce `--gpu-memory-utilization` to 0.90

4. **Kernel Compilation Errors**
   - Ensure correct `PYTORCH_ROCM_ARCH` setting
   - Use appropriate ROCm version for GPU architecture

## Future Roadmap

### Expected Developments

1. **vLLM V1 Enhancements**
   - Further Triton kernel optimizations
   - Better automatic kernel selection
   - Improved speculative decoding support

2. **ROCm 7.x Series**
   - Enhanced RDNA4 support
   - Improved Triton compilation
   - Better multi-GPU scaling

3. **Architecture Support**
   - Full CDNA4 optimization (MI350X/355X)
   - RDNA4 consumer GPU support
   - Improved APU integration

## References

- [vLLM Project Repository](https://github.com/vllm-project/vllm)
- [ROCm Docker Hub](https://hub.docker.com/r/rocm/vllm)
- [PyTorch Blog: Enabling vLLM V1 on AMD GPUs](https://pytorch.org/blog/enabling-vllm-v1-on-amd-gpus-with-triton/)
- [AMD ROCm Documentation](https://rocm.docs.amd.com/)
- [vLLM Documentation](https://docs.vllm.ai/)

## Conclusion

For gfx1151 (RDNA3) GPUs, the recommended approach is to use vLLM V1 with ROCm 7.0.0+ using the `rocm/vllm:rocm7.0.0_vllm_0.10.2_20251006` image. This configuration provides:

- 10-15% performance improvement over V0
- Better mixed workload handling
- Reduced maintenance with Triton kernels
- Full feature compatibility
- Active development and support

The V1 architecture with Triton kernels represents a significant advancement in vLLM's AMD GPU support, offering both performance improvements and better maintainability compared to the previous C++/HIP implementations.