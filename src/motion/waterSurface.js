import { createLiquidRipple } from 'liquid-ripple';
import { createClickRipples } from './clickRipples.js';

export function createWaterSurface(layer) {
  const scene = layer.parentElement, canvas = layer.querySelector('canvas');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clicks = createClickRipples(layer);
  let water = null, visible = false, previous = null, lastDrop = 0;
  const sync = () => {
    if (reduced.matches || document.hidden || !visible) {
      water?.pause(); previous = null; clicks.clear();
      layer.dataset.waterState = reduced.matches ? 'reduced' : 'paused';
      return;
    }
    if (!water) {
      const dark = scene.matches('.slide-start, .auth-visual-panel');
      water = createLiquidRipple(canvas, {
        interactive: false, ambient: 0, maxRipples: 20, dprCap: 1,
        opacity: dark ? .35 : .3,
        palette: dark
          ? { top: '#39324c', bottom: '#334e59', glint: '#c9eaec' }
          : { top: '#f6f7f1', bottom: '#b6d4d5', glint: '#ffffff' },
        wave: { swell: .15, amplitude: .42, ringSpeed: .22, decay: 1.3, wavelength: 45, life: 3, refraction: .2, caustics: .12, specular: .7 },
        onUnsupported: () => { layer.dataset.waterState = 'unsupported'; },
      });
    }
    if (water) { water.resume(); layer.dataset.waterState = 'active'; }
  };
  const pointAt = (event) => {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const move = (event) => {
    if (reduced.matches || document.hidden || !visible || event.pointerType === 'touch') return;
    const point = pointAt(event), now = performance.now();
    if (previous && (Math.hypot(point.x - previous.x, point.y - previous.y) < 10 || now - lastDrop < 60)) return;
    water?.drop(point.x, point.y, 'canvas'); previous = point; lastDrop = now;
  };
  const pulse = (event) => {
    if (reduced.matches || document.hidden || event.target.closest?.('input, textarea, select')) return;
    const point = pointAt(event);
    water?.drop(point.x, point.y, 'canvas'); clicks.drop(point);
  };
  const leave = () => { previous = null; };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .02 });
  observer.observe(layer);
  scene.addEventListener('pointermove', move, { passive: true });
  scene.addEventListener('pointerleave', leave);
  scene.addEventListener('pointerdown', pulse, { passive: true });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  return () => {
    observer.disconnect(); clicks.clear(); water?.destroy();
    scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerleave', leave); scene.removeEventListener('pointerdown', pulse);
    reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
  };
}
