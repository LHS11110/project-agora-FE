import initWasm, { WgpuCanvasRenderer } from './pkg/agora_wgpu_renderer.js';
import wasmUrl from './pkg/agora_wgpu_renderer_bg.wasm?url';

let wasmReadyPromise = null;

export function ensureWgpuWasm() {
  if (!wasmReadyPromise) {
    wasmReadyPromise = initWasm({ module_or_path: wasmUrl }).catch(err => {
      wasmReadyPromise = null;
      throw err;
    });
  }
  return wasmReadyPromise;
}

export async function createWgpuRenderer(canvas, width, height, preferWebgl = true) {
  await ensureWgpuWasm();
  return WgpuCanvasRenderer.create(canvas, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), preferWebgl);
}

export { WgpuSceneBatcher } from './WgpuSceneBatcher.js';
