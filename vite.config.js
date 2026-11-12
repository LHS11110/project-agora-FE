import { thirdPartyNotices } from './build/thirdPartyNotices.js';
import { localPdfAssets } from './build/pdfAssets.js';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, mkdirSync, cpSync, copyFileSync, readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import { extname, resolve, sep } from 'node:path';

function manualChunk(id) {
  const monacoRoot = '/node_modules/monaco-editor/esm/vs/';
  const monacoIndex = id.indexOf(monacoRoot);
  if (monacoIndex >= 0) {
    const parts = id.slice(monacoIndex + monacoRoot.length).split('/');
    const [area, section, feature, detail] = parts;
    if (area === 'editor') {
      if (section === 'contrib') {
        if (['snippet', 'suggest', 'inlineCompletions', 'hover', 'colorPicker', 'inlayHints', 'stickyScroll'].includes(feature)) return 'monaco-editor-completion-suite';
        return `monaco-editor-contrib-${feature || 'core'}`;
      }
      if (section === 'common') return ['model', 'services'].includes(feature) ? 'monaco-editor-common-model-services' : `monaco-editor-common-${feature || 'core'}`;
      if (section === 'browser') return ['services', 'editorExtensions.js'].includes(feature) ? 'monaco-editor-browser-services' : `monaco-editor-browser-${feature || 'core'}`;
      if (section === 'standalone') return `monaco-editor-standalone-${feature || 'core'}`;
      return `monaco-editor-${section || 'core'}`;
    }
    if (area === 'base') {
      if (section === 'browser' && feature === 'ui' && ['iconLabel', 'highlightedlabel'].includes(detail)) return 'monaco-base-browser-ui-labels';
      if (section === 'browser' && feature === 'ui') return `monaco-base-browser-ui-${detail || 'core'}`;
      if (section === 'browser') return `monaco-base-browser-${feature || 'core'}`;
      if (section === 'common') return `monaco-base-common-${feature || 'core'}`;
      return `monaco-base-${section || 'core'}`;
    }
    if (area === 'platform') {
      if (['actions', 'contextview'].includes(section)) return 'monaco-platform-actions-context';
      if (['opener', 'hover', 'markdown'].includes(section)) return 'monaco-platform-markdown-hover';
      return `monaco-platform-${section || 'core'}`;
    }
    if (area === 'features') return `monaco-features-${section || 'core'}`;
  }
}

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
    minVersion: 'TLSv1.3',
  } : undefined;
  const agent = command === 'serve' ? new Agent({ minVersion: 'TLSv1.3', ca: readFileSync(env.SERVICE_TLS_CA || resolve(tlsRoot, 'ca.pem')) }) : undefined;
  return {
    // Dynamic language modules must share the editor registry during development.
    optimizeDeps: { exclude: ['monaco-editor'] },
    plugins: [react(), localMathJaxAssets(), localPdfAssets(), thirdPartyNotices()],
    // Vite checks pre-compression bytes; the remaining 553 kB Monaco service
    // chunk is lazy-loaded with the editor and compresses to about 145 kB.
    // Keep the warning tight so materially larger chunks still trigger it.
    build: { chunkSizeWarningLimit: 600, rollupOptions: { output: { manualChunks: manualChunk } } },
    server: { https, host: '0.0.0.0', allowedHosts: (env.VITE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean), proxy: { '/api': { target: apiTarget, agent, secure: true, changeOrigin: true, ws: true } } },
    preview: { https },
  };
});
