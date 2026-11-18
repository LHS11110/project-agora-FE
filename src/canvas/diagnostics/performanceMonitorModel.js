export const MONITOR_SAMPLE_INTERVAL_MS = 200;
export const MONITOR_MAX_SAMPLES = 30;
const COMPOSITOR_OVERHEAD_MS = 1.5;
const MIN_FRAME_BUDGET_MS = 2.5;

const round1 = (value) => Math.round(value * 10) / 10;

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function appendMonitorSample(samples, sample, maxSamples = MONITOR_MAX_SAMPLES) {
  const list = Array.isArray(samples) ? samples : [];
  const cap = Math.max(1, Math.floor(maxSamples) || MONITOR_MAX_SAMPLES);
  const next = [...list, sample];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * Estimates main-thread CPU occupancy (0..100%) from idle headroom + long-animation-frame timing.
 * Uses only observed scheduling signals; returns 0 when the tab is hidden or inactive.
 */
export function estimateCpuPercent({
  elapsedMs,
  frames = 0,
  idleSupported = false,
  idleRemaindersMs = [],
  idleStarved = false,
  loafBusyMs = 0,
  baselineFrameMs = 16.67,
  compositorOverheadMs = COMPOSITOR_OVERHEAD_MS,
  hidden = false,
} = {}) {
  if (hidden || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;

  const loafRatio = Number.isFinite(loafBusyMs) && loafBusyMs > 0
    ? Math.min(1, loafBusyMs / elapsedMs)
    : 0;

  let idleBusyRatio = 0;
  if (idleSupported) {
    const validRemainders = Array.isArray(idleRemaindersMs)
      ? idleRemaindersMs.filter((ms) => Number.isFinite(ms) && ms >= 0)
      : [];
    const targetFrameMs = Math.max(4, Math.min(33.34, Number(baselineFrameMs) || 16.67));
    const availableBudgetMs = Math.max(MIN_FRAME_BUDGET_MS, targetFrameMs - compositorOverheadMs);

    if (validRemainders.length > 0) {
      const sum = validRemainders.reduce((acc, ms) => acc + ms, 0);
      const avgRem = sum / validRemainders.length;
      idleBusyRatio = Math.max(0, Math.min(1, 1 - avgRem / availableBudgetMs));
    } else if (idleStarved && frames >= 0) {
      // Idle probe remained starved for at least 150ms without running once.
      idleBusyRatio = 0.96;
    }
  }

  return clampPercent(Math.max(loafRatio, idleBusyRatio) * 100);
}

/**
 * Aggregates one 0.2s telemetry window into numeric metrics + normalized sample.
 */
export function computeMonitorWindow({
  ts = Date.now(),
  elapsedMs = MONITOR_SAMPLE_INTERVAL_MS,
  frames = 0,
  frameDeltasMs = [],
  idleSupported = false,
  idleRemaindersMs = [],
  idleStarved = false,
  loafBusyMs = 0,
  baselineFrameMs = 16.67,
  hidden = false,
  usedHeapMb = null,
  heapLimitMb = null,
  cores = null,
  renderer = 'dom',
  vectorStats = null,
  totalObjects = 0,
  domObjects = 0,
  workerFrameDelta = 0,
  rasterDelta = 0,
} = {}) {
  const safeElapsedMs = Math.max(1, Number(elapsedMs) || MONITOR_SAMPLE_INTERVAL_MS);
  const safeFrames = Math.max(0, Number(frames) || 0);
  const validDeltas = Array.isArray(frameDeltasMs)
    ? frameDeltasMs.filter((ms) => Number.isFinite(ms) && ms > 0)
    : [];
  const completeDeltaWindow = validDeltas.length >= Math.max(2, safeFrames - 1);
  const deltaSpanMs = completeDeltaWindow
    ? validDeltas.reduce((acc, ms) => acc + ms, 0)
    : 0;
  const rawRafFps = safeFrames > 0
    ? (completeDeltaWindow && deltaSpanMs > 0
      ? round1((validDeltas.length * 1000) / deltaSpanMs)
      : round1((safeFrames * 1000) / safeElapsedMs))
    : 0;
  const rafFps = Math.round(rawRafFps);

  const safeWorkerDelta = Math.max(0, Number(workerFrameDelta) || 0);
  const workerFps = safeWorkerDelta >= 3 ? Math.round((safeWorkerDelta * 1000) / safeElapsedMs) : null;

  const rawFps = rawRafFps;
  const fps = rafFps;

  const frameTimeMs = safeFrames > 0
    ? (completeDeltaWindow && deltaSpanMs > 0
      ? round1(deltaSpanMs / validDeltas.length)
      : round1(safeElapsedMs / safeFrames))
    : round1(safeElapsedMs);

  const maxFrameMs = validDeltas.length > 0
    ? round1(Math.max(...validDeltas, frameTimeMs))
    : frameTimeMs;

  const cpuPercent = estimateCpuPercent({
    elapsedMs: safeElapsedMs,
    frames: safeFrames,
    idleSupported,
    idleRemaindersMs,
    idleStarved,
    loafBusyMs,
    baselineFrameMs,
    hidden,
  });

  const stats = vectorStats && typeof vectorStats === 'object' ? vectorStats : {};

  return {
    ts,
    fps,
    rawFps,
    rafFps,
    cpuPercent,
    frameTimeMs,
    maxFrameMs,
    usedHeapMb: Number.isFinite(usedHeapMb) ? round1(usedHeapMb) : null,
    heapLimitMb: Number.isFinite(heapLimitMb) ? Math.round(heapLimitMb) : null,
    cores: Number.isFinite(cores) && cores > 0 ? Math.round(cores) : null,
    renderer: renderer || stats.engine || 'dom',
    engine: stats.engine || renderer || 'dom',
    renderThread: stats.renderThread || (renderer === 'canvas2d' ? 'worker' : 'main'),
    gpuAdapter: typeof stats.gpuAdapter === 'string' ? stats.gpuAdapter : '',
    visibleObjects: Number.isFinite(stats.visibleObjects) ? stats.visibleObjects : 0,
    totalObjects: Math.max(0, Number(totalObjects) || 0),
    domObjects: Math.max(0, Number(domObjects) || 0),
    texturePages: Number.isFinite(stats.texturePages) ? stats.texturePages : 0,
    workerFps,
    rasterDelta: Math.max(0, Number(rasterDelta) || 0),
  };
}

export function summarizeMonitorSamples(samples) {
  const list = Array.isArray(samples) ? samples : [];
  if (list.length === 0) {
    return {
      current: null,
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      avgCpu: 0,
      peakCpu: 0,
      fpsCeiling: 60,
    };
  }
  let fpsSum = 0;
  let cpuSum = 0;
  let minFps = Infinity;
  let maxFps = 0;
  let peakCpu = 0;
  for (const s of list) {
    const f = Number(s.fps) || 0;
    const c = Number(s.cpuPercent) || 0;
    fpsSum += f;
    cpuSum += c;
    if (f < minFps) minFps = f;
    if (f > maxFps) maxFps = f;
    if (c > peakCpu) peakCpu = c;
  }
  const fpsCeiling = Math.max(60, Math.ceil(Math.max(maxFps, 60) / 30) * 30);
  return {
    current: list[list.length - 1],
    avgFps: Math.round(fpsSum / list.length),
    minFps: minFps === Infinity ? 0 : minFps,
    maxFps,
    avgCpu: Math.round(cpuSum / list.length),
    peakCpu,
    fpsCeiling,
  };
}

/**
 * Computes right-aligned SVG polyline and point coordinates for up to 30 0.2s buckets.
 */
export function buildChartGeometry(
  samples,
  {
    width = 236,
    height = 92,
    padTop = 8,
    padRight = 6,
    padBottom = 10,
    padLeft = 6,
    maxSamples = MONITOR_MAX_SAMPLES,
    fpsCeiling = 60,
  } = {},
) {
  const list = Array.isArray(samples) ? samples.slice(-maxSamples) : [];
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = Math.max(1, height - padTop - padBottom);
  const baselineY = padTop + plotH;
  const ceiling = Math.max(60, Number(fpsCeiling) || 60);

  if (list.length === 0) {
    return {
      points: [],
      fpsLine: '',
      cpuLine: '',
      fpsArea: '',
      cpuArea: '',
      ref60Y: round1(padTop + plotH * (1 - Math.min(1, 60 / ceiling))),
      baselineY: round1(baselineY),
    };
  }

  const slotOffset = Math.max(0, maxSamples - list.length);
  const denom = Math.max(1, maxSamples - 1);
  const points = list.map((sample, index) => {
    const slot = slotOffset + index;
    const x = round1(padLeft + (slot / denom) * plotW);
    const fpsRatio = Math.max(0, Math.min(1, (Number(sample.fps) || 0) / ceiling));
    const cpuRatio = Math.max(0, Math.min(1, (Number(sample.cpuPercent) || 0) / 100));
    const fpsY = round1(padTop + plotH * (1 - fpsRatio));
    const cpuY = round1(padTop + plotH * (1 - cpuRatio));
    return { index, slot, x, fpsY, cpuY, sample };
  });

  const toLine = (key) => points.map((p) => `${p.x},${p[key]}`).join(' ');
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const fpsLine = toLine('fpsY');
  const cpuLine = toLine('cpuY');
  const fpsArea = `${firstX},${round1(baselineY)} ${fpsLine} ${lastX},${round1(baselineY)}`;
  const cpuArea = `${firstX},${round1(baselineY)} ${cpuLine} ${lastX},${round1(baselineY)}`;

  return {
    points,
    fpsLine,
    cpuLine,
    fpsArea,
    cpuArea,
    ref60Y: round1(padTop + plotH * (1 - Math.min(1, 60 / ceiling))),
    baselineY: round1(baselineY),
  };
}
