import { Clock, MapPin } from 'lucide-react';
import { MenuBook } from './MenuBook';
import { useLanguage } from '../../contexts/LanguageContext';

/** Login page hero — a real photo of the Swalif Cafe interior (public/swalif-interior.png)
 * with the animated menu book, slogan and opening details layered over a maroon fade. */
export function WelcomeSection() {
  const { t } = useLanguage();
  return (
    <div className="relative flex h-full min-h-[34rem] flex-col justify-between overflow-hidden lg:min-h-[38rem]">
      <img
        src="/swalif-interior.png"
        alt={t('auth.interiorAlt')}
        className="absolute inset-0 h-full w-full animate-ken-burns object-cover motion-reduce:animate-none"
      />
      {/* fade so the text stays readable over the busy photo */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-900/60 to-brand-950/40"
        aria-hidden="true"
      />

      <div className="relative px-4 pt-10 sm:pt-12">
        <MenuBook />
      </div>

      <div className="relative px-6 pb-8 pt-6 text-white sm:px-10 sm:pb-10 lg:px-12">
        <p className="font-arabic text-xl font-bold leading-snug text-accent-200" lang="ar">
          كل لحظة حكاية، وكل قهوة عالم
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold lg:text-3xl">{t('auth.productTagline')}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">{t('auth.welcomeBody')}</p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-accent-300" />
            {t('auth.location')}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
            <Clock className="h-3.5 w-3.5 text-accent-300" />
            {t('auth.hours')}
          </span>
        </div>
      </div>
    </div>
  );
}
