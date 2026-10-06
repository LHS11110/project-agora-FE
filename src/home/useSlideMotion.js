import { useEffect, useRef } from 'react';

export function useSlideMotion(activeSlide) {
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  useEffect(() => {
    const slides = trackRef.current?.querySelectorAll('.home-slide') || [];
    slides.forEach((slide, index) => {
      const active = index === activeSlide;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
  }, [activeSlide]);
  return { windowRef, trackRef };
}
