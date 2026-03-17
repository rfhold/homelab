# syntax=docker/dockerfile:1

FROM docker.io/library/rust:1.93-trixie

RUN sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources

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
