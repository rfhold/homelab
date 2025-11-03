#!/usr/bin/env python3
import subprocess
import sys

result = subprocess.run(
    [sys.executable, "-c",
     "import torch.utils.cpp_extension as t; "
     "print(t.ROCM_HOME); "
     "print(' '.join(t._get_rocm_arch_flags()))"],
    capture_output=True,
    text=True
)

for line in result.stdout.strip().split('\n'):
    if not line.startswith('WARNING') and not line.startswith('The detected CUDA version'):
        print(line)
