import { useEffect } from 'react';
import { createMotionParticles, paintMotionField } from './motionFieldPainter.js';

export function useMotionField(canvasRef, quiet) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const scope = canvas?.parentElement?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!scope || !ctx) return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const state = {
      width: 0, height: 0, particles: createMotionParticles(quiet ? 18 : 38), waves: [],
      pointer: { active: false, x: 0, y: 0, targetX: 0, targetY: 0 },
    };
    let frame = 0;
    let previous = 0;
    let visible = true;
    const render = (now) => {
      frame = 0;
      if (preference.matches || document.hidden || !visible) return;
      if (quiet && previous && now - previous < 1000 / 30) {
        frame = requestAnimationFrame(render);
        return;
      }
      paintMotionField(ctx, state, now, previous ? now - previous : 16.67, quiet);
      previous = now;
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (preference.matches || document.hidden || !visible) {
        cancelAnimationFrame(frame); frame = 0; previous = 0;
        if (preference.matches) ctx.clearRect(0, 0, state.width, state.height);
      } else if (!frame) { previous = 0; frame = requestAnimationFrame(render); }
    };
    const resize = () => {
      const bounds = canvas.parentElement.getBoundingClientRect();
      state.width = bounds.width; state.height = bounds.height;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const locate = (event) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const move = (event) => {
      if (preference.matches || (quiet && event.buttons)) { state.pointer.active = false; return; }
      if (event.pointerType === 'touch') return;
      const { x, y } = locate(event);
      if (!state.pointer.active) { state.pointer.x = x; state.pointer.y = y; }
      Object.assign(state.pointer, { active: true, targetX: x, targetY: y });
    };
    const leave = () => { state.pointer.active = false; };
    const press = (event) => {
      if (preference.matches || event.button !== 0) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [data-item-id]')) return;
      const { x, y } = locate(event);
      state.waves.push({ x, y, started: performance.now() });
      state.waves = state.waves.slice(-5);
      if (quiet) { leave(); return; }
      state.particles.forEach((particle) => {
        const dx = particle.x - x, dy = particle.y - y;
        const distance = Math.hypot(dx, dy) || 1;
        const strength = Math.max(0, 1 - distance / 240) * 10;
        particle.vx += dx / distance * strength; particle.vy += dy / distance * strength;
      });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
    intersectionObserver.observe(canvas);
    scope.addEventListener('pointermove', move, { passive: true });
    scope.addEventListener('pointerleave', leave);
    scope.addEventListener('pointerdown', press, { passive: true, capture: true });
    document.addEventListener('visibilitychange', resume);
    preference.addEventListener('change', resume);
    resize(); resume();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      scope.removeEventListener('pointermove', move);
      scope.removeEventListener('pointerleave', leave);
      scope.removeEventListener('pointerdown', press, true);
      document.removeEventListener('visibilitychange', resume);
      preference.removeEventListener('change', resume);
    };
  }, [canvasRef, quiet]);
}
