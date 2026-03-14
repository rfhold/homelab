# syntax=docker/dockerfile:1

FROM golang:1.26-bookworm

RUN apt-get update -qq && apt-get install -y -qq libffi-dev && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go install honnef.co/go/tools/cmd/staticcheck@v0.7.0 && \
    go install github.com/bufbuild/buf/cmd/buf@v1.47.2
