# Qwen3-Omni vLLM Deployment Guide

## Model Overview

Qwen3-Omni is a natively end-to-end multilingual omni-modal foundation model developed by Alibaba Cloud's Qwen team. It represents a significant advancement in multimodal AI, capable of processing diverse inputs including text, images, audio, and video, while delivering real-time streaming responses in both text and natural speech.

### Key Capabilities

- **Multimodal Input Processing**: Handles text, images, audio, and video inputs seamlessly
- **Multilingual Support**: 
  - **Speech Input**: 19 languages including English, Chinese, Korean, Japanese, German, Russian, Italian, French, Spanish, Portuguese, Malay, Dutch, Indonesian, Turkish, Vietnamese, Cantonese, Arabic, Urdu
  - **Speech Output**: 10 languages including English, Chinese, French, German, Russian, Italian, Spanish, Portuguese, Japanese, Korean
  - **Text**: 119 languages
- **Real-time Interaction**: Low-latency streaming with natural turn-taking and immediate text or speech responses
- **State-of-the-Art Performance**: Reaches SOTA on 22 of 36 audio/video benchmarks and open-source SOTA on 32 of 36
- **Novel Architecture**: MoE-based Thinker–Talker design with multi-codebook optimization for minimal latency

### Model Architecture

The model uses a sophisticated architecture with two main components:

1. **Thinker Component**: Handles understanding and reasoning across modalities
2. **Talker Component**: Generates audio/speech output

The architecture employs:
- Mixture of Experts (MoE) design for efficiency
- Audio-as-Text (AuT) pretraining for strong general representations
- Multi-codebook design for optimized latency
- FlashAttention 2 support for improved memory efficiency

## Docker Deployment Options

### 1. Official Docker Image (qwenllm/qwen3-omni)

The official Docker image provides a pre-built environment with all necessary dependencies.

#### Available Tags
- `qwenllm/qwen3-omni:latest` - Latest stable release (10.98 GB)
- `qwenllm/qwen3-omni:3-cu124` - CUDA 12.4 optimized version (10.97 GB)

#### Image Features
- **Base**: Ubuntu 22.04 with CUDA 12.4.0
- **Python Environment**: Python 3 with comprehensive AI libraries
- **vLLM Integration**: Custom vLLM branch with Qwen3-Omni optimizations
- **Flash Attention**: Pre-compiled for optimal performance
- **Media Processing**: FFmpeg and audio libraries included
- **Web Interface**: Gradio 5.44.1 for demo deployment

#### Pull and Run
```bash
# Pull the official image
docker pull qwenllm/qwen3-omni:3-cu124

# Run with GPU support
docker run --gpus all --name qwen3-omni \
    -v /path/to/models:/models \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -p 8901:80 \
    --shm-size=4gb \
    -it qwenllm/qwen3-omni:3-cu124
```

### 2. Community Docker Image (kyr0/qwen3-omni-vllm-docker)

A community-maintained Docker setup optimized for production deployment with vLLM.

#### Features
- **Simplified Setup**: Make-based commands for easy management
- **Model Variant Support**: Instruct, Thinking, and Captioner models
- **H200 Optimizations**: Specific tunings for high-end GPUs
- **OpenAI API Compatible**: Works with VSCode Copilot and other tools
- **Automatic Model Download**: Built-in Hugging Face model fetching

#### Quick Start
```bash
# Clone the repository
git clone https://github.com/kyr0/qwen3-omni-vllm-docker.git
cd qwen3-omni-vllm-docker

# Make scripts executable
make setup

# Build Docker image (defaults to instruct)
sudo make build
# Or specify variant
make build MODEL_VARIANT=thinking

# Download model (optional, can use HF cache)
make download

# Start container
make start

# Check status
make status

# Test API
make test-api
```

#### Dockerfile Structure
```dockerfile
FROM aimehub/pytorch-2.8.0-aime-cuda12.8.1

# vLLM for Qwen3 Omni
RUN git clone -b qwen3_omni https://github.com/wangxiongts/vllm.git /opt/vllm
WORKDIR /opt/vllm
RUN pip install --break-system-packages -r requirements/build.txt && \
    pip install --break-system-packages -r requirements/cuda.txt && \
    export VLLM_PRECOMPILED_WHEEL_LOCATION="https://wheels.vllm.ai/..." && \
    VLLM_USE_PRECOMPILED=1 pip install -e . -v --no-build-isolation

# Install Transformers and utilities
RUN pip install --break-system-packages "git+https://github.com/huggingface/transformers" \
    accelerate qwen-omni-utils -U \
    "flash-attn>=2.6.0" --no-build-isolation

# Set Hugging Face caches
ENV HF_HOME=/models \
    TRANSFORMERS_CACHE=/models \
    HUGGINGFACE_HUB_CACHE=/models

EXPOSE 8901
ENTRYPOINT ["vllm", "serve"]
```

