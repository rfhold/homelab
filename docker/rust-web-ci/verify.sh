#!/bin/sh
set -eu

[ "$(rustc --version | cut -d ' ' -f 2)" = 1.96.0 ]
[ "$(cargo --version | cut -d ' ' -f 2)" = 1.96.0 ]
[ "$(node --version)" = v24.18.0 ]
[ "$(pnpm --version)" = 11.5.0 ]
[ "$(wasm-bindgen --version)" = 'wasm-bindgen 0.2.122' ]
[ "$CARGO_HOME" = /usr/local/cargo ]
[ "$RUSTUP_HOME" = /usr/local/rustup ]
[ "$PNPM_HOME" = /pnpm ]
[ "$(id -u)" = 0 ]
. /etc/os-release
[ "$VERSION_CODENAME" = bookworm ]
rustup target list --installed | grep -Fx wasm32-unknown-unknown
rustup component list --installed | grep '^clippy-'
rustup component list --installed | grep '^rustfmt-'
cargo clippy --version
cargo fmt --version
git --version
pkg-config --version
cc --version
[ -s /etc/ssl/certs/ca-certificates.crt ]

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
cd "$work"
export CARGO_NET_OFFLINE=true
export CARGO_TARGET_DIR="$work/target"
mkdir src
cat > Cargo.toml <<'EOF'
[package]
name = "rust-web-ci-contract"
version = "0.0.0"
edition = "2024"
EOF
cat > src/main.rs <<'EOF'
fn main() {
    println!("rust-web-ci");
}
EOF
cargo build --offline
[ "$(./target/debug/rust-web-ci-contract)" = rust-web-ci ]
cargo clippy --offline -- -D warnings
cargo fmt --check

cat > add.rs <<'EOF'
#[unsafe(no_mangle)]
pub extern "C" fn add(left: u32, right: u32) -> u32 {
    left + right
}
EOF
rustc --edition=2024 --target wasm32-unknown-unknown --crate-type cdylib add.rs -o add.wasm
wasm-bindgen --target web --out-dir glue --out-name add /opt/rust-web-ci/fixture.wasm
[ -s glue/add_bg.wasm ]
[ -s glue/add.d.ts ]
cp glue/add.js glue/add.mjs
node --input-type=module <<'EOF'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { add, initSync } from './glue/add.mjs';
initSync({ module: readFileSync('./glue/add_bg.wasm') });
assert.equal(add(20, 22), 42);
EOF

printf '%s\n' 'rust-web-ci contract verified'
