# vLLM ROCm for AMD Strix Halo (gfx1151)

vLLM inference engine built from source for AMD Strix Halo GPUs using ROCm nightlies.

## Build

```bash
docker build -t vllm-rocm:latest .
```

## Run

Using docker-compose:
```bash
HF_HOME=/path/to/models docker-compose up
```

Using docker directly:
```bash
docker run --rm -it \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/workspace/models \
  --device=/dev/kfd \
  --device=/dev/dri \
  --ipc=host \
  --security-opt seccomp=unconfined \
  --cap-add SYS_PTRACE \
  --ulimit memlock=-1:-1 \
  --ulimit stack=67108864:67108864 \
  --group-add video \
  --group-add render \
  -e HSA_OVERRIDE_GFX_VERSION=11.5.1 \
  -e HF_HOME=/workspace/models \
  -e HIP_VISIBLE_DEVICES=0 \
  vllm-rocm:latest \
  serve Qwen/Qwen2.5-7B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --dtype float16 \
    --max-model-len 32768
```

## Notes

Based on community guide: https://community.frame.work/t/compiling-vllm-from-source-on-strix-halo/77241

### Tested Models
- Qwen/Qwen3-VL-4B-Instruct
- cpatonn/Qwen3-VL-8B-Instruct-AWQ-4bit
- cpatonn/Qwen3-VL-30B-A3B-Instruct-AWQ-8bit
- cpatonn/Qwen3-Next-80B-A3B-Thinking-AWQ-4bit

### Known Issues
- FP8 models not working yet (use AWQ 8-bit instead)
- MXFP4 not supported yet
- BF16 models work fine
- Include `--dtype float16` for better performance
- For large models, may need to limit max-num-seqs to avoid HIP crashes

### Performance Tips
- Remove `--enforce-eager` flag for better performance
- Adjust `--max-num-seqs` based on model size and available memory
- Use `--gpu-memory-utilization 0.8` to leave headroom for system
