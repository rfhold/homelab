# syntax=docker/dockerfile:1

FROM pulumi/pulumi-nodejs:3.215.0

RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*

ENV BUN_VERSION=1.3
RUN curl -fsSL https://bun.sh/install | BUN_VERSION=${BUN_VERSION} bash

ENV PATH="/root/.bun/bin:$PATH"
RUN printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /root/.bunfig.toml
