import { localPdfAssets } from './build/pdfAssets.js';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, mkdirSync, cpSync, copyFileSync, readFileSync } from 'node:fs';
import { Agent } from 'node:https';
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

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'https://localhost:8443';
  for (const [name, value, protocol] of [
    ['VITE_API_PROXY_TARGET', apiTarget, 'https:'],
    ['VITE_API_BASE_URL', env.VITE_API_BASE_URL, 'https:'],
    ['VITE_WS_BASE_URL', env.VITE_WS_BASE_URL, 'wss:'],
  ]) if (value && new URL(value).protocol !== protocol) throw new Error(`${name} requires ${protocol}`);
  const tlsRoot = resolve('.local-https/internal/frontend');
  const https = command === 'serve' ? {
    cert: readFileSync(env.SERVICE_TLS_CERT || resolve(tlsRoot, 'fullchain.pem')),
    key: readFileSync(env.SERVICE_TLS_KEY || resolve(tlsRoot, 'privkey.pem')),
    minVersion: 'TLSv1.2',
  } : undefined;
  const agent = command === 'serve' ? new Agent({ ca: readFileSync(env.SERVICE_TLS_CA || resolve(tlsRoot, 'ca.pem')) }) : undefined;
  return {
    plugins: [react(), localMathJaxAssets(), localPdfAssets()],
    server: { https, host: '0.0.0.0', allowedHosts: (env.VITE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean), proxy: { '/api': { target: apiTarget, agent, secure: true, changeOrigin: true } } },
    preview: { https },
  };
});
