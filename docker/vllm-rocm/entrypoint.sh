#!/bin/bash
set -e

echo "=== vLLM ROCm gfx1151 Environment ==="
echo "ROCm Version: ${ROCM_VERSION}"
echo "PyTorch ROCm Arch: ${PYTORCH_ROCM_ARCH}"
echo "HSA Override: ${HSA_OVERRIDE_GFX_VERSION}"
echo "Flash Attention Backend: ${VLLM_ATTENTION_BACKEND}"
echo "====================================="

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat <<EOF
vLLM ROCm gfx1151 Docker Image

Usage:
  docker run [docker-options] vllm-rocm [command] [args...]

Commands:
  serve MODEL_NAME [OPTIONS]     Start vLLM server
  test-gpu                       Test GPU detection
  test-vllm                      Test vLLM with simple model
  benchmark MODEL_NAME           Run performance benchmark
  bash                          Open interactive shell

Examples:
  # Test GPU detection
  docker run --device=/dev/kfd --device=/dev/dri --group-add video vllm-rocm test-gpu

  # Start server with Qwen3-Omni
  docker run --device=/dev/kfd --device=/dev/dri --group-add video \\
    -v /path/to/models:/models \\
    -p 8901:8901 \\
    vllm-rocm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \\
    --dtype bfloat16 \\
    --max-model-len 16384 \\
    --gpu-memory-utilization 0.95

Environment Variables:
  HF_TOKEN                       Hugging Face API token
  PYTORCH_ROCM_ARCH             Target GPU architecture (default: gfx1151)
  HSA_OVERRIDE_GFX_VERSION      HSA override version (default: 11.0.0)
  VLLM_ATTENTION_BACKEND        Attention backend (default: ROCM_TRITON)

Note: This is experimental software for gfx1151. Expect 2.5-6X performance
degradation compared to officially supported architectures.
EOF
    exit 0
fi

case "$1" in
    serve)
        shift
        exec python3 -m vllm.entrypoints.openai.api_server "$@"
        ;;
    test-gpu)
        exec /app/scripts/test-gpu.sh
        ;;
    test-vllm)
        exec /app/scripts/test-vllm.sh
        ;;
    benchmark)
        shift
        exec /app/scripts/benchmark.sh "$@"
        ;;
    bash|shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
