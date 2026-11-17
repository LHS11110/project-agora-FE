#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
# Install wasm32-unknown-unknown and wasm-bindgen-cli 0.2.100 beforehand.
[ "$(wasm-bindgen --version)" = "wasm-bindgen 0.2.100" ] || { echo "wasm-bindgen-cli 0.2.100 is required" >&2; exit 1; }
cargo build --manifest-path rust/agora-wgpu-renderer/Cargo.toml --target wasm32-unknown-unknown --release --locked
wasm-bindgen rust/agora-wgpu-renderer/target/wasm32-unknown-unknown/release/agora_wgpu_renderer.wasm --target web --out-dir src/canvas/wgpu/pkg --out-name agora_wgpu_renderer
node scripts/wgpu-artifacts.mjs --write
