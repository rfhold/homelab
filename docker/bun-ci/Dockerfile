# syntax=docker/dockerfile:1

FROM docker.io/oven/bun:1.3

USER root

RUN touch /etc/apt/sources.list && \
    sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    git \
    openssh-client \
  && rm -rf /var/lib/apt/lists/*

RUN printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /root/.bunfig.toml && \
    mkdir -p /home/bun && \
    printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /home/bun/.bunfig.toml && \
    chown bun:bun /home/bun/.bunfig.toml
