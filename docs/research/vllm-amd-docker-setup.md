# vLLM Docker Deployment with AMD ROCm

## Overview

vLLM is an open-source library designed for high-performance large language model (LLM) inference and serving. It leverages advanced optimization techniques including PagedAttention for efficient memory management and continuous batching for maximizing throughput. This guide provides comprehensive instructions for deploying vLLM using Docker containers on AMD GPUs with ROCm support.

### Key Features
- **PagedAttention**: Manages attention mechanism as virtual memory, optimizing GPU memory utilization
- **Continuous Batching**: Dynamically groups incoming requests to minimize latency
- **AMD GPU Support**: Full compatibility with AMD Instinct and Radeon GPUs via ROCm
- **OpenAI-Compatible API**: Drop-in replacement for OpenAI API endpoints
- **Docker Deployment**: Containerized deployment for consistency and portability

## System Requirements

### Minimum Requirements
- **Operating System**: Linux (see [supported distributions](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/reference/system-requirements.html#supported-operating-systems))
- **ROCm Version**: 6.2 or later (7.0.0 recommended)
- **Python**: 3.9 – 3.12
- **Docker**: Engine 20.10+ with buildx support
- **GPU Architecture Support**:
  - MI200s (gfx90a)
  - MI300 series (gfx942) - Including MI300X, MI325X, MI350X, MI355X
  - Radeon RX 7900 series (gfx1100) - RDNA 3.5
  - Other [ROCm-supported GPUs](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/reference/system-requirements.html#supported-gpus)

### Software Stack Versions
The latest ROCm vLLM Docker image (`rocm/vllm:rocm7.0.0_vllm_0.10.2_20251006`) includes:
- ROCm: 7.0.0
- vLLM: 0.10.2 (0.11.0rc2.dev160+g790d22168.rocm700)
- PyTorch: 2.9.0a0+git1c57644
- hipBLASLt: 1.0.0

## Docker Setup Instructions

### Option 1: Using Official vLLM Docker Images

AMD provides two main vLLM container options:

#### Production Container (`rocm/vllm`)
```bash
# Pull specific version for stability
docker pull rocm/vllm:rocm6.3.1_mi300_ubuntu22.04_py3.12_vllm_0.6.6

# Run with GPU access
docker run -it \
    --device=/dev/kfd \
    --device=/dev/dri \
    --group-add video \
    --shm-size 16G \
    --security-opt seccomp=unconfined \
    --security-opt apparmor=unconfined \
    --cap-add=SYS_PTRACE \
    -v $(pwd):/workspace \
    rocm/vllm:rocm6.3.1_mi300_ubuntu22.04_py3.12_vllm_0.6.6
```

#### Development Container (`rocm/vllm-dev`)
```bash
# Pull latest development version
docker pull rocm/vllm-dev:main

# Or nightly build
docker pull rocm/vllm-dev:nightly
```

### Option 2: Building Custom vLLM Docker Image

#### Basic Dockerfile for vLLM with ROCm

```dockerfile
FROM rocm/vllm-dev:main

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
    transformers \
    accelerate \
    safetensors

# Create non-root user for security
RUN useradd -m -u 2000 vllm
WORKDIR /app
RUN chown vllm:vllm /app

# Create directories for models and benchmarks
RUN mkdir -p /data/models /data/benchmarks && \
    chmod 777 /data/benchmarks

USER vllm

# Set entrypoint for flexibility
COPY --chown=vllm:vllm entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
```

#### Flexible Entrypoint Script

```bash
#!/bin/bash

# Base configuration with defaults
MODE=${MODE:-"serve"}
MODEL=${MODEL:-"amd/Llama-3.2-1B-FP8-KV"}
PORT=${PORT:-8000}

# Benchmark configuration
INPUT_LEN=${INPUT_LEN:-512}
OUTPUT_LEN=${OUTPUT_LEN:-256}
NUM_PROMPTS=${NUM_PROMPTS:-1000}
MAX_BATCH_TOKENS=${MAX_BATCH_TOKENS:-8192}

# Additional vLLM arguments
EXTRA_ARGS=${EXTRA_ARGS:-""}

case $MODE in
  "serve")
    echo "Starting vLLM server on port $PORT with model: $MODEL"
    python3 -m vllm.entrypoints.openai.api_server \
      --model $MODEL \
      --port $PORT \
      $EXTRA_ARGS
    ;;
    
  "benchmark")
    echo "Running vLLM benchmarks with model: $MODEL"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BENCHMARK_DIR="/data/benchmarks/$TIMESTAMP"
    mkdir -p "$BENCHMARK_DIR"
    
    # Throughput benchmark
    python3 /app/vllm/benchmarks/benchmark_throughput.py \
      --model $MODEL \
      --input-len $INPUT_LEN \
      --output-len $OUTPUT_LEN \
      --num-prompts $NUM_PROMPTS \
      --max-num-batched-tokens $MAX_BATCH_TOKENS \
      --output-json "$BENCHMARK_DIR/throughput.json" \
      $EXTRA_ARGS
      
    # Latency benchmark
    python3 /app/vllm/benchmarks/benchmark_latency.py \
      --model $MODEL \
      --input-len $INPUT_LEN \
      --output-len $OUTPUT_LEN \
      --output-json "$BENCHMARK_DIR/latency.json" \
      $EXTRA_ARGS
      
    echo "Results saved to $BENCHMARK_DIR"
    ;;
    
  *)
    echo "Unknown mode: $MODE"
    echo "Please use 'serve' or 'benchmark'"
    exit 1
    ;;
esac
```

### Option 3: Building from Source with Docker

#### For MI200/MI300 Series
```bash
# Using Docker buildkit for efficient builds
DOCKER_BUILDKIT=1 docker build \
    -f Dockerfile.rocm \
    -t vllm-rocm .
```

#### For Radeon RX 7900 Series (gfx1100)
```bash
# Disable flash-attention for RDNA 3.5
DOCKER_BUILDKIT=1 docker build \
    --build-arg BUILD_FA="0" \
    -f Dockerfile.rocm \
    -t vllm-rocm-rx7900 .
```

#### For ARM64/aarch64 Systems (e.g., NVIDIA Grace-Hopper)
```bash
# Ensure QEMU is set up for cross-compilation
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Build for ARM64
python3 use_existing_torch.py
DOCKER_BUILDKIT=1 docker build . \
    --file docker/Dockerfile \
    --target vllm-openai \
    --platform "linux/arm64" \
    -t vllm/vllm-arm64:latest \
    --build-arg max_jobs=66 \
    --build-arg nvcc_threads=2 \
    --build-arg torch_cuda_arch_list="9.0 10.0+PTX"
```

## ROCm Configuration

### Environment Variables
Key environment variables for ROCm optimization:

```bash
# Enable Triton flash attention (default)
export VLLM_USE_TRITON_FLASH_ATTN=1

# For Mixture of Experts models (e.g., Mixtral)
export VLLM_ROCM_USE_AITER=1

# Disable Triton for CK flash-attention or PyTorch naive attention
export VLLM_USE_TRITON_FLASH_ATTN=0

# Set GPU architecture
export PYTORCH_ROCM_ARCH="gfx90a;gfx942"

# For debugging
export VLLM_LOGGING_LEVEL=DEBUG
```

### Flash Attention Configuration

#### CK Flash Attention (Optional)
```bash
git clone https://github.com/ROCm/flash-attention.git
cd flash-attention
git checkout 3cea2fb
git submodule update --init
GPU_ARCHS="gfx90a" python3 setup.py install
```

#### Triton Flash Attention (Default)
```bash
python3 -m pip install ninja cmake wheel pybind11
git clone https://github.com/OpenAI/triton.git
cd triton
git checkout e192dba
cd python
pip3 install .
```

## Container Security and GPU Access

### Running as Non-Root User
```bash
# Create a Docker run alias for ROCm containers
alias rdr='docker run -it --rm \
    --device=/dev/kfd --device=/dev/dri \
    --group-add=$(getent group video | cut -d: -f3) \
    --group-add=$(getent group render | cut -d: -f3) \
    --ipc=host \
    --security-opt seccomp=unconfined'

# Use the alias for cleaner commands
rdr -v /path/to/models:/home/vllm/.cache/huggingface \
    -e MODE="serve" \
    -e MODEL="your-model" \
    -p 8000:8000 \
    vllm-toolkit
```

### Security Best Practices
- Run containers as non-root users
- Use group permissions for GPU access
- Mount only necessary volumes
- Avoid exposing sensitive environment variables
- Use secrets management for API tokens

## Inference Deployment

### Starting the vLLM Server
```bash
# Basic server launch
docker run -it \
    --device=/dev/kfd \
    --device=/dev/dri \
    --group-add video \
    --shm-size 16G \
    -v /data/models:/app/models \
    -p 8000:8000 \
    rocm/vllm:latest \
    vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --dtype auto \
    --kv-cache-dtype auto \
    --max-num-seqs 256 \
    --gpu-memory-utilization 0.9
```

### Multi-GPU Serving (Tensor Parallelism)
```bash
# For large models across multiple GPUs
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --distributed-executor-backend mp \
    --max-model-len 8192 \
    --max-num-batched-tokens 131072 \
    --gpu-memory-utilization 0.9
```

### OpenAI-Compatible API Client
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="dummy"  # vLLM doesn't require authentication
)

completion = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing"}
    ],
    temperature=0.8,
    max_tokens=256
)

