# Kokoro-FastAPI Documentation

## Overview

Kokoro-FastAPI is a Dockerized FastAPI wrapper for the Kokoro-82M text-to-speech model. It provides OpenAI-compatible TTS endpoints with support for both GPU (NVIDIA CUDA) and CPU inference, multiple languages, streaming, voice mixing, and word-level timestamps.

## Table of Contents

- [Running with Docker](#running-with-docker)
- [Configuration Options](#configuration-options)
- [System Requirements](#system-requirements)
- [Models and Voice Packs](#models-and-voice-packs)
- [API Endpoints](#api-endpoints)
- [Performance Considerations](#performance-considerations)
- [Kubernetes Deployment](#kubernetes-deployment)

## Running with Docker

### Quick Start with Docker Run

```bash
# CPU version
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest

# GPU version (NVIDIA)
docker run --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
```

### Docker Compose Setup

#### GPU Configuration (docker/gpu/docker-compose.yml)

```yaml
name: kokoro-tts-gpu
services:
  kokoro-tts:
    image: ghcr.io/remsky/kokoro-fastapi-gpu:latest
    # Or build from source:
    # build:
    #   context: ../..
    #   dockerfile: docker/gpu/Dockerfile
    volumes:
      - ../../api:/app/api
    user: "1001:1001"  # Run as non-root user
    ports:
      - "8880:8880"
    environment:
      - PYTHONPATH=/app:/app/api
      - USE_GPU=true
      - PYTHONUNBUFFERED=1
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

#### CPU Configuration (docker/cpu/docker-compose.yml)

```yaml
name: kokoro-fastapi-cpu
services:
  kokoro-tts:
    image: ghcr.io/remsky/kokoro-fastapi-cpu:latest
    volumes:
      - ../../api:/app/api
    ports:
      - "8880:8880"
    environment:
      - PYTHONPATH=/app:/app/api
      # ONNX Optimization Settings for CPU
      - ONNX_NUM_THREADS=8
      - ONNX_INTER_OP_THREADS=4
      - ONNX_EXECUTION_MODE=parallel
      - ONNX_OPTIMIZATION_LEVEL=all
      - ONNX_MEMORY_PATTERN=true
      - ONNX_ARENA_EXTEND_STRATEGY=kNextPowerOfTwo
```

### Building Custom Images

```bash
# Clone the repository
git clone https://github.com/remsky/Kokoro-FastAPI.git
cd Kokoro-FastAPI

# Build GPU version
cd docker/gpu
docker compose build

# Build CPU version
cd docker/cpu
docker compose build
```

## Configuration Options

### Environment Variables

All configuration can be controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| **API Settings** | | |
| `API_TITLE` | `"Kokoro TTS API"` | API title displayed in documentation |
| `API_DESCRIPTION` | `"API for text-to-speech..."` | API description |
| `API_VERSION` | `"1.0.0"` | API version |
| `HOST` | `"0.0.0.0"` | Host to bind to |
| `PORT` | `8880` | Port to listen on |
| **Processing Settings** | | |
| `OUTPUT_DIR` | `"output"` | Directory for output files |
| `OUTPUT_DIR_SIZE_LIMIT_MB` | `500.0` | Max size of output directory in MB |
| `DEFAULT_VOICE` | `"af_heart"` | Default voice to use |
| `DEFAULT_VOICE_CODE` | `None` | Override first letter of voice name |
| `USE_GPU` | `true` | Use GPU acceleration if available |
| `DEVICE_TYPE` | `None` | Force device type: `"cuda"`, `"mps"`, or `"cpu"` |
| `ALLOW_LOCAL_VOICE_SAVING` | `false` | Allow saving combined voices locally |
| **Model Paths** | | |
| `MODEL_DIR` | `"/app/api/src/models"` | Model directory path (container) |
| `VOICES_DIR` | `"/app/api/src/voices/v1_0"` | Voice packs directory (container) |
| **Audio Settings** | | |
| `SAMPLE_RATE` | `24000` | Audio sample rate |
| `DEFAULT_VOLUME_MULTIPLIER` | `1.0` | Default volume multiplier |
| **Text Processing** | | |
| `TARGET_MIN_TOKENS` | `175` | Target minimum tokens per chunk |
| `TARGET_MAX_TOKENS` | `250` | Target maximum tokens per chunk |
| `ABSOLUTE_MAX_TOKENS` | `450` | Absolute maximum tokens per chunk |
| `ADVANCED_TEXT_NORMALIZATION` | `true` | Preprocess text before misaki |
| `VOICE_WEIGHT_NORMALIZATION` | `true` | Normalize voice weights to sum to 1 |
| **Streaming Settings** | | |
| `GAP_TRIM_MS` | `1` | Base trim from streaming chunk ends (ms) |
| `DYNAMIC_GAP_TRIM_PADDING_MS` | `410` | Padding for dynamic gap trim |
| **Web UI Settings** | | |
| `ENABLE_WEB_PLAYER` | `true` | Enable web player UI |
| `WEB_PLAYER_PATH` | `"web"` | Path to web player static files |
| `CORS_ORIGINS` | `["*"]` | CORS allowed origins |
| `CORS_ENABLED` | `true` | Enable CORS |
| **Temp Files** | | |
| `TEMP_FILE_DIR` | `"api/temp_files"` | Directory for temporary audio files |
| `MAX_TEMP_DIR_SIZE_MB` | `2048` | Max size of temp directory (MB) |
| `MAX_TEMP_DIR_AGE_HOURS` | `1` | Remove temp files older than N hours |
| `MAX_TEMP_DIR_COUNT` | `3` | Maximum number of temp files to keep |
| **GPU/CPU Specific** | | |
| `DOWNLOAD_MODEL` | `true` | Auto-download model on startup |
| `PHONEMIZER_ESPEAK_PATH` | `/usr/bin` | Path to espeak binary |
| `PHONEMIZER_ESPEAK_DATA` | `/usr/share/espeak-ng-data` | Path to espeak data |

### CPU-Specific ONNX Settings

For CPU inference optimization:

```yaml
ONNX_NUM_THREADS: 8              # Number of threads for computation
ONNX_INTER_OP_THREADS: 4         # Inter-op parallelism threads
ONNX_EXECUTION_MODE: parallel    # Execution mode
ONNX_OPTIMIZATION_LEVEL: all     # Optimization level
ONNX_MEMORY_PATTERN: true        # Enable memory pattern optimization
ONNX_ARENA_EXTEND_STRATEGY: kNextPowerOfTwo  # Memory arena strategy
```

## System Requirements

### Hardware Requirements

#### GPU Version
- **NVIDIA GPU**: CUDA 12.8+ compatible GPU
- **VRAM**: Minimum 4GB, recommended 8GB+
- **System RAM**: 8GB minimum, 16GB recommended
- **Storage**: ~5GB for model and dependencies

#### CPU Version  
- **CPU**: Modern multi-core processor (4+ cores recommended)
- **System RAM**: 16GB minimum, 32GB recommended for optimal performance
- **Storage**: ~5GB for model and dependencies

### Software Requirements

#### Base Dependencies
- Docker or Docker Desktop
- Docker Compose (optional)
- NVIDIA Container Toolkit (for GPU version)

#### Pre-installed in Container
- Python 3.10
- espeak-ng (phonemization fallback)
- ffmpeg (audio format conversion)
- PyTorch 2.8.0 (with CUDA 12.9 for GPU)
- FastAPI and Uvicorn
- Kokoro 0.9.4 and Misaki 0.9.4

### Platform Support
- **Linux**: Full support for CPU and GPU
- **Windows**: Full support via WSL2 or native Docker
- **macOS**: CPU support only (Apple Silicon MPS planned)
- **ARM**: Multi-arch support for ARM64 processors

## Models and Voice Packs

### Model Files

The Kokoro-82M model (~333MB) is automatically downloaded on first startup:
- **Model**: `kokoro-v1_0.pth` 
- **Config**: `config.json`
- **Source**: [HuggingFace - hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)

Manual download:
```bash
python docker/scripts/download_model.py --output api/src/models/v1_0
```

### Available Voice Packs

Default voices included:
- `af_bella` - Female voice
- `af_sky` - Female voice  
- `af_heart` - Female voice
- `am_adam` - Male voice
- `am_michael` - Male voice
- `bf_emma` - Female voice
- `bf_isabella` - Female voice
- `bm_george` - Male voice
- `bm_lewis` - Male voice

Voice naming convention: `{accent}{gender}_{name}`
- First letter: accent code (a=American, b=British)
- Second letter: gender (f=female, m=male)

### Voice Mixing

Combine multiple voices with weighted ratios:

```python
# Equal mix (50%/50%)
voice="af_bella+af_sky"

# Weighted mix (67%/33%)  
voice="af_bella(2)+af_sky(1)"

# Three-voice mix
voice="af_bella+af_sky+bf_emma"
```

## API Endpoints

### OpenAI-Compatible Endpoints

#### POST `/v1/audio/speech`
Generate speech from text (OpenAI-compatible).

**Request Body:**
```json
{
  "model": "tts-1",  // or "tts-1-hd", "kokoro"
  "input": "Hello world!",
  "voice": "af_bella",
  "response_format": "mp3",  // mp3, wav, opus, flac, pcm, m4a
  "speed": 1.0,  // 0.25 to 4.0
  "stream": true,  // Enable streaming
  "lang_code": "a",  // Language code
  "volume_multiplier": 1.0,
  "normalization_options": {
    "normalize": true
  },
  "return_download_link": false,
  "download_format": "mp3"
}
```

**Response:** Audio stream or complete audio file

#### GET `/v1/audio/voices`
List available voices.

**Response:**
```json
{
  "voices": ["af_bella", "af_sky", "af_heart", ...]
}
```

#### POST `/v1/audio/voices/combine`
Combine multiple voices into a new voicepack.

**Request Body:**
```json
"af_bella(2)+af_sky(1)"  // String format
// or
["af_bella", "af_sky"]  // Array format
```

**Response:** Combined `.pt` voicepack file

#### GET `/v1/models`
List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "tts-1",
      "object": "model",
      "created": 1686935002,
      "owned_by": "kokoro"
    },
    ...
  ]
}
```

### Development Endpoints

#### POST `/dev/phonemize`
Convert text to phonemes.

**Request Body:**
```json
{
  "text": "Hello world",
  "language": "a"  // Language code
}
```

**Response:**
```json
{
  "phonemes": "hɛˈloʊ wˈɜːld",
  "tokens": []
}
```

#### POST `/dev/generate_from_phonemes`
Generate audio from phonemes.

**Request Body:**
```json
{
  "phonemes": "hɛˈloʊ wˈɜːld",
  "voice": "af_bella"
}
```

**Response:** Audio stream

#### POST `/dev/captioned_speech`
Generate speech with word-level timestamps.

**Request Body:**
```json
{
  "model": "kokoro",
  "input": "Hello world!",
  "voice": "af_bella",
  "response_format": "mp3",
  "stream": true,
  "return_timestamps": true
}
```

**Response (streaming):**
```json
{
  "audio": "base64_encoded_chunk",
  "audio_format": "audio/mpeg",
  "timestamps": [
    {
      "word": "Hello",
      "start": 0.0,
      "end": 0.5
    },
    ...
  ]
}
```

### Debug Endpoints

#### GET `/debug/system`
Get system information (CPU, memory, GPU).

#### GET `/debug/threads`
Get thread information and stack traces.

#### GET `/debug/storage`
Monitor temp file and output directory usage.

#### GET `/debug/session_pools`
View ONNX session and CUDA stream status.

### Web Interface

- **API Documentation**: `http://localhost:8880/docs`
- **Web Player UI**: `http://localhost:8880/web/`
- **Health Check**: `http://localhost:8880/health`

## Performance Considerations

### GPU Performance

**NVIDIA 4060Ti 16GB Benchmarks:**
- **Realtime Factor**: 35x-100x (generation speed vs audio length)
- **Processing Rate**: ~137.67 tokens/second
- **First Token Latency**: ~300ms @ 400 chunk size
- **Memory Usage**: ~2-4GB VRAM

### CPU Performance

**Intel i7-11700 @ 2.5GHz:**
- **Realtime Factor**: 5x-15x
- **First Token Latency**: ~3500ms @ 200 chunk size
- **Memory Usage**: 4-8GB RAM

**Apple M3 Pro:**
- **First Token Latency**: <1s @ 200 chunk size

### Optimization Tips

1. **Streaming**: Use streaming for real-time applications to reduce latency
2. **Chunk Size**: Adjust `TARGET_MIN_TOKENS` and `TARGET_MAX_TOKENS` for quality vs speed
3. **Batch Processing**: Process multiple requests concurrently for better throughput
4. **Voice Caching**: Pre-combine frequently used voice mixes
5. **Format Selection**: Use PCM for lowest latency, MP3/Opus for bandwidth efficiency

### Text Processing Limits

- **Optimal chunk**: 175-250 tokens (~30s audio)
- **Maximum chunk**: 450 tokens (may cause rushed speech)
- **Long-form**: Automatically splits at sentence boundaries

## Kubernetes Deployment

### Helm Chart Installation

```bash
# Add the repository
helm repo add kokoro https://github.com/remsky/Kokoro-FastAPI/charts

# Install with default values
helm install kokoro-tts kokoro/kokoro-fastapi

# Install with custom values
helm install kokoro-tts kokoro/kokoro-fastapi \
  --set kokoroTTS.repository=ghcr.io/remsky/kokoro-fastapi-gpu \
  --set kokoroTTS.tag=latest \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=tts.example.com
```

### Helm Values Configuration

```yaml
kokoroTTS:
  replicaCount: 1
  repository: "ghcr.io/remsky/kokoro-fastapi-gpu"
  tag: "latest"
  pullPolicy: Always
  port: 8880

service:
  type: ClusterIP

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: tts.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kokoro-tts-tls
      hosts:
        - tts.example.com

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 5
  targetCPUUtilizationPercentage: 80
```

### Direct Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kokoro-tts
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kokoro-tts
  template:
    metadata:
      labels:
        app: kokoro-tts
    spec:
      containers:
      - name: kokoro-tts
        image: ghcr.io/remsky/kokoro-fastapi-gpu:latest
        ports:
        - containerPort: 8880
        env:
        - name: USE_GPU
          value: "true"
        - name: DOWNLOAD_MODEL
          value: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: kokoro-tts
spec:
  selector:
    app: kokoro-tts
  ports:
  - port: 8880
    targetPort: 8880
```

## Example Usage

### Python with OpenAI Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8880/v1",
    api_key="not-needed"
)

# Simple generation
response = client.audio.speech.create(
    model="kokoro",
    voice="af_bella",
    input="Hello world!"
)
response.stream_to_file("output.mp3")

# Streaming with voice mix
with client.audio.speech.with_streaming_response.create(
    model="kokoro",
    voice="af_bella(2)+af_sky(1)",
    input="This is a longer text that will be streamed.",
    response_format="opus"
) as response:
    response.stream_to_file("output.opus")
```

### Python with Requests

```python
import requests

# Generate audio
response = requests.post(
    "http://localhost:8880/v1/audio/speech",
    json={
        "model": "kokoro",
        "input": "Hello world!",
        "voice": "af_bella",
        "response_format": "mp3",
        "speed": 1.0
    }
)

with open("output.mp3", "wb") as f:
    f.write(response.content)

# Stream audio
response = requests.post(
    "http://localhost:8880/v1/audio/speech",
    json={
        "input": "Streaming text",
        "voice": "af_bella",
        "stream": True
    },
    stream=True
)

for chunk in response.iter_content(chunk_size=1024):
    if chunk:
        # Process streaming chunks
        pass
```

### Curl Examples

```bash
# Simple TTS
curl -X POST http://localhost:8880/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kokoro",
    "input": "Hello world!",
    "voice": "af_bella"
  }' \
  --output speech.mp3

# List voices
curl http://localhost:8880/v1/audio/voices

# Generate with phonemes
curl -X POST http://localhost:8880/dev/phonemize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "language": "a"
  }'
```

## Troubleshooting

### Common Issues

1. **GPU not detected**: Ensure NVIDIA Container Toolkit is installed and Docker has GPU access
2. **Model download fails**: Check internet connection and GitHub access
3. **Out of memory**: Reduce batch size or use CPU version
4. **Audio artifacts**: Adjust chunk sizes via environment variables
5. **Slow generation**: Check if using GPU, optimize ONNX settings for CPU

### Linux GPU Permissions

If encountering GPU permission issues:

```yaml
# Option 1: Add container groups
services:
  kokoro-tts:
    group_add:
      - "video"
      - "render"

# Option 2: Host system groups  
services:
  kokoro-tts:
    user: "${UID}:${GID}"
    group_add:
      - "video"
```

## Additional Resources

- **GitHub Repository**: [remsky/Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)
- **Model Page**: [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
- **Docker Images**: [ghcr.io/remsky/kokoro-fastapi-gpu](https://ghcr.io/remsky/kokoro-fastapi-gpu)
- **API Documentation**: Access at `http://localhost:8880/docs` when running

## License

- Kokoro model weights: Apache 2.0
- FastAPI wrapper code: Apache 2.0
- StyleTTS2 inference code: MIT
