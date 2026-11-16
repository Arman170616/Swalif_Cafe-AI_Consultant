import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Banknote,
  CalendarClock,
  ChevronDown,
  Coffee,
  CreditCard,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { GlassButton, GlassCard } from '../../ui';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TranslationKey } from '../../../lib/translations';
import { STATUS_STYLE, withVat, type CustomerPackage, type PackagePlan, type PackageStatus } from '../../../lib/packages';
import { splitName } from './MenuItems';

type Category = { id: number; name: string };
type Customer = { id: number; name: string; phone: string };
type Method = 'cash' | 'card' | 'mobile';
type Filter = 'all' | PackageStatus | 'expiring';

const omr = (v: number | string) => `OMR ${Number(v).toFixed(3)}`;

function fmtDate(iso: string, locale: string) {
  return new Date(`${iso}T00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function PackagesPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-OM' : 'en-GB';
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<'clients' | 'plans'>('clients');
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selling, setSelling] = useState(false);
  const [renewing, setRenewing] = useState<CustomerPackage | null>(null);
  const [editingPlan, setEditingPlan] = useState<PackagePlan | 'new' | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<CustomerPackage[]>('/crm/packages/'),
      api.getAll<PackagePlan>('/crm/package-plans/'),
      api.getAll<Category>('/inventory/categories/'),
    ])
      .then(([p, pl, c]) => {
        setPackages(p);
        setPlans(pl);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // One row per client: their newest package; older months live in the history panel.
  const latest = useMemo(() => {
    const byCustomer = new Map<number, CustomerPackage>();
    for (const p of [...packages].sort((a, b) => b.end_date.localeCompare(a.end_date) || b.id - a.id)) {
      if (!byCustomer.has(p.customer)) byCustomer.set(p.customer, p);
    }
    return [...byCustomer.values()].sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  }, [packages]);

  const isExpiring = (p: CustomerPackage) => p.status === 'active' && p.days_left <= 7;
  const counts = {
    active: latest.filter((p) => p.status === 'active').length,
    expiring: latest.filter(isExpiring).length,
    expired: latest.filter((p) => p.status === 'expired' || p.status === 'used_up').length,
  };
  const thisMonth = new Date().toISOString().slice(0, 7);
  const soldThisMonth = packages.filter((p) => p.created_at.slice(0, 7) === thisMonth);
  const revenueThisMonth = soldThisMonth.reduce((s, p) => s + Number(p.total_paid ?? 0), 0);

  const shown = latest.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !p.customer_name.toLowerCase().includes(q) && !p.customer_phone.includes(q)) return false;
    if (filter === 'all') return true;
    if (filter === 'expiring') return isExpiring(p);
    return p.status === filter;
  });

  const kpis = [
    { label: t('pkg.kpi.active'), value: String(counts.active), icon: Users },
    { label: t('pkg.kpi.expiring'), value: String(counts.expiring), icon: CalendarClock },
    { label: t('pkg.kpi.soldThisMonth'), value: String(soldThisMonth.length), icon: Ticket },
    { label: t('pkg.kpi.revenueThisMonth'), value: omr(revenueThisMonth), icon: Banknote },
  ];

  if (loading) {
    return <div className="grid h-96 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>;
  }

  const activePlans = plans.filter((p) => p.is_active);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <GlassCard key={k.label} sheen hover className="p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow"><k.icon className="h-5 w-5" /></span>
            <div className="mt-4 font-display text-2xl font-bold text-ink-900">{k.value}</div>
            <div className="text-xs text-ink-500">{k.label}</div>
          </GlassCard>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl bg-white/40 p-1">
          {(['clients', 'plans'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={['rounded-xl px-4 py-1.5 text-sm font-semibold transition-all', tab === k ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow' : 'text-ink-600 hover:bg-white/60'].join(' ')}
            >
              {t(k === 'clients' ? 'pkg.tab.clients' : 'pkg.tab.plans')}
            </button>
          ))}
        </div>
        {tab === 'clients' ? (
          <GlassButton variant="primary" size="sm" onClick={() => setSelling(true)} disabled={activePlans.length === 0}>
            <UserPlus className="h-4 w-4" /> {t('pkg.sell')}
          </GlassButton>
        ) : (
          isAdmin && (
            <GlassButton variant="primary" size="sm" onClick={() => setEditingPlan('new')}>
              <Plus className="h-4 w-4" /> {t('pkg.newPlan')}
            </GlassButton>
          )
        )}
      </div>

      {tab === 'clients' && (
        <GlassCard className="p-4">
          {activePlans.length === 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
              {isAdmin ? t('pkg.noPlansAdmin') : t('pkg.noPlansManager')}
              {isAdmin && (
                <button onClick={() => { setTab('plans'); setEditingPlan('new'); }} className="ms-2 font-bold underline">
                  {t('pkg.newPlan')}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-white/50 bg-white/50 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pkg.searchClients')} className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', 'pkg.filter.all', latest.length],
                ['active', 'pkg.status.active', counts.active],
                ['expiring', 'pkg.filter.expiring', counts.expiring],
                ['expired', 'pkg.status.expired', latest.filter((p) => p.status === 'expired').length],
                ['used_up', 'pkg.status.used_up', latest.filter((p) => p.status === 'used_up').length],
              ] as const).map(([k, key, n]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={['rounded-full px-3 py-1.5 text-xs font-semibold transition-all', filter === k ? 'bg-brand-600 text-white' : 'border border-white/50 bg-white/40 text-ink-600 hover:bg-white/70'].join(' ')}
                >
                  {t(key)} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {shown.map((p) => (
              <ClientRow
                key={p.id}
                pkg={p}
                history={packages.filter((x) => x.customer === p.customer)}
                locale={locale}
                expanded={expanded === p.customer}
                onToggle={() => setExpanded(expanded === p.customer ? null : p.customer)}
                onRenew={() => setRenewing(p)}
                planActive={plans.find((pl) => pl.id === p.plan)?.is_active ?? false}
              />
            ))}
            {shown.length === 0 && (
              <div className="grid place-items-center rounded-2xl border border-dashed border-white/60 py-12 text-center">
                <Ticket className="h-8 w-8 text-ink-300" />
                <p className="mt-2 text-sm font-semibold text-ink-600">{latest.length === 0 ? t('pkg.noClients') : t('pkg.noMatch')}</p>
                {latest.length === 0 && <p className="mt-1 text-xs text-ink-400">{t('pkg.noClientsHint')}</p>}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {tab === 'plans' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((pl) => (
            <GlassCard key={pl.id} className={['p-5', pl.is_active ? '' : 'opacity-60'].join(' ')}>
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Coffee className="h-5 w-5" /></span>
                {isAdmin && (
                  <button onClick={() => setEditingPlan(pl)} className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-white/70" title={t('pkg.editPlan')}>
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink-900">{pl.name}</h3>
              {pl.description && <p className="text-xs text-ink-500">{pl.description}</p>}
              <div className="mt-3 font-display text-2xl font-extrabold text-brand-700">{omr(withVat(pl.price))}</div>
              <div className="text-[11px] text-ink-400">{t('pkg.priceBreakdown', { price: Number(pl.price).toFixed(3) })}</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <PlanLine label={t('pkg.drinksPerMonth')} value={String(pl.drinks_per_month)} />
                <PlanLine label={t('pkg.dailyLimit')} value={pl.daily_limit ? String(pl.daily_limit) : t('pkg.noLimit')} />
                <PlanLine
                  label={t('pkg.covers')}
                  value={pl.category_names.length ? pl.category_names.map((n) => (lang === 'ar' ? splitName(n).ar ?? splitName(n).en : splitName(n).en)).join('، ') : t('pkg.anyItem')}
                />
                <PlanLine label={t('pkg.activeClients')} value={String(pl.active_clients)} />
              </div>
              {!pl.is_active && <div className="mt-3 inline-block rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-500">{t('pkg.planOff')}</div>}
            </GlassCard>
          ))}
          {plans.length === 0 && (
            <GlassCard className="col-span-full grid place-items-center p-10 text-center">
              <Ticket className="h-8 w-8 text-ink-300" />
              <p className="mt-2 text-sm font-semibold text-ink-600">{t('pkg.noPlans')}</p>
              <p className="mt-1 text-xs text-ink-400">{isAdmin ? t('pkg.noPlansAdmin') : t('pkg.noPlansManager')}</p>
            </GlassCard>
          )}
        </div>
      )}

      {selling && (
        <SellDialog plans={activePlans} onClose={() => setSelling(false)} onDone={() => { setSelling(false); load(); }} />
      )}
      {renewing && (
        <RenewDialog pkg={renewing} locale={locale} onClose={() => setRenewing(null)} onDone={() => { setRenewing(null); load(); }} />
      )}
      {editingPlan && (
        <PlanDialog
          plan={editingPlan === 'new' ? null : editingPlan}
          categories={categories}
          onClose={() => setEditingPlan(null)}
          onDone={() => { setEditingPlan(null); load(); }}
        />
      )}
    </div>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="text-end font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status, expiring }: { status: PackageStatus; expiring?: boolean }) {
  const { t } = useLanguage();
  return (
    <span className={['inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold', expiring ? 'border-orange-200 bg-orange-50 text-orange-700' : STATUS_STYLE[status]].join(' ')}>
      {expiring ? t('pkg.filter.expiring') : t(`pkg.status.${status}` as TranslationKey)}
    </span>
  );
}

function ClientRow({ pkg, history, locale, expanded, onToggle, onRenew, planActive }: {
  pkg: CustomerPackage;
  history: CustomerPackage[];
  locale: string;
  expanded: boolean;
  onToggle: () => void;
  onRenew: () => void;
  planActive: boolean;
}) {
  const { t } = useLanguage();
  const pct = pkg.drinks_total ? (pkg.drinks_used / pkg.drinks_total) * 100 : 0;
  const expiring = pkg.status === 'active' && pkg.days_left <= 7;
  return (
    <div className="rounded-2xl border border-white/50 bg-white/40">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-sm font-bold text-white">
          {pkg.customer_name[0]?.toUpperCase()}
        </span>
        <div className="min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-900">{pkg.customer_name}</span>
            <StatusBadge status={pkg.status} expiring={expiring} />
          </div>
          <div className="text-xs text-ink-500" dir="ltr">{pkg.customer_phone || '—'}</div>
        </div>
        <div className="min-w-[180px] flex-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold text-ink-700">{pkg.plan_name}</span>
            <span className="text-ink-500">{t('pkg.usedOf', { used: String(pkg.drinks_used), total: String(pkg.drinks_total) })}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/70">
            <div className={['h-full rounded-full', pkg.status === 'active' ? 'bg-gradient-to-r from-brand-400 to-brand-600' : 'bg-ink-300'].join(' ')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-ink-400">
            {fmtDate(pkg.start_date, locale)} – {fmtDate(pkg.end_date, locale)}
            {pkg.status === 'active' && ` · ${t('pkg.daysLeft', { n: String(pkg.days_left) })}`}
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl font-extrabold text-brand-700">{pkg.drinks_remaining}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{t('pkg.left')}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <GlassButton variant="glass" size="sm" onClick={onRenew} disabled={!planActive} title={planActive ? undefined : t('pkg.planOff')}>
            <RefreshCw className="h-3.5 w-3.5" /> {t('pkg.renew')}
          </GlassButton>
          <button onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-white/70" title={t('pkg.history')} aria-expanded={expanded}>
            <ChevronDown className={['h-4 w-4 transition-transform', expanded ? 'rotate-180' : ''].join(' ')} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-white/60 p-3.5 md:grid-cols-2">
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500"><History className="h-3.5 w-3.5" /> {t('pkg.recentRedemptions')}</h4>
            <div className="space-y-1.5">
              {pkg.redemptions.map((r) => (
                <div key={r.id} className={['rounded-xl bg-white/60 px-3 py-2 text-xs', r.cancelled ? 'line-through opacity-50' : ''].join(' ')}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-ink-800">{new Date(r.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-ink-500">#{r.order} · {r.quantity}</span>
                  </div>
                  <div className="truncate text-ink-500">{r.items.map((i) => i.replace(/ · .*/, '')).join(', ')}</div>
                </div>
              ))}
              {pkg.redemptions.length === 0 && <p className="text-xs text-ink-400">{t('pkg.noRedemptions')}</p>}
            </div>
          </div>
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500"><CalendarClock className="h-3.5 w-3.5" /> {t('pkg.months')}</h4>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs">
                  <span className="text-ink-700">{fmtDate(h.start_date, locale)} – {fmtDate(h.end_date, locale)}</span>
                  <span className="text-ink-500">{h.drinks_used}/{h.drinks_total} · {h.total_paid ? omr(h.total_paid) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Dialogs ──────────────────────────────────────────────────────────── */

function Dialog({ title, icon, onClose, children }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-glass-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
            <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-400 focus:outline-none';
const labelCls = 'mb-1 block text-xs font-semibold text-ink-600';

function MethodPicker({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  const { t } = useLanguage();
  const opts: [Method, typeof Banknote, TranslationKey][] = [
    ['cash', Banknote, 'pos.cash'],
    ['card', CreditCard, 'pos.card'],
    ['mobile', Wallet, 'pos.wallet'],
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {opts.map(([m, Icon, key]) => (
        <button
          type="button"
          key={m}
          onClick={() => onChange(m)}
          className={['flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-semibold', value === m ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'].join(' ')}
        >
          <Icon className="h-4 w-4" /> {t(key)}
        </button>
      ))}
    </div>
  );
}

function SellDialog({ plans, onClose, onDone }: { plans: PackagePlan[]; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id ?? 0);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Method>('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'existing' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      api.get<{ results?: Customer[] } | Customer[]>('/crm/customers/', { search: query.trim() }).then((r) => setResults(Array.isArray(r) ? r : r.results ?? []));
    }, 250);
    return () => clearTimeout(id);
  }, [query, mode]);

  const plan = plans.find((p) => p.id === planId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/crm/packages/', {
        ...(mode === 'existing' && customer ? { customer: customer.id } : { customer_name: name, customer_phone: phone }),
        plan: planId,
        payment_method: method,
        start_date: start,
      });
      onDone();
    } catch (err) {
      setError(errorText(err, t('pkg.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={t('pkg.sell')} icon={<UserPlus className="h-5 w-5" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-50 p-1">
          {(['new', 'existing'] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)} className={['rounded-lg py-1.5 text-xs font-semibold', mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500'].join(' ')}>
              {t(m === 'new' ? 'pkg.newClient' : 'pkg.existingClient')}
            </button>
          ))}
        </div>

        {mode === 'new' ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('pkg.clientName')}</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('pkg.phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} dir="ltr" inputMode="tel" />
            </div>
          </div>
        ) : customer ? (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
            <span className="font-semibold text-ink-900">{customer.name} <span className="font-normal text-ink-500" dir="ltr">{customer.phone}</span></span>
            <button type="button" onClick={() => setCustomer(null)} className="text-ink-500 hover:text-ink-800"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div>
            <label className={labelCls}>{t('pkg.findClient')}</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder={t('pkg.searchClients')} autoFocus />
            <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
              {results.map((c) => (
                <button type="button" key={c.id} onClick={() => setCustomer(c)} className="flex w-full justify-between rounded-lg px-3 py-1.5 text-start text-sm hover:bg-ink-50">
                  <span>{c.name}</span>
                  <span className="text-ink-400" dir="ltr">{c.phone}</span>
                </button>
              ))}
              {query.trim().length >= 2 && results.length === 0 && <p className="px-1 text-xs text-ink-400">{t('pkg.noClientFound')}</p>}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>{t('pkg.plan')}</label>
          <select value={planId} onChange={(e) => setPlanId(Number(e.target.value))} className={inputCls}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.drinks_per_month} · {omr(withVat(p.price))}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>{t('pkg.startDate')}</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>{t('pkg.paymentMethod')}</label>
          <MethodPicker value={method} onChange={setMethod} />
        </div>

        {plan && (
          <div className="space-y-1 rounded-2xl bg-ink-50 p-3 text-sm">
            <PlanLine label={t('pos.subtotal')} value={omr(plan.price)} />
            <PlanLine label={t('pos.vat')} value={omr(Number(plan.price) * 0.05)} />
            <div className="flex justify-between border-t border-ink-200 pt-1 font-bold"><span>{t('pkg.toCollect')}</span><span className="text-brand-700">{omr(withVat(plan.price))}</span></div>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <GlassButton type="submit" variant="primary" size="md" className="w-full" disabled={saving || (mode === 'existing' && !customer)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('pkg.confirmSale')}
        </GlassButton>
      </form>
    </Dialog>
  );
}

function RenewDialog({ pkg, locale, onClose, onDone }: { pkg: CustomerPackage; locale: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [method, setMethod] = useState<Method>('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const nextStart = pkg.end_date >= today ? new Date(new Date(`${pkg.end_date}T00:00`).getTime() + 86400000).toISOString().slice(0, 10) : today;

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.post(`/crm/packages/${pkg.id}/renew/`, { payment_method: method });
      onDone();
    } catch (err) {
      setError(errorText(err, t('pkg.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={t('pkg.renewFor', { name: pkg.customer_name })} icon={<RefreshCw className="h-5 w-5" />} onClose={onClose}>
      <div className="space-y-3.5">
        <div className="space-y-1 rounded-2xl bg-ink-50 p-3 text-sm">
          <PlanLine label={t('pkg.plan')} value={pkg.plan_name} />
          <PlanLine label={t('pkg.newPeriodStarts')} value={fmtDate(nextStart, locale)} />
          <PlanLine label={t('pkg.drinksPerMonth')} value={String(pkg.drinks_total)} />
          <div className="flex justify-between border-t border-ink-200 pt-1 font-bold"><span>{t('pkg.toCollect')}</span><span className="text-brand-700">{omr(withVat(pkg.price))}</span></div>
        </div>
        {pkg.status === 'active' && <p className="text-xs text-ink-500">{t('pkg.renewEarlyNote')}</p>}
        <div>
          <label className={labelCls}>{t('pkg.paymentMethod')}</label>
          <MethodPicker value={method} onChange={setMethod} />
        </div>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <GlassButton variant="primary" size="md" className="w-full" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('pkg.confirmRenew')}
        </GlassButton>
      </div>
    </Dialog>
  );
}

function PlanDialog({ plan, categories, onClose, onDone }: { plan: PackagePlan | null; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useLanguage();
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [price, setPrice] = useState(plan ? Number(plan.price).toFixed(3) : '');
  const [drinks, setDrinks] = useState(plan ? String(plan.drinks_per_month) : '30');
  const [daily, setDaily] = useState(plan?.daily_limit ? String(plan.daily_limit) : '');
  const [cats, setCats] = useState<number[]>(plan?.categories ?? []);
  const [active, setActive] = useState(plan?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = { name, description, price, drinks_per_month: Number(drinks), daily_limit: daily ? Number(daily) : null, categories: cats, is_active: active };
    try {
      if (plan) await api.patch(`/crm/package-plans/${plan.id}/`, body);
      else await api.post('/crm/package-plans/', body);
      onDone();
    } catch (err) {
      setError(errorText(err, t('pkg.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const catLabel = (n: string) => {
    const s = splitName(n);
    return lang === 'ar' && s.ar ? s.ar : s.en;
  };

  return (
    <Dialog title={plan ? t('pkg.editPlan') : t('pkg.newPlan')} icon={<Ticket className="h-5 w-5" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className={labelCls}>{t('pkg.planName')}</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={t('pkg.planNameHint')} />
        </div>
        <div>
          <label className={labelCls}>{t('pkg.description')}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>{t('pkg.priceExclVat')}</label>
            <input required type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className={labelCls}>{t('pkg.drinksPerMonth')}</label>
            <input required type="number" min="1" value={drinks} onChange={(e) => setDrinks(e.target.value)} className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className={labelCls}>{t('pkg.dailyLimit')}</label>
            <input type="number" min="1" value={daily} onChange={(e) => setDaily(e.target.value)} className={inputCls} dir="ltr" placeholder="—" />
          </div>
        </div>
        {price && <p className="-mt-2 text-[11px] text-ink-500">{t('pkg.clientPays', { amount: omr(withVat(price)) })}</p>}
        <div>
          <label className={labelCls}>{t('pkg.covers')}</label>
          <p className="mb-1.5 text-[11px] text-ink-400">{t('pkg.coversHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])}
                  className={['rounded-full border px-3 py-1 text-xs font-semibold', on ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-200 text-ink-600 hover:bg-ink-50'].join(' ')}
                >
                  {catLabel(c.name)}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-brand-600" />
          {t('pkg.offerPlan')}
        </label>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <GlassButton type="submit" variant="primary" size="md" className="w-full" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
        </GlassButton>
      </form>
    </Dialog>
  );
}
