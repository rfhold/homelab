FROM docker.io/library/node:24.18.0-bookworm-slim AS node
FROM docker.io/library/rust:1.96.0-slim-bookworm AS toolchain

ARG TARGETARCH

USER root

COPY --from=node /usr/local /usr/local

ENV CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:/usr/local/cargo/bin:/usr/local/bin:$PATH \
    npm_config_registry=https://mirrors.holdenitdown.net/npm/

LABEL org.opencontainers.image.version="bw-r1.96.0-n24.18.0-p11.5.0-w0.2.122-v1" \
      org.opencontainers.image.source="https://git.holdenitdown.net/rfhold/homelab"

RUN sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      build-essential \
      ca-certificates \
      git \
      pkg-config && \
    rm -rf /var/lib/apt/lists/*

RUN printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"\n' \
      > /usr/local/cargo/config.toml && \
    npm install --global pnpm@11.5.0

RUN rustup component add clippy rustfmt && \
    rustup target add wasm32-unknown-unknown

RUN --mount=type=cache,id=rust-web-ci-${TARGETARCH}-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=rust-web-ci-${TARGETARCH}-cargo-git,target=/usr/local/cargo/git \
    cargo install --locked wasm-bindgen-cli --version 0.2.122

FROM toolchain AS fixture-build

ARG TARGETARCH

COPY fixture /tmp/rust-web-ci-fixture
RUN --mount=type=cache,id=rust-web-ci-${TARGETARCH}-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=rust-web-ci-${TARGETARCH}-cargo-git,target=/usr/local/cargo/git \
    CARGO_TARGET_DIR=/tmp/rust-web-ci-fixture-target \
      cargo build --locked --release --target wasm32-unknown-unknown \
        --manifest-path /tmp/rust-web-ci-fixture/Cargo.toml && \
    install -D /tmp/rust-web-ci-fixture-target/wasm32-unknown-unknown/release/rust_web_ci_wasm_fixture.wasm \
      /opt/rust-web-ci/fixture.wasm

FROM toolchain

COPY --from=fixture-build /opt/rust-web-ci/fixture.wasm /opt/rust-web-ci/fixture.wasm
COPY verify.sh /usr/local/bin/rust-web-ci-verify
RUN chmod 0755 /usr/local/bin/rust-web-ci-verify && rust-web-ci-verify

WORKDIR /workspace
