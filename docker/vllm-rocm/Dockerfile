# syntax=docker/dockerfile:1.4
FROM fedora:43
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ARG ROCM_INDEX_URL=https://rocm.nightlies.amd.com/v2/gfx1151/

WORKDIR /opt/vllm-build
RUN uv venv --python 3.13
ENV VIRTUAL_ENV=/opt/vllm-build/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN dnf install -y \
    wget \
    curl \
    git \
    gcc \
    gcc-c++ \
    make \
    cmake \
    python3-pip \
    python3-devel \
    openssl-devel \
    libffi-devel \
    ca-certificates \
    tar \
    gzip \
    libatomic \
    && dnf clean all

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --index-url ${ROCM_INDEX_URL} "rocm[libraries,devel]" && \
    uv pip install --index-url ${ROCM_INDEX_URL} --pre torch torchaudio torchvision

RUN --mount=type=cache,target=/var/cache/rocm-downloads \
    ROCM_VERSION=$(uv pip show torch | grep Version | awk -F'+rocm' '{print $2}') && \
    echo "Detected ROCm Version: $ROCM_VERSION" && \
    #
    # Fetch the ROCm tarball from cache or download
    #
    TARBALL="therock-dist-linux-gfx1151-${ROCM_VERSION}.tar.gz" && \
    if [ -f "/var/cache/rocm-downloads/${TARBALL}" ]; then \
        echo "Using cached ROCm tarball" && \
        ln -s "/var/cache/rocm-downloads/${TARBALL}" . ; \
    else \
        echo "Downloading ROCm tarball" && \
        curl -#LO "https://therock-nightly-tarball.s3.amazonaws.com/${TARBALL}" && \
        cp "${TARBALL}" "/var/cache/rocm-downloads/${TARBALL}" ; \
    fi && \
    #
    # Extract tarball
    #
    echo "Extracting ROCm from ${TARBALL}" && \
    mkdir -p rocm-${ROCM_VERSION} && \
    tar xzf ${TARBALL} -C rocm-${ROCM_VERSION} && \
    rm ${TARBALL} && \
    #
    # Link ROCm version
    #
    echo "${ROCM_VERSION}" > /opt/rocm_version.txt && \
    ln -s /opt/vllm-build/rocm-${ROCM_VERSION} /opt/rocm-current


ENV ROCM_PATH=/opt/rocm-current
ENV LD_LIBRARY_PATH=$ROCM_PATH/lib
ENV DEVICE_LIB_PATH=$ROCM_PATH/llvm/amdgcn/bitcode
ENV HIP_DEVICE_LIB_PATH=$ROCM_PATH/llvm/amdgcn/bitcode
ENV PYTORCH_ROCM_ARCH="gfx1151"
ENV CUDA_HOME=/opt/rocm-current
ENV VLLM_TORCH_COMPILE_LEVEL=0

RUN --mount=type=cache,target=/root/.cache/git \
    echo "Cloning vllm repository..." && \
    git clone https://github.com/vllm-project/vllm.git

WORKDIR /opt/vllm-build/vllm

RUN sed -i '/from \.version import __version__/a import amdsmi' vllm/__init__.py

RUN --mount=type=cache,target=/root/.cache/uv \
    echo "Building vllm..." && \
    export ROCM_PATH=/opt/rocm-current && \
    export LD_LIBRARY_PATH=/opt/rocm-current/lib && \
    export DEVICE_LIB_PATH=/opt/rocm-current/llvm/amdgcn/bitcode && \
    export HIP_DEVICE_LIB_PATH=/opt/rocm-current/llvm/amdgcn/bitcode && \
    export HIP_VISIBLE_DEVICES=-1 && \
    export ROCR_VISIBLE_DEVICES=-1 && \
    export VLLM_TARGET_DEVICE=rocm && \
    export CMAKE_PREFIX_PATH=$(python -c "import torch; print(torch.utils.cmake_prefix_path)") && \
    echo "CMAKE_PREFIX_PATH set to: $CMAKE_PREFIX_PATH" && \
    find $VIRTUAL_ENV -name "TorchConfig.cmake" -o -name "torch-config.cmake" && \
    uv pip uninstall amdsmi && \
    uv pip install "numpy<2" && \
    python use_existing_torch.py && \
    uv pip install --upgrade numba scipy huggingface-hub[cli,hf_transfer] setuptools_scm && \
    uv pip install -r requirements/rocm.txt && \
    python setup.py develop && \
    uv pip install ${ROCM_PATH}/share/amd_smi && \
    echo "vllm build complete."

RUN --mount=type=cache,target=/root/.cache/git \
    echo "Cloning flash-attention repository..." && \
    cd /opt/vllm-build && \
    git clone https://github.com/ROCm/flash-attention.git && \
    cd flash-attention && \
    git checkout main_perf

WORKDIR /opt/vllm-build/flash-attention

RUN echo "Patching flash-attention for ROCm..." && \
    sed -i '/from wheel.bdist_wheel import bdist_wheel/a import amdsmi' setup.py && \
    sed -i '1i import amdsmi' flash_attn/__init__.py && \
    echo "Verifying patch applied:" && \
    head -3 flash_attn/__init__.py

ENV FLASH_ATTENTION_TRITON_AMD_ENABLE="TRUE"
RUN echo "Installing flash-attention with ROCm support..." && \
    python setup.py develop
