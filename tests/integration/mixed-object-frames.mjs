import assert from 'node:assert/strict';
const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5222';
const types = (process.env.OBJECT_TYPES || 'empty,pdf,image,code,drawing,matrix,table,notebook,youtube,mixed').split(',');
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist',
    ...(process.env.UNTHROTTLED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])],
});
const paths = Array.from({ length: 1400 }, (_, i) => `${i % 470} ${i % 590} m ${(i * 17) % 470} ${(i * 13) % 590} l S`).join('\n');
const pdfObjects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 600] /Resources << >> /Contents 4 0 R >>',
  `<< /Length ${paths.length} >>\nstream\n${paths}\nendstream`];
let pdf = '%PDF-1.4\n';
const offsets = [];
for (const [i, body] of pdfObjects.entries()) {
  offsets.push(pdf.length);
  pdf += `${i+1} 0 obj\n${body}\nendobj\n`;
}
const xref = pdf.length;
pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
try {
  for (const type of types) {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/api/canvases/1/pdfs/**', route => route.fulfill({ contentType: 'application/pdf', body: pdf }));
    await page.route('**/vi/dQw4w9WgXcQ/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#34295c"/></svg>' }));
    await page.goto(`${origin}/tests/browser/mixed-object-frames.html?type=${type}`);
    await page.waitForFunction(() => window.mixedFrameFixture);
    if (type === 'empty' && process.env.VERIFY_GRID) {
      const samples = await page.evaluate(async () => {
        const stage = document.querySelector('.canvas-stage');
        const grid = stage.querySelector('.canvas-grid-surface');
        const { setCamera } = window.mixedFrameFixture;
        const samples = [];
        for (const zoom of [0.35, 1, 4, 16]) {
          for (const x of [-137.25, 63.75]) {
            const y = x * -0.73;
            await new Promise(resolve => {
              stage.addEventListener('agora-camera', resolve, { once: true });
              setCamera({ x, y, scale: zoom });
            });
            const style = getComputedStyle(grid);
            const matrix = new DOMMatrixReadOnly(style.transform);
            const [tileX, tileY] = style.backgroundSize.split(' ').map(parseFloat);
            const [bgX, bgY] = style.backgroundPosition.split(' ').map(parseFloat);
            const fraction = (center, origin, spacing) => {
              const delta = (center - origin) / spacing;
              return Math.abs(delta - Math.round(delta));
            };
            const stageBounds = stage.getBoundingClientRect(), tileBounds = grid.getBoundingClientRect();
            samples.push({
              xError: fraction(matrix.e + (bgX + tileX / 2) * matrix.a, x, tileX * matrix.a),
              yError: fraction(matrix.f + (bgY + tileY / 2) * matrix.d, y, tileY * matrix.d),
              noFixedGrid: getComputedStyle(stage).backgroundImage === 'none',
              covered: tileBounds.left <= stageBounds.left + stage.clientLeft && tileBounds.right >= stageBounds.left + stage.clientLeft + stage.clientWidth
                && tileBounds.top <= stageBounds.top + stage.clientTop && tileBounds.bottom >= stageBounds.top + stage.clientTop + stage.clientHeight,
            });
          }
        }
        return samples;
      });
      assert.ok(samples.every(sample => sample.noFixedGrid && sample.covered && sample.xError < 0.001 && sample.yError < 0.001), JSON.stringify(samples));
    }
    if (type === 'pdf' || type === 'mixed') await page.locator('.pdf-document-actions').first().getByText('1 / 1', { exact: true }).waitFor();
    if (type === 'matrix' || type === 'mixed') await page.locator('mjx-container').first().waitFor();
    if (type === 'drawing' || type === 'mixed') {
      await page.waitForFunction(() => (document.querySelector('.vector-layer')?.__agoraRenderStats?.visibleObjects || 0) > 0);
    }
    await page.waitForTimeout(450);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const taskTime = async () => (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'TaskDuration')?.value || 0;
    for (const motion of ['pan', 'zoom']) {
      const before = await taskTime();
      const stats = await page.evaluate(async motion => {
        const stage = document.querySelector('.canvas-stage');
        const { setCamera } = window.mixedFrameFixture;
        setCamera({ x: 0, y: 0, scale: 1 });
        await new Promise(resolve => setTimeout(resolve, 240));
        return new Promise(resolve => {
          const samples = [];
          const start = performance.now();
          let previous = start;
          function frame(now) {
            samples.push(now - previous);
            previous = now;
            const elapsed = now - start;
            const scale = motion === 'zoom' ? 1 + Math.sin(elapsed / 190) * 0.21 : 1;
            setCamera({ x: Math.sin(elapsed / 240) * 42 + (1 - scale) * 430,
              y: Math.cos(elapsed / 230) * 27 + (1 - scale) * 295, scale });
            if (elapsed < 1400) requestAnimationFrame(frame);
            else {
              samples.sort((a, b) => a - b);
              resolve({ fps: +(samples.length * 1000 / elapsed).toFixed(1),
                p95: +samples[Math.floor(samples.length * 0.95)].toFixed(1),
                worst: +samples.at(-1).toFixed(1),
                visible: stage.querySelectorAll('.canvas-object').length,
                vectors: stage.querySelector('.vector-layer')?.__agoraRenderStats?.visibleObjects || 0 });
            }
          }
          requestAnimationFrame(frame);
        });
      }, motion);
      console.log(JSON.stringify({ type, motion, ...stats, taskMs: +((await taskTime() - before) * 1000).toFixed(1) }));
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
}
