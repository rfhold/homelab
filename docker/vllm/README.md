# vLLM ROCm Images For gfx1151

These are application inference images for AMD gfx1151, not generic [CI helper images](../../docs/deployment/spec/ci-images.md). The default Dockerfile builds a vLLM wheel for ROCm and starts the OpenAI-compatible API server on port 8000.

Repository source does not prove that an image was built, published, or validated on a particular host.

## Dockerfile Variants

| File | Base and build path | Floating inputs |
| --- | --- | --- |
| [`Dockerfile`](Dockerfile) | ROCm/PyTorch base, then builds vLLM for `gfx1151` | `VLLM_BRANCH=main`, Git-installed Transformers, upgraded Python packages, and mutable image tags |
| [`Dockerfile.kyuz0`](Dockerfile.kyuz0) | Extends `kyuz0/vllm-therock-gfx1151:latest` | `latest`, Git-installed Transformers, and upgraded Python packages |
| [`Dockerfile.kyuz0-main`](Dockerfile.kyuz0-main) | Builds TheRock, PyTorch, Flash Attention, and vLLM on Fedora 43 | Latest matching TheRock nightly, Flash Attention `main_perf`, vLLM default branch, Git-installed Transformers, and package resolution |

None of these files pins every upstream input by immutable digest and commit.

## Default Build Inputs

| Argument | Default |
| --- | --- |
| `BASE_IMAGE` | `docker.io/rocm/pytorch:rocm7.2_ubuntu24.04_py3.12_pytorch_release_2.9.1` |
| `ARG_PYTORCH_ROCM_ARCH` | `gfx1151` |
| `VLLM_REPO` | `https://github.com/vllm-project/vllm.git` |
| `VLLM_BRANCH` | `main` |

The runtime sets the ROCm and gfx1151 build environment, installs the built wheel, disables the vLLM v1 engine with `VLLM_USE_V1=0`, exposes port 8000, and uses `python -m vllm.entrypoints.openai.api_server` as its entrypoint.

## Build

From the repository root:

```bash
docker build \
  --file docker/vllm/Dockerfile \
  --tag vllm-rocm-gfx1151:local \
  docker/vllm
```

Select an alternative explicitly with `--file docker/vllm/Dockerfile.kyuz0` or `--file docker/vllm/Dockerfile.kyuz0-main`.

## Run

The target is a Linux host with an AMD gfx1151 device, working ROCm kernel and userspace support, and accessible `/dev/kfd` and `/dev/dri` devices. The Dockerfiles do not pin a host kernel or driver version. For a public model, omit `--env HF_TOKEN`; otherwise load the token into the environment through an approved secret source and forward it without putting its value on the command line.

```bash
docker run --rm \
  --device /dev/kfd \
  --device /dev/dri \
  --ipc host \
  --shm-size 8g \
  --publish 8000:8000 \
  --volume "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  --env HF_TOKEN \
  vllm-rocm-gfx1151:local \
  --model "<model-id>"
```

After startup, a local API check is:

```bash
curl --fail http://127.0.0.1:8000/v1/models
```

Functional acceptance also requires a successful inference request for the selected model while observing that the gfx1151 device is used. That model- and hardware-dependent check was not run for this documentation change.

## Publication Status

No tracked GitHub or Tekton workflow references `docker/vllm/`. [`src/docker-images.ts`](../../src/docker-images.ts) contains the consumer tag `cr.holdenitdown.net/rfhold/vllm:rocm-gfx1151`, but a consumer reference is not publication or registry-availability evidence.
