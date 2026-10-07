import { useLayoutEffect, useRef } from 'react';

let mathJaxLoadPromise;
let mathJaxRenderQueue = Promise.resolve();

function mathJaxReady(mathJax) {
  return Promise.resolve(mathJax?.startup?.promise).then(() => {
    if (typeof mathJax?.tex2svgPromise !== 'function') throw new Error('MathJax is not ready');
    return mathJax;
  });
}

function loadMathJax() {
  if (mathJaxLoadPromise) return mathJaxLoadPromise;
  if (window.MathJax?.tex2svgPromise) {
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
    script.onerror = () => {
      script.remove();
      reject(new Error('MathJax failed to load'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    mathJaxLoadPromise = null;
    throw error;
  });
  return mathJaxLoadPromise;
}

export default function MathFormula({ formula, display = false }) {
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const text = String(formula ?? '').slice(0, 1200);
    const source = display ? `\\[${text}\\]` : `\\(${text}\\)`;
    element.textContent = source;
    let cancelled = false;
    loadMathJax().then((mathJax) => {
      if (cancelled) return;
      mathJaxRenderQueue = mathJaxRenderQueue.catch(() => {}).then(async () => {
        if (cancelled) return;
        const output = await mathJax.tex2svgPromise(text, { display });
        if (cancelled) return;
        element.replaceChildren(output);
      });
      return mathJaxRenderQueue;
    }).catch(() => { if (!cancelled) element.textContent = source; });
    return () => {
      cancelled = true;
      element.replaceChildren();
    };
  }, [formula, display]);

  return <span className="mathjax-output" ref={elementRef} aria-label={`수식: ${formula}`} />;
}
