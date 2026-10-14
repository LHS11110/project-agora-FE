import { useCallback, useEffect, useState } from 'react';

const SEEN_KEY = 'frelog.home-intro.v1';
export const HOME_INTRO_DURATION = 3000;
export const HOME_INTRO_REVEAL_DELAY = HOME_INTRO_DURATION * 0.8;
let seenInMemory = false;

function shouldPlayIntro() {
  if (seenInMemory || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(SEEN_KEY) !== 'seen'; }
  catch { return true; }
}

export function useHomeCinematicIntro() {
  const [introVisible, setIntroVisible] = useState(shouldPlayIntro);
  const [homeRevealed, setHomeRevealed] = useState(() => !introVisible);
  const finishIntro = useCallback(() => {
    setHomeRevealed(true);
    setIntroVisible(false);
  }, []);

  useEffect(() => {
    seenInMemory = true;
    try { sessionStorage.setItem(SEEN_KEY, 'seen'); } catch { /* Private storage must never prevent entry. */ }
    if (!introVisible) return undefined;
    const timer = window.setTimeout(finishIntro, HOME_INTRO_DURATION + 150);
    // Prepare the entrance while the curtain begins fading, not after it leaves.
    const revealTimer = window.setTimeout(() => setHomeRevealed(true), HOME_INTRO_REVEAL_DELAY);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = () => { if (preference.matches) finishIntro(); };
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(revealTimer);
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, [introVisible, finishIntro]);

  return { introVisible, homeRevealed, finishIntro };
}
