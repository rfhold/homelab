ARG SPEACHES_VERSION=0.8.3
ARG CUDA_VERSION=12.6.3
ARG CTRANSLATE2_VERSION=4.6.0

FROM nvidia/cuda:${CUDA_VERSION}-cudnn-devel-ubuntu22.04 AS ctranslate2-builder

ARG CTRANSLATE2_VERSION
ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        git \
        wget \
        ca-certificates \
        software-properties-common && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.12 \
        python3.12-dev \
        python3.12-venv \
        python3-pip && \
    python3.12 -m ensurepip --upgrade && \
    python3.12 -m pip install --upgrade pip setuptools wheel && \
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

FROM ghcr.io/speaches-ai/speaches:${SPEACHES_VERSION}-cuda-${CUDA_VERSION}

COPY --from=ctranslate2-builder /opt/ctranslate2 /opt/ctranslate2
COPY --from=ctranslate2-builder /wheels /wheels

ENV LD_LIBRARY_PATH="/opt/ctranslate2/lib:${LD_LIBRARY_PATH}"
ENV PATH="/opt/ctranslate2/bin:${PATH}"

RUN uv pip uninstall ctranslate2 && \
    uv pip install --no-cache /wheels/*.whl
