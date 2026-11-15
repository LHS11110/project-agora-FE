import { createContext, useContext } from 'react';
import { animationFrames, defaultAnimation, hasAnimation } from './portfolioModel.js';
import { readObjectVisibility } from '../styling/objectStyleModel.js';

export const VisibilityContext = createContext({ previewHidden: false });

export function useVisibilityPreview() {
  return useContext(VisibilityContext);
}

/**
 * Evaluate the current visibility and reveal-after-animation phase of a canvas item.
 * Deterministic across author and viewer clients using committed `animationPlayback.startedAt`.
 */
export function getObjectRevealPhase(item, now = Date.now()) {
  const { hidden, revealAfterAnimation } = readObjectVisibility(item);
  if (!hidden) {
    return {
      hiddenFlag: false,
      revealAfterAnimation,
      phase: 'visible',
      startedAt: 0,
      delay: 0,
      duration: 0,
      revealAt: 0,
      completeAt: 0,
    };
  }
  if (!revealAfterAnimation) {
    return {
      hiddenFlag: true,
      revealAfterAnimation: false,
      phase: 'hidden',
      startedAt: 0,
      delay: 0,
      duration: 0,
      revealAt: 0,
      completeAt: 0,
    };
  }

  const playback = item?.animationPlayback;
  const config = playback?.config || item?.animation || defaultAnimation();
  const delay = Math.max(0, Number(config?.delay) || 0);
  const duration = Math.max(100, Number(config?.duration) || 1000);
  const startedAt = Number(playback?.startedAt) || 0;

  if (!playback || playback.action !== 'play' || startedAt <= 0) {
    return {
      hiddenFlag: true,
      revealAfterAnimation: true,
      phase: 'hidden',
      startedAt: 0,
      delay,
      duration,
      revealAt: 0,
      completeAt: 0,
    };
  }

  const revealAt = startedAt + delay;
  const completeAt = revealAt + duration;
  const phase = now < revealAt ? 'delayed' : now < completeAt ? 'animating' : 'revealed';

  return {
    hiddenFlag: true,
    revealAfterAnimation: true,
    phase,
    startedAt,
    delay,
    duration,
    revealAt,
    completeAt,
  };
}

/**
 * Return true while an item should be completely invisible and non-interactive on stage
 * (unless preview mode is enabled by the editor).
 */
export function isObjectInvisibleAtTime(item, now = Date.now()) {
  const { phase } = getObjectRevealPhase(item, now);
  return phase === 'hidden' || phase === 'delayed';
}

/**
 * Return true when an item should be omitted from rendered stage entries completely
 * (permanently hidden or awaiting reveal play, when hidden preview mode is off).
 */
export function shouldOmitFromScene(item, { previewHidden = false, now = Date.now() } = {}) {
  if (previewHidden) return false;
  const { phase } = getObjectRevealPhase(item, now);
  return phase === 'hidden';
}

/**
 * Return true when an item should temporarily render in DOM instead of Pixi so preview outlines
 * or pre-delay reveal animation frames do not clash with opaque Pixi drawing.
 */
export function shouldUseVisibilityDom(item, { previewHidden = false, now = Date.now() } = {}) {
  const { hiddenFlag, revealAfterAnimation, phase } = getObjectRevealPhase(item, now);
  if (!hiddenFlag) return false;
  if (previewHidden && (phase === 'hidden' || phase === 'delayed')) return true;
  if (revealAfterAnimation && (phase === 'delayed' || phase === 'animating')) return true;
  return false;
}

/**
 * Find milliseconds until the next reveal transition (`startedAt + delay` or `startedAt + delay + duration`),
 * or `null` if no active reveal animation is running or queued.
 */
export function nextRevealBoundaryDelay(items, now = Date.now()) {
  if (!items || typeof items !== 'object') return null;
  let earliest = Infinity;
  for (const item of Object.values(items)) {
    const state = getObjectRevealPhase(item, now);
    if (!state.hiddenFlag || !state.revealAfterAnimation) continue;
    if (state.phase === 'delayed' && state.revealAt > now) {
      earliest = Math.min(earliest, state.revealAt);
    } else if (state.phase === 'animating' && state.completeAt > now) {
      earliest = Math.min(earliest, state.completeAt);
    }
  }
  if (!Number.isFinite(earliest)) return null;
  return Math.max(16, Math.min(30000, earliest - now + 16));
}

/**
 * Return the object's animation config, or default to a clean fade-in when triggering reveal-after-animation.
 */
export function ensureRevealAnimationConfig(item) {
  if (hasAnimation(item)) return item.animation;
  return { ...defaultAnimation(), effect: 'fade', duration: 700 };
}

/**
 * Build WAAPI keyframes; for non-entrance effects on a hidden-reveal object, smoothly fade opacity 0 -> 1.
 */
export function effectiveAnimationFrames(config, fadeInFromHidden = false) {
  const frames = animationFrames(config);
  if (!fadeInFromHidden || !frames.length) return frames;
  if (['fade', 'slide-up', 'slide-left', 'zoom'].includes(config.effect)) return frames;
  return frames.map((frame, index) => (index === 0 ? { ...frame, opacity: 0 } : { ...frame, opacity: 1 }));
}
