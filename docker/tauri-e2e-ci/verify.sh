#!/bin/sh
set -eu

test "$(rustc --version | cut -d ' ' -f 2)" = "${RUST_VERSION}"
test "$(cargo --version | cut -d ' ' -f 2)" = "${RUST_VERSION}"
components=$(rustup component list --toolchain "${RUST_VERSION}" --installed)
printf '%s\n' "$components" | grep -E '^clippy-'
printf '%s\n' "$components" | grep -E '^rustfmt-'
cargo clippy --version
cargo fmt --version
host=$(rustc -vV | sed -n 's/^host: //p')
targets=$(rustup target list --toolchain "${RUST_VERSION}" --installed)
printf '%s\n' "$targets" | grep -Fx "$host"
bun --version
docker --version
command -v Xvfb
command -v WebKitWebDriver
command -v dbus-run-session
