# Kokoro-FastAPI Research Evidence

This is a non-authoritative research record. It does not establish an approved TTS implementation, image, model, voice, endpoint, GPU allocation, deployment, or benchmark.

## Provenance

- The research referenced Kokoro `0.9.4`, Misaki `0.9.4`, PyTorch `2.8.0`, CUDA `12.8+` and `12.9`, and the Kokoro-82M model; no research or retrieval date was recorded.
- Consulted sources: [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI), [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), and the named GHCR CPU and GPU images.

## Evidence Retained

- Kokoro-FastAPI was evaluated as an OpenAI-compatible TTS service with CPU and NVIDIA paths, streaming, voice mixing, multiple output formats, and optional timestamps.
- Model download and caching, GPU runtime access, non-root execution, chunking, temporary storage, and API compatibility were identified as integration concerns.
- Reported CPU and GPU benchmarks were upstream or unspecified-environment observations, not homelab measurements.

## Repository Relevance

The topic is relevant to voice and inference workloads, but no repository-specific selection or deployment evidence was recorded. Copied APIs, manifests, and floating image procedures were removed.

## Disposition

No canonical Kokoro contract exists. [Voice satellites](../voice-satellites/README.md) records current voice capability and unknowns; [Kubernetes workloads](../kubernetes-workloads/README.md) governs implemented inference patterns.
