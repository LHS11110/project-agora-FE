import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const paths=[
 'rust/agora-wgpu-renderer/Cargo.toml',
 'rust/agora-wgpu-renderer/Cargo.lock',
 'rust/agora-wgpu-renderer/src/lib.rs',
 'rust/agora-wgpu-renderer/src/shader.wgsl',
 'src/canvas/wgpu/pkg/agora_wgpu_renderer.js',
 'src/canvas/wgpu/pkg/agora_wgpu_renderer_bg.wasm',
];
const manifest='src/canvas/wgpu/pkg/artifacts.json';
const current=Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
if(process.argv.includes('--write'))writeFileSync(manifest,JSON.stringify(current,null,2)+'\n');
else {
 const expected=JSON.parse(readFileSync(manifest,'utf8'));
 for(const path of paths)if(current[path]!==expected[path])throw new Error(`Stale Rust WASM artifact: ${path}. Run npm run build:wasm.`);
 console.log('Rust WASM source/artifact hashes verified.');
}
