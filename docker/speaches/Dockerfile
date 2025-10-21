ARG SPEACHES_VERSION=0.8.3
ARG CUDA_VERSION=12.6.3
ARG CTRANSLATE2_VERSION=4.6.0
ARG ONNXRUNTIME_VERSION=1.20.1

FROM nvidia/cuda:${CUDA_VERSION}-cudnn-devel-ubuntu22.04 AS builder

ARG CTRANSLATE2_VERSION
ARG ONNXRUNTIME_VERSION
ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git \
        wget \
        ca-certificates \
        software-properties-common \
        gnupg && \
    rm -rf /var/lib/apt/lists/* && \
    wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /usr/share/keyrings/kitware-archive-keyring.gpg >/dev/null && \
    echo 'deb [signed-by=/usr/share/keyrings/kitware-archive-keyring.gpg] https://apt.kitware.com/ubuntu/ jammy main' | tee /etc/apt/sources.list.d/kitware.list >/dev/null && \
    apt-get update && \
    apt-get install -y --no-install-recommends cmake && \
    cmake --version && \
    rm -rf /var/lib/apt/lists/* && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.10-dev \
        python3.12 \
        python3.12-dev \
        python3.12-venv \
        python3-pip && \
    python3.12 -m ensurepip --upgrade && \
    python3.12 -m pip install --upgrade pip setuptools wheel numpy && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN git clone --depth 1 --branch v${CTRANSLATE2_VERSION} https://github.com/OpenNMT/CTranslate2.git && \
    cd CTranslate2 && \
    git submodule update --init --recursive

WORKDIR /build/CTranslate2

RUN mkdir build && \
    cd build && \
    cmake -DCMAKE_INSTALL_PREFIX=/opt/ctranslate2 \
          -DCMAKE_BUILD_TYPE=Release \
          -DWITH_CUDA=ON \
          -DCUDA_DYNAMIC_LOADING=OFF \
          -DCUDA_ARCH_LIST="Common" \
          -DWITH_CUDNN=ON \
          -DWITH_MKL=OFF \
          -DOPENMP_RUNTIME=COMP \
          -DCMAKE_CUDA_FLAGS="-cudart shared" \
          .. && \
    make -j$(nproc) && \
    make install

WORKDIR /build/CTranslate2/python

RUN python3.12 -m pip install pybind11 && \
    python3.12 setup.py build_ext --include-dirs=/opt/ctranslate2/include --library-dirs=/opt/ctranslate2/lib --rpath=/opt/ctranslate2/lib bdist_wheel && \
    mkdir -p /wheels && cp dist/*.whl /wheels/

WORKDIR /build

RUN git clone --depth 1 --branch v${ONNXRUNTIME_VERSION} https://github.com/microsoft/onnxruntime.git && \
    cd onnxruntime && \
    git submodule update --init --recursive

WORKDIR /build/onnxruntime

RUN sed -i 's/URL_HASH SHA1=.*//' cmake/external/eigen.cmake && \
    ./build.sh --config Release \
    --build_shared_lib \
    --build_wheel \
    --use_cuda \
    --cuda_home /usr/local/cuda \
    --cudnn_home /usr/lib/aarch64-linux-gnu \
    --parallel 8 \
    --nvcc_threads 1 \
    --skip_tests \
    --allow_running_as_root \
    --cmake_extra_defines CMAKE_POLICY_VERSION_MINIMUM=3.5 && \
    cp build/Linux/Release/dist/*.whl /wheels/

FROM ghcr.io/speaches-ai/speaches:${SPEACHES_VERSION}-cuda-${CUDA_VERSION}

COPY --from=builder /opt/ctranslate2 /opt/ctranslate2
COPY --from=builder /wheels /wheels

ENV LD_LIBRARY_PATH="/opt/ctranslate2/lib:${LD_LIBRARY_PATH}"
ENV PATH="/opt/ctranslate2/bin:${PATH}"

RUN sed -i '/^override-dependencies = /d' /home/ubuntu/speaches/pyproject.toml && \
    uv pip uninstall ctranslate2 onnxruntime && \
    uv pip install --no-cache /wheels/*.whl && \
    uv pip install --force-reinstall --no-cache kokoro-onnx[gpu]
