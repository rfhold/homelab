# syntax=docker/dockerfile:1

FROM docker.io/oven/bun:1.3

USER root

ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV RUST_VERSION=1.93
ENV PATH=${CARGO_HOME}/bin:${PATH}

RUN touch /etc/apt/sources.list && \
    sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    dbus-x11 \
    docker-cli \
    file \
    git \
    libasound2-dev \
    libayatana-appindicator3-dev \
    libclang-dev \
    libgtk-3-dev \
    libjavascriptcoregtk-4.1-dev \
    libpipewire-0.3-dev \
    librsvg2-dev \
    libsoup-3.0-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    openssh-client \
    webkit2gtk-driver \
    xauth \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain ${RUST_VERSION} && \
    ln -sf ${CARGO_HOME}/bin/cargo /usr/local/bin/cargo && \
    ln -sf ${CARGO_HOME}/bin/rustc /usr/local/bin/rustc

RUN mkdir -p ${CARGO_HOME} && \
    printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"\n' \
    > ${CARGO_HOME}/config.toml

RUN printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /root/.bunfig.toml && \
    mkdir -p /home/bun && \
    printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /home/bun/.bunfig.toml && \
    chown bun:bun /home/bun/.bunfig.toml
