# Qwen3-Omni AMD ROCm Docker Image Implementation Plan

## Executive Summary

**Challenge**: Create a Docker image to run Qwen3-Omni on AMD ROCm with gfx1151 (Strix Halo) support. This is **untested territory** with significant technical challenges.

**Key Findings**:
- gfx1151 has **no official vLLM support** (only gfx1100/1101 documented)
- Qwen3-Omni vLLM branch is **CUDA-focused, unvalidated on ROCm**
- Flash Attention requires **Triton backend** (experimental) for RDNA3
- **Zero community attempts** documented for this specific combination

## Research Findings on Qwen3-Omni ROCm Compatibility

### 1. vLLM qwen3_omni Branch ROCm Support Status

**Critical Finding**: The [wangxiongts/vllm qwen3_omni branch](https://github.com/wangxiongts/vllm/tree/qwen3_omni) **appears to be CUDA-focused** with limited explicit ROCm support validation.

**Evidence**:
- The qwen3_omni branch is a fork from the main vLLM project with Qwen3-Omni specific model implementations
- According to the [vLLM official installation documentation](https://docs.vllm.ai/en/latest/getting_started/installation.html), vLLM **does support ROCm** on the main branch with the following specifications:
  - **Supported GPUs**: MI200s (gfx90a), MI300 (gfx942), MI350 (gfx950), Radeon RX 7900 series (gfx1100/1101), Radeon RX 9000 series (gfx1200/1201)
  - **⚠️ Critical Gap**: **gfx1151 is NOT listed** in the officially supported architectures
  - Requires ROCm 6.3 or above
  - Requires torch 2.8.0 and above

**Key Issue**: While the main vLLM branch has ROCm support infrastructure, the qwen3_omni branch modifications have not been explicitly tested or validated for ROCm environments.

### 2. Flash Attention Requirements: ROCm vs CUDA

**Flash Attention Architecture Support**:

According to the [ROCm Flash Attention repository](https://github.com/ROCm/flash-attention):

**Composable Kernel (CK) Backend** (Default):
- Requires ROCm 6.0+
- Supported GPUs: **MI200 or MI300 only**
- Datatypes: fp16 and bf16
- Supports head dimensions up to 256

**Triton Backend** (Alternative):
- Supports CDNA (MI200, MI300) and **RDNA GPUs**
- Datatypes: fp16, bf16, fp32
- More flexible but still in development
- To enable: `FLASH_ATTENTION_TRITON_AMD_ENABLE="TRUE"`

**⚠️ Critical Gap for gfx1151**: 
- gfx1151 is **RDNA3 architecture** (Radeon RX 7000 series)
- The Composable Kernel backend **does NOT support** RDNA3
- Must use **Triton backend** for any Flash Attention support
- Triton backend is **experimental** and may have performance/stability issues

### 3. ROCm-Specific Patches or Forks

**Findings**:
- **No dedicated ROCm fork** of the qwen3_omni branch was found
- The main vLLM project has ROCm support through:
  - [PR #27603: Update ROCm installation docs for ROCm 7.0](https://github.com/vllm-project/vllm/pull/27603)
  - [PR #26980: Reorganize ROCm Backend Selection Logic](https://github.com/vllm-project/vllm/pull/26980)
  - [PR #27776: Upstream VIT FA RDNA3 ROCM](https://github.com/vllm-project/vllm/pull/27776)

**Action Required**: You would need to manually merge/adapt the qwen3_omni model implementation into a ROCm-compatible vLLM version.

### 4. Audio Processing Library Compatibility

According to the [setup.py from the qwen3_omni branch](https://github.com/wangxiongts/vllm/blob/qwen3_omni/setup.py), audio dependencies are:

```python
extras_require={
    "audio": ["librosa", "soundfile"],
}
```

**Compatibility Analysis**:
- **librosa**: Pure Python library with numpy/scipy dependencies - **ROCm compatible** ✅
- **soundfile**: Python wrapper for libsndfile C library - **ROCm compatible** ✅
- **av (PyAV)**: FFmpeg wrapper - **ROCm compatible** ✅

**Conclusion**: All audio processing libraries are platform-agnostic Python packages that don't directly interact with GPU backends. They should work identically on ROCm and CUDA systems.

### 5. qwen-omni-utils CUDA Dependencies

**Research Result**: 
- No evidence of a separate "qwen-omni-utils" package was found in the repository
- The Qwen3-Omni implementation in the qwen3_omni branch integrates audio processing directly through vLLM's multimodal framework
- The vLLM ROCm requirements file shows: According to [requirements/rocm.txt](https://github.com/wangxiongts/vllm/blob/qwen3_omni/requirements/rocm.txt), there are **no CUDA-specific dependencies that would conflict** with ROCm

**Dependencies listed**:
```
numba == 0.61.2
boto3, botocore, datasets
ray>=2.10.0,<2.45.0
peft, pytest-asyncio
tensorizer>=2.9.0
packaging>=24.2
setuptools>=77.0.3,<80.0.0
```

All of these are **CUDA/ROCm agnostic**.

### 6. AOTriton Support for Qwen3-Omni

**AOTriton Status**:
- AOTriton is AMD's ahead-of-time Triton compiler for ROCm
- According to [GitHub issue #1925](https://github.com/ROCm/TheRock/issues/1925), AOTriton development is focused on enabling:
  - gfx101X (RDNA2)
  - gfx103X (RDNA3)
  - gfx1103 (specific RDNA3 variant)

**⚠️ Critical Finding**: 
- **gfx1151 support in AOTriton is unclear** and not explicitly documented
- The [ComfyUI issue #10460](https://github.com/comfyanonymous/ComfyUI/issues/10460) discusses RDNA3 performance fixes, suggesting RDNA3 (including gfx1151) support is **evolving but problematic**

**Qwen3-Omni Specific Needs**:
- Qwen3-Omni relies heavily on Flash Attention
- If using Triton backend for Flash Attention on RDNA3, AOTriton support becomes critical
- Current status suggests **experimental/incomplete support** for gfx1151

### 7. Community Attempts to Run Qwen3-Omni on AMD GPUs

**Recent Issues Found**:

1. **[vLLM Issue #27907](https://github.com/vllm-project/vllm/issues/27907)**: "qwen3-omni Crashed when processing with audio"
   - User experiencing crashes with audio input
   - No mention of ROCm, but indicates audio processing issues exist even on CUDA

2. **[vLLM Issue #27906](https://github.com/vllm-project/vllm/issues/27906)**: "Qwen3-Omni Thinker audio input failing"
   - Audio inference problems reported
   - [PR #27920](https://github.com/vllm-project/vllm/pull/27920) was created to fix these audio issues

3. **[ModelScope Swift Issue #6349](https://github.com/modelscope/ms-swift/issues/6300)**: Qwen-2.5-omni tuning discussions

**⚠️ No Evidence Found**: **Zero documented community attempts** to run Qwen3-Omni specifically on AMD ROCm GPUs were discovered. This suggests:
- The Qwen3-Omni + ROCm combination is **untested territory**
- You may be among the first to attempt this configuration

## Critical Compatibility Matrix

| Component | CUDA Support | ROCm gfx1151 Support | Status | Notes |
|-----------|--------------|----------------------|--------|-------|
| **vLLM qwen3_omni branch** | ✅ Yes | ❌ Unvalidated | **BLOCKER** | Branch not tested on ROCm |
| **Flash Attention CK Backend** | ✅ Yes | ❌ No | **BLOCKER** | Only MI200/MI300 |
| **Flash Attention Triton** | ✅ Yes | ⚠️ Experimental | **RISKY** | RDNA3 support incomplete |
| **Audio libs (librosa, soundfile)** | ✅ Yes | ✅ Yes | **OK** | Platform agnostic |
| **PyTorch 2.8+** | ✅ Yes | ✅ Yes | **OK** | ROCm wheels available |
| **AOTriton** | N/A | ⚠️ Unclear | **UNKNOWN** | gfx1151 support undocumented |
| **vLLM ROCm Base** | ✅ Yes | ⚠️ Partial | **RISKY** | gfx1100/1101 supported, not 1151 |

## Implementation Strategy

### Phase 1: Foundation & Validation (High Priority)

**Objective**: Establish baseline ROCm + vLLM functionality before attempting Qwen3-Omni integration

#### 1.1 Base Image Selection
```dockerfile
# Option A: Start with ROCm 6.4.4 (proven stable for gfx1151)
FROM rocm/dev-ubuntu-22.04:6.4.4-complete

# Option B: Use community toolbox as reference
# Reference: kyuz0/vllm-therock-gfx1151-aotriton:latest
```

**Rationale**: ROCm 6.4.4 has formal gfx1151 support; ROCm 7.0.1 has known regressions

#### 1.2 Critical Environment Variables
```bash
# gfx1151 specific configuration
export PYTORCH_ROCM_ARCH="gfx1151"
export HSA_OVERRIDE_GFX_VERSION=11.0.0  # Fallback to gfx1100 kernels
export TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1
export ROCBLAS_USE_HIPBLASLT=1
export HIPBLASLT_TENSILE_LIBPATH=/opt/rocm/lib/hipblaslt/library

# Flash Attention Triton backend (required for RDNA3)
export FLASH_ATTENTION_TRITON_AMD_ENABLE=TRUE
export FLASH_ATTENTION_TRITON_AMD_AUTOTUNE=TRUE

# vLLM configuration
export VLLM_USE_V1=1  # Use V1 architecture for better RDNA3 support
export VLLM_ATTENTION_BACKEND=ROCM_TRITON
```

#### 1.3 Memory Configuration
```bash
# Kernel boot parameters (document for users)
amd_iommu=off amdgpu.gttsize=131072 ttm.pages_limit=33554432

# Runtime configuration
--gpu-memory-utilization 0.95
--max-model-len 32768  # Limit due to VRAM constraints
```

### Phase 2: Build Strategy (Multi-Stage Docker)

#### 2.1 Stage 1: ROCm Dependencies
```dockerfile
FROM rocm/dev-ubuntu-22.04:6.4.4-complete AS rocm-base

# System dependencies
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip git wget \
    rocm-dev hipblas hipfft rocblas rocsparse \
    hipsparse rocthrust rocprim hipcub rocrand \
    rccl rocfft rocsolver hipblaslt \
    ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# PyTorch for ROCm 6.4.4
RUN pip3 install --no-cache-dir \
    torch==2.8.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/rocm6.2
```

#### 2.2 Stage 2: Flash Attention (Triton Backend)
```dockerfile
FROM rocm-base AS flash-attention-builder

# AOTriton (experimental gfx1151 support)
RUN git clone https://github.com/ROCm/aotriton.git /opt/aotriton
WORKDIR /opt/aotriton
RUN pip3 install -e . --no-build-isolation

# Flash Attention with Triton backend
RUN git clone https://github.com/ROCm/flash-attention.git /opt/flash-attention
WORKDIR /opt/flash-attention
RUN git checkout main_perf

ENV FLASH_ATTENTION_TRITON_AMD_ENABLE=TRUE
ENV FLASH_ATTENTION_TRITON_AMD_AUTOTUNE=TRUE
RUN python3 setup.py install
```

#### 2.3 Stage 3: vLLM Base (ROCm-Compatible)
```dockerfile
FROM flash-attention-builder AS vllm-builder

# Install official vLLM with ROCm support (main branch)
RUN git clone https://github.com/vllm-project/vllm.git /opt/vllm
WORKDIR /opt/vllm
RUN git checkout main  # Use main branch, NOT qwen3_omni branch initially

ENV ROCM_HOME=/opt/rocm
ENV VLLM_TARGET_DEVICE=rocm
RUN pip3 install -r requirements/rocm.txt
RUN pip3 install -e . --no-build-isolation
```

#### 2.4 Stage 4: Qwen3-Omni Model Integration
```dockerfile
FROM vllm-builder AS qwen3-omni-integration

# Manually port Qwen3-Omni model files from qwen3_omni branch
# This is the critical custom work required
RUN mkdir -p /opt/qwen3-omni-models
WORKDIR /opt/qwen3-omni-models

# Download specific model files from wangxiongts/vllm qwen3_omni branch
RUN git clone --depth 1 -b qwen3_omni \
    https://github.com/wangxiongts/vllm.git /tmp/qwen3-vllm

# Copy Qwen3-Omni model implementations
RUN cp -r /tmp/qwen3-vllm/vllm/model_executor/models/*qwen*omni* \
    /opt/vllm/vllm/model_executor/models/

# Copy audio processing utilities
RUN cp -r /tmp/qwen3-vllm/vllm/attention/* /opt/vllm/vllm/attention/ 2>/dev/null || true
RUN cp -r /tmp/qwen3-vllm/vllm/multimodal/* /opt/vllm/vllm/multimodal/ 2>/dev/null || true
```

#### 2.5 Stage 5: Audio Dependencies
```dockerfile
FROM qwen3-omni-integration AS final

# Audio processing libraries (platform-agnostic)
RUN pip3 install --no-cache-dir \
    librosa==0.10.1 \
    soundfile==0.12.1 \
    av==12.0.0 \
    transformers>=4.45.0 \
    accelerate \
    gradio==5.44.1

# Hugging Face integration
RUN pip3 install --no-cache-dir huggingface-hub

# Environment setup
ENV HF_HOME=/models
ENV TRANSFORMERS_CACHE=/models
ENV HUGGINGFACE_HUB_CACHE=/models

# Work directory
WORKDIR /app
RUN chown -R 2000:2000 /app /models

# Create entrypoint script
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

EXPOSE 8901
USER 2000

ENTRYPOINT ["/app/entrypoint.sh"]
```

### Phase 3: Fallback Strategies

#### 3.1 If vLLM Integration Fails
```dockerfile
# Alternative: Use llama.cpp with Vulkan backend
FROM rocm-base AS llamacpp-fallback

RUN git clone https://github.com/ggerganov/llama.cpp.git /opt/llama.cpp
WORKDIR /opt/llama.cpp

# Build with Vulkan support (better RDNA3 performance)
RUN apt-get update && apt-get install -y \
    vulkan-tools libvulkan-dev vulkan-validationlayers
    
RUN cmake -B build -DGGML_VULKAN=ON -DGGML_ROCM=ON
RUN cmake --build build --config Release -j$(nproc)
```

#### 3.2 If gfx1151 Proves Incompatible
```bash
# Document workaround: Override to gfx1100
export HSA_OVERRIDE_GFX_VERSION=11.0.0
export PYTORCH_ROCM_ARCH="gfx1100"
```

**Risk**: 2.5-6X performance degradation documented for gfx1151 kernels

### Phase 4: Testing & Validation Plan

#### 4.1 Stage 1: ROCm Validation
```bash
# Test GPU detection
rocm-smi
rocminfo | grep gfx

# Test PyTorch ROCm
python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

#### 4.2 Stage 2: vLLM Basic Functionality
```bash
# Test with simple model (non-Qwen3-Omni)
vllm serve meta-llama/Llama-2-7b-chat-hf \
    --dtype float16 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.8
```

#### 4.3 Stage 3: Qwen3-Omni Text-Only
```bash
# Test without audio/multimodal
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --dtype bfloat16 \
    --max-model-len 16384 \
    --max-num-seqs 2 \
    --gpu-memory-utilization 0.95
```

#### 4.4 Stage 4: Full Multimodal
```bash
# Test with audio input
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --dtype bfloat16 \
    --max-model-len 16384 \
    --allowed-local-media-path / \
    --limit-mm-per-prompt '{"audio": 1, "image": 1}'
```

### Phase 5: Known Issues & Mitigations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| gfx1151 not officially supported | May not work at all | Use HSA_OVERRIDE to gfx1100 |
| Performance regression | 2.5-6X slower | Document expectations, consider hardware upgrade |
| Flash Attention Triton experimental | Crashes possible | Provide fallback with `--enforce-eager` |
| Audio processing untested on ROCm | Unknown stability | Extensive testing phase required |
| VRAM limitations (likely 8-16GB) | Cannot run full 30B model | Require quantization or model sharding |

### Phase 6: Alternative Approach (Hybrid Strategy)

**If full integration proves impossible:**

1. **Separate inference pipeline**:
   - Run text inference on AMD GPU with vLLM
   - Offload audio processing to CPU with librosa/soundfile
   - Use model variants without MoE (simpler architecture)

2. **Use existing community toolbox**:
   - Start with `kyuz0/vllm-therock-gfx1151-aotriton:latest`
   - Attempt to add Qwen3-Omni model files on top
   - Reference: https://github.com/kyuz0/amd-strix-halo-vllm-toolboxes

3. **Wait for official support**:
   - Monitor vLLM issue #25634
   - Track ROCm 6.5+ releases for gfx1151 improvements

## Critical Success Factors

✅ **Must Have**:
1. ROCm 6.4.4 installed on host system
2. Kernel parameters configured for unified memory
3. At least 16GB VRAM allocated to GPU
4. 64GB+ system RAM for model loading

⚠️ **Nice to Have**:
1. Actual gfx1151 hardware for testing (Ryzen AI Max+ 395)
2. Experience with ROCm debugging
3. Ability to compile from source
4. Patience for experimental setup

❌ **Blockers**:
1. Incompatible hardware revision
2. ROCm installation issues
3. Python environment conflicts
4. Insufficient memory

## Deliverables

### 1. Docker Image Structure
```
docker/qwen3-omni-rocm/
├── Dockerfile                  # Multi-stage build
├── Dockerfile.fallback         # llama.cpp alternative
├── docker-compose.yml          # Production deployment
├── entrypoint.sh              # Flexible launch script
├── requirements-rocm.txt      # Python dependencies
├── patches/                   # Custom patches directory
│   ├── qwen3-omni-models/     # Ported model files
│   └── vllm-rocm-fixes/       # Any custom fixes
├── scripts/
│   ├── test-gpu.sh           # GPU validation
│   ├── test-vllm.sh          # vLLM testing
│   └── benchmark.sh          # Performance tests
└── README.md                  # Comprehensive documentation
```

### 2. Documentation Files
- Installation guide with prerequisites
- Troubleshooting guide for common gfx1151 issues
- Performance benchmarking results
- Known limitations and workarounds
- Migration guide from CUDA version

### 3. Configuration Files
- Example docker-compose.yml for various scenarios
- Environment variable templates
- Kernel parameter recommendations
- GRUB configuration examples

## Timeline & Risk Assessment

**Estimated Effort**: 40-80 hours
- Research & setup: 8-16 hours
- Docker image development: 16-32 hours  
- Testing & debugging: 16-32 hours

**Risk Level**: **HIGH**

**Probability of Success**:
- Basic ROCm vLLM: 80%
- Qwen3-Omni text-only: 50%
- Full multimodal with audio: 20%

**Recommendation**: Implement in phases with clear go/no-go decision points after each stage.

## Immediate Next Steps

### Technical Clarification Required
1. **Verify GPU Architecture**:
   - Confirm exact GPU model
   - Run `rocminfo | grep gfx` to identify actual architecture
   - Check if gfx1151 designation is correct

2. **Assess Hardware Constraints**:
   - Determine available VRAM
   - Confirm system RAM availability
   - Verify ROCm installation status

3. **Define Success Criteria**:
   - Text-only inference acceptable?
   - Audio processing required?
   - Acceptable performance thresholds?

### Recommended First Action
```bash
# Validate ROCm environment
docker run --rm \
    --device=/dev/kfd \
    --device=/dev/dri \
    --group-add video \
    rocm/vllm-dev:nightly \
    bash -c "rocminfo | grep gfx && python3 -c 'import torch; print(torch.cuda.is_available())'"
```

If this succeeds, proceed with Phase 1 implementation. If it fails, address ROCm installation issues first.

## Sources and References

### Research Sources
- [vLLM Official Documentation - ROCm Installation](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/index.html)
- [vLLM Main Repository](https://github.com/vllm-project/vllm)
- [wangxiongts/vllm qwen3_omni branch](https://github.com/wangxiongts/vllm/tree/qwen3_omni)
- [ROCm Flash Attention Repository](https://github.com/ROCm/flash-attention)
- [vLLM Issue #27907 - Qwen3-Omni Audio Crashes](https://github.com/vllm-project/vllm/issues/27907)
- [vLLM Issue #27906 - Qwen3-Omni Thinker Audio Failures](https://github.com/vllm-project/vllm/issues/27906)
- [vLLM PR #27920 - Fix Qwen Omni Audio Inference](https://github.com/vllm-project/vllm/pull/27920)
- [vLLM PR #27603 - Update ROCm 7.0 Installation Docs](https://github.com/vllm-project/vllm/pull/27603)
- [vLLM PR #27776 - VIT FA RDNA3 ROCm Support](https://github.com/vllm-project/vllm/pull/27776)
- [ROCm TheRock Issue #1925 - AOTriton RDNA3 Enablement](https://github.com/ROCm/TheRock/issues/1925)
- [ComfyUI Issue #10460 - AMD RDNA3 Performance Fix](https://github.com/comfyanonymous/ComfyUI/issues/10460)
- [Dao-AILab Flash Attention (Original)](https://github.com/Dao-AILab/flash-attention)

### Community Resources
- [Strix Halo vLLM Toolboxes](https://github.com/kyuz0/amd-strix-halo-vllm-toolboxes)
- [Strix Halo Testing Repository](https://github.com/lhl/strix-halo-testing)
- [LLM Tracker - Strix Halo Benchmarks](https://llm-tracker.info/_TOORG/Strix-Halo)
- [Framework Community Discussion](https://community.frame.work/t/amd-strix-halo-ryzen-ai-max-395-gpu-llm-performance-tests/72521)
- [Level1Techs Forum](https://forum.level1techs.com/t/strix-halo-ryzen-ai-max-395-llm-benchmark-results/233796)

### Official Documentation
- [Qwen3-Omni GitHub Repository](https://github.com/QwenLM/Qwen3-Omni)
- [Qwen3-Omni Technical Paper](https://arxiv.org/pdf/2509.17765)
- [ROCm Documentation](https://rocm.docs.amd.com/)
- [AMD Instinct Documentation](https://instinct.docs.amd.com/)

## Conclusion

Running Qwen3-Omni on gfx1151 (AMD Strix Halo) represents a significant technical challenge with no prior community success stories. The implementation requires:

1. Manual integration of Qwen3-Omni model code into ROCm-compatible vLLM
2. Experimental Flash Attention Triton backend for RDNA3
3. Potential performance sacrifices (2.5-6X degradation possible)
4. Extensive testing and debugging

**Final Assessment**: This is **technically possible but HIGHLY EXPERIMENTAL**. Success depends on:
- Correct hardware identification (verify gfx1151 is accurate)
- Adequate VRAM allocation (16GB+ minimum)
- Patience for trial-and-error debugging
- Willingness to accept reduced performance compared to CUDA

Consider using NVIDIA hardware or AMD MI300X for production deployments if reliability and performance are critical.