print(completion.choices[0].message.content)
```

## Performance Benchmarking

### Throughput Benchmark
```bash
docker exec -it vllm-container bash

vllm bench throughput \
    --model meta-llama/Llama-3.1-8B-Instruct \
    -tp 1 \
    --num-prompts 1024 \
    --input-len 128 \
    --output-len 128 \
    --dtype auto \
    --kv-cache-dtype auto \
    --max-num-seqs 1024 \
    --max-num-batched-tokens 131072 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.9 \
    --output-json throughput_results.json
```

### Serving Benchmark
```bash
# Start server first
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    -tp 1 \
    --dtype auto \
    --max-num-seqs 256 \
    --gpu-memory-utilization 0.9

# In another terminal, run benchmark
vllm bench serve \
    --model meta-llama/Llama-3.1-8B-Instruct \
    --percentile-metrics "ttft,tpot,itl,e2el" \
    --dataset-name random \
    --max-concurrency 8 \
    --num-prompts 100 \
    --random-input-len 128 \
    --random-output-len 128 \
    --save-result \
    --result-filename serving_results.json
```

### Using MAD (Model Automation and Dashboarding)
```bash
# Clone MAD repository
git clone https://github.com/ROCm/MAD
cd MAD
pip install -r requirements.txt

# Run comprehensive benchmarks
export MAD_SECRETS_HFTOKEN="your-huggingface-token"
madengine run \
    --tags pyt_vllm_llama-3.1-8b \
    --keep-model-dir \
    --live-output
