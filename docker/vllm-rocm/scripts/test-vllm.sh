#!/bin/bash
set -e

echo "=== vLLM Basic Functionality Test ==="

MODEL=${1:-"facebook/opt-125m"}
echo "Testing with model: ${MODEL}"

echo -e "\n1. vLLM Import Test:"
python3 -c "
import vllm
print(f'vLLM version: {vllm.__version__}')
print('vLLM import: PASSED')
"

echo -e "\n2. Starting vLLM server in background..."
python3 -m vllm.entrypoints.openai.api_server \
    --model ${MODEL} \
    --dtype float16 \
    --max-model-len 2048 \
    --gpu-memory-utilization 0.5 \
    --port 8901 &

SERVER_PID=$!
echo "Server PID: ${SERVER_PID}"

cleanup() {
    echo "Stopping vLLM server..."
    kill ${SERVER_PID} 2>/dev/null || true
    wait ${SERVER_PID} 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for server to start..."
for i in {1..60}; do
    if curl -s http://localhost:8901/health > /dev/null 2>&1; then
        echo "Server is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "Server failed to start within 60 seconds"
        exit 1
    fi
    sleep 1
done

echo -e "\n3. Testing inference via API:"
RESPONSE=$(curl -s http://localhost:8901/v1/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${MODEL}'",
        "prompt": "Hello, my name is",
        "max_tokens": 10,
        "temperature": 0
    }')

echo "Response: ${RESPONSE}"

if echo "${RESPONSE}" | grep -q "choices"; then
    echo "Inference test: PASSED"
else
    echo "Inference test: FAILED"
    exit 1
fi

echo -e "\n=== vLLM Test Completed Successfully ==="
