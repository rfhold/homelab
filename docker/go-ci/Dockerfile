# syntax=docker/dockerfile:1

FROM docker.io/library/golang:1.26-bookworm

RUN sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update -qq && apt-get install -y -qq libffi-dev && rm -rf /var/lib/apt/lists/*

ENV GOPROXY=https://mirrors.holdenitdown.net/go/,direct

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go install honnef.co/go/tools/cmd/staticcheck@v0.7.0 && \
    go install github.com/bufbuild/buf/cmd/buf@v1.47.2
