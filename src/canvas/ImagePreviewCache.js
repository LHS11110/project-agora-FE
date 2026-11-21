import {sharedAuthenticatedImageBlob} from '../components/authenticatedImageCache.js';
import {canvasFetch} from '../api/client.js';
import {decodeDataUriBlob} from '../api/canvasTransport.js';
import { objectCornerRadius } from './objectCorners.js';
import { bearer } from '../state/authSession.js';
// Small decoded previews are bounded independently of GPU atlas resources.
// Eviction never invalidates pixels already copied into a layer's raster atlas.
export default class ImagePreviewCache {
  constructor(load, onReady, { concurrency = 2, maxEntries = 2048, maxPixels = 8_000_000 } = {}) {
    this.load = load; this.onReady = onReady; this.concurrency = concurrency;
    this.maxEntries = maxEntries; this.maxPixels = maxPixels;
    this.entries = new Map(); this.queue = []; this.cursor = 0; this.priorityQueue=[];this.priorityCursor=0; this.settled = 0; this.active = 0; this.pixels = 0; this.version = 0; this.disposed = false;
  }
  get queued() { return this.queue.length - this.cursor + this.priorityQueue.length-this.priorityCursor; }
  peek(source) { return this.entries.get(source); }
  request(source, id, priority=false) {
    let entry = this.entries.get(source);
    if (entry) {
      this.entries.delete(source); this.entries.set(source, entry);
      if (entry.state === 'loading') entry.ids.add(id);
      if(priority&&!entry.started&&!entry.urgent){entry.urgent=true;this.priorityQueue.push(entry);this.pump();}
      return entry;
    }
    entry = { source, ids: new Set([id]), state: 'loading', version: 0, controller: new AbortController() };
    this.entries.set(source, entry);if(priority){entry.urgent=true;this.priorityQueue.push(entry);}else this.queue.push(entry);this.pump();return entry;
  }
  pump() {
    while (!this.disposed && this.active < this.concurrency && this.queued) {
      const entry = this.priorityCursor<this.priorityQueue.length?this.priorityQueue[this.priorityCursor++]:this.queue[this.cursor++];
      if(entry.started)continue;entry.started=true;this.active++;
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
    if(this.priorityCursor===this.priorityQueue.length){this.priorityQueue.length=0;this.priorityCursor=0;}
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
    this.entries.clear();this.priorityQueue.length=0;this.priorityCursor=0; this.queue.length = 0; this.cursor = 0; this.settled = 0; this.pixels = 0;
  }
}

export async function loadImagePreview(source, token, apiUrl, signal, maxSide=1024) {
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError');
  const isInline = /^(data|blob):/i.test(source);
  const url = new URL(isInline ? source : apiUrl(source));
  let bitmap, objectUrl;
  try {
    if (url.protocol === 'blob:') {
      // Avoid fetch() on blob:/data: URLs so strict connect-src https: wss: CSP is never violated.
      const image = new Image(); image.src = url.href; await image.decode();
      bitmap = image;
    } else {
      let blob;
      if (url.protocol === 'data:') {
        blob = decodeDataUriBlob(url.href);
      } else {
        const apiOrigin = new URL(apiUrl('/')).origin;
        const shared=sharedAuthenticatedImageBlob(url.href,token);
        if(shared)blob=await shared;
        if(!blob) {
          const response = await canvasFetch(url.href, { signal, cache: 'no-store', headers: url.origin === apiOrigin && token ? { Authorization: bearer(token) } : {} });
          if (!response.ok) throw Error('Image preview unavailable');
          blob = await response.blob();
        }
      }
      try { bitmap = await createImageBitmap(blob); }
      catch {
        // Some browsers decode SVG in <img> but reject SVG createImageBitmap.
        objectUrl = URL.createObjectURL(blob);
        const image = new Image(); image.src = objectUrl; await image.decode();
        bitmap = image;
      }
    }
    if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError');
    const ratio = Math.min(1, Math.max(16,Math.min(2048,Number(maxSide)||1024)) / Math.max(1, bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { bitmap?.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

export function drawImagePreview(context, item, world, bitmap) {
  const width = item.width * world.width, height = item.height * world.height;
  const radius = objectCornerRadius(item, width, height);
  if (radius) { context.save(); context.beginPath(); context.roundRect(0, 0, width, height, radius); context.clip(); }
  if (!bitmap) {
    // An outline while loading avoids replacing the image with an opaque block.
    context.strokeStyle = '#a8b2aa'; context.lineWidth = 1; context.strokeRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2));
    if (radius) context.restore();
    return;
  }
  const framed = Boolean(item.imageFrameEnabled);
  const border = framed ? Math.max(2, Math.min(7, width * 0.04)) : 0;
  const footer = framed ? Math.max(5, Math.min(20, height * 0.14)) : 0;
  if (framed) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#d8ded6';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
  }
  const boxWidth = Math.max(1, width - border * 2), boxHeight = Math.max(1, height - border - footer);
  const ratio = Math.min(boxWidth / bitmap.width, boxHeight / bitmap.height);
  const w = bitmap.width * ratio, h = bitmap.height * ratio;
  const x = border + (boxWidth - w) / 2, y = border + (boxHeight - h) / 2;
  const innerRadius = Math.max(0, radius - border);
  if (innerRadius) { context.beginPath(); context.roundRect(x, y, w, h, Math.min(innerRadius, w / 2, h / 2)); context.clip(); }
  context.drawImage(bitmap, x, y, w, h);
  if (radius) context.restore();
}
