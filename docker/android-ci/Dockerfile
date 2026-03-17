# syntax=docker/dockerfile:1

FROM cimg/android:2026.02

ENV ANDROID_HOME=/home/circleci/android-sdk
ENV NDK_VERSION=29.0.13846066
ENV NDK_HOME=${ANDROID_HOME}/ndk/${NDK_VERSION}
ENV RUST_VERSION=1.93
ENV BUN_VERSION=1.3
ENV CARGO_HOME=/home/circleci/.cargo
ENV BUN_INSTALL=/home/circleci/.bun
ENV GRADLE_USER_HOME=/home/circleci/.gradle
ENV PATH=${CARGO_HOME}/bin:${BUN_INSTALL}/bin:${ANDROID_HOME}/build-tools/35.0.0:${PATH}

RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true && \
    sdkmanager "ndk;${NDK_VERSION}" "build-tools;35.0.0"

RUN --mount=type=cache,uid=1001,gid=1001,target=/home/circleci/.cargo/registry \
    --mount=type=cache,uid=1001,gid=1001,target=/home/circleci/.cargo/git \
    curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain ${RUST_VERSION} && \
    rustup target add \
      aarch64-linux-android \
      armv7-linux-androideabi \
      i686-linux-android \
      x86_64-linux-android

RUN printf '[source.crates-io]\nreplace-with = "homelab"\n\n[source.homelab]\nregistry = "sparse+https://mirrors.holdenitdown.net/cargo/"\n' \
    > ${CARGO_HOME}/config.toml

RUN curl -fsSL https://bun.sh/install | BUN_VERSION=${BUN_VERSION} bash
