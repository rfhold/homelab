#!/bin/bash
set -e

MODEL=${1:-"facebook/opt-125m"}

if [ -z "$MODEL" ]; then
    echo "Usage: benchmark.sh MODEL_NAME"
    exit 1
fi

echo "=== vLLM Performance Benchmark ==="
echo "Model: ${MODEL}"
echo "GPU Architecture: ${PYTORCH_ROCM_ARCH}"
echo "======================================"

python3 -c "
import torch
import time
from vllm import LLM, SamplingParams

print('Initializing model...')
llm = LLM(
    model='${MODEL}',
    dtype='float16',
    max_model_len=2048,
    gpu_memory_utilization=0.9,
)

sampling_params = SamplingParams(
    temperature=0.8,
    top_p=0.95,
    max_tokens=100,
)

prompts = [
    'Hello, my name is',
    'The capital of France is',
    'Python is a programming language that',
] * 10

print(f'Running benchmark with {len(prompts)} prompts...')
start_time = time.time()

outputs = llm.generate(prompts, sampling_params)

end_time = time.time()
total_time = end_time - start_time

total_tokens = sum(len(output.outputs[0].token_ids) for output in outputs)
throughput = total_tokens / total_time

print(f'\nBenchmark Results:')
print(f'Total prompts: {len(prompts)}')
print(f'Total tokens: {total_tokens}')
print(f'Total time: {total_time:.2f}s')
print(f'Throughput: {throughput:.2f} tokens/s')
print(f'Latency per prompt: {(total_time / len(prompts)) * 1000:.2f}ms')

print('\nSample output:')
print(outputs[0].outputs[0].text[:200])
"

echo -e "\n=== Benchmark Completed ==="
