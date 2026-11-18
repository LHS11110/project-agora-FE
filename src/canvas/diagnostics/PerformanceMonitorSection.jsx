import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  MONITOR_MAX_SAMPLES,
  MONITOR_SAMPLE_INTERVAL_MS,
  appendMonitorSample,
  buildChartGeometry,
  computeMonitorWindow,
  summarizeMonitorSamples,
} from './performanceMonitorModel.js';
import './performance-monitor.css';

const CHART_WIDTH = 236;
const CHART_HEIGHT = 92;

function readVectorLayerInfo(prevLayerMap) {
  if (typeof document === 'undefined') {
    return { renderer: 'dom', stats: null, domObjects: 0, workerFrameDelta: 0, totalRasterizations: 0 };
  }
  const layers = [...document.querySelectorAll('.vector-layer')];
  const domObjects = document.querySelectorAll('.canvas-object').length;
  if (layers.length === 0) {
    return { renderer: 'dom', stats: null, domObjects, workerFrameDelta: 0, totalRasterizations: 0 };
  }

  let primaryLayer = layers[0];
  let bestScore = -1;
  let maxWorkerDelta = 0;
  let totalVisible = 0;
  let totalTexturePages = 0;
  let totalRasterizations = 0;

  for (const layer of layers) {
    const s = layer.__agoraRenderStats;
    const isWorker = s?.renderThread === 'worker' || layer.dataset?.compositor === 'worker';
    const gpuCount = Number(s?.gpuWorkerFrames) || 0;
    const compCount = Number(s?.workerFrames) || 0;
    const count = gpuCount + compCount;
    if (prevLayerMap) {
      if (prevLayerMap.has(layer)) {
        const prev = prevLayerMap.get(layer);
        const delta = Math.max(0, gpuCount - prev.gpu) + Math.max(0, compCount - prev.comp);
        if (delta > maxWorkerDelta) maxWorkerDelta = delta;
      }
      prevLayerMap.set(layer, { gpu: gpuCount, comp: compCount });
    }
    const score = (isWorker ? 1_000_000 : 0) + count;
    if (score > bestScore) {
      bestScore = score;
      primaryLayer = layer;
    }
    totalVisible += Number(s?.visibleObjects) || 0;
    totalTexturePages += Number(s?.texturePages) || 0;
    totalRasterizations += Number(s?.rasterizations) || 0;
  }

  const primaryStats = primaryLayer.__agoraRenderStats || null;
  const renderer = primaryLayer.dataset?.renderer || primaryStats?.engine || 'dom';
  const mergedStats = primaryStats
    ? {
        ...primaryStats,
        renderThread:
          primaryStats.renderThread ||
          (primaryLayer.dataset?.compositor === 'worker' || renderer === 'canvas2d' ? 'worker' : 'main'),
        visibleObjects: totalVisible,
        texturePages: totalTexturePages,
      }
    : null;

  return {
    renderer,
    stats: mergedStats,
    domObjects,
    workerFrameDelta: maxWorkerDelta,
    totalRasterizations,
  };
}

function readMemoryInfo() {
  const mem = typeof performance !== 'undefined' ? performance.memory : null;
  if (!mem || !Number.isFinite(mem.usedJSHeapSize)) {
    return { usedHeapMb: null, heapLimitMb: null };
  }
  const usedHeapMb = mem.usedJSHeapSize / (1024 * 1024);
  const heapLimitMb = Number.isFinite(mem.jsHeapSizeLimit)
    ? mem.jsHeapSizeLimit / (1024 * 1024)
    : null;
  return { usedHeapMb, heapLimitMb };
}

