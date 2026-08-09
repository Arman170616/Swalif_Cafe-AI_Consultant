import { useMemo } from 'react';

type Star = { top: string; left: string; size: number; delay: string; duration: string };

/** Small glowing dots scattered across the purple background, each twinkling on its own
 * cycle. Positions are randomized once per mount (not per render) so they don't jump
 * around — pure CSS animation, no dependency needed. */
export function BackgroundParticles({ count = 45 }: { count?: number }) {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: count }, () => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2.5 + 1,
        delay: `${Math.random() * 4}s`,
        duration: `${2.5 + Math.random() * 3}s`,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute animate-twinkle rounded-full bg-white"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
            boxShadow: '0 0 6px 1px rgba(255,255,255,0.8)',
          }}
        />
      ))}
    </div>
  );
}
