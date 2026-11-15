import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasAdvancedStyle,
  isHideableObject,
  isObjectHidden,
  readObjectStyle,
  readObjectVisibility,
  writeObjectStylePatch,
  writeObjectVisibilityPatch,
} from '../src/canvas/styling/objectStyleModel.js';
import { extractStyleBundle, applyStyleBundlePatch } from '../src/canvas/styling/styleClipboard.js';
import {
  effectiveAnimationFrames,
  ensureRevealAnimationConfig,
  getObjectRevealPhase,
  isObjectInvisibleAtTime,
  nextRevealBoundaryDelay,
  shouldOmitFromScene,
  shouldUseVisibilityDom,
} from '../src/canvas/portfolio/animationReveal.js';

const BE_ALLOWED_FIELDS = new Set([
  'frameId', 'animationPriority', 'frameOrder', 'frameLinkPriority', 'portfolioCursor',
  'animation', 'animationPlayback', 'portfolioPages', 'portfolioDescription',
  'kind', 'text', 'code', 'formula', 'format', 'filename', 'language',
  'shapeType', 'visualStyle', 'volumeStyle', 'chartType', 'color', 'fill',
  'permission', 'groupId', 'src', 'url', 'title', 'mediaType',
  'from', 'to', 'fromPort', 'toPort', 'startHead', 'endHead', 'brush',
  'embedUrl', 'videoId', 'renderMode', 'label', 'labelMode', 'groupTitle',
  'thumbnail', 'cornerStyle', 'runtimeRole', 'shadowBlur', 'shadowOpacity',
  'shadowOffsetX', 'shadowOffsetY', 'depth', 'x', 'y', 'width', 'height',
  'rotation', 'fontSize', 'strokeWidth', 'bend', 'opacity',
  'fillOpacity', 'sketchFillOpacity', 'points', 'rows', 'columns',
  'simulatePressure', 'complete', 'strokeEnabled', 'shadowEnabled',
  'locked', 'imageFrameEnabled', 'bendPoints', 'members',
]);

test('writeObjectVisibilityPatch uses BE-allowed fields (`brush` / `format`) and preserves existing styles', () => {
  const shape = { kind: 'shape', shapeType: 'rectangle', visualStyle: 'sketch', x: 0.1, y: 0.1, width: 0.2, height: 0.12 };
  const hiddenPatch = writeObjectVisibilityPatch(shape, { hidden: true, revealAfterAnimation: true });
  assert.ok(hiddenPatch);
  assert.deepEqual(Object.keys(hiddenPatch), ['brush']);
  assert.ok(BE_ALLOWED_FIELDS.has('brush'));

  const hiddenShape = { ...shape, ...hiddenPatch };
  assert.equal(isObjectHidden(hiddenShape), true);
  assert.deepEqual(readObjectVisibility(hiddenShape), { hidden: true, revealAfterAnimation: true });
  assert.equal(hasAdvancedStyle(hiddenShape), false, 'visibility-only metadata keeps sketch/standard Pixi pipeline intact');

  // Visual style edit preserves hidden & revealAfterAnimation
  const styledPatch = writeObjectStylePatch(hiddenShape, (cur) => ({
    ...cur,
    cornerRadius: { linked: true, tl: 16, tr: 16, br: 16, bl: 16, explicit: true },
  }));
  const styledHiddenShape = { ...hiddenShape, ...styledPatch };
  assert.deepEqual(readObjectVisibility(styledHiddenShape), { hidden: true, revealAfterAnimation: true });
  assert.equal(readObjectStyle(styledHiddenShape).cornerRadius.tl, 16);
  assert.equal(hasAdvancedStyle(styledHiddenShape), true);

  // Stroke uses `format`
  const stroke = { kind: 'stroke', color: '#111111', points: [[0.1, 0.1], [0.2, 0.2]] };
  const strokeHiddenPatch = writeObjectVisibilityPatch(stroke, { hidden: true });
  assert.deepEqual(Object.keys(strokeHiddenPatch), ['format']);
  assert.equal(isObjectHidden({ ...stroke, ...strokeHiddenPatch }), true);

  // Clearing visibility returns clean empty envelope
  const shownPatch = writeObjectVisibilityPatch(hiddenShape, { hidden: false, revealAfterAnimation: false });
  assert.equal(shownPatch.brush, '');
  assert.equal(isHideableObject({ kind: 'portfolio' }), false);
  assert.equal(isHideableObject(shape), true);
});

