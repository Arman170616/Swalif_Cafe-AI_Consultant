import { useLanguage } from '../../contexts/LanguageContext';
import { BrandLogoHero } from './BrandLogoHero';

/** Decorative right-hand panel, desktop only — real Share Cafe copy, not placeholder
 * lorem ipsum. */
export function WelcomeSection() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col justify-center px-6 py-10 text-center sm:px-12 lg:px-6 lg:py-0 lg:text-start">
      <div className="mx-auto lg:mx-0 lg:mb-6">
        <BrandLogoHero />
      </div>
      <h2 className="mt-3 font-display text-2xl font-bold text-ink-900 lg:mt-0 lg:text-4xl">{t('auth.productTagline')}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-500 lg:mx-0 lg:mt-4">{t('auth.welcomeBody')}</p>
    </div>
  );
}
