const WORDS_PER_INSTANCE = 12;

export class WgpuSceneBatcher {
  constructor() {
    this.capacity = 256;
    this.buffer = new ArrayBuffer(this.capacity * WORDS_PER_INSTANCE * 4);
    this.f32 = new Float32Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
    this.batchTexIds = [];
    this.batchStarts = [];
    this.batchCounts = [];
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

  sync(renderer, ordered) {
    this.ensureCapacity(ordered.length);
    const f32 = this.f32;
    const u32 = this.u32;
    const batchTexIds = this.batchTexIds;
    const batchStarts = this.batchStarts;
    const batchCounts = this.batchCounts;
    batchTexIds.length = 0;
    batchStarts.length = 0;
    batchCounts.length = 0;

    let instanceCount = 0;
    let currentTexId = 0;
    let currentBatchIndex = -1;

    for (let i = 0; i < ordered.length; i++) {
      const record = ordered[i];
      if (!record || record.hidden) continue;
      const handle = record.resource?.textureHandle;
      const descriptor = record.descriptor;
      const raster = record.raster;
      if (!handle || !descriptor || !raster) continue;

      const base = instanceCount * WORDS_PER_INSTANCE;
      f32[base + 0] = descriptor.x + descriptor.centerX;
      f32[base + 1] = descriptor.y + descriptor.centerY;
      f32[base + 2] = raster.left - descriptor.centerX;
      f32[base + 3] = raster.top - descriptor.centerY;
      f32[base + 4] = raster.width;
      f32[base + 5] = raster.height;
      f32[base + 6] = handle.uvMinX;
      f32[base + 7] = handle.uvMinY;
      f32[base + 8] = handle.uvMaxX;
      f32[base + 9] = handle.uvMaxY;
      f32[base + 10] = (descriptor.rotation || 0) * Math.PI / 180;
      u32[base + 11] = record.tint === null || record.tint === undefined ? 0xffffff : (record.tint >>> 0);

      const texId = handle.texId >>> 0;
      if (currentBatchIndex >= 0 && currentTexId === texId) {
        batchCounts[currentBatchIndex]++;
      } else {
        currentTexId = texId;
        currentBatchIndex = batchTexIds.length;
        batchTexIds.push(texId);
        batchStarts.push(instanceCount);
        batchCounts.push(1);
      }
      instanceCount++;
    }

    renderer.update_scene(
      u32.subarray(0, instanceCount * WORDS_PER_INSTANCE),
      new Uint32Array(batchTexIds),
      new Uint32Array(batchStarts),
      new Uint32Array(batchCounts),
    );
    return instanceCount;
  }
}
