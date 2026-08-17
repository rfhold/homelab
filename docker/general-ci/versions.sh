#!/bin/sh
set -eux

rustc --version | grep -Eq '^rustc 1\.96\.0 '
cargo --version | grep -Eq '^cargo 1\.96\.0 '
rustfmt --version | grep -Eq '^rustfmt 1\.9\.0-'
cargo clippy --version | grep -Eq '^clippy 0\.1\.96 '
rustup target list --installed | grep -Fxq wasm32-unknown-unknown
test "$(wasm-bindgen --version)" = "wasm-bindgen 0.2.122"
test "$(node --version)" = "v24.18.0"
test "$(pnpm --version)" = "11.5.0"
test "$(bun --version)" = "1.3.5"
test "$(python --version)" = "Python 3.13.11"
test "$(python3 --version)" = "Python 3.13.11"
test "$(python -c 'import platform; print(platform.python_implementation())')" = "CPython"
uv --version | grep -Eq '^uv 0\.11\.15( \([^)]*\))?$'
uvx --version | grep -Eq '^uvx 0\.11\.15( \([^)]*\))?$'
go version | grep -Eq '^go version go1\.26\.1 linux/(amd64|arm64)$'
staticcheck -version | grep -Fq '0.7.0'
test "$(buf --version)" = "1.47.2"
test "$(pulumi version)" = "v3.253.0"
