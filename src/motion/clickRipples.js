export function createClickRipples(layer, { prominent = false } = {}) {
  const rings = new Set();
  const remove = (ring) => { rings.delete(ring); ring.remove(); };
  const clear = () => {
    rings.forEach((ring) => { ring.getAnimations().forEach((animation) => animation.cancel()); ring.remove(); });
    rings.clear();
  };
  const drop = ({ x, y }) => {
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('span');
      ring.className = 'pointer-water-ring';
      ring.style.left = `${x}px`; ring.style.top = `${y}px`;
      layer.append(ring); rings.add(ring);
      const animation = ring.animate([{ opacity: prominent ? .95 : .8, scale: .15 }, { opacity: 0, scale: prominent ? 3.2 : 2.5 }], { duration: prominent ? 1800 : 1400, delay: i * 140, easing: 'ease-out' });
      animation.onfinish = () => remove(ring); animation.oncancel = () => remove(ring);
    }
    while (rings.size > 18) {
      const ring = rings.values().next().value;
      ring.getAnimations().forEach((animation) => animation.cancel()); remove(ring);
    }
  };
  return { drop, clear };
}
