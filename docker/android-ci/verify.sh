#!/bin/sh
set -eu

test "$(rustc --version | cut -d ' ' -f 2)" = "${RUST_VERSION}"
test "$(cargo --version | cut -d ' ' -f 2)" = "${RUST_VERSION}"
components=$(rustup component list --toolchain "${RUST_VERSION}" --installed)
printf '%s\n' "$components" | grep -E '^clippy-'
printf '%s\n' "$components" | grep -E '^rustfmt-'
cargo clippy --version
cargo fmt --version
targets=$(rustup target list --toolchain "${RUST_VERSION}" --installed)
for target in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android; do
    printf '%s\n' "$targets" | grep -Fx "$target"
done
packages=$(sdkmanager --list_installed)
printf '%s\n' "$packages" | grep -F 'build-tools;35.0.0'
printf '%s\n' "$packages" | grep -F "ndk;${NDK_VERSION}"
bun --version