```

## GPU Architecture Compatibility

### MI300X Series Optimizations
```bash
# Environment settings for MI300X
export PYTORCH_ROCM_ARCH="gfx942"
export VLLM_USE_TRITON_FLASH_ATTN=1

# Performance tuning
--max-num-batched-tokens 131072
--gpu-memory-utilization 0.95
```

### RDNA 3.5 (RX 7900 Series) Considerations
```bash
# Build without flash-attention
docker build --build-arg BUILD_FA="0" -f Dockerfile.rocm -t vllm-rdna3

# Use PyTorch naive attention
export VLLM_USE_TRITON_FLASH_ATTN=0
```

### APU Support Limitations
- Limited VRAM may restrict model sizes
- Shared memory architecture considerations
- May require reduced batch sizes and sequence lengths

## Model Quantization Support

### FP8 Quantization (AMD Quark)
```bash
# Using FP8 quantized models
vllm serve amd/Llama-3.1-8B-Instruct-FP8-KV \
    --dtype auto \
    --kv-cache-dtype fp8 \
    --gpu-memory-utilization 0.9
```

### MXFP4 Support (MI355X/MI350X Only)
```bash
# For 4-bit quantized models on supported hardware
vllm serve amd/Llama-3.3-70B-Instruct-MXFP4-Preview \
    --dtype auto \
    --kv-cache-dtype fp8 \
    --tensor-parallel-size 8
