ARG ROCM_VERSION=6.4.4
ARG PYTHON_VERSION=3.10
ARG VLLM_VERSION=main
ARG FLASH_ATTENTION_BRANCH=main_perf

FROM rocm/dev-ubuntu-22.04:${ROCM_VERSION}-complete AS rocm-base

ARG PYTHON_VERSION
ARG DEBIAN_FRONTEND=noninteractive

ENV ROCM_VERSION=6.4.4
ENV ROCM_HOME=/opt/rocm
ENV PATH="${ROCM_HOME}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${ROCM_HOME}/lib:${LD_LIBRARY_PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-dev \
    python3-pip \
    git \
    wget \
    curl \
    ca-certificates \
    build-essential \
    ninja-build \
    cmake \
    rocm-dev \
    hipblas \
    hipfft \
    rocblas \
    rocsparse \
    hipsparse \
    rocthrust \
    rocprim \
    hipcub \
    rocrand \
    rccl \
    rocfft \
    rocsolver \
    hipblaslt \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1 && \
    update-alternatives --install /usr/bin/python python /usr/bin/python${PYTHON_VERSION} 1 && \
    python3 -m pip install --upgrade pip setuptools wheel && \
    pip3 install --upgrade cmake

RUN pip3 install --no-cache-dir \
    torch==2.9.0+rocm6.4 \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/rocm6.4

FROM rocm-base AS flash-attention-builder

ARG FLASH_ATTENTION_BRANCH

ENV PYTORCH_ROCM_ARCH="gfx1151"
ENV HSA_OVERRIDE_GFX_VERSION=11.0.0
ENV TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1
ENV ROCBLAS_USE_HIPBLASLT=1
ENV HIPBLASLT_TENSILE_LIBPATH=/opt/rocm/lib/hipblaslt/library
ENV FLASH_ATTENTION_TRITON_AMD_ENABLE=TRUE
ENV FLASH_ATTENTION_TRITON_AMD_AUTOTUNE=TRUE

WORKDIR /build

RUN pip3 install --no-cache-dir triton==3.2.0 packaging

RUN git clone https://github.com/ROCm/flash-attention.git && \
    cd flash-attention && \
    git checkout ${FLASH_ATTENTION_BRANCH} && \
    MAX_JOBS=8 python3 setup.py install

FROM flash-attention-builder AS vllm-builder

ENV VLLM_TARGET_DEVICE=rocm
ENV VLLM_USE_V1=1
ENV VLLM_ATTENTION_BACKEND=ROCM_TRITON

WORKDIR /build

RUN git clone --depth 1 -b qwen3_omni https://github.com/wangxiongts/vllm.git vllm

WORKDIR /build/vllm

RUN pip3 install --no-cache-dir -r requirements/rocm.txt && \
    pip3 install --no-cache-dir -e . --no-build-isolation

FROM vllm-builder AS final

ENV HF_HOME=/models
ENV TRANSFORMERS_CACHE=/models
ENV HUGGINGFACE_HUB_CACHE=/models
ENV PYTORCH_ROCM_ARCH="gfx1151"
ENV HSA_OVERRIDE_GFX_VERSION=11.0.0
ENV TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1
ENV ROCBLAS_USE_HIPBLASLT=1
ENV HIPBLASLT_TENSILE_LIBPATH=/opt/rocm/lib/hipblaslt/library
ENV FLASH_ATTENTION_TRITON_AMD_ENABLE=TRUE
ENV FLASH_ATTENTION_TRITON_AMD_AUTOTUNE=TRUE
ENV VLLM_USE_V1=1
ENV VLLM_ATTENTION_BACKEND=ROCM_TRITON

RUN pip3 install --no-cache-dir \
    librosa==0.10.1 \
    soundfile==0.12.1 \
    av==12.0.0 \
    transformers>=4.45.0 \
    accelerate \
    gradio==5.44.1 \
    huggingface-hub

RUN mkdir -p /app /models && \
    groupadd -g 2000 vllm && \
    useradd -u 2000 -g 2000 -d /app -s /bin/bash vllm && \
    chown -R 2000:2000 /app /models

WORKDIR /app

COPY --chown=2000:2000 entrypoint.sh /app/
COPY --chown=2000:2000 scripts/ /app/scripts/

RUN chmod +x /app/entrypoint.sh /app/scripts/*.sh

EXPOSE 8901

USER 2000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["--help"]
