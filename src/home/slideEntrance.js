const easing = 'cubic-bezier(.2,.75,.2,1)';

/** Replay on every visit without remounting interactive objects or changing their transforms. */
export function playSlideEntrance(slide, { direction = 1, initial = false } = {}) {
  if (!slide || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const animations = [];
  const animate = (element, keyframes, delay, duration = 650) => {
    if (typeof element.animate !== 'function') return;
    const animation = element.animate(keyframes, { duration, delay, easing, fill: 'backwards' });
    animations.push(animation);
  };
  const arrival = initial ? 100 : 180;
  slide.querySelectorAll('.home-slide-copy > *, .start-slide-card > :not(.start-star)').forEach((element, index) => {
    animate(element, [
      { opacity: 0, translate: `0 ${18 + index * 2}px` },
      { opacity: 1, translate: '0 0' },
    ], arrival + index * 65);
  });
  slide.querySelectorAll('.hero-scene-setting, .architecture-showcase, .vector-showcase, .collab-showcase-stack').forEach(element => {
    animate(element, [
      { opacity: 0, translate: `${direction * 30}px 12px` },
      { opacity: 1, translate: '0 0' },
    ], arrival + 100, 800);
  });
  slide.querySelectorAll('.collab-card-row article, .start-star').forEach((element, index) => {
    animate(element, [
      { opacity: 0, scale: '.92', translate: '0 10px' },
      { opacity: 1, scale: '1', translate: '0 0' },
    ], arrival + 280 + index * 90, 600);
  });
  const cancel = () => animations.forEach(animation => animation.cancel());
  slide.querySelectorAll('.slide-context-card').forEach((element, index) => {
    animate(element, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], arrival + 400 + index * 85, 550);
  });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onPreferenceChange = () => { if (reduced.matches) cancel(); };
  reduced.addEventListener('change', onPreferenceChange);
  return () => {
    reduced.removeEventListener('change', onPreferenceChange);
    cancel();
  };
}
