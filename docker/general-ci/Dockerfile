# syntax=docker/dockerfile:1

FROM docker.io/library/node:24.18.0-bookworm-slim AS node
FROM docker.io/library/golang:1.26.1-bookworm AS go
FROM docker.io/library/rust:1.96.0-bookworm AS rust
FROM docker.io/library/python:3.13.11-slim-bookworm AS python
FROM ghcr.io/astral-sh/uv:0.11.15 AS uv
FROM docker.io/oven/bun:1.3.5

ARG PULUMI_VERSION=3.253.0

USER root

COPY --from=node /usr/local /usr/local
COPY --from=go /usr/local/go /usr/local/go
COPY --from=rust /usr/local/cargo /usr/local/cargo
COPY --from=rust /usr/local/rustup /usr/local/rustup
COPY --from=python /usr/local /usr/local
COPY --from=uv /uv /uvx /usr/local/bin/

ENV CARGO_HOME=/usr/local/cargo \
    GOPATH=/go \
    GOPROXY=https://mirrors.holdenitdown.net/go/|direct \
    PATH=/usr/local/cargo/bin:/usr/local/go/bin:/go/bin:/root/.pulumi/bin:$PATH \
    PIP_INDEX_URL=https://mirrors.holdenitdown.net/pypi/simple \
    RUSTUP_HOME=/usr/local/rustup \
    UV_DEFAULT_INDEX=https://mirrors.holdenitdown.net/pypi/simple

RUN sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    build-essential \
    ca-certificates \
    clang \
    cmake \
    curl \
    git \
    gnupg \
    jq \
    libbluetooth3 \
    libbz2-1.0 \
    libclang-dev \
    libcrypt1 \
    libdb5.3 \
    libexpat1 \
    libffi-dev \
    libgdbm-compat4 \
    libgdbm6 \
    liblzma5 \
    libncursesw6 \
    libreadline8 \
    libsqlite3-0 \
    libssl-dev \
    libuuid1 \
    openssh-client \
    pkg-config \
    protobuf-compiler \
    tzdata \
    unzip \
    xz-utils \
    zlib1g \
  && rm -rf /var/lib/apt/lists/*

RUN printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"\n' \
    > /usr/local/cargo/config.toml && \
    printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /root/.bunfig.toml && \
    npm config set registry https://mirrors.holdenitdown.net/npm/ && \
    npm install --global pnpm@11.5.0

RUN rustup component add clippy rustfmt && \
    rustup target add wasm32-unknown-unknown

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go install honnef.co/go/tools/cmd/staticcheck@v0.7.0 && \
    go install github.com/bufbuild/buf/cmd/buf@v1.47.2

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install --locked wasm-bindgen-cli --version 0.2.122

RUN curl -fsSL https://get.pulumi.com | sh -s -- --version "${PULUMI_VERSION}"

COPY versions.sh /usr/local/bin/general-ci-versions
RUN chmod 0755 /usr/local/bin/general-ci-versions && general-ci-versions

WORKDIR /workspace