```

## Troubleshooting

### Common Issues and Solutions

#### Out of Memory Errors
```bash
# Reduce memory utilization
--gpu-memory-utilization 0.8

# Reduce batch size
--max-num-batched-tokens 4096

# Reduce model context length
--max-model-len 4096
```

#### Slow Performance
```bash
# Enable MoE optimizations
export VLLM_ROCM_USE_AITER=1

# Increase batch tokens
--max-num-batched-tokens 131072

# Use multiprocessing backend
--distributed-executor-backend mp
```

#### Authentication Errors
```bash
# For gated models on Hugging Face
export HF_TOKEN="your-huggingface-token"
```

#### Docker Permission Issues
```bash
# Ensure proper group permissions
sudo usermod -aG video $USER
sudo usermod -aG render $USER
# Log out and back in for changes to take effect
```

### Performance Validation
```bash
# Check ROCm installation
rocm-smi

# Verify GPU detection in container
docker run --rm --device=/dev/kfd --device=/dev/dri rocm/vllm:latest rocm-smi

# Test basic inference
docker run --rm \
    --device=/dev/kfd \
    --device=/dev/dri \
    --group-add video \
    rocm/vllm:latest \
    python -c "from vllm import LLM; print('vLLM loaded successfully')"
```

## Advanced Configuration

### Custom Engine Arguments
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    tensor_parallel_size=1,
    max_num_seqs=256,
    max_num_batched_tokens=131072,
    max_model_len=8192,
    gpu_memory_utilization=0.9,
    enforce_eager=False,  # Enable CUDA graphs
    enable_prefix_caching=True,  # Cache common prefixes
    enable_chunked_prefill=True,  # Process prefills in chunks
    max_num_batched_tokens=131072,
    trust_remote_code=True
)
```

### Production Deployment Checklist
- [ ] System validation and NUMA configuration
- [ ] ROCm and driver version compatibility
- [ ] Container security hardening
- [ ] Model quantization for efficiency
- [ ] Monitoring and logging setup
- [ ] Load balancing for multi-instance deployment
- [ ] Backup and recovery procedures
- [ ] API rate limiting and authentication

## Resources and References

### Official Documentation
- [vLLM Documentation](https://docs.vllm.ai/)
- [ROCm Documentation](https://rocm.docs.amd.com/)
- [AMD Instinct Documentation](https://instinct.docs.amd.com/)

### Docker Images
- [Official vLLM Docker Hub](https://hub.docker.com/r/vllm/vllm-openai)
- [ROCm vLLM Docker Hub](https://hub.docker.com/r/rocm/vllm)
- [AMD Infinity Hub](https://www.amd.com/en/developer/resources/infinity-hub.html)

### Benchmarking and Optimization
- [ROCm MAD Repository](https://github.com/ROCm/MAD)
- [vLLM Benchmarking Guide](https://github.com/vllm-project/vllm/blob/main/benchmarks/README.md)
- [AMD MI300X Performance Guides](https://rocm.docs.amd.com/en/latest/how-to/tuning-guides/mi300x/index.html)

### Community Resources
- [vLLM GitHub Repository](https://github.com/vllm-project/vllm)
- [ROCm GitHub](https://github.com/ROCm)
- [AMD Community Forums](https://community.amd.com/)

## License and Disclaimers

This documentation references third-party software and models that may be subject to their own licenses. Always review and comply with applicable license terms, especially for commercial use. Some models may require acceptance of external license agreements through third parties.