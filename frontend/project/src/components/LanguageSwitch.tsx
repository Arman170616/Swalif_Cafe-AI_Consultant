import { Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

/** EN / AR toggle. Compact pill so it fits in the Topbar next to the notification bell,
 * and in the auth screen header before the user is even logged in. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      className={[
        'flex items-center gap-1.5 rounded-full border border-white/50 bg-white/40 px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:bg-white/60',
        className,
      ].join(' ')}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
