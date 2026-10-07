import { createReadStream, existsSync, mkdirSync, cpSync, copyFileSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

export function localPdfAssets() {
  const source = resolve(process.cwd(), 'node_modules/pdfjs-dist');
  const folders = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  let outputRoot;
  return {
    name: 'local-pdf-assets',
    configResolved(config) { outputRoot = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/pdfjs/')) return next();
        const relative = decodeURIComponent(request.url.split('?')[0].slice(7));
        if (!folders.includes(relative.split('/')[0])) return next();
        const file = resolve(source, relative);
        if (!file.startsWith(`${source}${sep}`) || !existsSync(file)) return next();
        response.setHeader('Content-Type', extname(file) === '.wasm' ? 'application/wasm' : 'application/octet-stream');
        createReadStream(file).on('error', next).pipe(response);
      });
    },
    closeBundle() {
      const target = resolve(outputRoot, 'pdfjs');
      mkdirSync(target, { recursive: true });
      for (const folder of folders) cpSync(resolve(source, folder), resolve(target, folder), { recursive: true });
      mkdirSync(resolve(outputRoot, 'licenses'), { recursive: true });
      copyFileSync(resolve(source, 'LICENSE'), resolve(outputRoot, 'licenses/pdfjs-dist.txt'));
    },
  };
}
