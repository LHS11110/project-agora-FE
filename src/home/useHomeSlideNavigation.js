import { useEffect, useRef, useState } from 'react';
import { canScroll, getAdjacentSlide, HOME_SLIDES } from './slideConfig.js';

export function useHomeSlideNavigation() {
  const [activeSlide, setActiveSlide] = useState(0);
  const slideLabels = HOME_SLIDES.map(({ label }) => label);
  const activePosition = HOME_SLIDES[activeSlide];
  const wheelDeltaRef = useRef({ x: 0, y: 0 });
  const gestureStartRef = useRef(null);
  const navigationCooldownRef = useRef(0);
  const selectSlide = (index) => setActiveSlide(Math.max(0, Math.min(slideLabels.length - 1, index)));
  const moveInDirection = (rowOffset, columnOffset) => {
    const nextSlide = getAdjacentSlide(activeSlide, rowOffset, columnOffset);
    if (nextSlide < 0) return false;
    setActiveSlide(nextSlide);
    return true;
  };
  const moveFromGesture = (rowOffset, columnOffset) => {
    if (Date.now() < navigationCooldownRef.current) return;
    if (moveInDirection(rowOffset, columnOffset)) navigationCooldownRef.current = Date.now() + 620;
  };
  const handleWheel = (event) => {
    if (event.currentTarget.closest('[data-home-dragging="true"]')) return;
    if (Date.now() < navigationCooldownRef.current) return;
    const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    const target = event.target instanceof Element ? event.target : null;
    const contentPane = target?.closest('.home-slide-inner');
    if (vertical && canScroll(contentPane, Math.sign(event.deltaY))) {
      wheelDeltaRef.current = { x: 0, y: 0 };
      return;
    }

    const accumulated = wheelDeltaRef.current;
    accumulated.x += event.deltaX;
    accumulated.y += event.deltaY;
    if (Math.max(Math.abs(accumulated.x), Math.abs(accumulated.y)) < 42) return;

    const horizontal = Math.abs(accumulated.x) > Math.abs(accumulated.y);
    const rowOffset = horizontal ? 0 : Math.sign(accumulated.y);
    const columnOffset = horizontal ? Math.sign(accumulated.x) : 0;
    wheelDeltaRef.current = { x: 0, y: 0 };
    moveFromGesture(rowOffset, columnOffset);
  };
  const handleTouchStart = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('a, button, input, textarea, select, [data-home-draggable]')) {
      gestureStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    const contentPane = target?.closest('.home-slide-inner');
    const overflowY = contentPane ? window.getComputedStyle(contentPane).overflowY : 'visible';
    const maxScroll = contentPane && (overflowY === 'auto' || overflowY === 'scroll')
      ? Math.max(0, contentPane.scrollHeight - contentPane.clientHeight)
      : 0;
    if (touch) gestureStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollTop: contentPane?.scrollTop ?? 0,
      maxScroll,
    };
  };
  const handleTouchEnd = (event) => {
    const start = gestureStartRef.current;
    const touch = event.changedTouches[0];
    gestureStartRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 48) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) moveFromGesture(0, deltaX < 0 ? 1 : -1);
    else {
      const scrollDirection = deltaY < 0 ? 1 : -1;
      const contentCanScrollAtStart = start.maxScroll > 1 && (scrollDirection > 0
        ? start.scrollTop < start.maxScroll - 1
        : start.scrollTop > 1);
      if (!contentCanScrollAtStart) moveFromGesture(scrollDirection, 0);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (target?.closest('a, button')) return;
      const directions = {
        ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1],
      };
      if (directions[event.key]) {
        const [rowOffset, columnOffset] = directions[event.key];
        const contentPane = target?.closest('.home-slide-inner');
        if (rowOffset !== 0 && canScroll(contentPane, rowOffset)) return;
        const nextSlide = getAdjacentSlide(activeSlide, rowOffset, columnOffset);
        if (nextSlide >= 0) {
          event.preventDefault();
          setActiveSlide(nextSlide);
        }
        return;
      }
      if (event.key === 'PageDown') { event.preventDefault(); setActiveSlide((slide) => Math.min(slideLabels.length - 1, slide + 1)); }
      if (event.key === 'PageUp') { event.preventDefault(); setActiveSlide((slide) => Math.max(0, slide - 1)); }
      if (event.key === 'Home') setActiveSlide(0);
      if (event.key === 'End') setActiveSlide(slideLabels.length - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSlide, slideLabels.length]);

  return { activeSlide, activePosition, slideLabels, selectSlide, handleWheel, handleTouchStart, handleTouchEnd };
}
