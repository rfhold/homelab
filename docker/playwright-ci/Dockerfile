FROM docker.io/library/node:24.18.0-bookworm-slim AS node
FROM docker.io/library/rust:1.96.0-slim-bookworm

ARG TARGETARCH
RUN test "$TARGETARCH" = amd64

COPY --from=node /usr/local /usr/local

ENV CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PATH=/usr/local/cargo/bin:/usr/local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    npm_config_registry=https://mirrors.holdenitdown.net/npm/

LABEL org.opencontainers.image.version="bw-pw1.63.0-r1.96.0-n24.18.0-p11.5.0-v1-amd64" \
      org.opencontainers.image.source="https://git.holdenitdown.net/rfhold/homelab"

RUN sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      build-essential ca-certificates git pkg-config && \
    rm -rf /var/lib/apt/lists/*

RUN rustup component add clippy rustfmt && \
    npm install --global pnpm@11.5.0 && \
    npm install --prefix /opt/playwright --save-exact --ignore-scripts playwright-core@1.63.0 && \
    node /opt/playwright/node_modules/playwright-core/cli.js install --with-deps --no-shell chromium && \
    rm -rf /var/lib/apt/lists/* /root/.npm && \
    useradd --create-home --uid 10001 browser && \
    chmod -R a+rX /ms-playwright /opt/playwright && \
    chown -R 10001:10001 /usr/local/cargo

RUN printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"\n' \
      > /usr/local/cargo/config.toml

COPY verify.mjs /opt/playwright/verify.mjs
RUN node /opt/playwright/verify.mjs --write-contract

USER 10001:10001
ENV HOME=/home/browser
WORKDIR /workspace
ENTRYPOINT []
CMD ["node", "/opt/playwright/verify.mjs"]
