FROM rocm/vllm-dev:base_custom_ROCm-7.1_base_image_20251031

ENV ROCM_HOME=/opt/rocm \
    HIP_PATH=/opt/rocm \
    ROCM_PATH=/opt/rocm \
    HIP_DEVICE_LIB_PATH=/opt/rocm/amdgcn/bitcode \
    PYTORCH_ROCM_ARCH=gfx1151

WORKDIR /workspace

RUN git clone https://github.com/vllm-project/vllm.git && \
    cd vllm

WORKDIR /workspace/vllm

COPY patches/amdsmi.patch .
COPY patches/get_hip_flags.py cmake/
COPY patches/utils.cmake.patch .

RUN patch -p1 < amdsmi.patch && \
    patch -p1 < utils.cmake.patch

RUN python3 use_existing_torch.py

RUN pip install -r requirements-rocm.txt

ENV VLLM_TARGET_DEVICE=rocm \
    VLLM_GPU_ARCHES=gfx1151

RUN python3 setup.py build_ext --inplace

RUN pip install -e .

WORKDIR /workspace

CMD ["vllm", "serve", "--help"]