## vLLM-Specific Configuration

### vLLM Installation from Source

For the latest Qwen3-Omni support, install vLLM from the specialized branch:

```bash
# Clone the Qwen3-Omni branch
git clone -b qwen3_omni https://github.com/wangxiongts/vllm.git
cd vllm

# Install requirements
pip install -r requirements/build.txt
pip install -r requirements/cuda.txt

# Build with precompiled wheel (recommended)
export VLLM_PRECOMPILED_WHEEL_LOCATION=https://wheels.vllm.ai/a5dd03c1ebc5e4f56f3c9d3dc0436e9c582c978f/vllm-0.9.2-cp38-abi3-manylinux1_x86_64.whl
VLLM_USE_PRECOMPILED=1 pip install -e . -v --no-build-isolation

# Or build from source if precompiled fails
pip install -e . -v

# Install additional dependencies
pip install git+https://github.com/huggingface/transformers
pip install accelerate qwen-omni-utils -U
pip install -U flash-attn --no-build-isolation
```

### vLLM Server Configuration

#### Basic Server Launch
```bash
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --port 8901 \
    --host 0.0.0.0 \
    --dtype bfloat16 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.95
```

#### Multi-GPU Configuration
```bash
# For 4 GPUs with tensor parallelism
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --port 8901 \
    --host 0.0.0.0 \
    --dtype bfloat16 \
    --max-model-len 65536 \
    --tensor-parallel-size 4 \
    --allowed-local-media-path / \
    --limit-mm-per-prompt '{"image": 3, "video": 3, "audio": 3}' \
    --max-num-seqs 8
```

#### Advanced Parameters
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="Qwen/Qwen3-Omni-30B-A3B-Instruct",
    trust_remote_code=True,
    gpu_memory_utilization=0.95,
    tensor_parallel_size=torch.cuda.device_count(),
    limit_mm_per_prompt={'image': 3, 'video': 3, 'audio': 3},
    max_num_seqs=8,
    max_model_len=32768,
    seed=1234,
)

sampling_params = SamplingParams(
    temperature=0.6,
    top_p=0.95,
    top_k=20,
    max_tokens=16384,
)
```

## API Endpoint Setup

### OpenAI-Compatible API

The vLLM server provides OpenAI-compatible endpoints out of the box:

#### Endpoints
- **Chat Completions**: `http://localhost:8901/v1/chat/completions`
- **Models List**: `http://localhost:8901/v1/models`
- **Health Check**: `http://localhost:8901/health`

#### Example Request
```bash
curl http://localhost:8901/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "Qwen/Qwen3-Omni-30B-A3B-Instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}},
                    {"type": "audio_url", "audio_url": {"url": "https://example.com/audio.wav"}},
                    {"type": "text", "text": "What can you see and hear?"}
                ]
            }
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }'
```

#### Python Client Example
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8901/v1",
    api_key="EMPTY"  # vLLM doesn't require API key for local deployment
)

