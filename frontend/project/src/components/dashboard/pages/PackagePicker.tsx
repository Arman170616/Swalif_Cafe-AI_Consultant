import { useEffect, useState } from 'react';
import { Loader2, Search, Ticket, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TranslationKey } from '../../../lib/translations';
import { leftToday, STATUS_STYLE, type CustomerPackage } from '../../../lib/packages';

/** POS: pick the package client whose drinks this order should be redeemed against. */
export function PackagePicker({ onPick, onClose }: { onPick: (p: CustomerPackage) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CustomerPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      api
        .get<CustomerPackage[]>('/crm/packages/', { latest: 1, search: query.trim() || undefined })
        .then(setRows)
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white p-5 shadow-glass-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-700"><Ticket className="h-5 w-5" /></span>
            <h3 className="font-display text-base font-bold text-ink-900">{t('pkg.pickClient')}</h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('pkg.searchClients')} className="flex-1 bg-transparent text-sm focus:outline-none" />
        </div>
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {loading && <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-brand-500" /></div>}
          {!loading &&
            rows.map((p) => {
              const usable = p.status === 'active' && leftToday(p) > 0;
              const reason =
                p.status !== 'active'
                  ? t(`pkg.status.${p.status}` as TranslationKey)
                  : leftToday(p) === 0
                  ? t('pkg.dailyLimitReached')
                  : null;
              return (
                <button
                  key={p.id}
                  disabled={!usable}
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2.5 text-start transition-colors hover:border-brand-200 hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-sm font-bold text-white">{p.customer_name[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{p.customer_name}</span>
                    <span className="block truncate text-xs text-ink-500">{p.plan_name} · <span dir="ltr">{p.customer_phone}</span></span>
                  </span>
                  {reason ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[p.status === 'active' ? 'used_up' : p.status]}`}>{reason}</span>
                  ) : (
                    <span className="text-end">
                      <span className="block font-display text-lg font-extrabold leading-none text-brand-700">{p.drinks_remaining}</span>
                      <span className="text-[10px] text-ink-400">{t('pkg.left')}</span>
                    </span>
                  )}
                </button>
              );
            })}
          {!loading && rows.length === 0 && <p className="py-8 text-center text-sm text-ink-400">{t('pkg.noClientFound')}</p>}
        </div>
      </div>
    </div>
  );
}
