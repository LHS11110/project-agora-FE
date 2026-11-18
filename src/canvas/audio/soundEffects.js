export const SOUND_CUE_PATTERNS = {
  voice_join: [
    { freq: 523.25, delay: 0, duration: 0.14, gain: 0.11, type: 'sine' },
    { freq: 659.25, delay: 0.065, duration: 0.15, gain: 0.11, type: 'sine' },
    { freq: 783.99, delay: 0.13, duration: 0.24, gain: 0.12, type: 'triangle' },
  ],
  voice_leave: [
    { freq: 783.99, delay: 0, duration: 0.12, gain: 0.1, type: 'sine' },
    { freq: 587.33, delay: 0.07, duration: 0.14, gain: 0.1, type: 'sine' },
    { freq: 523.25, delay: 0.14, duration: 0.22, gain: 0.11, type: 'triangle' },
  ],
  screen_share_start: [
    { freq: 659.25, delay: 0, duration: 0.12, gain: 0.1, type: 'sine' },
    { freq: 830.61, delay: 0.06, duration: 0.14, gain: 0.1, type: 'sine' },
    { freq: 987.77, delay: 0.12, duration: 0.16, gain: 0.11, type: 'triangle' },
    { freq: 1318.51, delay: 0.18, duration: 0.22, gain: 0.07, type: 'sine' },
  ],
  screen_share_stop: [
    { freq: 987.77, delay: 0, duration: 0.11, gain: 0.1, type: 'sine' },
    { freq: 830.61, delay: 0.06, duration: 0.13, gain: 0.1, type: 'sine' },
    { freq: 659.25, delay: 0.12, duration: 0.2, gain: 0.09, type: 'triangle' },
  ],
  mention: [
    { freq: 698.46, delay: 0, duration: 0.13, gain: 0.12, type: 'sine' },
    { freq: 1046.5, delay: 0.085, duration: 0.26, gain: 0.13, type: 'triangle' },
  ],
};

let sharedContext = null;
const lastPlayedByCue = new Map();

function getAudioContextClass() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

function ensureAudioContext() {
  const Ctx = getAudioContextClass();
  if (!Ctx) return null;
  if (!sharedContext || sharedContext.state === 'closed') {
    try {
      sharedContext = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

function schedulePattern(ctx, notes) {
  const baseTime = ctx.currentTime + 0.01;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  let remaining = notes.length;
  const cleanupMaster = () => {
    remaining -= 1;
    if (remaining <= 0) {
      try { master.disconnect(); } catch { /* Already disconnected. */ }
    }
  };

  for (const note of notes) {
    const startAt = baseTime + note.delay;
    const stopAt = startAt + note.duration;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = note.type || 'sine';
    osc.frequency.setValueAtTime(note.freq, startAt);

    env.gain.setValueAtTime(0.0001, startAt);
    env.gain.exponentialRampToValueAtTime(note.gain, startAt + 0.016);
    env.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    osc.connect(env);
    env.connect(master);
    osc.onended = () => {
      try { osc.disconnect(); } catch { /* Node already cleaned up. */ }
      try { env.disconnect(); } catch { /* Node already cleaned up. */ }
      cleanupMaster();
    };
    osc.start(startAt);
    osc.stop(stopAt + 0.02);
  }
}

/**
 * Unlocks or resumes the shared Web Audio context during user gestures.
 */
export function unlockSoundEffects() {
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

/**
 * Installs passive gesture listeners so WebSocket-driven cues (such as mentions)
 * can play after the first user interaction without blocking pointerdown.
 */
export function installSoundUnlock(target = globalThis.window) {
  if (!target?.addEventListener) return () => {};
  let disposed = false;
  let scheduled = false;
  let idleHandle = null;
  let timerHandle = null;

  const removeListeners = () => {
    target.removeEventListener('pointerup', scheduleUnlock, true);
    target.removeEventListener('keyup', scheduleUnlock, true);
    target.removeEventListener('touchend', scheduleUnlock, true);
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    removeListeners();
    if (idleHandle !== null && typeof globalThis.cancelIdleCallback === 'function') {
      globalThis.cancelIdleCallback(idleHandle);
    }
    if (timerHandle !== null) {
      globalThis.clearTimeout(timerHandle);
    }
    idleHandle = null;
    timerHandle = null;
  };

  const scheduleIdle = (delayMs = 1500) => {
    if (disposed) return;
    if (delayMs > 0) {
      timerHandle = globalThis.setTimeout(() => { timerHandle = null; scheduleIdle(0); }, delayMs);
      return;
    }
    if (typeof globalThis.requestIdleCallback === 'function') {
      idleHandle = globalThis.requestIdleCallback(runUnlock, { timeout: 2000 });
    } else {
      timerHandle = globalThis.setTimeout(runUnlock, 500);
    }
  };

  const runUnlock = () => {
    idleHandle = null;
    timerHandle = null;
    if (disposed) return;
    if (globalThis.document?.querySelector?.('.canvas-stage:is(.camera-moving, .camera-zooming, .panning, .camera-coasting)')) {
      scheduleIdle(1200);
      return;
    }
    unlockSoundEffects();
    cleanup();
  };

  const scheduleUnlock = () => {
    if (disposed || scheduled) return;
    scheduled = true;
    // Remove gesture hooks immediately so subsequent pan/zoom frames pay zero listener overhead.
    removeListeners();
    scheduleIdle(1500);
  };

  target.addEventListener('pointerup', scheduleUnlock, { passive: true, capture: true });
  target.addEventListener('keyup', scheduleUnlock, { passive: true, capture: true });
  target.addEventListener('touchend', scheduleUnlock, { passive: true, capture: true });
  return cleanup;
}

/**
 * Plays a short synthesized notification sound cue for voice, screen share, or mention events.
 */
export function playSoundCue(cue, { now = Date.now(), cooldownMs = 80 } = {}) {
  const notes = SOUND_CUE_PATTERNS[cue];
  if (!notes) return false;
  const prev = lastPlayedByCue.get(cue) || 0;
  if (now - prev < cooldownMs) return false;
  lastPlayedByCue.set(cue, now);

  if (typeof globalThis.window?.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
    globalThis.window.dispatchEvent(new globalThis.CustomEvent('agora:sound-cue', {
      detail: { cue, at: now },
    }));
  }

  const ctx = ensureAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => schedulePattern(ctx, notes)).catch(() => {});
    return true;
  }
  schedulePattern(ctx, notes);
  return true;
}

export function resetSoundCueState() {
  lastPlayedByCue.clear();
  if (sharedContext && sharedContext.state !== 'closed') {
    sharedContext.close().catch(() => {});
  }
  sharedContext = null;
}
