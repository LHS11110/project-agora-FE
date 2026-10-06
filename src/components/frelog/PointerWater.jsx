import { useEffect, useRef } from 'react';
import { createWaterSurface } from '../../motion/waterSurface.js';
import '../../motion/pointer-water.css';

export default function PointerWater() {
  const ref = useRef(null);
  useEffect(() => createWaterSurface(ref.current), []);
  return <div ref={ref} className="pointer-water" aria-hidden="true"><canvas /></div>;
}
