ARG BASE_IMAGE=docker.io/rocm/pytorch:rocm7.2_ubuntu24.04_py3.12_pytorch_release_2.9.1

FROM ${BASE_IMAGE} AS base

ARG ARG_PYTORCH_ROCM_ARCH=gfx1151
ENV PYTORCH_ROCM_ARCH=${ARG_PYTORCH_ROCM_ARCH}
ENV ROCM_PATH=/opt/rocm
ENV HIP_PATH=/opt/rocm
ENV VLLM_TARGET_DEVICE=rocm

RUN apt-get update -q -y && apt-get install -q -y \
    sqlite3 libsqlite3-dev libfmt-dev libmsgpack-dev libsuitesparse-dev \
    apt-transport-https ca-certificates wget curl git \
    libgoogle-perftools4 cmake \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --upgrade pip

FROM base AS fetch_vllm

ARG VLLM_REPO=https://github.com/vllm-project/vllm.git
ARG VLLM_BRANCH=main

WORKDIR /build
RUN git clone --depth 1 --branch ${VLLM_BRANCH} ${VLLM_REPO} vllm

FROM fetch_vllm AS build_vllm

WORKDIR /build/vllm
RUN python3 -m pip install -r requirements/rocm.txt \
    && python3 setup.py clean --all \
    && python3 setup.py bdist_wheel --dist-dir=dist

FROM base AS runtime

ENV VLLM_USE_V1=0
ENV HIP_PLATFORM=amd
ENV HIP_ARCHITECTURES=gfx1151
ENV AMDGPU_TARGETS=gfx1151
ENV RAY_EXPERIMENTAL_NOSET_ROCR_VISIBLE_DEVICES=1

ENV TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1
ENV FLASH_ATTENTION_TRITON_AMD_ENABLE=TRUE
ENV HIP_FORCE_DEV_KERNARG=1
ENV ROCBLAS_USE_HIPBLASLT=1
ENV SAFETENSORS_FAST_GPU=1
ENV TOKENIZERS_PARALLELISM=false

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libtcmalloc_minimal.so.4

RUN pip install --upgrade huggingface-hub[cli] amdsmi

COPY --from=build_vllm /build/vllm/requirements /tmp/requirements
RUN pip install -r /tmp/requirements/rocm.txt && rm -rf /tmp/requirements

COPY --from=build_vllm /build/vllm/dist/*.whl /wheels/
RUN pip install --no-deps /wheels/*.whl && rm -rf /wheels

RUN pip install --upgrade huggingface-hub && \
    pip install --force-reinstall --no-deps git+https://github.com/huggingface/transformers.git

WORKDIR /app

EXPOSE 8000

ENTRYPOINT ["python", "-m", "vllm.entrypoints.openai.api_server"]

CMD ["--host", "0.0.0.0", "--port", "8000"]
