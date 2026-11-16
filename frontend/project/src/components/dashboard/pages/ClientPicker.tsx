import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useLanguage } from '../../../contexts/LanguageContext';

export type Client = { id: number; name: string; phone: string; loyalty_points?: number };

/** POS: attach a client to a normal (paid) order — so loyalty points and the monthly
 * "best clients" ranking know who bought it. Search existing clients or add a new one. */
export function ClientPicker({ onPick, onClose }: { onPick: (c: Client) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      api
        .get<{ results?: Client[] } | Client[]>('/crm/customers/', { search: query.trim() || undefined })
        .then((r) => setRows(Array.isArray(r) ? r : r.results ?? []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function addClient(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const c = await api.post<Client>('/crm/customers/', { name: name.trim(), phone: phone.trim() });
      onPick(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('pkg.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white p-5 shadow-glass-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-100 text-accent-700"><UserPlus className="h-5 w-5" /></span>
            <h3 className="font-display text-base font-bold text-ink-900">{t('client.pick')}</h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50"><X className="h-4 w-4" /></button>
        </div>

        {adding ? (
          <form onSubmit={addClient} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600">{t('pkg.clientName')}</label>
              <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600">{t('pkg.phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} dir="ltr" inputMode="tel" />
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-ink-200 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('client.addAndUse')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('pkg.searchClients')} className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <button
              onClick={() => { setAdding(true); setName(/\d/.test(query) ? '' : query); setPhone(/\d/.test(query) ? query : ''); }}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              <UserPlus className="h-3.5 w-3.5" /> {t('client.new')}
            </button>
            <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
              {loading && <div className="grid h-16 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-brand-500" /></div>}
              {!loading &&
                rows.map((c) => (
                  <button key={c.id} onClick={() => onPick(c)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-ink-50">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-xs font-bold text-white">{c.name[0]?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">{c.name}</span>
                      <span className="block text-xs text-ink-500" dir="ltr">{c.phone || '—'}</span>
                    </span>
                    {c.loyalty_points ? <span className="text-[10px] font-semibold text-accent-700">{t('client.points', { n: String(c.loyalty_points) })}</span> : null}
                  </button>
                ))}
              {!loading && rows.length === 0 && <p className="py-6 text-center text-sm text-ink-400">{t('pkg.noClientFound')}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
