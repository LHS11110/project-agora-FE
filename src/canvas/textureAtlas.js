// Shelf packing with recycled slots keeps texture count independent of object count.
export class AtlasPageSlots {
  constructor(size = 1024) { this.size = size; this.x = 0; this.y = 0; this.rowHeight = 0; this.free = []; this.used = 0; }
  allocate(width, height) {
    if (width > this.size || height > this.size) return null;
    // Best fit keeps large recycled slots available for large rasters.
    let index = -1, waste = Infinity;
    for (let i = 0; i < this.free.length; i++) {
      const slot = this.free[i];
      if (slot.width < width || slot.height < height) continue;
      const area = slot.width * slot.height - width * height;
      if (area < waste) { waste = area; index = i; if (!area) break; }
    }
    if (index >= 0) { this.used++; return this.free.splice(index, 1)[0]; }
    if (this.x + width > this.size) { this.x = 0; this.y += this.rowHeight; this.rowHeight = 0; }
    if (this.y + height > this.size) return null;
    const slot = { x: this.x, y: this.y, width, height };
    this.x += width;
    this.rowHeight = Math.max(this.rowHeight, height);
    this.used++;
    return slot;
  }
  release(slot) { this.free.push(slot); this.used = Math.max(0, this.used - 1); }
}

let nextTextureId = 1;

export class RasterTextureAtlas {
  constructor(size = 1024, maxPages = 8) {
    this.size = size;
    this.maxPages = maxPages;
    this.pages = [];
    this.standalone = new Set();
    this.uploadedTexIds = new Set();
    this.removedTexIds = [];
    // Direct mode (GPU worker): pages hold no pixels on the main thread. Each raster
    // is uploaded once into its slot of the worker texture and then freed, so the
    // GPU keeps one copy instead of a page canvas plus its uploaded texture.
    this.direct = false;
  }

  allocate(canvas) {
    const width = canvas.width + 4, height = canvas.height + 4;
    let page, slot;
    for (const candidate of this.pages) {
      slot = candidate.slots.allocate(width, height);
      if (slot) { page = candidate; break; }
    }
    if (!slot && width <= this.size && height <= this.size && this.pages.length < this.maxPages) {
      let bitmap = null;
      if (!this.direct) { bitmap = document.createElement('canvas'); bitmap.width = bitmap.height = this.size; }
      page = {
        texId: nextTextureId++,
        size: this.size,
        canvas: bitmap,
        context: bitmap?.getContext('2d') || null,
        slots: new AtlasPageSlots(this.size),
        dirty: false,
        regions: [],
      };
      this.pages.push(page);
      slot = page.slots.allocate(width, height);
    }
    if (!slot) {
      const handle = {
        texId: nextTextureId++,
        canvas,
        width: Math.max(1, canvas.width),
        height: Math.max(1, canvas.height),
        uvMinX: 0,
        uvMinY: 0,
        uvMaxX: 1,
        uvMaxY: 1,
        dirty: true,
      };
      this.standalone.add(handle);
      return handle;
    }
    let direct = false;
    if (page.context) {
      page.context.clearRect(slot.x, slot.y, slot.width, slot.height);
      page.context.drawImage(canvas, slot.x + 2, slot.y + 2);
      page.dirty = true;
    } else {
      // The region includes the 2px transparent gutter, clearing a recycled slot.
      page.regions.push({ canvas, x: slot.x, y: slot.y });
      direct = true;
    }
    return {
      direct,
      page,
      slot,
      texId: page.texId,
      uvMinX: (slot.x + 2) / this.size,
      uvMinY: (slot.y + 2) / this.size,
      uvMaxX: (slot.x + 2 + canvas.width) / this.size,
      uvMaxY: (slot.y + 2 + canvas.height) / this.size,
    };
  }

  release(handle) {
    if (!handle) return;
    if (handle.page) {
      const page = handle.page;
      page.slots.release(handle.slot);
      // An empty page is a whole 2D canvas plus a GPU texture. Keep one page warm
      // and return the rest, so memory follows the live scene rather than its peak.
      if (!page.slots.used && this.pages.length > 1) {
        this.pages = this.pages.filter(candidate => candidate !== page);
        if (this.uploadedTexIds.delete(page.texId)) this.removedTexIds.push(page.texId);
        if (page.canvas) page.canvas.width = page.canvas.height = 1;
        page.context = null; page.regions.length = 0;
      }
    } else {
      this.standalone.delete(handle);
      this.uploadedTexIds.delete(handle.texId);
      this.removedTexIds.push(handle.texId);
      if (handle.canvas) handle.canvas.width = handle.canvas.height = 1;
    }
  }

  resetGpuState() {
    this.uploadedTexIds.clear();
  }

  flush(renderer = null) {
    if (!renderer) return;
    if (this.removedTexIds.length) {
      for (const texId of this.removedTexIds.splice(0)) {
        renderer.remove_texture(texId);
      }
    }
    for (const page of this.pages) {
      if (page.canvas && (page.dirty || !this.uploadedTexIds.has(page.texId))) {
        if (renderer.upload_canvas_texture(page.texId, page.canvas, page.size, page.size)) {
          page.dirty = false;
          this.uploadedTexIds.add(page.texId);
          // Entering direct mode: this page's pixels now live in the worker texture.
          if (this.direct) { renderer.release_after_upload?.(page.canvas); page.canvas = null; page.context = null; }
        }
      }
      if (page.regions.length && renderer.upload_canvas_region) {
        for (const region of page.regions.splice(0)) renderer.upload_canvas_region(page.texId, region.canvas, page.size, region.x, region.y);
        this.uploadedTexIds.add(page.texId);
      }
    }
    for (const handle of this.standalone) {
      if (handle.dirty || !this.uploadedTexIds.has(handle.texId)) {
        if (handle.canvas && renderer.upload_canvas_texture(handle.texId, handle.canvas, handle.width, handle.height)) {
          handle.dirty = false;
          this.uploadedTexIds.add(handle.texId);
          if (this.direct) { renderer.release_after_upload?.(handle.canvas); handle.canvas = null; }
        }
      }
    }
  }

  destroy(renderer = null) {
    for (const handle of this.standalone) {
      if (renderer) renderer.remove_texture(handle.texId);
      if (handle.canvas) handle.canvas.width = handle.canvas.height = 1;
    }
    this.standalone.clear();
    for (const page of this.pages) {
      if (renderer) renderer.remove_texture(page.texId);
      if (page.canvas) page.canvas.width = page.canvas.height = 1;
    }
    this.pages = [];
    this.uploadedTexIds.clear();
    this.removedTexIds.length = 0;
  }
}
