ARG CUDA_VERSION=12.9.1
ARG PYTHON_VERSION=3.12
ARG VLLM_VERSION=v0.13.0

FROM docker.io/nvidia/cuda:${CUDA_VERSION}-devel-ubuntu22.04 AS build

ARG PYTHON_VERSION
ARG VLLM_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        ccache \
        software-properties-common \
        git \
        curl \
        sudo \
        python3-pip \
        libibverbs-dev \
        gcc-10 \
        g++-10 \
    && update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-10 110 --slave /usr/bin/g++ g++ /usr/bin/g++-10 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && $HOME/.local/bin/uv venv /opt/venv --python ${PYTHON_VERSION} \
    && rm -f /usr/bin/python3 /usr/bin/python3-config /usr/bin/pip \
    && ln -s /opt/venv/bin/python3 /usr/bin/python3 \
    && ln -s /opt/venv/bin/python3-config /usr/bin/python3-config \
    && ln -s /opt/venv/bin/pip /usr/bin/pip

ENV PATH="/opt/venv/bin:/root/.local/bin:$PATH"
ENV VIRTUAL_ENV="/opt/venv"
ENV UV_HTTP_TIMEOUT=500
ENV UV_INDEX_STRATEGY="unsafe-best-match"
ENV UV_LINK_MODE=copy

RUN ldconfig /usr/local/cuda-$(echo $CUDA_VERSION | cut -d. -f1,2)/compat/

WORKDIR /workspace

RUN git clone --depth 1 --branch ${VLLM_VERSION} https://github.com/vllm-project/vllm.git

WORKDIR /workspace/vllm

ARG PYTORCH_CUDA_INDEX_BASE_URL=https://download.pytorch.org/whl
ARG CUDA_VERSION

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /opt/venv/bin/python3 -r requirements/cuda.txt \
    --extra-index-url ${PYTORCH_CUDA_INDEX_BASE_URL}/cu$(echo $CUDA_VERSION | cut -d. -f1,2 | tr -d '.')

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /opt/venv/bin/python3 -r requirements/build.txt \
    --extra-index-url ${PYTORCH_CUDA_INDEX_BASE_URL}/cu$(echo $CUDA_VERSION | cut -d. -f1,2 | tr -d '.')

ARG MAX_JOBS=8
ARG NVCC_THREADS=2
ENV MAX_JOBS=${MAX_JOBS}
ENV NVCC_THREADS=${NVCC_THREADS}
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV VLLM_TARGET_DEVICE=cuda
ENV CCACHE_DIR=/root/.cache/ccache

RUN --mount=type=cache,target=/root/.cache/ccache \
    --mount=type=cache,target=/root/.cache/uv \
    python3 setup.py bdist_wheel --dist-dir=dist --py-limited-api=cp38

FROM docker.io/nvidia/cuda:${CUDA_VERSION}-base-ubuntu22.04

ARG CUDA_VERSION
ARG PYTHON_VERSION
ARG VLLM_VERSION

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /vllm-workspace

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        software-properties-common \
        curl \
        sudo \
        python3-pip \
        ffmpeg \
        libsm6 \
        libxext6 \
        libgl1 \
    && for i in 1 2 3; do \
            add-apt-repository -y ppa:deadsnakes/ppa && break || \
            { echo "Attempt $i failed, retrying in 5s..."; sleep 5; }; \
        done \
    && apt-get update -y \
    && apt-get install -y --no-install-recommends \
        python${PYTHON_VERSION} \
        python${PYTHON_VERSION}-dev \
        python${PYTHON_VERSION}-venv \
        libibverbs-dev \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1 \
    && update-alternatives --set python3 /usr/bin/python${PYTHON_VERSION} \
    && ln -sf /usr/bin/python${PYTHON_VERSION}-config /usr/bin/python3-config \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python${PYTHON_VERSION}

RUN CUDA_VERSION_DASH=$(echo $CUDA_VERSION | cut -d. -f1,2 | tr '.' '-') && \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
        cuda-nvcc-${CUDA_VERSION_DASH} \
        cuda-cudart-${CUDA_VERSION_DASH} \
        cuda-nvrtc-${CUDA_VERSION_DASH} \
        cuda-cuobjdump-${CUDA_VERSION_DASH} \
        libcurand-dev-${CUDA_VERSION_DASH} \
        libcublas-${CUDA_VERSION_DASH} \
        libnccl-dev && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install uv

ENV UV_HTTP_TIMEOUT=500
ENV UV_INDEX_STRATEGY="unsafe-best-match"
ENV UV_LINK_MODE=copy

RUN ldconfig /usr/local/cuda-$(echo $CUDA_VERSION | cut -d. -f1,2)/compat/

ARG PYTORCH_CUDA_INDEX_BASE_URL=https://download.pytorch.org/whl
COPY --from=build /workspace/vllm/requirements/common.txt /tmp/common.txt
COPY --from=build /workspace/vllm/requirements/cuda.txt /tmp/requirements-cuda.txt

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r /tmp/requirements-cuda.txt \
        --extra-index-url ${PYTORCH_CUDA_INDEX_BASE_URL}/cu$(echo $CUDA_VERSION | cut -d. -f1,2 | tr -d '.') && \
    rm /tmp/requirements-cuda.txt /tmp/common.txt

COPY --from=build /workspace/vllm/dist/*.whl /tmp/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system /tmp/*.whl --verbose \
        --extra-index-url ${PYTORCH_CUDA_INDEX_BASE_URL}/cu$(echo $CUDA_VERSION | cut -d. -f1,2 | tr -d '.') && \
    rm /tmp/*.whl

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --prerelease=allow accelerate hf_transfer modelscope 'timm>=1.0.17' 'transformers>=5.0.0rc1'

ENV VLLM_USAGE_SOURCE=production-docker-image
ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib64:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}

ENTRYPOINT ["vllm", "serve"]
