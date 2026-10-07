import { useEffect, useRef } from 'react';
import { playSlideEntrance } from './slideEntrance.js';
import { playDiagramMotion } from './diagramMotion.js';

export function useSlideMotion(activeSlide) {
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  const previousSlideRef = useRef(null);
  useEffect(() => {
    const slides = trackRef.current?.querySelectorAll('.home-slide') || [];
    slides.forEach((slide, index) => {
      const active = index === activeSlide;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
    const previous = previousSlideRef.current;
    previousSlideRef.current = activeSlide;
    const stopEntrance = playSlideEntrance(slides[activeSlide], {
      direction: previous === null || activeSlide >= previous ? 1 : -1,
      initial: previous === null,
    });
    const stopDiagram = playDiagramMotion(slides[activeSlide]);
    return () => { stopEntrance(); stopDiagram(); };
  }, [activeSlide]);
  return { windowRef, trackRef };
}
