import { useLayoutEffect, useRef } from 'react';

let mathJaxLoadPromise;

function loadMathJax() {
  if (window.MathJax?.typesetPromise) return Promise.resolve(window.MathJax);
  if (!mathJaxLoadPromise) {
    window.MathJax = {
      loader: { load: ['ui/safe'] },
      startup: { typeset: false },
      options: { safeOptions: { allow: { URLs: 'safe', classes: 'safe', cssIDs: 'none', styles: 'safe' } } },
    };
    mathJaxLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/mathjax/tex-svg.js';
      script.async = true;
      script.dataset.agoraMathjax = 'true';
      script.onload = () => resolve(window.MathJax);
      script.onerror = () => { mathJaxLoadPromise = null; reject(new Error('MathJax failed to load')); };
      document.head.appendChild(script);
    });
  }
  return mathJaxLoadPromise;
}

export default function MathFormula({ formula }) {
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const source = `\\(${String(formula || '').slice(0, 1200)}\\)`;
    element.textContent = source;
    let cancelled = false;
    loadMathJax().then(async (mathJax) => {
      if (cancelled) return;
      mathJax.typesetClear?.([element]);
      element.textContent = source;
      await mathJax.typesetPromise([element]);
    }).catch(() => { if (!cancelled) element.textContent = source; });
    return () => {
      cancelled = true;
      window.MathJax?.typesetClear?.([element]);
    };
  }, [formula]);

  return <span className="mathjax-output" ref={elementRef} aria-label={`수식: ${formula}`} />;
}
