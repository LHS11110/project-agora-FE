import { createLiquidRipple } from 'liquid-ripple';
import { createClickRipples } from './clickRipples.js';
import { waterAppearance } from './waterAppearance.js';

export function createWaterSurface(layer) {
  const scene = layer.parentElement, canvas = layer.querySelector('canvas');
  const appearance = waterAppearance(scene);
  layer.dataset.waterTone = appearance.dark ? 'dark' : 'light';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clicks = createClickRipples(layer, { prominent: appearance.home });
  let water = null, visible = false, previous = null, lastDrop = 0;
  const sync = () => {
    if (reduced.matches || document.hidden || !visible) {
      water?.pause(); previous = null; clicks.clear();
      layer.dataset.waterState = reduced.matches ? 'reduced' : 'paused';
      return;
    }
    if (!water && !appearance.home) {
      water = createLiquidRipple(canvas, {
        ...appearance.options,
        onUnsupported: () => { layer.dataset.waterState = 'unsupported'; },
      });
    }
    if (appearance.home) layer.dataset.waterState = 'click-only';
    else if (water) { water.resume(); layer.dataset.waterState = 'active'; }
  };
  const pointAt = (event) => {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const move = (event) => {
    if (reduced.matches || document.hidden || !visible || event.pointerType === 'touch') return;
    const point = pointAt(event), now = performance.now();
    if (previous && (Math.hypot(point.x - previous.x, point.y - previous.y) < appearance.distance || now - lastDrop < appearance.interval)) return;
    water?.drop(point.x, point.y, 'canvas'); previous = point; lastDrop = now;
  };
  const pulse = (event) => {
    if (reduced.matches || document.hidden || !visible || event.target.closest?.('input, textarea, select')) return;
    const point = pointAt(event);
    water?.drop(point.x, point.y, 'canvas'); clicks.drop(point);
  };
  const leave = () => { previous = null; };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .02 });
  observer.observe(layer);
  if (!appearance.home) {
    scene.addEventListener('pointermove', move, { passive: true });
    scene.addEventListener('pointerleave', leave);
  }
  scene.addEventListener('pointerdown', pulse, { passive: true });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  return () => {
    observer.disconnect(); clicks.clear(); water?.destroy();
    scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerleave', leave); scene.removeEventListener('pointerdown', pulse);
    reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
  };
}
