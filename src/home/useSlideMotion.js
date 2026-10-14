import { useLayoutEffect, useRef } from 'react';
import { playSlideEntrance } from './slideEntrance.js';
import { playDiagramMotion } from './diagramMotion.js';

export function useSlideMotion(activeSlide, enabled = true) {
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  const previousSlideRef = useRef(null);
  useLayoutEffect(() => {
    const slides = trackRef.current?.querySelectorAll('.home-slide') || [];
    slides.forEach((slide, index) => {
      const active = enabled && index === activeSlide;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
    if (!enabled) return undefined;
    const previous = previousSlideRef.current;
    previousSlideRef.current = activeSlide;
    const stopEntrance = playSlideEntrance(slides[activeSlide], {
      direction: previous === null || activeSlide >= previous ? 1 : -1,
      initial: previous === null,
    });
    const stopDiagram = playDiagramMotion(slides[activeSlide]);
    return () => { stopEntrance(); stopDiagram(); };
  }, [activeSlide, enabled]);
  return { windowRef, trackRef };
}
