# syntax=docker/dockerfile:1

FROM cimg/android:2026.02-node

USER root

ENV ANDROID_HOME=/home/circleci/android-sdk
ENV ANDROID_SDK_ROOT=/home/circleci/android-sdk
ENV NDK_VERSION=29.0.14206865
ENV NDK_HOME=/home/circleci/android-sdk/ndk/29.0.14206865
ENV CARGO_HOME=/home/circleci/.cargo
ENV RUSTUP_HOME=/home/circleci/.rustup
ENV RUST_VERSION=1.96.0
ENV TAURI_CLI_VERSION=2.10.1
ENV WASM_BINDGEN_CLI_VERSION=0.2.122
ENV PNPM_VERSION=11.5.0
ENV PATH=/home/circleci/.cargo/bin:/home/circleci/android-sdk/build-tools/36.0.0:${PATH}

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    desktop-file-utils \
    file \
    git \
    jq \
    libayatana-appindicator3-dev \
    libfuse2 \
    libgtk-3-dev \
    libjavascriptcoregtk-4.1-dev \
    librsvg2-dev \
    libsoup-3.0-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    openjdk-17-jdk-headless \
    openssh-client \
    patchelf \
    squashfs-tools \
    unzip \
    xz-utils \
    zip \
  && rm -rf /var/lib/apt/lists/*

RUN yes | sdkmanager --licenses >/dev/null 2>&1 || true && \
    sdkmanager \
      "platforms;android-36" \
      "build-tools;36.0.0" \
      "ndk;${NDK_VERSION}"

RUN mkdir -p "${CARGO_HOME}" && \
    printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"\n' \
      > "${CARGO_HOME}/config.toml" && \
    npm config --global set registry https://mirrors.holdenitdown.net/npm/

RUN curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | \
      sh -s -- -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}" && \
    rustup target add \
      aarch64-linux-android \
      armv7-linux-androideabi \
      i686-linux-android \
      wasm32-unknown-unknown \
      x86_64-linux-android \
      x86_64-unknown-linux-gnu && \
    cargo install tauri-cli --version "${TAURI_CLI_VERSION}" --locked && \
    cargo install wasm-bindgen-cli --version "${WASM_BINDGEN_CLI_VERSION}" --locked && \
    npm install --global "pnpm@${PNPM_VERSION}"

RUN chown -R circleci:circleci "${CARGO_HOME}" "${RUSTUP_HOME}"

USER circleci

RUN rustc --version | grep -F "rustc ${RUST_VERSION}" && \
    cargo tauri --version | grep -F "tauri-cli ${TAURI_CLI_VERSION}" && \
    wasm-bindgen --version | grep -F "wasm-bindgen ${WASM_BINDGEN_CLI_VERSION}" && \
    test "$(pnpm --version)" = "${PNPM_VERSION}" && \
    sdkmanager --list_installed | grep -F "platforms;android-36" && \
    sdkmanager --list_installed | grep -F "build-tools;36.0.0" && \
    sdkmanager --list_installed | grep -F "ndk;${NDK_VERSION}" && \
    command -v zipalign && \
    command -v apksigner
