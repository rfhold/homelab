FROM rocm/vllm-dev:base_custom_ROCm-7.1_base_image_20251031

ENV ROCM_HOME=/opt/rocm-7.1.0 \
    HIP_PATH=/opt/rocm-7.1.0 \
    ROCM_PATH=/opt/rocm-7.1.0 \
    HIP_DEVICE_LIB_PATH=/opt/rocm-7.1.0/amdgcn/bitcode \
    CMAKE_HIP_ARCHITECTURES=gfx1151 \
    PYTORCH_ROCM_ARCH=gfx1151

WORKDIR /workspace

RUN git clone https://github.com/vllm-project/vllm.git && \
    cd vllm

WORKDIR /workspace/vllm

RUN python3 use_existing_torch.py

RUN pip install -r requirements/rocm.txt

ENV VLLM_TARGET_DEVICE=rocm \
    VLLM_GPU_ARCHES=gfx1151

RUN pip install --no-build-isolation -e .

WORKDIR /workspace

CMD ["vllm", "serve", "--help"]
