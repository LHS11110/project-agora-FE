import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONITOR_MAX_SAMPLES,
  MONITOR_SAMPLE_INTERVAL_MS,
  appendMonitorSample,
  buildChartGeometry,
  clampPercent,
  computeMonitorWindow,
  estimateCpuPercent,
  summarizeMonitorSamples,
} from '../src/canvas/diagnostics/performanceMonitorModel.js';

test('constants match 0.2s aggregation interval and 30-sample maximum', () => {
  assert.equal(MONITOR_SAMPLE_INTERVAL_MS, 200);
  assert.equal(MONITOR_MAX_SAMPLES, 30);
});

test('appendMonitorSample caps history at 30 latest samples', () => {
  let list = [];
  for (let i = 1; i <= 45; i++) {
    list = appendMonitorSample(list, { ts: i * 200, fps: 60, cpuPercent: i });
  }
  assert.equal(list.length, 30);
  assert.equal(list[0].cpuPercent, 16);
  assert.equal(list[29].cpuPercent, 45);
});

test('estimateCpuPercent reflects idle headroom, load, and long animation frames honestly', () => {
  assert.equal(clampPercent(-12), 0);
  assert.equal(clampPercent(134.8), 100);

  // Idle 60Hz window (~14.8ms idle remainder out of 15.17ms budget) -> low CPU
  const idleCpu = estimateCpuPercent({
    elapsedMs: 200,
    frames: 12,
    idleSupported: true,
    idleRemaindersMs: [14.8, 14.9, 14.7],
    idleStarved: false,
    loafBusyMs: 0,
  });
  assert.ok(idleCpu >= 0 && idleCpu <= 8, `expected low idle CPU, got ${idleCpu}`);

  // Pending idle probe that has not crossed starvation threshold does not falsely spike to 96%
  assert.equal(
    estimateCpuPercent({
      elapsedMs: 200,
      frames: 1,
      idleSupported: true,
      idleRemaindersMs: [],
      idleStarved: false,
      loafBusyMs: 0,
    }),
    0,
  );

  // True idle starvation across window -> ~96%
  assert.equal(
    estimateCpuPercent({
      elapsedMs: 200,
      frames: 1,
      idleSupported: true,
      idleRemaindersMs: [],
      idleStarved: true,
      loafBusyMs: 0,
    }),
    96,
  );

  // Medium work (~5ms/frame -> ~9.8ms idle left)
  const mediumCpu = estimateCpuPercent({
    elapsedMs: 200,
    frames: 12,
    idleSupported: true,
    idleRemaindersMs: [9.8, 9.5, 9.9],
    idleStarved: false,
    loafBusyMs: 0,
  });
  assert.ok(mediumCpu >= 30 && mediumCpu <= 45, `expected ~35% CPU, got ${mediumCpu}`);

  // Blocked main thread: LOAF consumed 170ms of 200ms window
  const heavyCpu = estimateCpuPercent({
    elapsedMs: 200,
    frames: 2,
    idleSupported: true,
    idleRemaindersMs: [],
    idleStarved: true,
    loafBusyMs: 170,
  });
  assert.ok(heavyCpu >= 85 && heavyCpu <= 100, `expected high saturated CPU, got ${heavyCpu}`);

  // Hidden tab returns 0 instead of reporting false 100% stall
  assert.equal(
    estimateCpuPercent({
      elapsedMs: 200,
      frames: 0,
      idleSupported: true,
      idleRemaindersMs: [],
      idleStarved: true,
      loafBusyMs: 180,
      hidden: true,
    }),
    0,
  );
});

