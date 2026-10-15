// Small decoded previews are bounded independently of GPU atlas resources.
// Eviction never invalidates pixels already copied into a layer's raster atlas.
export default class ImagePreviewCache {
  constructor(load, onReady, { concurrency = 2, maxEntries = 2048, maxPixels = 8_000_000 } = {}) {
    this.load = load; this.onReady = onReady; this.concurrency = concurrency;
    this.maxEntries = maxEntries; this.maxPixels = maxPixels;
    this.entries = new Map(); this.queue = []; this.cursor = 0; this.settled = 0; this.active = 0; this.pixels = 0; this.version = 0; this.disposed = false;
  }
  get queued() { return this.queue.length - this.cursor; }
  peek(source) { return this.entries.get(source); }
  request(source, id) {
    let entry = this.entries.get(source);
    if (entry) {
      this.entries.delete(source); this.entries.set(source, entry);
      if (entry.state === 'loading') entry.ids.add(id);
      return entry;
    }
    entry = { source, ids: new Set([id]), state: 'loading', version: 0, controller: new AbortController() };
    this.entries.set(source, entry); this.queue.push(entry); this.pump(); return entry;
  }
  pump() {
    while (!this.disposed && this.active < this.concurrency && this.queued) {
      const entry = this.queue[this.cursor++]; this.active++;
      Promise.resolve().then(() => this.load(entry.source, entry.controller.signal)).then(canvas => {
        if (this.disposed) { canvas.width = canvas.height = 1; return; }
        entry.canvas = canvas; entry.pixels = canvas.width * canvas.height;
        entry.state = 'ready'; this.settled++; entry.version = ++this.version; this.pixels += entry.pixels;
        this.onReady(entry.source, [...entry.ids]); entry.ids.clear(); this.trim();
      }).catch(() => {
        if (this.disposed) return;
        entry.state = 'failed'; this.settled++; entry.ids.clear(); this.trim();
      }).finally(() => { this.active--; this.pump(); });
    }
    if (this.cursor === this.queue.length) { this.queue.length = 0; this.cursor = 0; }
  }
  trim() {
    if (this.settled <= this.maxEntries && this.pixels <= this.maxPixels) return;
    for (const [source, entry] of this.entries) {
      if (this.settled <= this.maxEntries && this.pixels <= this.maxPixels) break;
      if (entry.state === 'loading') continue;
      this.entries.delete(source); this.settled--; this.pixels -= entry.pixels || 0;
      if (entry.canvas) entry.canvas.width = entry.canvas.height = 1;
    }
  }
  destroy() {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.controller.abort();
      if (entry.canvas) entry.canvas.width = entry.canvas.height = 1;
    }
    this.entries.clear(); this.queue.length = 0; this.cursor = 0; this.settled = 0; this.pixels = 0;
  }
}

export async function loadImagePreview(source, token, apiUrl, signal) {
  const url = new URL(/^(data|blob):/i.test(source) ? source : apiUrl(source));
  const apiOrigin = /^(data|blob):$/i.test(url.protocol) ? null : new URL(apiUrl('/')).origin;
  const response = await fetch(url.href, { signal, cache: 'no-store', headers: url.origin === apiOrigin && token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw Error('Image preview unavailable');
  const blob = await response.blob();
  let bitmap, objectUrl;
  try {
    try { bitmap = await createImageBitmap(blob); }
    catch {
      // Some browsers decode SVG in <img> but reject SVG createImageBitmap.
      objectUrl = URL.createObjectURL(blob);
      const image = new Image(); image.src = objectUrl; await image.decode();
      bitmap = image;
    }
    const ratio = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { bitmap?.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

export function drawImagePreview(context, item, world, bitmap) {
  const width = item.width * world.width, height = item.height * world.height;
  if (item.imageFrameEnabled !== false) {
    context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
  }
  if (!bitmap) {
    // An outline while loading avoids replacing the image with an opaque block.
    context.strokeStyle = '#a8b2aa'; context.lineWidth = 1; context.strokeRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2));
    return;
  }
  const border = item.imageFrameEnabled === false ? 0 : 7;
  const footer = item.imageFrameEnabled === false ? 0 : 26;
  const boxWidth = Math.max(1, width - border * 2), boxHeight = Math.max(1, height - border - footer);
  const ratio = Math.min(boxWidth / bitmap.width, boxHeight / bitmap.height);
  const w = bitmap.width * ratio, h = bitmap.height * ratio;
  context.drawImage(bitmap, border + (boxWidth - w) / 2, border + (boxHeight - h) / 2, w, h);
}
