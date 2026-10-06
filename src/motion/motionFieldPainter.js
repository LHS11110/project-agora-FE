const COLORS = ['118,93,233', '255,139,114', '145,183,87'];
const SYMBOLS = ['+', '∞', '∑', '✦', '↗'];

export function createMotionParticles(count) {
  return Array.from({ length: count }, (_, index) => ({
    nx: Math.random(), ny: Math.random(), x: null, y: null, vx: 0, vy: 0,
    phase: Math.random() * Math.PI * 2, depth: .5 + Math.random(),
    color: COLORS[index % COLORS.length], symbol: SYMBOLS[index % SYMBOLS.length],
  }));
}

export function paintMotionField(ctx, state, now, delta, quiet) {
  const { width, height, particles, pointer, waves } = state;
  const tick = Math.min(delta / 16.67, 2);
  ctx.clearRect(0, 0, width, height);
  const fade = quiet ? .42 : 1;
  if (pointer.active) {
    pointer.x += (pointer.targetX - pointer.x) * .15 * tick;
    pointer.y += (pointer.targetY - pointer.y) * .15 * tick;
    const radius = quiet ? 160 : 300;
    const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
    glow.addColorStop(0, `rgba(118,93,233,${.12 * fade})`);
    glow.addColorStop(.45, `rgba(255,139,114,${.045 * fade})`);
    glow.addColorStop(1, 'rgba(118,93,233,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  particles.forEach((particle, index) => {
    const homeX = particle.nx * width + Math.sin(now * .00022 + particle.phase) * 26;
    const homeY = particle.ny * height + Math.cos(now * .00018 + particle.phase) * 20;
    if (particle.x === null) { particle.x = homeX; particle.y = homeY; }
    particle.vx += (homeX - particle.x) * .006 * tick;
    particle.vy += (homeY - particle.y) * .006 * tick;
    if (pointer.active) {
      const dx = pointer.x - particle.x;
      const dy = pointer.y - particle.y;
      const distance = Math.hypot(dx, dy);
      const force = Math.max(0, 1 - distance / 280) * particle.depth;
      particle.vx += (dx * .002 - dy * .003) * force * tick;
      particle.vy += (dy * .002 + dx * .003) * force * tick;
    }
    particle.vx *= Math.pow(.93, tick);
    particle.vy *= Math.pow(.93, tick);
    particle.x += particle.vx * tick;
    particle.y += particle.vy * tick;
    ctx.fillStyle = `rgba(${particle.color},${.45 * fade})`;
    if (!quiet && index % 7 === 0) {
      ctx.font = `${14 + particle.depth * 7}px monospace`;
      ctx.fillText(particle.symbol, particle.x, particle.y);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.depth * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let next = index + 1; next < particles.length; next += 1) {
      const other = particles[next];
      if (other.x === null) continue;
      const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
      if (distance > 120) continue;
      ctx.strokeStyle = `rgba(${particle.color},${(1 - distance / 120) * .2 * fade})`;
      ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(particle.x, particle.y); ctx.lineTo(other.x, other.y); ctx.stroke();
    }
  });

  state.waves = waves.filter((wave) => now - wave.started < 1000);
  state.waves.forEach((wave) => {
    const progress = Math.max(0, Math.min(1, (now - wave.started) / 1000));
    const radius = 8 + (1 - Math.pow(1 - progress, 3)) * (quiet ? 90 : 200);
    ctx.strokeStyle = `rgba(118,93,233,${(1 - progress) * .4 * fade})`;
    ctx.lineWidth = 1.5 * (1 - progress);
    ctx.beginPath(); ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2); ctx.stroke();
    if (!quiet) {
      for (let i = 0; i < 10; i += 1) {
        const angle = i * Math.PI / 5 + progress;
        ctx.fillStyle = `rgba(${COLORS[i % 3]},${(1 - progress) * .7})`;
        ctx.fillRect(wave.x + Math.cos(angle) * radius, wave.y + Math.sin(angle) * radius, 3, 3);
      }
    }
  });
}
