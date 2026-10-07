import './diagram-motion.css';

/** Run only the visible slide's diagram; restart its flow on every visit. */
export function playDiagramMotion(slide) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!slide || preference.matches) return () => {};
  const animations = [];
  const edges = [...slide.querySelectorAll('[data-diagram-edge]')];
  const nodes = [...slide.querySelectorAll('[data-diagram-node]')];
  if (!edges.length && !nodes.length) return () => {};
  const packets = edges.map(edge => ({
    edge, dot: edge.parentElement.querySelector('[data-diagram-packet]'),
    length: edge.getTotalLength(), level: Number(edge.dataset.level),
  }));
  slide.classList.add('is-diagram-active');
  nodes.forEach((node, index) => {
    const level = Number(node.dataset.level);
    if (node.animate) animations.push(node.animate([
      { opacity: 0, scale: '.94' }, { opacity: 1, scale: '1' },
    ], { duration: 700, delay: 400 + level * 430 + index % 3 * 80, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards' }));
  });
  for (const { edge, length, level } of packets) {
    if (edge.animate) animations.push(edge.animate([
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: String(length), opacity: 0 },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: '0', opacity: 1 },
    ], { duration: 800, delay: 650 + level * 430, easing: 'ease-out', fill: 'backwards' }));
  }
  const start = performance.now();
  let frame = 0;
  const draw = now => {
    const cycle = (now - start) % 6000;
    for (const { edge, dot, length, level } of packets) {
      if (!dot) continue;
      const progress = (cycle - (500 + level * 1600)) / 1200;
      if (progress < 0 || progress > 1) { dot.setAttribute('opacity', '0'); continue; }
      const point = edge.getPointAtLength(length * progress);
      dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y);
      dot.setAttribute('opacity', Math.min(1, progress * 8, (1 - progress) * 8));
    }
    frame = requestAnimationFrame(draw);
  };
  if (packets.length) frame = requestAnimationFrame(draw);
  const stop = () => {
    cancelAnimationFrame(frame);
    animations.forEach(animation => animation.cancel());
    slide.classList.remove('is-diagram-active');
    packets.forEach(({ dot }) => dot?.setAttribute('opacity', '0'));
  };
  const onChange = () => { if (preference.matches) stop(); };
  preference.addEventListener('change', onChange);
  return () => { preference.removeEventListener('change', onChange); stop(); };
}
