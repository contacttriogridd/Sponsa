'use client';

import { useEffect, useState } from 'react';

const SEEN_KEY = 'vptrust_splash_seen';
const SHOW_MS = 1600;
const FADE_MS = 500;

/**
 * Full-screen welcome photo with the VP Trust logo, shown once each time the
 * app is opened (per browser session), then faded out. It renders visible from
 * the first paint so it covers the app while it loads; a reload within the same
 * session hides it straight away.
 *
 * Photo: Michael Ali on Unsplash (unsplash.com/photos/Glt7d_fofLQ), Unsplash License.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: just show it this once.
    }
    if (seen) { setPhase('gone'); return; }
    const fade = setTimeout(() => setPhase('fading'), SHOW_MS);
    const done = setTimeout(() => setPhase('gone'), SHOW_MS + FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      role="presentation"
      onClick={() => setPhase('fading')}
      onTransitionEnd={() => phase === 'fading' && setPhase('gone')}
      className="fixed inset-0 z-[100] bg-[#8173C9] transition-opacity ease-out"
      style={{ opacity: phase === 'fading' ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-16 text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/vp-trust-mark.png" alt="VP Trust" className="h-28 w-28 object-contain drop-shadow-xl" />
        <div className="mt-4 text-3xl font-semibold">VP Trust</div>
        <div className="mt-1 text-sm text-white/85">Serving people in need</div>
      </div>
    </div>
  );
}