test('computeMonitorWindow computes 0.2s FPS, frame times, memory fallback, and renderer metadata', () => {
  const win = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    frameDeltasMs: [16.6, 16.8, 17.1],
    idleSupported: true,
    idleRemaindersMs: [14.5, 14.6],
    usedHeapMb: null,
    heapLimitMb: null,
    cores: 12,
    renderer: 'webgl',
    vectorStats: {
      engine: 'rust-wgpu',
      renderThread: 'worker',
      gpuAdapter: 'ANGLE (NVIDIA)',
      visibleObjects: 42,
      texturePages: 2,
    },
    totalObjects: 50,
    domObjects: 14,
    workerFrameDelta: 12,
    rasterDelta: 3,
  });

  assert.equal(win.fps, 60);
  assert.equal(win.frameTimeMs, 16.7);
  assert.equal(win.maxFrameMs, 17.1);
  assert.equal(win.usedHeapMb, null);
  assert.equal(win.cores, 12);
  assert.equal(win.renderer, 'webgl');
  assert.equal(win.engine, 'rust-wgpu');
  assert.equal(win.renderThread, 'worker');
  assert.equal(win.visibleObjects, 42);
  assert.equal(win.totalObjects, 50);
  assert.equal(win.domObjects, 14);
  assert.equal(win.texturePages, 2);
  assert.equal(win.workerFps, 60);
  assert.equal(win.rasterDelta, 3);

  const highWorkerWin = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    idleSupported: true,
    idleRemaindersMs: [14.8, 14.2, 15.1, 14.9],
    renderer: 'webgl',
    vectorStats: { engine: 'rust-wgpu', renderThread: 'worker' },
    workerFrameDelta: 24,
  });
  assert.equal(highWorkerWin.workerFps, 120);
  assert.equal(highWorkerWin.fps, 60);
  assert.equal(highWorkerWin.rafFps, 60);
  assert.ok(highWorkerWin.workerFps >= 70);
  assert.ok(highWorkerWin.cpuPercent <= 10, `expected low idle CPU, got ${highWorkerWin.cpuPercent}`);

  // Phase drift in setInterval (217ms capturing 11 steady 16.67ms frames) must not report 51 FPS.
  const steady60Win = computeMonitorWindow({
    elapsedMs: 217,
    frames: 11,
    frameDeltasMs: Array.from({ length: 11 }, () => 16.67),
  });
  assert.equal(steady60Win.fps, 60);
  assert.equal(steady60Win.frameTimeMs, 16.7);

  // Single settle tick from an event-driven GPU worker in a 200ms idle window must not show 5 FPS.
  const idleWorkerTick = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    frameDeltasMs: Array.from({ length: 12 }, () => 16.67),
    renderer: 'webgl',
    vectorStats: { engine: 'rust-wgpu', renderThread: 'worker' },
    workerFrameDelta: 1,
  });
  assert.equal(idleWorkerTick.workerFps, null);
});

test('summarizeMonitorSamples and buildChartGeometry adapt FPS ceiling > 60 and right-align 30 slots', () => {
  const samples = [
    { fps: 60, cpuPercent: 10 },
    { fps: 120, cpuPercent: 50 },
  ];
  const summary = summarizeMonitorSamples(samples);
  assert.equal(summary.avgFps, 90);
  assert.equal(summary.minFps, 60);
  assert.equal(summary.maxFps, 120);
  assert.equal(summary.peakCpu, 50);
  assert.equal(summary.fpsCeiling, 120);

  const geom = buildChartGeometry(samples, {
    width: 240,
    height: 100,
    padLeft: 10,
    padRight: 10,
    padTop: 10,
    padBottom: 10,
    fpsCeiling: summary.fpsCeiling,
  });
  assert.equal(geom.points.length, 2);
  // Latest point lands on right edge (230)
  assert.equal(geom.points[1].x, 230);
  assert.equal(geom.points[1].slot, 29);
  assert.equal(geom.points[0].slot, 28);
  // 120 FPS at ceiling -> top of plot area (y = 10), 60 FPS -> middle (y = 50)
  assert.equal(geom.points[1].fpsY, 10);
  assert.equal(geom.points[0].fpsY, 50);
  // 50% CPU -> middle (y = 50)
  assert.equal(geom.points[1].cpuY, 50);
});

test('computeMonitorWindow uses workerActiveMs to avoid partial-window idle dilution of workerFps', () => {
  const diluted = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    workerFrameDelta: 6,
  });
  assert.equal(diluted.workerFps, 30);

  const partialGesture = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    workerFrameDelta: 6,
    workerActiveMs: 100,
  });
  assert.equal(partialGesture.workerFps, 60);

  const unclampedFallback = computeMonitorWindow({
    elapsedMs: 200,
    frames: 12,
    workerFrameDelta: 6,
    workerActiveMs: 320,
  });
  assert.equal(unclampedFallback.workerFps, 30);
});