response = client.chat.completions.create(
    model="Qwen/Qwen3-Omni-30B-A3B-Instruct",
    messages=[
        {"role": "user", "content": "Explain quantum computing"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
```

### Streaming Support

Enable token streaming for real-time responses:

```bash
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --port 8901 \
    --enable-token-streaming
```

### Authentication and Security

For production deployments, add authentication:

```nginx
# NGINX reverse proxy with auth
server {
    listen 443 ssl;
    server_name api.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /v1/ {
        auth_basic "API Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://localhost:8901/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Hardware Requirements

### Minimum Requirements

| Model Variant | Precision | VRAM Required | System RAM |
|--------------|-----------|---------------|------------|
| Qwen3-Omni-30B-A3B-Instruct | BF16 | 78-145 GB* | 60+ GB |
| Qwen3-Omni-30B-A3B-Thinking | BF16 | 68-132 GB* | 60+ GB |
| Qwen3-Omni-30B-A3B-Captioner | BF16 | 68-132 GB* | 60+ GB |

*VRAM requirements vary based on video length:
- 15s video: 78.85 GB (Instruct) / 68.74 GB (Thinking)
- 30s video: 88.52 GB (Instruct) / 77.79 GB (Thinking)
- 60s video: 107.74 GB (Instruct) / 95.76 GB (Thinking)
- 120s video: 144.81 GB (Instruct) / 131.65 GB (Thinking)

### Recommended Hardware

- **GPU**: NVIDIA A100 (80GB), H100, or multiple A100 (40GB) with tensor parallelism
- **CPU**: 32+ cores for preprocessing
- **Storage**: 200+ GB SSD for model weights and cache
- **Network**: High-bandwidth for model downloading

## Memory Requirements and Quantization

### Quantization Options

#### BFloat16 (Default)
```bash
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --dtype bfloat16
```

#### Float16 (Alternative)
```bash
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --dtype float16
```

#### INT8 Quantization (Experimental)
```bash
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --quantization awq \
    --dtype float16
```

### Memory Optimization Strategies

1. **PagedAttention**: Automatically enabled in vLLM
2. **Flash Attention 2**: Reduces memory usage by ~30%
3. **Tensor Parallelism**: Distribute model across multiple GPUs
4. **Batch Size Tuning**: Adjust `--max-num-seqs` based on available memory
5. **Context Length Limiting**: Use `--max-model-len` to restrict sequence length

## Audio/Multimodal Capabilities

### Supported Modalities

#### Input Modalities
- **Text**: All standard text formats
- **Audio**: WAV, MP3, FLAC, AAC (via FFmpeg)
- **Images**: JPEG, PNG, WebP, GIF
- **Video**: MP4, AVI, MOV (with audio extraction)

#### Output Modalities
- **Text**: Streaming or batch generation
- **Audio**: 24kHz speech synthesis in 10 languages
- **Voice Types**: Ethan (male), Chelsie (female), Aiden (male)

### Audio Processing Configuration

```python
from transformers import Qwen3OmniMoeProcessor
from qwen_omni_utils import process_mm_info

processor = Qwen3OmniMoeProcessor.from_pretrained(MODEL_PATH)

conversation = [
    {
        "role": "user",
        "content": [
            {"type": "audio", "audio": "/path/to/audio.wav"},
            {"type": "video", "video": "/path/to/video.mp4"},
            {"type": "text", "text": "Describe what you hear and see"}
        ],
    },
]

# Process with audio from video
audios, images, videos = process_mm_info(conversation, use_audio_in_video=True)
```

### Audio Output Configuration

```python
# Generate with specific voice
text_ids, audio = model.generate(
    **inputs,
    speaker="Chelsie",  # Options: Ethan, Chelsie, Aiden
    return_audio=True,
    thinker_return_dict_in_generate=True,
    use_audio_in_video=True
)

# Save audio output
import soundfile as sf
sf.write("output.wav", audio.reshape(-1).detach().cpu().numpy(), samplerate=24000)
```

## Available Docker Images and Tags

### Official Images (qwenllm)

| Repository | Tag | Size | Description |
|------------|-----|------|-------------|
| qwenllm/qwen3-omni | latest | 10.98 GB | Latest stable release |
| qwenllm/qwen3-omni | 3-cu124 | 10.97 GB | CUDA 12.4 optimized |
| qwenllm/qwen-omni | latest | 21.24 GB | Previous generation |
| qwenllm/qwenvl | latest | 44.53 GB | Vision-language model |

### Image Contents

The official Docker images include:
- CUDA 12.4.0 toolkit and drivers
- Python 3 with pip
- vLLM with Qwen3-Omni patches
- Flash Attention 2.6+
- Transformers (latest from git)
- Gradio 5.44.1 for web demos
- FFmpeg for media processing
- Audio libraries (soundfile, librosa, av)
- ModelScope integration
- Hugging Face CLI tools

## Example Configurations

### Production Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  qwen3-omni:
    image: qwenllm/qwen3-omni:3-cu124
    container_name: qwen3-omni-prod
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - HF_HOME=/models
      - TRANSFORMERS_CACHE=/models
    volumes:
      - ./models:/models
      - ./data:/data
    ports:
      - "8901:80"
    shm_size: '8gb'
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    command: >
      python web_demo.py
      -c Qwen/Qwen3-Omni-30B-A3B-Instruct
      --server-port 80
      --server-name 0.0.0.0
      --generate-audio
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Development Setup

```bash
#!/bin/bash
# dev-setup.sh

# Set environment variables
export MODEL_VARIANT=instruct
export HF_HOME=/data/models
export HF_TOKEN=hf_xxxxxxxxxxxxxxx

# Download model if not exists
if [ ! -d "$HF_HOME/hub/models--Qwen--Qwen3-Omni-30B-A3B-Instruct" ]; then
    huggingface-cli download Qwen/Qwen3-Omni-30B-A3B-Instruct \
        --local-dir $HF_HOME/Qwen3-Omni-30B-A3B-Instruct
fi

# Start vLLM server with development settings
vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct \
    --port 8901 \
    --host 0.0.0.0 \
    --dtype auto \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.90 \
    --max-num-seqs 4 \
    --enable-token-streaming \
    --chat-template ./chat-template.jinja2
```

### Multi-Model Deployment

```bash
# Deploy multiple variants on different ports

# Instruct model on port 8901
docker run -d --gpus '"device=0"' --name qwen3-instruct \
    -p 8901:80 -v /models:/models \
    qwenllm/qwen3-omni:3-cu124 \
    vllm serve Qwen/Qwen3-Omni-30B-A3B-Instruct --port 80

# Thinking model on port 8902
docker run -d --gpus '"device=1"' --name qwen3-thinking \
    -p 8902:80 -v /models:/models \
    qwenllm/qwen3-omni:3-cu124 \
    vllm serve Qwen/Qwen3-Omni-30B-A3B-Thinking --port 80

# Captioner model on port 8903
docker run -d --gpus '"device=2"' --name qwen3-captioner \
    -p 8903:80 -v /models:/models \
    qwenllm/qwen3-omni:3-cu124 \
    vllm serve Qwen/Qwen3-Omni-30B-A3B-Captioner --port 80
```

### Load Balancing Setup

```nginx
# nginx.conf
upstream qwen3_backend {
    least_conn;
    server localhost:8901 weight=3;
    server localhost:8902 weight=2;
    server localhost:8903 weight=1;
}

server {
    listen 80;
    server_name api.example.com;
    
    location /v1/ {
        proxy_pass http://qwen3_backend/v1/;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

## Troubleshooting

### Common Issues

#### 1. CUDA Out of Memory
```bash
# Solution: Reduce batch size or context length
--max-num-seqs 2 \
--max-model-len 16384
```

#### 2. Model Loading Fails
```bash
# Verify model files exist
ls -la /models/Qwen3-Omni-30B-A3B-Instruct/

# Check permissions
chmod -R 755 /models
```

#### 3. vLLM Import Errors
```bash
# Reinstall vLLM from source
pip uninstall vllm
git clone -b qwen3_omni https://github.com/wangxiongts/vllm.git
cd vllm && pip install -e . -v
```

#### 4. Audio Processing Issues
```bash
# Install missing audio libraries
apt-get update && apt-get install -y ffmpeg libsndfile1
pip install soundfile librosa av
```

#### 5. Slow Inference
```bash
# Enable Flash Attention
pip install -U flash-attn --no-build-isolation

# Use tensor parallelism
--tensor-parallel-size 2
```

### Performance Optimization

1. **Enable Flash Attention 2**
   ```python
   attn_implementation="flash_attention_2"
   ```

2. **Use PagedAttention** (automatic in vLLM)

3. **Optimize Batch Sizes**
   ```bash
   --max-num-seqs 8  # Adjust based on VRAM
   ```

4. **Enable Continuous Batching**
   ```bash
   --enable-continuous-batching
   ```

5. **Use Tensor Parallelism for Multi-GPU**
   ```bash
   --tensor-parallel-size 4
   ```

### Monitoring and Logging

```bash
# Enable detailed logging
export VLLM_LOGGING_LEVEL=DEBUG

# Monitor GPU usage
nvidia-smi -l 1

# Check container logs
docker logs -f qwen3-omni --tail 100

# Monitor API performance
curl http://localhost:8901/metrics
```

## Resources and References

### Official Resources
- [Qwen3-Omni GitHub Repository](https://github.com/QwenLM/Qwen3-Omni)
- [Qwen3-Omni Technical Paper](https://arxiv.org/pdf/2509.17765)
- [Hugging Face Model Collection](https://huggingface.co/collections/Qwen/qwen3-omni-68d100a86cd0906843ceccbe)
- [ModelScope Models](https://modelscope.cn/collections/Qwen3-Omni-867aef131e7d4f)
- [Official Docker Hub](https://hub.docker.com/u/qwenllm)

### Community Resources
- [kyr0's vLLM Docker Setup](https://github.com/kyr0/qwen3-omni-vllm-docker)
- [vLLM Qwen3-Omni Branch](https://github.com/wangxiongts/vllm/tree/qwen3_omni)
- [Qwen Discord](https://discord.gg/CV4E9rpNSD)

### Documentation
- [vLLM Documentation](https://docs.vllm.ai/en/latest/)
- [Transformers Documentation](https://huggingface.co/docs/transformers/)
- [Docker NVIDIA Runtime](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

### API Documentation
- [DashScope API (China)](https://help.aliyun.com/zh/model-studio/qwen-omni)
- [DashScope API (International)](https://www.alibabacloud.com/help/en/model-studio/qwen-omni)
- [OpenAI API Specification](https://platform.openai.com/docs/api-reference)