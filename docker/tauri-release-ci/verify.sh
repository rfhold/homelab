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
for target in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android wasm32-unknown-unknown x86_64-unknown-linux-gnu; do
    printf '%s\n' "$targets" | grep -Fx "$target"
done
test "$(cargo tauri --version)" = "tauri-cli ${TAURI_CLI_VERSION}"
test "$(wasm-bindgen --version)" = "wasm-bindgen ${WASM_BINDGEN_CLI_VERSION}"
test "$(pnpm --version)" = "${PNPM_VERSION}"
packages=$(sdkmanager --list_installed)
printf '%s\n' "$packages" | grep -F 'platforms;android-36'
printf '%s\n' "$packages" | grep -F 'build-tools;36.0.0'
printf '%s\n' "$packages" | grep -F "ndk;${NDK_VERSION}"
java -version 2>&1 | grep -E 'version "17[.]'
command -v xdg-open
command -v zipalign
command -v apksigner
pkg-config --exists alsa
pkg-config --modversion alsa
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT HUP INT TERM
cat > "$workdir/alsa.c" <<'EOF'
#include <alsa/asoundlib.h>
int main(void) {
    return snd_asoundlib_version() == 0;
}
EOF
cc $(pkg-config --cflags alsa) "$workdir/alsa.c" -o "$workdir/alsa" $(pkg-config --libs alsa)
"$workdir/alsa"
