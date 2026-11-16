import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Banknote,
  Calendar,
  Crown,
  FileDown,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { GlassButton, GlassCard } from '../../ui';
import { api, ApiError, downloadFile } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TranslationKey } from '../../../lib/translations';

const PAYMENT_METHOD_KEY: Record<string, TranslationKey> = {
  cash: 'paymentMethod.cash',
  card: 'paymentMethod.card',
  mobile: 'paymentMethod.mobile',
};
const ORDER_TYPE_KEY: Record<string, TranslationKey> = {
  dine_in: 'acc.type.dineIn',
  takeaway: 'acc.type.takeaway',
  delivery: 'acc.type.delivery',
  talabat: 'acc.type.talabat',
  package: 'acc.type.package',
};
const EXPENSE_PRESETS = ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Maintenance', 'Marketing', 'Other'];

type Summary = {
  orders: number;
  gross_sales: number;
  discounts: number;
  net_sales: number;
  vat: number;
  total_billed: number;
  cogs: number;
  expenses: number;
  net_profit: number;
  payments_received: number;
  package_sales: number;
};
type TopCustomer = { customer: number; name: string; phone: string; orders: number; amount: number; packages_bought: number; last_visit: string | null };
type MonthReport = { summary: Summary; expenses: { category: string; count: number; total: number }[]; top_customers: TopCustomer[]; slug: string };
type Expense = { id: number; category: string; amount: string; date: string; note: string };
type Payment = { id: number; order: number; order_type: string; customer_name: string | null; method: string; amount: string; received_by_username: string | null; paid_at: string };

const money = (v: number | string) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pad = (n: number) => String(n).padStart(2, '0');

