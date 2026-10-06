import { useRef } from 'react';
import { useMotionField } from '../../motion/useMotionField.js';
import '../../motion/motion.css';

export default function InteractiveAtmosphere({ variant = 'page' }) {
  const canvasRef = useRef(null);
  useMotionField(canvasRef, variant === 'canvas');
  return <div className={`motion-field motion-field--${variant}`} aria-hidden="true">
    <canvas ref={canvasRef} />
    {variant === 'canvas' && <span className="motion-canvas-arrival" />}
  </div>;
}
