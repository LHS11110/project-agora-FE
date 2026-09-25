import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, mkdirSync, cpSync, copyFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

function localMathJaxAssets() {
  const source = resolve(process.cwd(), 'node_modules/mathjax');
  let outputRoot = resolve(process.cwd(), 'dist');
  const mimeTypes = {
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
  };
  return {
    name: 'local-mathjax-assets',
    configResolved(config) {
      outputRoot = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/mathjax/')) return next();
        const relative = decodeURIComponent(request.url.split('?')[0].slice('/mathjax/'.length));
        const file = resolve(source, relative);
        if (!file.startsWith(`${source}${sep}`) || !existsSync(file)) return next();
        response.setHeader('Content-Type', mimeTypes[extname(file)] || 'application/octet-stream');
        createReadStream(file).on('error', next).pipe(response);
      });
    },
    closeBundle() {
      if (!existsSync(source)) return;
      const output = resolve(outputRoot, 'mathjax');
      mkdirSync(output, { recursive: true });
      cpSync(source, output, { recursive: true, filter: (file) => !file.endsWith('.map') });
      const licenses = resolve(outputRoot, 'licenses');
      mkdirSync(licenses, { recursive: true });
      copyFileSync(resolve(process.cwd(), 'node_modules/pixi.js/LICENSE'), resolve(licenses, 'pixi.js.txt'));
      copyFileSync(resolve(process.cwd(), 'node_modules/@automerge/automerge/LICENSE'), resolve(licenses, 'automerge.txt'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080';
  return {
    plugins: [react(), localMathJaxAssets()],
    server: { host: '0.0.0.0', proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  };
});
