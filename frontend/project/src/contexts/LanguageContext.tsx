import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { dictionaries, type Lang, type TranslationKey } from '../lib/translations';

type LanguageContextValue = {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function dirFor(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'ar' || saved === 'en' ? saved : 'en';
  });

  useEffect(() => {
    document.documentElement.dir = dirFor(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  }, []);

  const toggleLang = useCallback(() => setLang(lang === 'en' ? 'ar' : 'en'), [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string>) => {
      let text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
      }
      return text;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, dir: dirFor(lang), setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
