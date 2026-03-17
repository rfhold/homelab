# syntax=docker/dockerfile:1

FROM docker.io/library/rust:1.93-trixie

RUN echo 'Acquire::http::Proxy "http://apt-mirrors.holdenitdown.net";' > /etc/apt/apt.conf.d/00proxy

RUN apt-get update -qq && apt-get install -y -qq \
    libasound2-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    libpipewire-0.3-dev \
    libclang-dev \
  && rm -rf /var/lib/apt/lists/*

RUN printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/"\n' \
    > /usr/local/cargo/config.toml

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    rustup component add rustfmt clippy
