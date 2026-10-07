import './click-fireworks.css';

/** Short, bounded bursts anchored to the original click position. */
export function createClickFireworks(layer, { dark = false } = {}) {
  const bursts = new Set();
  const colors = dark
    ? ['#ffe39c', '#a9edff', '#d3b6ff', '#ffb8cd', '#b8efae']
    : ['#bf781f', '#328ca8', '#8a65c9', '#d76586', '#599b63'];
  const remove = (burst) => {
    bursts.delete(burst);
    burst.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    burst.remove();
  };
  const clear = () => [...bursts].forEach(remove);
  const drop = ({ x, y }) => {
    while (bursts.size >= 6) remove(bursts.values().next().value);
    const burst = document.createElement('span');
    burst.className = 'pointer-firework';
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;
    const animations = [];
    for (let i = 0; i < 28; i++) {
      const spark = document.createElement('span');
      spark.className = 'pointer-firework-spark';
      const angle = i / 28 * Math.PI * 2 + (Math.random() - .5) * .12;
      const distance = 45 + Math.random() * 85;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = `${angle * 180 / Math.PI}deg`;
      spark.style.background = colors[i % colors.length];
      spark.style.width = `${i % 3 === 0 ? 8 : 4}px`;
      burst.append(spark);
      animations.push(spark.animate([
        { transform: `translate(-50%, -50%) rotate(${rotation}) scale(.4)`, opacity: 1 },
        { transform: `translate(${dx * .65}px, ${dy * .65}px) rotate(${rotation}) scale(1)`, opacity: .9, offset: .4 },
        { transform: `translate(${dx}px, ${dy + 32}px) rotate(${rotation}) scale(.15)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 400, easing: 'cubic-bezier(.16,.65,.35,1)', fill: 'forwards' }));
    }
    layer.append(burst);
    bursts.add(burst);
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => remove(burst));
  };
  return { drop, clear };
}
