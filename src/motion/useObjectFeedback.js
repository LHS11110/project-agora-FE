import { useEffect, useRef } from 'react';
import { FEEDBACK_MOTIONS } from './feedbackMotions.js';
import './object-feedback.css';

// Feedback stays inside each object and leaves its drag coordinates untouched.
export function useObjectFeedback() {
  const animations = useRef(new Set());
  useEffect(() => () => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current.clear();
  }, []);
  const animate = (element, frames, options) => {
    if (!element?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.getAnimations().forEach((animation) => animation.cancel());
    const animation = element.animate(frames, options);
    animations.current.add(animation);
    const finished = () => animations.current.delete(animation);
    animation.onfinish = finished;
    animation.oncancel = finished;
  };
  const trackPointer = (event) => {
    if (event.pointerType === 'touch') return;
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty('--feedback-x', `${(event.clientX - bounds.left) / Math.max(1, bounds.width) * 100}%`);
    element.style.setProperty('--feedback-y', `${(event.clientY - bounds.top) / Math.max(1, bounds.height) * 100}%`);
  };
  const playFeedback = (event) => {
    const element = event.currentTarget;
    animate(element, [{ scale: 1 }, { scale: .97, offset: .2 }, { scale: 1.025, offset: .6 }, { scale: 1 }], { duration: 440, easing: 'ease-out' });
    animate(element.querySelector('[data-feedback-pulse]'), [{ opacity: .7, scale: .92 }, { opacity: 0, scale: 1.08 }], { duration: 650, easing: 'ease-out' });
    const frames = FEEDBACK_MOTIONS[element.dataset.feedbackMotion] || FEEDBACK_MOTIONS.sway;
    animate(element.querySelector('.desk-object-icon, :scope > strong'), frames, { duration: 650, easing: 'ease-out' });
  };
  return { trackPointer, playFeedback };
}
