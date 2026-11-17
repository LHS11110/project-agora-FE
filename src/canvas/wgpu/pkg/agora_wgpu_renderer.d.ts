/* tslint:disable */
/* eslint-disable */
export class WgpuCanvasRenderer {
  private constructor();
  free(): void;
  adapter_name(): string;
  backend_kind(): string;
  render_frame(camera_x: number, camera_y: number, camera_scale: number, viewport_width: number, viewport_height: number): boolean;
  update_scene(instance_words: Uint32Array, batch_tex_ids: Uint32Array, batch_starts: Uint32Array, batch_counts: Uint32Array): void;
  remove_texture(tex_id: number): void;
  upload_canvas_texture(tex_id: number, source: HTMLCanvasElement, width: number, height: number): boolean;
  width(): number;
  static create(canvas: HTMLCanvasElement, width: number, height: number, prefer_webgl: boolean): Promise<WgpuCanvasRenderer>;
  height(): number;
  resize(width: number, height: number): void;
  destroy(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wgpucanvasrenderer_free: (a: number, b: number) => void;
  readonly wgpucanvasrenderer_adapter_name: (a: number) => [number, number];
  readonly wgpucanvasrenderer_backend_kind: (a: number) => [number, number];
  readonly wgpucanvasrenderer_create: (a: any, b: number, c: number, d: number) => any;
  readonly wgpucanvasrenderer_destroy: (a: number) => void;
  readonly wgpucanvasrenderer_height: (a: number) => number;
  readonly wgpucanvasrenderer_remove_texture: (a: number, b: number) => void;
  readonly wgpucanvasrenderer_render_frame: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly wgpucanvasrenderer_resize: (a: number, b: number, c: number) => void;
  readonly wgpucanvasrenderer_update_scene: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly wgpucanvasrenderer_upload_canvas_texture: (a: number, b: number, c: any, d: number, e: number) => number;
  readonly wgpucanvasrenderer_width: (a: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_5: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly closure36_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure377_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure1473_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
