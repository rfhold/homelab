#!/bin/bash
set -e

echo "=== GPU Detection Test ==="

echo -e "\n1. ROCm System Management Interface:"
if command -v rocm-smi &> /dev/null; then
    rocm-smi
else
    echo "rocm-smi not found"
    exit 1
fi

echo -e "\n2. ROCm Info (GPU Architecture):"
if command -v rocminfo &> /dev/null; then
    rocminfo | grep -E "Name:|Marketing Name:|gfx"
else
    echo "rocminfo not found"
    exit 1
fi

echo -e "\n3. PyTorch ROCm Detection:"
python3 -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available (ROCm): {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'Device count: {torch.cuda.device_count()}')
    print(f'Device name: {torch.cuda.get_device_name(0)}')
    print(f'Device capability: {torch.cuda.get_device_capability(0)}')
    tensor = torch.randn(100, 100).cuda()
    result = torch.matmul(tensor, tensor)
    print(f'Simple computation test: PASSED')
else:
    print('ERROR: PyTorch cannot detect ROCm device')
    exit(1)
"

echo -e "\n4. Flash Attention Test:"
python3 -c "
try:
    import flash_attn
    print(f'Flash Attention version: {flash_attn.__version__}')
    print('Flash Attention import: PASSED')
except ImportError as e:
    print(f'Flash Attention import: FAILED - {e}')
"

echo -e "\n=== All Tests Completed ==="
