import { useEffect } from 'react';
import './object-motion.css';

// Independent translate keeps the slide entrance and each object's rotation intact.
const selector = [
  '.home-slide-copy > h1', '.home-slide-copy > p', '.home-slide-kicker',
  '.home-slide-note', '.home-scroll-hint', '.hero-side-note',
  '.slide-desk-object', '.scene-object', '.scene-toolbar', '.scene-caption',
  '.home-slide-actions > *', '.underlined-link', '.scene-connect-toggle',
  '.architecture-node', '.architecture-storage-grid > article',
  '.architecture-flow-arrow', '.architecture-storage-connector',
  '.architecture-showcase-label', '.architecture-showcase-foot', '.architecture-slide-note',
  '.vector-slide-metrics > span', '.vector-showcase-label', '.vector-showcase-caption',
  '.project-map-object', '.collab-card-row > article', '.live-edit-showcase',
  '.text-edit-showcase', '.home-slide-copy > button',
  '.start-slide-card > h1', '.start-slide-card > p', '.start-slide-links > *', '.start-star',
].join(',');

export function useHomeObjectMotion(trackRef, activeSlide) {
  useEffect(() => {
    const slide = trackRef.current?.querySelectorAll('.home-slide')[activeSlide];
    if (!slide) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const entries = new Map();
    const page = slide.closest('.home-slides-page');
    const chromeSelector = '.marketing-header a, .marketing-header button, .home-slide-controls button, .slide-counter';
    const elements = [...slide.querySelectorAll(selector), ...page.querySelectorAll(chromeSelector)];
    elements.forEach((element, index) => {
      // Treat cards as one object, including their text and icons.
      if (element.parentElement?.closest(selector)) return;
      entries.set(element, { x: 0, y: 0, phase: index * 1.73, original: element.style.translate });
      element.classList.add('home-movable-object');
    });
    let drag = null, frame = 0, previous = performance.now(), suppressClick = false;
    const draw = (time) => {
      const dt = Math.min(64, time - previous); previous = time;
      for (const [element, state] of entries) {
        if (drag?.element !== element) {
          const decay = Math.exp(-dt / (reduced.matches ? 1 : 110));
          state.x *= decay; state.y *= decay;
        }
        const idle = drag?.element === element || reduced.matches ? 0 : 1;
        const x = state.x + Math.sin(time / 1900 + state.phase) * 2 * idle;
        const y = state.y + Math.cos(time / 2300 + state.phase) * 2.5 * idle;
        element.style.translate = `${x}px ${y}px`;
      }
      frame = requestAnimationFrame(draw);
    };
    const finish = (event) => {
      if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
      const { element, pointerId, moved } = drag;
      suppressClick = moved;
      drag = null;
      element.classList.remove('is-home-dragging');
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    };
    const down = (event) => {
      if (event.button !== 0 || drag) return;
      const element = event.target.closest?.('.home-movable-object');
      const state = entries.get(element);
      if (!state) return;
      suppressClick = false;
      const matrix = element instanceof SVGGraphicsElement ? element.getScreenCTM()?.inverse() : null;
      drag = { element, matrix, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: state.x, y: state.y, moved: false };
      element.classList.add('is-home-dragging');
      element.setPointerCapture(event.pointerId);
      event.stopPropagation();
    };
    const move = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      const state = entries.get(drag.element);
      const matrix = drag.matrix;
      state.x = drag.x + (matrix ? matrix.a * dx + matrix.c * dy : dx);
      state.y = drag.y + (matrix ? matrix.b * dx + matrix.d * dy : dy);
      event.preventDefault(); event.stopPropagation();
    };
    const up = (event) => {
      if (!drag) return;
      finish(event); event.stopPropagation();
    };
    const click = (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault(); event.stopPropagation();
    };
    const blur = () => finish({});
    const nativeDrag = (event) => {
      if (event.target.closest?.('.home-movable-object')) event.preventDefault();
    };
    const wheel = (event) => {
      if (drag) { event.preventDefault(); event.stopPropagation(); }
    };
    const handlers = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: finish, click, dragstart: nativeDrag };
    for (const [name, handler] of Object.entries(handlers)) page.addEventListener(name, handler, true);
    page.addEventListener('wheel', wheel, { capture: true, passive: false });
    window.addEventListener('blur', blur);
    frame = requestAnimationFrame(draw);
    return () => {
      finish({}); cancelAnimationFrame(frame);
      for (const [name, handler] of Object.entries(handlers)) page.removeEventListener(name, handler, true);
      page.removeEventListener('wheel', wheel, true);
      window.removeEventListener('blur', blur);
      for (const [element, state] of entries) {
        element.style.translate = state.original;
        element.classList.remove('home-movable-object', 'is-home-dragging');
      }
    };
  }, [trackRef, activeSlide]);
}
