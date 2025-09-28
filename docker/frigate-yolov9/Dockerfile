ARG FRIGATE_VERSION=0.16.1

# Build stage for YOLOv9 models
FROM python:3.11 AS yolov9-builder
RUN apt-get update && apt-get install --no-install-recommends -y libgl1 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.8.0 /uv /bin/

WORKDIR /yolov9
ADD https://github.com/WongKinYiu/yolov9.git .

RUN uv pip install --system -r requirements.txt
RUN uv pip install --system onnx==1.18.0 onnxruntime onnx-simplifier>=0.4.1

# Fix torch.load security issue
RUN sed -i "s/ckpt = torch.load(attempt_download(w), map_location='cpu')/ckpt = torch.load(attempt_download(w), map_location='cpu', weights_only=False)/g" models/experimental.py

# Download all model weights first (for better layer caching)
ADD https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-t-converted.pt yolov9-t.pt
ADD https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-s-converted.pt yolov9-s.pt
ADD https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-m-converted.pt yolov9-m.pt

# Export all model combinations
RUN python3 export.py --weights ./yolov9-t.pt --imgsz 320 --simplify --include onnx && \
    mv yolov9-t.onnx yolov9-t-320.onnx

RUN python3 export.py --weights ./yolov9-t.pt --imgsz 640 --simplify --include onnx && \
    mv yolov9-t.onnx yolov9-t-640.onnx

RUN python3 export.py --weights ./yolov9-s.pt --imgsz 320 --simplify --include onnx && \
    mv yolov9-s.onnx yolov9-s-320.onnx

RUN python3 export.py --weights ./yolov9-s.pt --imgsz 640 --simplify --include onnx && \
    mv yolov9-s.onnx yolov9-s-640.onnx

RUN python3 export.py --weights ./yolov9-m.pt --imgsz 320 --simplify --include onnx && \
    mv yolov9-m.onnx yolov9-m-320.onnx

RUN python3 export.py --weights ./yolov9-m.pt --imgsz 640 --simplify --include onnx && \
    mv yolov9-m.onnx yolov9-m-640.onnx

# Verify all models were created
RUN ls -la *.onnx

# Final stage with Frigate and YOLOv9 models
FROM ghcr.io/blakeblackshear/frigate:${FRIGATE_VERSION}

# Create models directory
RUN mkdir -p /models/yolov9

# Copy all YOLOv9 ONNX models
COPY --from=yolov9-builder /yolov9/yolov9-t-320.onnx /models/yolov9/
COPY --from=yolov9-builder /yolov9/yolov9-t-640.onnx /models/yolov9/
COPY --from=yolov9-builder /yolov9/yolov9-s-320.onnx /models/yolov9/
COPY --from=yolov9-builder /yolov9/yolov9-s-640.onnx /models/yolov9/
COPY --from=yolov9-builder /yolov9/yolov9-m-320.onnx /models/yolov9/
COPY --from=yolov9-builder /yolov9/yolov9-m-640.onnx /models/yolov9/

# Verify models are available
RUN ls -la /models/yolov9/

LABEL org.opencontainers.image.title="Frigate NVR with YOLOv9"
LABEL org.opencontainers.image.description="Frigate NVR with pre-built YOLOv9 ONNX models for object detection"
LABEL org.opencontainers.image.source="https://github.com/rfhold/homelab"