const WORDS_PER_INSTANCE = 12;
const DEG_TO_RAD = Math.PI / 180;

export class WgpuSceneBatcher {
  constructor() {
    this.capacity = 256;
    this.buffer = new ArrayBuffer(this.capacity * WORDS_PER_INSTANCE * 4);
    this.f32 = new Float32Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
    this.batchCapacity = 32;
    this.batchTexIds = new Uint32Array(this.batchCapacity);
    this.batchStarts = new Uint32Array(this.batchCapacity);
    this.batchCounts = new Uint32Array(this.batchCapacity);
  }

  ensureCapacity(count) {
    if (count <= this.capacity) return;
    let next = this.capacity;
    while (next < count) next *= 2;
    this.capacity = next;
    this.buffer = new ArrayBuffer(this.capacity * WORDS_PER_INSTANCE * 4);
    this.f32 = new Float32Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
  }

  ensureBatchCapacity(count) {
    if (count <= this.batchCapacity) return;
    let next = this.batchCapacity * 2;
    while (next < count) next *= 2;
    const texIds = new Uint32Array(next);
    const starts = new Uint32Array(next);
    const counts = new Uint32Array(next);
    texIds.set(this.batchTexIds);
    starts.set(this.batchStarts);
    counts.set(this.batchCounts);
    this.batchCapacity = next;
    this.batchTexIds = texIds;
    this.batchStarts = starts;
    this.batchCounts = counts;
  }

  sync(renderer, ordered, dragPreview = null, cullBounds = null) {
    const length = ordered.length;
    this.ensureCapacity(length);
    const f32 = this.f32;
    const u32 = this.u32;
    let batchTexIds = this.batchTexIds;
    let batchStarts = this.batchStarts;
    let batchCounts = this.batchCounts;
    const dragIds = dragPreview?.ids;
    const dragDx = dragIds?.size ? (dragPreview.dx || 0) : 0;
    const dragDy = dragIds?.size ? (dragPreview.dy || 0) : 0;
    const useCull = Boolean(
      cullBounds &&
      Number.isFinite(cullBounds.minX) &&
      Number.isFinite(cullBounds.minY) &&
      Number.isFinite(cullBounds.maxX) &&
      Number.isFinite(cullBounds.maxY)
    );
    const cMinX = useCull ? cullBounds.minX : 0;
    const cMinY = useCull ? cullBounds.minY : 0;
    const cMaxX = useCull ? cullBounds.maxX : 0;
    const cMaxY = useCull ? cullBounds.maxY : 0;

    let instanceCount = 0;
    let currentTexId = 0;
    let batchCount = 0;

    for (let i = 0; i < length; i++) {
      const record = ordered[i];
      if (!record || record.hidden) continue;
      const handle = record.resource?.textureHandle;
      const descriptor = record.descriptor;
      const raster = record.raster;
      if (!handle || !descriptor || !raster) continue;

      const shifted = Boolean(dragIds && dragIds.has(record.id));
      if (useCull && record.paintedBounds) {
        const pb = record.paintedBounds;
        const offX = shifted ? dragDx : 0;
        const offY = shifted ? dragDy : 0;
        if (pb.maxX + offX < cMinX || pb.minX + offX > cMaxX || pb.maxY + offY < cMinY || pb.minY + offY > cMaxY) {
          continue;
        }
      }

      const base = instanceCount * WORDS_PER_INSTANCE;
      const centerX = descriptor.centerX;
      const centerY = descriptor.centerY;
      f32[base] = descriptor.x + centerX + (shifted ? dragDx : 0);
      f32[base + 1] = descriptor.y + centerY + (shifted ? dragDy : 0);
      f32[base + 2] = raster.left - centerX;
      f32[base + 3] = raster.top - centerY;
      f32[base + 4] = raster.width;
      f32[base + 5] = raster.height;
      f32[base + 6] = handle.uvMinX;
      f32[base + 7] = handle.uvMinY;
      f32[base + 8] = handle.uvMaxX;
      f32[base + 9] = handle.uvMaxY;
      f32[base + 10] = (descriptor.rotation || 0) * DEG_TO_RAD;
      const tint = record.tint;
      u32[base + 11] = tint === null || tint === undefined ? 0xffffff : (tint >>> 0);

      const texId = handle.texId >>> 0;
      if (batchCount > 0 && currentTexId === texId) {
        batchCounts[batchCount - 1]++;
      } else {
        if (batchCount === this.batchCapacity) {
          this.ensureBatchCapacity(batchCount + 1);
          batchTexIds = this.batchTexIds;
          batchStarts = this.batchStarts;
          batchCounts = this.batchCounts;
        }
        currentTexId = texId;
        batchTexIds[batchCount] = texId;
        batchStarts[batchCount] = instanceCount;
        batchCounts[batchCount] = 1;
        batchCount++;
      }
      instanceCount++;
    }

    renderer.update_scene(
      u32.subarray(0, instanceCount * WORDS_PER_INSTANCE),
      batchTexIds.subarray(0, batchCount),
      batchStarts.subarray(0, batchCount),
      batchCounts.subarray(0, batchCount),
    );
    return instanceCount;
  }
}
