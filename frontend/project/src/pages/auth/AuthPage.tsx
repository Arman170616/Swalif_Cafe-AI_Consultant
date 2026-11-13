import { useEffect, useState } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { useLanguage } from '../../contexts/LanguageContext';
import { BackgroundParticles } from './BackgroundParticles';
import { LoginForm } from './LoginForm';
import { WelcomeSection } from './WelcomeSection';

export function AuthPage() {
  const { t } = useLanguage();
  // Mount the entrance animation a tick after paint so it actually plays (a class
  // present on first render never transitions — it has to be applied after mount).
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-4 py-8 sm:px-6">
      <BackgroundParticles />
      {/* soft glow blobs behind the card for depth */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl" aria-hidden="true" />

      <div
        className={[
          'relative w-full max-w-5xl transition-all duration-700',
          entered ? 'animate-blob-in' : 'opacity-0',
        ].join(' ')}
      >
        <div className="absolute -top-14 end-0 z-10">
          <LanguageSwitch className="bg-white/90 shadow-md" />
        </div>

        <div className="grid overflow-hidden rounded-[2.5rem] bg-white shadow-2xl shadow-brand-950/40 sm:rounded-[3rem] lg:grid-cols-2 lg:rounded-ss-[7rem] lg:rounded-ee-[7rem] lg:rounded-se-[2.5rem] lg:rounded-es-[2.5rem]">
          {/* Login section */}
          <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-16">
            <div
              className={['flex items-center gap-2.5', entered ? 'animate-fade-up' : 'opacity-0'].join(' ')}
              style={{ animationDelay: '150ms' }}
            >
              <BrandMark className="h-9 w-9 rounded-xl" />
              <span className="font-display text-lg font-bold tracking-tight text-ink-900">
                Swalif<span className="text-brand-600">.</span>
              </span>
            </div>

            <div className={entered ? 'animate-fade-up' : 'opacity-0'} style={{ animationDelay: '200ms' }}>
              <h1 className="mt-7 font-display text-3xl font-bold text-ink-900">{t('auth.welcomeBack')}</h1>
              <p className="mt-1.5 text-sm text-ink-500">{t('auth.welcomeBackSubtitle')}</p>
            </div>

            <div className={['mt-6', entered ? 'animate-fade-up' : 'opacity-0'].join(' ')} style={{ animationDelay: '300ms' }}>
              <LoginForm />
            </div>
          </div>

          {/* Welcome section — stacks below the login form on mobile/tablet, becomes the
              second column on desktop */}
          <div className="relative bg-brand-950">
            <WelcomeSection />
          </div>
        </div>
      </div>
    </div>
  );
}
