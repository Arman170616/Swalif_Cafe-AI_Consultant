/** Big animated Share Cafe logo — the login page's hero visual, replacing a generic
 * mascot with the real brand mark: a slow rotating gold/maroon glow halo behind it, a
 * soft pulsing ring, and a gentle continuous float on the logo itself. */
export function BrandLogoHero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex h-32 w-32 items-center justify-center ${className}`}>
      <div
        className="absolute inset-0 animate-[spin_7s_linear_infinite] rounded-full opacity-70 blur-xl"
        style={{ background: 'conic-gradient(from 0deg, #b84f68, #dba828, #96304a, #dba828, #b84f68)' }}
        aria-hidden="true"
      />
      <div className="absolute inset-3 animate-pulse-ring rounded-[1.75rem] bg-brand-500/25" aria-hidden="true" />
      <img
        src="/share-logo.png"
        alt="Share Cafe"
        className="relative h-24 w-24 animate-float rounded-[1.75rem] object-cover shadow-glow"
        style={{ animationDuration: '5s' }}
      />
    </div>
  );
}