test('style clipboard preserves destination object hidden/reveal visibility flags', () => {
  const source = { kind: 'shape', shapeType: 'rectangle', fill: '#ef4444' };
  const targetBase = { kind: 'shape', shapeType: 'rectangle', fill: '#ffffff' };
  const target = { ...targetBase, ...writeObjectVisibilityPatch(targetBase, { hidden: true, revealAfterAnimation: true }) };
  const bundle = extractStyleBundle(source);
  const pasted = { ...target, ...applyStyleBundlePatch(target, bundle) };
  assert.deepEqual(readObjectVisibility(pasted), { hidden: true, revealAfterAnimation: true });
});

test('reveal-after-animation timeline deterministically transitions hidden -> delayed -> animating -> revealed', () => {
  const base = {
    kind: 'shape',
    shapeType: 'rectangle',
    animation: { effect: 'fade', duration: 700, delay: 500, loop: false, easing: 'ease-in-out', distance: 40 },
  };
  const item = {
    ...base,
    ...writeObjectVisibilityPatch(base, { hidden: true, revealAfterAnimation: true }),
  };

  // Before playback
  assert.equal(getObjectRevealPhase(item, 10000).phase, 'hidden');
  assert.equal(isObjectInvisibleAtTime(item, 10000), true);
  assert.equal(shouldOmitFromScene(item, { previewHidden: false, now: 10000 }), true);
  assert.equal(shouldOmitFromScene(item, { previewHidden: true, now: 10000 }), false);
  assert.equal(shouldUseVisibilityDom(item, { previewHidden: true, now: 10000 }), true);

  // Playback queued optimistically (startedAt === 0)
  const optimistic = { ...item, animationPlayback: { runId: 'r1', action: 'play', startedAt: 0, config: base.animation } };
  assert.equal(getObjectRevealPhase(optimistic, 10000).phase, 'hidden');

  // Committed playback: startedAt = 10000, delay = 500 (revealAt = 10500), duration = 700 (completeAt = 11200)
  const playing = { ...item, animationPlayback: { runId: 'r1', action: 'play', startedAt: 10000, config: base.animation } };

  // During delay
  assert.equal(getObjectRevealPhase(playing, 10200).phase, 'delayed');
  assert.equal(isObjectInvisibleAtTime(playing, 10200), true);
  assert.equal(shouldOmitFromScene(playing, { previewHidden: false, now: 10200 }), false);
  assert.equal(shouldUseVisibilityDom(playing, { previewHidden: false, now: 10200 }), true);
  assert.equal(nextRevealBoundaryDelay({ a: playing }, 10200), 316);

  // During animation
  assert.equal(getObjectRevealPhase(playing, 10600).phase, 'animating');
  assert.equal(isObjectInvisibleAtTime(playing, 10600), false);
  assert.equal(shouldUseVisibilityDom(playing, { previewHidden: false, now: 10600 }), true);
  assert.equal(nextRevealBoundaryDelay({ a: playing }, 10600), 616);

  // After animation completes -> stays visible/revealed!
  assert.equal(getObjectRevealPhase(playing, 11250).phase, 'revealed');
  assert.equal(isObjectInvisibleAtTime(playing, 11250), false);
  assert.equal(shouldOmitFromScene(playing, { previewHidden: false, now: 11250 }), false);
  assert.equal(shouldUseVisibilityDom(playing, { previewHidden: false, now: 11250 }), false);
  assert.equal(nextRevealBoundaryDelay({ a: playing }, 11250), null);

  // Stopping playback returns item to hidden cleanly
  const stopped = { ...playing, animationPlayback: { runId: 'r2', action: 'stop', startedAt: 12000, config: base.animation } };
  assert.equal(getObjectRevealPhase(stopped, 12500).phase, 'hidden');
  assert.equal(isObjectInvisibleAtTime(stopped, 12500), true);
});

test('ensureRevealAnimationConfig defaults none -> fade and effectiveAnimationFrames fades in non-entrance effects', () => {
  const noAnim = { kind: 'text', text: 'hi' };
  const cfg = ensureRevealAnimationConfig(noAnim);
  assert.equal(cfg.effect, 'fade');
  assert.equal(cfg.duration, 700);

  const pulseFrames = effectiveAnimationFrames({ effect: 'pulse', distance: 40 }, true);
  assert.equal(pulseFrames[0].opacity, 0);
  assert.equal(pulseFrames[1].opacity, 1);
  assert.equal(pulseFrames[2].opacity, 1);

  const zoomFrames = effectiveAnimationFrames({ effect: 'zoom', distance: 40 }, true);
  assert.deepEqual(zoomFrames, [{ opacity: 0, scale: '.8' }, { opacity: 1, scale: '1' }]);
});