export default function PerformanceMonitorSection({ items, onClose }) {
  useUiLocale();
  const chartTitleId = useId();
  const [paused, setPaused] = useState(false);
  const [samples, setSamples] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);

  const itemsCountRef = useRef(0);
  itemsCountRef.current = items && typeof items === 'object' ? Object.keys(items).length : 0;

  const baselineFrameMsRef = useRef(16.67);
  const mountedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const prevLayerFramesRef = useRef(new WeakMap());
  const prevRasterizationsRef = useRef(null);

  const resetCollector = useCallback(() => {
    setSamples([]);
    setHoverIndex(null);
    baselineFrameMsRef.current = 16.67;
    prevLayerFramesRef.current = new WeakMap();
    const initialInfo = readVectorLayerInfo(prevLayerFramesRef.current);
    prevRasterizationsRef.current = initialInfo.totalRasterizations;
  }, []);

  useEffect(() => {
    if (paused || typeof window === 'undefined' || typeof performance === 'undefined') return undefined;

    let active = true;
    let rafId = 0;
    let idleId = 0;
    let intervalId = 0;
    let observers = [];

    const supportsIdle = typeof window.requestIdleCallback === 'function';
    const loafSpans = [];
    const effectStart = performance.now();
    // Skip panel-open layout/resize transition only on initial mount; resume immediately afterward.
    const settleDelayMs = Math.max(0, 600 - (effectStart - mountedAtRef.current));
    let warmed = false;
    let warmupFrames = 0;
    let frames = 0;
    let frameDeltasMs = [];
    let lastFrameTs = 0;
    let windowStart = effectStart;
    let idleRemaindersMs = [];
    let idlePendingSince = 0;
    prevLayerFramesRef.current = new WeakMap();
    const seedInfo = readVectorLayerInfo(prevLayerFramesRef.current);
    prevRasterizationsRef.current = seedInfo.totalRasterizations;

    // Observe main-thread stalls unbuffered so initial page load delays do not skew opening ticks.
    if (typeof PerformanceObserver === 'function') {
      const supported = Array.isArray(PerformanceObserver.supportedEntryTypes)
        ? PerformanceObserver.supportedEntryTypes
        : [];
      for (const entryType of ['long-animation-frame', 'longtask']) {
        if (!supported.includes(entryType)) continue;
        try {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.duration > 0) {
                loafSpans.push({
                  start: entry.startTime,
                  end: entry.startTime + entry.duration,
                });
              }
            }
          });
          obs.observe({ type: entryType, buffered: false });
          observers.push(obs);
        } catch {
          // Ignore unsupported observer type
        }
      }
    }

    const scheduleIdleProbe = () => {
      if (!active || !supportsIdle || idleId) return;
      idlePendingSince = performance.now();
      idleId = window.requestIdleCallback((deadline) => {
        idleId = 0;
        idlePendingSince = 0;
        if (!active) return;
        idleRemaindersMs.push(deadline.timeRemaining());
      });
    };

    const onFrame = (ts) => {
      if (!active) return;
      if (!warmed) {
        warmupFrames++;
        // Let inspector drawer mount layout/paint and resize transitions settle before recording min FPS / peak CPU.
        if (warmupFrames >= 3 && ts - effectStart >= settleDelayMs) {
          warmed = true;
          windowStart = ts;
          lastFrameTs = ts;
          frames = 0;
          frameDeltasMs = [];
          loafSpans.length = 0;
          idleRemaindersMs = [];
          scheduleIdleProbe();
        }
        rafId = window.requestAnimationFrame(onFrame);
        return;
      }
      frames++;
      if (lastFrameTs > 0) {
        const delta = ts - lastFrameTs;
        if (delta > 0 && delta < 5000) frameDeltasMs.push(delta);
      }
      lastFrameTs = ts;
      rafId = window.requestAnimationFrame(onFrame);
    };

    rafId = window.requestAnimationFrame(onFrame);

    const flushWindow = () => {
      if (!active || !warmed) return;
      const now = performance.now();
      const elapsedMs = now - windowStart;
      if (elapsedMs < 80 || (frames < 3 && elapsedMs < 350)) return;

      const hidden = typeof document !== 'undefined' && Boolean(document.hidden);
      // Calibrate downward for 120Hz/144Hz monitors without drifting up when heavy frames stall.
      if (!hidden && frames >= 3) {
        const observedPeriod = elapsedMs / frames;
        if (observedPeriod < baselineFrameMsRef.current - 0.5) {
          baselineFrameMsRef.current = Math.max(4, observedPeriod);
        }
      }

      let loafBusyMs = 0;
      const clippedSpans = [];
      for (let i = loafSpans.length - 1; i >= 0; i--) {
        const span = loafSpans[i];
        const s = Math.max(span.start, windowStart);
        const e = Math.min(span.end, now);
        if (e > s) clippedSpans.push({ start: s, end: e });
        if (span.end <= now) loafSpans.splice(i, 1);
      }
      if (clippedSpans.length > 0) {
        clippedSpans.sort((a, b) => a.start - b.start);
        let curStart = clippedSpans[0].start;
        let curEnd = clippedSpans[0].end;
        for (let i = 1; i < clippedSpans.length; i++) {
          if (clippedSpans[i].start <= curEnd) {
            curEnd = Math.max(curEnd, clippedSpans[i].end);
          } else {
            loafBusyMs += curEnd - curStart;
            curStart = clippedSpans[i].start;
            curEnd = clippedSpans[i].end;
          }
        }
        loafBusyMs += curEnd - curStart;
      }

      const { usedHeapMb, heapLimitMb } = readMemoryInfo();
      const { renderer, stats, domObjects, workerFrameDelta, totalRasterizations } =
        readVectorLayerInfo(prevLayerFramesRef.current);

      const rasterDelta = prevRasterizationsRef.current === null
        ? 0
        : Math.max(0, totalRasterizations - prevRasterizationsRef.current);
      prevRasterizationsRef.current = totalRasterizations;

      const idleStarved = Boolean(
        supportsIdle && idleId && idlePendingSince > 0 && now - idlePendingSince >= 150,
      );

      const sample = computeMonitorWindow({
        ts: Date.now(),
        elapsedMs,
        frames,
        frameDeltasMs,
        idleSupported: supportsIdle,
        idleRemaindersMs,
        idleStarved,
        loafBusyMs,
        baselineFrameMs: baselineFrameMsRef.current,
        hidden,
        usedHeapMb,
        heapLimitMb,
        cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null,
        renderer,
        vectorStats: stats,
        totalObjects: itemsCountRef.current,
        domObjects,
        workerFrameDelta,
        rasterDelta,
      });

      windowStart = now;
      frames = 0;
      frameDeltasMs = [];
      idleRemaindersMs = [];
      scheduleIdleProbe();

      if (!hidden) {
        setSamples((prev) => appendMonitorSample(prev, sample, MONITOR_MAX_SAMPLES));
      }
    };

    intervalId = window.setInterval(flushWindow, MONITOR_SAMPLE_INTERVAL_MS);

    return () => {
      active = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (idleId && supportsIdle) window.cancelIdleCallback(idleId);
      if (intervalId) window.clearInterval(intervalId);
      for (const obs of observers) obs.disconnect();
    };
  }, [paused]);

  const summary = useMemo(() => summarizeMonitorSamples(samples), [samples]);
  const chart = useMemo(
    () => buildChartGeometry(samples, { width: CHART_WIDTH, height: CHART_HEIGHT, fpsCeiling: summary.fpsCeiling }),
    [samples, summary.fpsCeiling],
  );

  const activePoint = useMemo(() => {
    if (chart.points.length === 0) return null;
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < chart.points.length) {
      return chart.points[hoverIndex];
    }
    return null;
  }, [chart.points, hoverIndex]);

  const latest = summary.current;
  const rendererSummary = latest
    ? `${String(latest.renderer || 'dom').toUpperCase()} · ${latest.renderThread === 'worker' ? 'WORKER' : 'MAIN'}${latest.workerFps ? ` (${latest.workerFps}fps)` : ''}`
    : '—';

  const handleChartPointerMove = (event) => {
    if (chart.points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chart.points.length; i++) {
      const dist = Math.abs(chart.points[i].x - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        nearestIdx = i;
      }
    }
    setHoverIndex(nearestIdx);
  };

  return (
    <section className="inspector-section perf-monitor-section" aria-labelledby={chartTitleId}>
      <div className="perf-monitor-head">
        <div className="perf-monitor-title">
          <i className={`perf-monitor-dot${paused ? ' is-paused' : ''}`} aria-hidden="true" />
          <strong id={chartTitleId} className="inspector-label">{ui('성능 모니터링')}</strong>
          <span className="perf-monitor-badge">{paused ? ui('일시정지됨') : '0.2s'}</span>
        </div>
        <div className="perf-monitor-actions">
          <button
            type="button"
            className="perf-icon-btn"
            onClick={() => setPaused((p) => !p)}
            title={ui(paused ? '모니터링 재개' : '모니터링 일시정지')}
            aria-label={ui(paused ? '모니터링 재개' : '모니터링 일시정지')}
            aria-pressed={paused}
          >
            <Icon name={paused ? 'play' : 'pause'} size={12} />
          </button>
          <button
            type="button"
            className="perf-icon-btn"
            onClick={resetCollector}
            title={ui('그래프 초기화')}
            aria-label={ui('그래프 초기화')}
          >
            <Icon name="reset" size={12} />
          </button>
          {onClose && (
            <button
              type="button"
              className="perf-icon-btn"
              onClick={onClose}
              title={ui('모니터링 닫기')}
              aria-label={ui('모니터링 닫기')}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="perf-chart-card">
        <div className="perf-chart-legend">
          <div className="perf-legend-series">
            <span className="perf-legend-item is-fps">
              <i aria-hidden="true" />
              FPS {latest ? latest.fps : '—'}
            </span>
            <span className="perf-legend-item is-cpu">
              <i aria-hidden="true" />
              CPU {latest ? `${latest.cpuPercent}%` : '—'}
            </span>
          </div>
          <span className="perf-chart-window">
            {ui('{v0}/{v1}개 · 0.2s', { v0: samples.length, v1: MONITOR_MAX_SAMPLES })}
          </span>
        </div>

        <div
          className="perf-chart-frame"
          onPointerMove={handleChartPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg
            className="perf-chart-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={ui('0.2초 단위 최대 30개 FPS 및 CPU 사용률 그래프')}
          >
            <line className="perf-chart-grid" x1="6" y1="8" x2={CHART_WIDTH - 6} y2="8" />
            <line className="perf-chart-grid" x1="6" y1="45" x2={CHART_WIDTH - 6} y2="45" />
            <line className="perf-chart-grid" x1="6" y1={chart.baselineY} x2={CHART_WIDTH - 6} y2={chart.baselineY} />
            {Array.from({ length: 5 }, (_, idx) => {
              const x = 6 + ((idx + 1) / 6) * (CHART_WIDTH - 12);
              return <line key={idx} className="perf-chart-grid" x1={x} y1="8" x2={x} y2={chart.baselineY} />;
            })}
            <line className="perf-chart-ref60" x1="6" y1={chart.ref60Y} x2={CHART_WIDTH - 6} y2={chart.ref60Y} />
            <text className="perf-chart-axis-text" x="8" y="16">{summary.fpsCeiling}</text>
            <text className="perf-chart-axis-text" x={CHART_WIDTH - 32} y={Math.max(15, chart.ref60Y - 2)}>60</text>

            {chart.points.length >= 2 && (
              <>
                <polygon className="perf-chart-area-cpu" points={chart.cpuArea} />
                <polygon className="perf-chart-area-fps" points={chart.fpsArea} />
                <polyline className="perf-chart-line-cpu" points={chart.cpuLine} />
                <polyline className="perf-chart-line-fps" points={chart.fpsLine} />
              </>
            )}

            {chart.points.length > 0 && (() => {
              const point = activePoint || chart.points[chart.points.length - 1];
              return (
                <>
                  {activePoint && (
                    <line className="perf-chart-cursor" x1={point.x} y1="8" x2={point.x} y2={chart.baselineY} />
                  )}
                  <circle cx={point.x} cy={point.cpuY} r="2.7" fill="var(--pm-cpu)" />
                  <circle cx={point.x} cy={point.fpsY} r="2.9" fill="var(--pm-fps)" />
                </>
              );
            })()}
          </svg>
        </div>

        <div className="perf-chart-footer">
          {activePoint ? (
            <span>
              {`#${activePoint.index + 1} · ${activePoint.sample.fps} FPS · CPU ${activePoint.sample.cpuPercent}% · ${activePoint.sample.frameTimeMs}ms`}
            </span>
          ) : latest ? (
            <span>
              {ui('평균 {v0} FPS · 최저 {v1} · 최고 CPU {v2}%', {
                v0: summary.avgFps,
                v1: summary.minFps,
                v2: summary.peakCpu,
              })}
            </span>
          ) : (
            <span>{ui('0.2초 간격으로 측정 중…')}</span>
          )}
        </div>
      </div>

      <div className="perf-metrics-grid">
        <div className="perf-metric-card">
          <span className="perf-metric-label">FPS</span>
          <strong className={`perf-metric-value${latest && latest.fps < 30 ? ' is-warn' : ' is-fps'}`}>
            {latest ? latest.fps : '—'}
          </strong>
          <span className="perf-metric-sub">
            {latest
              ? ui('평균 {v0} · 최저 {v1}', { v0: summary.avgFps, v1: summary.minFps })
              : '—'}
          </span>
        </div>

        <div className="perf-metric-card">
          <span className="perf-metric-label">{ui('CPU (메인 스레드)')}</span>
          <strong className={`perf-metric-value${latest && latest.cpuPercent >= 85 ? ' is-warn' : ' is-cpu'}`}>
            {latest ? `${latest.cpuPercent}%` : '—'}
          </strong>
          <div className="perf-cpu-bar" aria-hidden="true">
            <i style={{ width: `${latest ? latest.cpuPercent : 0}%` }} />
          </div>
          <span className="perf-metric-sub">
            {latest?.cores ? ui('최고 {v0}% · {v1}코어', { v0: summary.peakCpu, v1: latest.cores }) : ui('최고 {v0}%', { v0: summary.peakCpu })}
          </span>
        </div>

        <div className="perf-metric-card">
          <span className="perf-metric-label">{ui('프레임 시간')}</span>
          <strong className="perf-metric-value">
            {latest ? `${latest.frameTimeMs}ms` : '—'}
          </strong>
          <span className="perf-metric-sub">
            {latest ? ui('최대 {v0}ms', { v0: latest.maxFrameMs }) : '—'}
          </span>
        </div>

        <div className="perf-metric-card">
          <span className="perf-metric-label">{ui('JS 힙 메모리')}</span>
          <strong className="perf-metric-value">
            {latest?.usedHeapMb !== null && latest?.usedHeapMb !== undefined ? `${latest.usedHeapMb}MB` : ui('미지원')}
          </strong>
          <span className="perf-metric-sub">
            {latest?.heapLimitMb ? ui('한도 {v0}MB', { v0: latest.heapLimitMb }) : ui('브라우저 측정')}
          </span>
        </div>
      </div>

      <div className="perf-details-list">
        <div className="perf-detail-row">
          <span>{ui('렌더러')}</span>
          <strong title={latest?.gpuAdapter || rendererSummary}>{rendererSummary}</strong>
        </div>
        {latest?.gpuAdapter && (
          <div className="perf-detail-row">
            <span>GPU</span>
            <strong title={latest.gpuAdapter}>{latest.gpuAdapter}</strong>
          </div>
        )}
        <div className="perf-detail-row">
          <span>{ui('표시 객체')}</span>
          <strong>
            {latest
              ? `${latest.visibleObjects}/${latest.totalObjects} (DOM ${latest.domObjects})`
              : '—'}
          </strong>
        </div>
        <div className="perf-detail-row">
          <span>{ui('아틀라스 · 래스터')}</span>
          <strong>
            {latest
              ? ui('{v0}p · +{v1}/0.2s', { v0: latest.texturePages, v1: latest.rasterDelta })
              : '—'}
          </strong>
        </div>
      </div>
    </section>
  );
}
