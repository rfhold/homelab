FROM kyuz0/pytorch-therock-gfx1151-aotriton-builder:latest AS vllm-builder

RUN git clone --depth 1 https://github.com/vllm-project/vllm.git

RUN source .venv/bin/activate && \
    cd vllm && \
    uv pip install ninja cmake wheel pybind11 && \
    uv pip install --upgrade numba scipy huggingface-hub[cli] "numpy<2" && \
    python use_existing_torch.py && \
    sed -i '/amdsmi==/d' requirements/rocm-build.txt && \
    sed -i '/pytorch-triton-rocm/d' requirements/rocm-build.txt && \
    sed -i '/triton==/d' requirements/rocm-build.txt && \
    uv pip install -r requirements/rocm-build.txt

RUN cd vllm && \
    sed -i 's/gfx1200;gfx1201/gfx1151;gfx1200;gfx1201/' CMakeLists.txt && \
    sed -i '/torch == 2.8.0,/d' pyproject.toml && \
    sed -i 's/import torch/try:\n    import torch\n    from torch.utils.cpp_extension import CUDA_HOME, ROCM_HOME\n    TORCH_AVAILABLE = True\nexcept ImportError:\n    torch = None\n    CUDA_HOME = None\n    ROCM_HOME = None\n    TORCH_AVAILABLE = False/' setup.py && \
    sed -i 's/from torch.utils.cpp_extension import CUDA_HOME, ROCM_HOME/# Moved to try block above/' setup.py && \
    sed -i 's/torch.version.cuda is None/TORCH_AVAILABLE and torch.version.cuda is None/' setup.py && \
    sed -i 's/has_cuda = torch.version.cuda is not None/has_cuda = TORCH_AVAILABLE and torch.version.cuda is not None/' setup.py && \
    sed -i 's/torch.version.hip is not None/TORCH_AVAILABLE and torch.version.hip is not None/' setup.py && \
    sed -i 's/rocm_version = get_rocm_version() or torch.version.hip/rocm_version = get_rocm_version() or (torch.version.hip if TORCH_AVAILABLE else None)/' setup.py && \
    sed -i 's/cuda_major, cuda_minor = torch.version.cuda.split(".")/cuda_major, cuda_minor = torch.version.cuda.split(".") if TORCH_AVAILABLE else ("0", "0")/' setup.py

RUN cd vllm && \
    git checkout HEAD -- vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/is_rocm = False/is_rocm = False/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/logger.debug("Checking if ROCm platform is available.")/logger.debug("Checking if ROCm platform is available.")\n    \n    # Skip amdsmi check due to segfault issues - default to ROCm for AMD systems/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/try:\n        import amdsmi/try:\n        import torch/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/amdsmi.amdsmi_init()/# amdsmi disabled - using torch detection/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/try:\n            if len(amdsmi.amdsmi_get_processor_handles()) > 0:/if hasattr(torch, '\''version'\'') and hasattr(torch.version, '\''hip'\'') and torch.version.hip is not None:/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/is_rocm = True\n                logger.debug("Confirmed ROCm platform is available.")/is_rocm = True\n            logger.debug("ROCm platform detected via torch.version.hip")/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/else:\n                logger.debug("ROCm platform is not available because"\n                             " no GPU is found.")/else:\n            # Fallback: assume ROCm if we'\''re not CUDA and not other platforms\n            logger.debug("Defaulting to ROCm platform (amdsmi disabled due to segfault)")\n            is_rocm = True/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/finally:\n            amdsmi.amdsmi_shut_down()/finally:\n            # amdsmi disabled\n            pass/' vllm/platforms/__init__.py && \
    sed -i '/def rocm_platform_plugin/,/return "vllm.platforms.rocm.RocmPlatform" if is_rocm else None/s/logger.debug("ROCm platform is not available because: %s", str(e))/logger.debug("ROCm platform check failed: %s", str(e))\n        # Still default to ROCm as fallback\n        is_rocm = True/' vllm/platforms/__init__.py

RUN cd vllm && python - <<'PY'
from pathlib import Path
p = Path("vllm/platforms/rocm.py")
s = p.read_text()

