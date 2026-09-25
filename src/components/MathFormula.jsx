import { useLayoutEffect, useRef } from 'react';

let mathJaxLoadPromise;
let mathJaxTypesetQueue = Promise.resolve();

function mathJaxReady(mathJax) {
  return Promise.resolve(mathJax?.startup?.promise).then(() => {
    if (typeof mathJax?.typesetPromise !== 'function') throw new Error('MathJax is not ready');
    return mathJax;
  });
}

function loadMathJax() {
  if (mathJaxLoadPromise) return mathJaxLoadPromise;
  if (window.MathJax?.typesetPromise) {
    mathJaxLoadPromise = mathJaxReady(window.MathJax).catch((error) => {
      mathJaxLoadPromise = null;
      throw error;
    });
    return mathJaxLoadPromise;
  }

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
    script.onload = () => mathJaxReady(window.MathJax).then(resolve, reject);
    script.onerror = () => reject(new Error('MathJax failed to load'));
    document.head.appendChild(script);
  }).catch((error) => {
    mathJaxLoadPromise = null;
    throw error;
  });
  return mathJaxLoadPromise;
}

export default function MathFormula({ formula }) {
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const source = `\\(${String(formula ?? '').slice(0, 1200)}\\)`;
    element.textContent = source;
    let cancelled = false;
    loadMathJax().then((mathJax) => {
      if (cancelled) return;
      mathJaxTypesetQueue = mathJaxTypesetQueue.catch(() => {}).then(async () => {
        if (cancelled) return;
        mathJax.typesetClear?.([element]);
        element.textContent = source;
        await mathJax.typesetPromise([element]);
      });
      return mathJaxTypesetQueue;
    }).catch(() => { if (!cancelled) element.textContent = source; });
    return () => {
      cancelled = true;
      window.MathJax?.typesetClear?.([element]);
    };
  }, [formula]);

  return <span className="mathjax-output" ref={elementRef} aria-label={`수식: ${formula}`} />;
}
