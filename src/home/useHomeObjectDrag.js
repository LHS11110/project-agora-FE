import { useEffect } from 'react';
import './home-object-drag.css';

// Select semantic objects, rather than individual glyphs inside a card or formula.
const OBJECTS = [
  '.marketing-header .frelog-brand-lockup', '.marketing-header a', '.marketing-header button',
  '.home-slide-controls button', '.slide-counter',
  '.home-slide-copy > h1', '.home-slide-copy > p', '.home-slide-kicker',
  '.home-slide-actions > *', '.home-slide-note', '.home-scroll-hint', '.underlined-link',
  '.slide-desk-object', '.slide-desk-hint', '.scene-object', '.scene-connect-toggle',
  '.scene-brand', '.scene-presence', '.scene-caption', '.hero-side-note',
  '.knowledge-tile', '[data-diagram-node]', '.architecture-tags i',
  '.architecture-showcase-label', '.architecture-flow-arrow', '.architecture-storage-connector',
  '.architecture-showcase-foot', '.vector-showcase-label', '.vector-showcase-caption',
  '.vector-slide-metrics > span', '.architecture-slide-note', '.collab-card-row article',
  '.live-edit-showcase', '.text-edit-showcase', '.shared-cursor', '.formula-preview',
  '.slide-context-card', '.start-slide-card > h1', '.start-slide-card > p',
  '.start-slide-links > *', '.start-star', '.home-slide-copy > .button',
].join(',');

/** Independent translate leaves each object's existing transform and animation intact. */
export function useHomeObjectDrag(pageRef, activeSlide) {
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    const objects = [...page.querySelectorAll(OBJECTS)];
    objects.forEach(element => element.setAttribute('data-home-draggable', ''));
    const returns = new Map();
    let gesture = null;
    let frame = 0;
    let suppressClick = false;
    let clickTimer = 0;
    const restore = state => {
      state.element.style.translate = state.translate;
      state.element.style.zIndex = state.zIndex;
      state.element.style.position = state.position;
      state.element.removeAttribute('data-home-dragging');
    };
    const delta = state => {
      const x = state.latestX - state.x, y = state.latestY - state.y;
      const matrix = state.svgMatrix;
      return matrix ? { x: matrix.a * x + matrix.c * y, y: matrix.b * x + matrix.d * y } : { x, y };
    };
    const draw = () => {
      frame = 0;
      if (!gesture?.moved) return;
      const offset = delta(gesture);
      gesture.element.style.translate = `${offset.x}px ${offset.y}px`;
    };
    const finish = (event, immediate = false) => {
      const state = gesture;
      if (!state || (event?.pointerId != null && event.pointerId !== state.pointerId)) return;
      if (frame) { cancelAnimationFrame(frame); draw(); }
      gesture = null;
      delete page.dataset.homeDragging;
      if (page.hasPointerCapture(state.pointerId)) page.releasePointerCapture(state.pointerId);
      if (!state.moved) return;
      suppressClick = true;
      clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => { suppressClick = false; }, 400);
      const from = state.element.style.translate;
      restore(state);
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const animation = state.element.animate([
        { translate: from }, { translate: state.restTranslate },
      ], { duration: 520, easing: 'cubic-bezier(.2,.9,.25,1)' });
      returns.set(state.element, { animation, state });
      animation.finished.then(() => {
        if (returns.get(state.element)?.animation === animation) returns.delete(state.element);
      }).catch(() => {});
    };
    const down = event => {
      if (event.button !== 0 || !event.isPrimary || gesture) return;
      const element = event.target instanceof Element ? event.target.closest('[data-home-draggable]') : null;
      if (!element || !page.contains(element) || element.closest('[inert]') || element.matches(':disabled')) return;
      suppressClick = false;
      clearTimeout(clickTimer);
      const returning = returns.get(element);
      if (returning) { returning.animation.cancel(); returns.delete(element); }
      // An entrance's translate must not mask movement when an object is grabbed immediately.
      element.getAnimations().forEach(animation => {
        if (animation.effect?.getKeyframes().some(keyframe => keyframe.translate != null)) animation.cancel();
      });
      const computed = getComputedStyle(element);
      gesture = {
        element, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        latestX: event.clientX, latestY: event.clientY, moved: false,
        translate: element.style.translate, restTranslate: computed.translate,
        position: element.style.position, zIndex: element.style.zIndex,
        svgMatrix: element instanceof SVGGraphicsElement ? element.getScreenCTM()?.inverse() : null,
      };
      // Existing object feedback still receives clicks, but drag ownership stays here.
      event.stopPropagation();
    };
    const move = event => {
      const state = gesture;
      if (!state || state.pointerId !== event.pointerId) return;
      state.latestX = event.clientX; state.latestY = event.clientY;
      if (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 5) return;
      if (!state.moved) {
        state.moved = true;
        page.setPointerCapture(event.pointerId);
        page.dataset.homeDragging = 'true';
        state.element.dataset.homeDragging = 'true';
        if (getComputedStyle(state.element).position === 'static' && !(state.element instanceof SVGElement)) state.element.style.position = 'relative';
        state.element.style.zIndex = '100';
      }
      event.preventDefault(); event.stopPropagation();
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const up = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const moved = gesture.moved;
      finish(event);
      if (moved) { event.preventDefault(); event.stopPropagation(); }
    };
    const click = event => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault(); event.stopPropagation();
    };
    const cancel = event => finish(event);
    const blur = () => finish(null);
    const escape = event => { if (event.key === 'Escape' && gesture) finish(null); };
    page.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    page.addEventListener('lostpointercapture', cancel, true);
    page.addEventListener('click', click, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', blur);
    window.addEventListener('keydown', escape);
    return () => {
      finish(null, true);
      cancelAnimationFrame(frame); clearTimeout(clickTimer);
      returns.forEach(({ animation, state }) => { animation.cancel(); restore(state); });
      objects.forEach(element => element.removeAttribute('data-home-draggable'));
      page.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      page.removeEventListener('lostpointercapture', cancel, true);
      page.removeEventListener('click', click, true);
      window.removeEventListener('blur', blur); window.removeEventListener('resize', blur);
      window.removeEventListener('keydown', escape);
    };
  }, [pageRef, activeSlide]);
}