if "def amdsmi_init" not in s:
    s += """

try:
    amdsmi
except Exception:
    amdsmi = None

if 'amdsmi_init' not in globals():
    def amdsmi_init(): return None
    def amdsmi_shut_down(): return None
"""

if "vllm_therock_rocm_get_device_name" not in s:
    s += r"""

def vllm_therock_rocm_get_device_name(self, device_id: int = 0):
    try:
        import torch
        return torch.cuda.get_device_name(device_id)
    except Exception:
        return "AMD-gfx1151"

try:
    RocmPlatform.get_device_name = vllm_therock_rocm_get_device_name
except Exception:
    pass
"""
p.write_text(s)
print("Patched", p)
PY


RUN source .venv/bin/activate && \
    cd vllm && \
    uv pip uninstall amdsmi || echo "amdsmi not installed" && \
    printf '#!/bin/bash\necho "gfx1151"\n' > /usr/local/bin/amdgpu-arch && \
    chmod +x /usr/local/bin/amdgpu-arch && \
    printf '#!/bin/bash\necho "gfx1151"\n' > /usr/bin/amdgpu-arch && \
    chmod +x /usr/bin/amdgpu-arch && \
    printf '#!/bin/bash\necho "gfx1151"\n' > /bin/amdgpu-arch && \
    chmod +x /bin/amdgpu-arch && \
    export PYTORCH_ROCM_ARCH="gfx1151" && \
    export VLLM_VERSION_OVERRIDE="0.11.0" && \
    /torch-therock/.venv/bin/python -c "import torch; print('torch==' + torch.__version__)" > /tmp/constraints.txt && \
    /torch-therock/.venv/bin/python -c "import triton; print('pytorch-triton-rocm==' + getattr(triton, '__version__', 'unknown'))" >> /tmp/constraints.txt || echo "# triton version not found" >> /tmp/constraints.txt && \
    TORCH_CMAKE_PATH=$(/torch-therock/.venv/bin/python -c "import torch; print(torch.utils.cmake_prefix_path)") && \
    VLLM_TARGET_DEVICE=rocm CMAKE_PREFIX_PATH="$TORCH_CMAKE_PATH" Torch_DIR="$TORCH_CMAKE_PATH/Torch" CMAKE_ARGS="-DGPU_TARGETS=gfx1151 -DHIP_TARGETS=gfx1151 -DAMDGPU_TARGETS=gfx1151" /torch-therock/.venv/bin/pip install . --no-build-isolation --constraint /tmp/constraints.txt

FROM archlinux:latest

RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm ca-certificates gcc make cmake ninja git && \
    pacman -Scc --noconfirm && \
    git clone --depth 1 https://github.com/pyenv/pyenv.git /opt/pyenv && \
    export PYENV_ROOT=/opt/pyenv && \
    export PATH=$PYENV_ROOT/bin:$PATH && \
    eval "$(pyenv init -)" && \
    pyenv install 3.12.9 && \
    pyenv global 3.12.9

COPY --from=vllm-builder /opt/pyenv /opt/pyenv
COPY --from=vllm-builder /torch-therock/.venv /torch-therock/.venv
COPY --from=vllm-builder /torch-therock/*.sh /torch-therock/

ENV PYENV_ROOT=/opt/pyenv
ENV PYENV_VERSION=3.12.9
ENV PATH="/opt/pyenv/versions/3.12.9/bin:/torch-therock/.venv/bin:$PATH"
ENV PYTORCH_ROCM_ARCH=gfx1151

WORKDIR /torch-therock

RUN /torch-therock/.venv/bin/python -c "import torch; print('PyTorch version:', torch.__version__)" && \
    /torch-therock/.venv/bin/python -c "import vllm; print('vLLM version:', vllm.__version__)"

RUN chmod -R a+rwX /torch-therock

COPY scripts/vllm-env.sh /etc/profile.d/vllm-env.sh
COPY scripts/vllm-banner.sh /etc/profile.d/vllm-banner.sh
RUN chmod 644 /etc/profile.d/vllm-env.sh /etc/profile.d/vllm-banner.sh

COPY scripts/start-vllm.sh /usr/local/bin/start-vllm
RUN chmod 755 /usr/local/bin/start-vllm

CMD ["bash", "-c", "source .venv/bin/activate && bash"]