export function AccountingPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-OM' : 'en-GB';
  // Manager gets read-only oversight; only Admin edits expenses (backend ReadWriteRolePermission).
  const canEdit = user?.role === 'admin';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseForm, setExpenseForm] = useState<Expense | 'new' | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [rankBy, setRankBy] = useState<'amount' | 'orders'>('amount');
  const [downloading, setDownloading] = useState<string | null>(null);

  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' }));
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<MonthReport>('/analytics/period-report/', { period: 'monthly', year, month }),
      api.getAll<Expense>('/analytics/expenses/', { start, end }),
      api.getAll<Payment>('/pos/payments/', { start, end }),
    ])
      .then(([r, e, p]) => {
        setReport(r);
        setExpenses(e);
        setPayments(p);
      })
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- start/end derive from year+month
  useEffect(load, [year, month]);

  async function deleteExpense(id: number) {
    if (!window.confirm(t('acc.deleteExpenseConfirm'))) return;
    await api.delete(`/analytics/expenses/${id}/`);
    load();
  }

  async function download(kind: 'pdf' | 'xlsx' | 'csv') {
    setDownloading(kind);
    try {
      await downloadFile('/analytics/period-report/', `swalif-monthly-report-${year}-${pad(month)}.${kind}`, { period: 'monthly', year, month, export: kind });
    } catch {
      alert(t('reports.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  }

  const ranked = useMemo(() => {
    const rows = [...(report?.top_customers ?? [])];
    rows.sort((a, b) => (rankBy === 'amount' ? b.amount - a.amount || b.orders - a.orders : b.orders - a.orders || b.amount - a.amount));
    return rows.slice(0, 10);
  }, [report, rankBy]);

  const methodTotals = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const p of payments) {
      const cur = m.get(p.method) ?? { total: 0, count: 0 };
      m.set(p.method, { total: cur.total + Number(p.amount), count: cur.count + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [payments]);
  const shownPayments = methodFilter === 'all' ? payments : payments.filter((p) => p.method === methodFilter);

  const selectCls = 'rounded-xl border border-white/50 bg-white/60 px-3 py-1.5 text-sm font-semibold text-ink-800 focus:border-brand-300 focus:outline-none';
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-brand-600" />
        <span className="font-display text-base font-bold text-ink-900">{t('acc.period')}</span>
      </div>
      <div className="flex items-center gap-2">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls} aria-label={t('reports.selectMonth')}>
          {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls} aria-label={t('reports.selectYear')}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );

  if (loading || !report) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid h-96 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
      </div>
    );
  }

  const s = report.summary;
  const grossProfit = Number(s.net_sales) - Number(s.cogs);
  const pct = (v: number) => (Number(s.net_sales) ? `${((v / Number(s.net_sales)) * 100).toFixed(1)}%` : '—');
  const unpaid = Number(s.total_billed) - Number(s.payments_received);

  const kpis = [
    { label: t('acc.kpi.netSales'), value: `OMR ${money(s.net_sales)}`, sub: t('reports.ordersCount', { n: String(s.orders) }), icon: TrendingUp },
    { label: t('acc.expenses'), value: `OMR ${money(s.expenses)}`, sub: t('acc.kpi.entries', { n: String(expenses.length) }), icon: TrendingDown },
    { label: t('reports.netProfit'), value: `OMR ${money(s.net_profit)}`, sub: t('acc.kpi.margin', { pct: pct(Number(s.net_profit)) }), icon: Wallet, negative: s.net_profit < 0 },
    { label: t('acc.kpi.cashCollected'), value: `OMR ${money(s.payments_received)}`, sub: t('acc.kpi.inclVat'), icon: Landmark },
  ];

  return (
    <div className="space-y-5">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <GlassCard key={k.label} sheen hover className="p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow"><k.icon className="h-5 w-5" /></span>
            <div className={['mt-4 font-display text-2xl font-bold', k.negative ? 'text-rose-600' : 'text-ink-900'].join(' ')}>{k.value}</div>
            <div className="text-xs font-semibold text-ink-600">{k.label}</div>
            <div className="text-[11px] text-ink-400">{k.sub}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Profit & Loss statement — built from the same period report as Reports */}
        <GlassCard className="p-5 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-ink-900">{t('acc.pl.title')}</h3>
              <p className="text-xs text-ink-500">{monthLabel} · OMR</p>
            </div>
            <div className="flex gap-1.5">
              {([['pdf', FileText, 'PDF'], ['xlsx', FileSpreadsheet, 'Excel'], ['csv', FileDown, 'CSV']] as const).map(([kind, Icon, label]) => (
                <button
                  key={kind}
                  onClick={() => download(kind)}
                  disabled={downloading !== null}
                  className="flex items-center gap-1 rounded-lg border border-white/50 bg-white/50 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-white disabled:opacity-60"
                  title={t('reports.download')}
                >
                  {downloading === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-sm">
            <PLLine label={t('reports.grossSales')} value={s.gross_sales} />
            <PLLine label={t('reports.discounts')} value={-s.discounts} />
            <PLLine label={t('reports.netSales')} value={s.net_sales} strong />
            {Number(s.package_sales) > 0 && <PLLine label={t('acc.pl.ofWhichPackages')} value={s.package_sales} indent muted />}
            <PLLine label={t('reports.cogs')} value={-s.cogs} />
            <PLLine label={t('acc.pl.grossProfit')} value={grossProfit} strong note={pct(grossProfit)} />
            <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{t('acc.pl.operatingExpenses')}</div>
            {report.expenses.map((e) => <PLLine key={e.category} label={e.category} value={-e.total} indent />)}
            {report.expenses.length === 0 && <div className="py-1 ps-4 text-xs text-ink-400">{t('reports.noExpensesPeriod')}</div>}
            <PLLine label={t('acc.pl.totalExpenses')} value={-s.expenses} />
            <div className={['mt-1 flex items-center justify-between rounded-xl px-3 py-2.5', s.net_profit < 0 ? 'bg-rose-50' : 'bg-brand-50'].join(' ')}>
              <span className="font-display font-bold text-ink-900">{t('reports.netProfitRow')} <span className="text-xs font-semibold text-ink-500">· {pct(Number(s.net_profit))}</span></span>
              <span className={['font-display text-lg font-extrabold tabular-nums', s.net_profit < 0 ? 'text-rose-600' : 'text-brand-700'].join(' ')}>{money(s.net_profit)}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <MiniStat label={t('acc.pl.vatPayable')} value={money(s.vat)} hint={t('acc.pl.vatHint')} />
              <MiniStat label={t('acc.pl.totalBilled')} value={money(s.total_billed)} hint={t('acc.kpi.inclVat')} />
              <MiniStat label={t('acc.pl.unpaid')} value={money(Math.max(unpaid, 0))} hint={unpaid > 0.0005 ? t('acc.pl.unpaidHint') : t('acc.pl.allPaid')} warn={unpaid > 0.0005} />
            </div>
          </div>
        </GlassCard>

        {/* Best clients of the month */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink-900"><Trophy className="h-4 w-4 text-accent-600" /> {t('acc.best.title')}</h3>
              <p className="text-xs text-ink-500">{monthLabel}</p>
            </div>
            <div className="flex rounded-full bg-white/50 p-0.5 text-[11px] font-semibold">
              {(['amount', 'orders'] as const).map((k) => (
                <button key={k} onClick={() => setRankBy(k)} className={['rounded-full px-2.5 py-1', rankBy === k ? 'bg-brand-600 text-white' : 'text-ink-600'].join(' ')}>
                  {t(k === 'amount' ? 'acc.best.byAmount' : 'acc.best.byOrders')}
                </button>
              ))}
            </div>
          </div>

          {ranked[0] && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-3.5">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-lg font-bold text-white">
                {ranked[0].name[0]?.toUpperCase()}
                <Crown className="absolute -top-2.5 h-5 w-5 fill-accent-300 text-accent-600" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-accent-700">{t('acc.best.clientOfMonth')}</div>
                <div className="truncate font-display text-base font-bold text-ink-900">{ranked[0].name}</div>
                <div className="text-xs text-ink-500">{t(ranked[0].orders === 1 ? 'acc.best.lineOne' : 'acc.best.line', { orders: String(ranked[0].orders), amount: money(ranked[0].amount) })}</div>
              </div>
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            {ranked.slice(1).map((c, i) => (
              <div key={c.customer} className="flex items-center gap-3 rounded-xl bg-white/40 px-3 py-2">
                <span className="w-5 text-center text-xs font-bold text-ink-400">{i + 2}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink-900">{c.name}</div>
                  <div className="text-[11px] text-ink-500" dir="ltr">{c.phone || '—'}</div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-bold tabular-nums text-ink-900">{money(c.amount)}</div>
                  <div className="text-[11px] text-ink-500">{t(c.orders === 1 ? 'acc.best.oneOrder' : 'acc.best.orders', { n: String(c.orders) })}</div>
                </div>
              </div>
            ))}
            {ranked.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/70 p-5 text-center">
                <Trophy className="mx-auto h-7 w-7 text-ink-300" />
                <p className="mt-2 text-sm font-semibold text-ink-600">{t('acc.best.empty')}</p>
                <p className="mt-1 text-xs text-ink-400">{t('acc.best.emptyHint')}</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Expenses ledger for the month */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">{t('acc.expenses')}</h3>
            <p className="text-xs text-ink-500">{monthLabel} · {t('acc.expensesTotal', { total: money(s.expenses) })}</p>
          </div>
          {canEdit && (
            <GlassButton variant="primary" size="sm" onClick={() => setExpenseForm(expenseForm === 'new' ? null : 'new')}>
              <Plus className="h-3.5 w-3.5" /> {t('acc.addExpense')}
            </GlassButton>
          )}
        </div>

        {canEdit && expenseForm && (
          <ExpenseForm
            key={expenseForm === 'new' ? 'new' : expenseForm.id}
            expense={expenseForm === 'new' ? null : expenseForm}
            defaultDate={now.getFullYear() === year && now.getMonth() + 1 === month ? now.toISOString().slice(0, 10) : start}
            onSaved={() => { setExpenseForm(null); load(); }}
            onCancel={() => setExpenseForm(null)}
          />
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-ink-400">
                <th className="pb-3 text-start font-semibold">{t('acc.date')}</th>
                <th className="pb-3 text-start font-semibold">{t('acc.category')}</th>
                <th className="pb-3 text-start font-semibold">{t('acc.note')}</th>
                <th className="pb-3 text-end font-semibold">{t('acc.amount')}</th>
                {canEdit && <th className="pb-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {expenses.map((e) => (
                <tr key={e.id} className="group transition-colors hover:bg-white/30">
                  <td className="py-2.5 text-ink-600">{new Date(`${e.date}T00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</td>
                  <td className="py-2.5"><span className="inline-flex rounded-full border border-amber-200/60 bg-amber-100/70 px-2 py-0.5 text-xs font-semibold text-amber-700">{e.category}</span></td>
                  <td className="py-2.5 text-ink-600">{e.note || '—'}</td>
                  <td className="py-2.5 text-end font-semibold tabular-nums text-ink-900">{money(e.amount)}</td>
                  {canEdit && (
                    <td className="py-2.5 text-end">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100">
                        <button onClick={() => setExpenseForm(e)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-500 hover:bg-white" title={t('acc.editExpense')}><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteExpense(e.id)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="py-6 text-center text-sm text-ink-400">{t('reports.noExpensesPeriod')}</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Payments ledger for the month */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">{t('acc.payments.title')}</h3>
            <p className="text-xs text-ink-500">{monthLabel} · {t('acc.payments.count', { n: String(payments.length), total: money(s.payments_received) })}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={methodFilter === 'all'} onClick={() => setMethodFilter('all')} label={t('pkg.filter.all')} />
            {methodTotals.map(([m, v]) => (
              <FilterChip
                key={m}
                active={methodFilter === m}
                onClick={() => setMethodFilter(m)}
                label={`${PAYMENT_METHOD_KEY[m] ? t(PAYMENT_METHOD_KEY[m]) : m} · ${money(v.total)}`}
                icon={m === 'cash' ? Banknote : undefined}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 max-h-[420px] overflow-auto">
          <table className="w-full min-w-[680px] text-start text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur">
              <tr className="text-xs uppercase tracking-wider text-ink-400">
                <th className="py-2 text-start font-semibold">{t('acc.date')}</th>
                <th className="py-2 text-start font-semibold">{t('acc.order')}</th>
                <th className="py-2 text-start font-semibold">{t('acc.payments.client')}</th>
                <th className="py-2 text-start font-semibold">{t('acc.payments.type')}</th>
                <th className="py-2 text-start font-semibold">{t('acc.method')}</th>
                <th className="py-2 text-start font-semibold">{t('acc.payments.by')}</th>
                <th className="py-2 text-end font-semibold">{t('acc.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {shownPayments.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-white/30">
                  <td className="py-2.5 text-ink-600">{new Date(p.paid_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2.5 font-mono text-xs text-ink-500">#{p.order}</td>
                  <td className="py-2.5 text-ink-700">{p.customer_name ?? <span className="text-ink-300">—</span>}</td>
                  <td className="py-2.5 text-ink-600">{ORDER_TYPE_KEY[p.order_type] ? t(ORDER_TYPE_KEY[p.order_type]) : p.order_type}</td>
                  <td className="py-2.5 text-ink-600">{PAYMENT_METHOD_KEY[p.method] ? t(PAYMENT_METHOD_KEY[p.method]) : p.method}</td>
                  <td className="py-2.5 text-ink-500">{p.received_by_username ?? '—'}</td>
                  <td className="py-2.5 text-end font-semibold tabular-nums text-ink-900">{money(p.amount)}</td>
                </tr>
              ))}
              {shownPayments.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-sm text-ink-400">{t('reports.noPaymentsPeriod')}</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function PLLine({ label, value, strong, indent, muted, note }: { label: string; value: number; strong?: boolean; indent?: boolean; muted?: boolean; note?: string }) {
  const v = Math.abs(Number(value)) < 0.0005 ? 0 : Number(value); // avoid "-0.000"
  return (
    <div className={['flex items-center justify-between py-1.5', strong ? 'border-t border-ink-200/60 font-bold text-ink-900' : muted ? 'text-ink-400' : 'text-ink-600', indent ? 'ps-4' : ''].join(' ')}>
      <span>
        {label}
        {note && <span className="ms-1.5 text-xs font-semibold text-ink-400">· {note}</span>}
      </span>
      <span className="tabular-nums">{v < 0 ? `(${money(-v)})` : money(v)}</span>
    </div>
  );
}

function MiniStat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={['rounded-xl border p-3', warn ? 'border-amber-200 bg-amber-50/70' : 'border-white/50 bg-white/40'].join(' ')}>
      <div className="text-[11px] font-semibold text-ink-500">{label}</div>
      <div className="font-display text-base font-bold tabular-nums text-ink-900">{value}</div>
      <div className="text-[10px] text-ink-400">{hint}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon?: typeof Banknote }) {
  return (
    <button onClick={onClick} className={['flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all', active ? 'bg-brand-600 text-white' : 'border border-white/50 bg-white/40 text-ink-600 hover:bg-white/70'].join(' ')}>
      {Icon && <Icon className="h-3.5 w-3.5" />} {label}
    </button>
  );
}

function ExpenseForm({ expense, defaultDate, onSaved, onCancel }: { expense: Expense | null; defaultDate: string; onSaved: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState(expense?.category ?? '');
  const [amount, setAmount] = useState(expense ? Number(expense.amount).toFixed(3) : '');
  const [date, setDate] = useState(expense?.date ?? defaultDate);
  const [note, setNote] = useState(expense?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { category: category.trim(), amount, date, note };
      if (expense) await api.patch(`/analytics/expenses/${expense.id}/`, body);
      else await api.post('/analytics/expenses/', body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('acc.addExpenseFailed'));
    } finally {
      setSaving(false);
    }
  }

  const input = 'rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none';
  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-white/50 bg-white/40 p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EXPENSE_PRESETS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCategory(c)}
            className={['rounded-full border px-2.5 py-1 text-xs font-semibold', category === c ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-white/60 bg-white/60 text-ink-600 hover:bg-white'].join(' ')}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <input required placeholder={t('acc.categoryPlaceholder')} value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} sm:col-span-2`} />
        <input required type="number" min="0" step="0.001" placeholder={t('acc.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className={input} dir="ltr" />
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        <input placeholder={t('acc.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} sm:col-span-2`} />
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <GlassButton type="submit" variant="primary" size="sm" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</GlassButton>
        <GlassButton type="button" variant="ghost" size="sm" onClick={onCancel}>{t('common.cancel')}</GlassButton>
      </div>
    </form>
  );
}
