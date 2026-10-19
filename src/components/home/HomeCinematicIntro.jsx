import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HOME_INTRO_DURATION } from '../../home/useHomeCinematicIntro.js';
import '../../home/home-cinematic-intro.css';

export default function HomeCinematicIntro({ onComplete, pageRef }) {
  useUiLocale();
  const skipRef = useRef(null);
  const dismiss = () => {
    onComplete();
    requestAnimationFrame(() => pageRef.current?.querySelector('a, button')?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return createPortal(<div className="home-cinematic-intro" role="dialog" aria-modal="true" aria-label={ui("FreLog 시작 애니메이션")}
    style={{ '--intro-duration': `${HOME_INTRO_DURATION}ms` }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus(); }
    }}
    onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'cinematic-curtain') dismiss(); }}>
    <div className="cinematic-letterbox cinematic-letterbox-top" aria-hidden="true" />
    <div className="cinematic-light-traces" aria-hidden="true"><i /><i /><i /></div>
    <div className="cinematic-brand">
      <div className="cinematic-emblem" aria-hidden="true">
        <span className="cinematic-emblem-ring" />
        <img className="cinematic-logo" src="/favicon.svg" alt="" width="112" height="112" />
        <span className="cinematic-emblem-echo" />
      </div>
      <h1 className="cinematic-wordmark" aria-label="FreLog">{'FreLog'.split('').map((letter, index) => <span key={index} aria-hidden="true" style={{ '--letter-index': index }}>{letter}</span>)}</h1>
      <p className="cinematic-caption">COLLABORATIVE CANVAS</p>
    </div>
    <div className="cinematic-letterbox cinematic-letterbox-bottom" aria-hidden="true" />
    <button ref={skipRef} className="cinematic-skip" onClick={dismiss}>{"" + ui("건너뛰기") + " "}<span aria-hidden="true">↗</span></button>
  </div>, document.body);
}
