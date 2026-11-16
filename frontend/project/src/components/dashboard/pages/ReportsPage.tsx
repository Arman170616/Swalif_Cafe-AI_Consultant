import { useEffect, useMemo, useState } from 'react';
import {
  TrendingDown,
  DollarSign,
  Receipt,
  Boxes,
  Wallet,
  Calendar,
  Sparkles,
  PieChart,
  Activity,
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  FileDown,
  Table2,
} from 'lucide-react';
import { GlassCard, Badge } from '../../ui';
import { api, downloadFile } from '../../../lib/api';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TranslationKey } from '../../../lib/translations';
import { splitName } from './MenuItems';

const PAYMENT_METHOD_KEY: Record<string, TranslationKey> = {
  cash: 'paymentMethod.cash',
  card: 'paymentMethod.card',
  mobile: 'paymentMethod.mobile',
};

type RangeKey = 'daily' | 'monthly' | 'yearly';
type CatKey = 'sales' | 'expenses' | 'profit' | 'inventory' | 'vat' | 'cashflow';
type ExportKind = 'pdf' | 'xlsx' | 'csv';

/** Mirrors Backend analytics/period_report.py — every figure comes from the database. */
type PeriodReport = {
  period: RangeKey;
  label: string;
  slug: string;
  start: string;
  end: string;
  summary: {
    orders: number;
    cancelled_orders: number;
    items_sold: number;
    gross_sales: number;
    discounts: number;
    net_sales: number;
    vat: number;
    total_billed: number;
    avg_order_value: number;
    cogs: number;
    expenses: number;
    net_profit: number;
    payments_received: number;
  };
  breakdown: { key: string; label: string; orders: number; net_sales: number; vat: number; cogs: number; expenses: number; net_profit: number }[];
  products: { product: string; category: string; quantity: number; revenue: number }[];
  categories: { category: string; quantity: number; revenue: number }[];
  payments: { method: string; label: string; count: number; total: number }[];
  order_types: { type: string; label: string; count: number; net_sales: number }[];
  expenses: { category: string; count: number; total: number }[];
};
type LowStockItem = { id: number; name: string; unit: string; quantity_on_hand: string; reorder_threshold: string };

const omr = (v: number | string, dp = 3) => `OMR ${Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const categoryDefs: { key: CatKey; labelKey: TranslationKey; icon: typeof DollarSign; descKey: TranslationKey }[] = [
  { key: 'sales', labelKey: 'reports.cat.sales', icon: DollarSign, descKey: 'reports.cat.salesDesc' },
  { key: 'expenses', labelKey: 'reports.cat.expenses', icon: TrendingDown, descKey: 'reports.cat.expensesDesc' },
  { key: 'profit', labelKey: 'reports.cat.profit', icon: Wallet, descKey: 'reports.cat.profitDesc' },
  { key: 'inventory', labelKey: 'reports.cat.inventory', icon: Boxes, descKey: 'reports.cat.inventoryDesc' },
  { key: 'vat', labelKey: 'reports.cat.vat', icon: Receipt, descKey: 'reports.cat.vatDesc' },
  { key: 'cashflow', labelKey: 'reports.cat.cashflow', icon: Activity, descKey: 'reports.cat.cashflowDesc' },
];

export function ReportsPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-OM' : 'en-GB';
  const localName = (name: string) => {
    const s = splitName(name);
    const base = lang === 'ar' && s.ar ? s.ar : s.en;
    return s.size ? `${base} (${s.size})` : base;
  };
  const categories = categoryDefs.map((c) => ({ ...c, label: t(c.labelKey), desc: t(c.descKey) }));

  const now = new Date();
  const [range, setRange] = useState<RangeKey>('monthly');
  const [day, setDay] = useState(todayIso());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [cat, setCat] = useState<CatKey>('sales');

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [downloading, setDownloading] = useState<ExportKind | null>(null);
  const [downloadError, setDownloadError] = useState(false);

  const params = useMemo(
    () =>
      range === 'daily'
        ? { period: range, date: day }
        : range === 'monthly'
        ? { period: range, year, month }
        : { period: range, year },
    [range, day, month, year]
  );

  useEffect(() => {
    setLoading(true);
    api
      .get<PeriodReport>('/analytics/period-report/', params)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [params]);

  // Stock is a "right now" figure, not tied to the reporting period.
  useEffect(() => {
    api.get<LowStockItem[]>('/inventory/ingredients/low_stock/').then(setLowStock);
    api.get<{ inventory_value: string }>('/analytics/overview/').then((o) => setInventoryValue(Number(o.inventory_value)));
  }, []);

  async function download(kind: ExportKind) {
    if (!report) return;
    setDownloading(kind);
    setDownloadError(false);
    try {
      await downloadFile('/analytics/period-report/', `swalif-${report.period}-report-${report.slug}.${kind}`, { ...params, export: kind });
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(null);
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' }));

  // Localized label for the chosen period (the backend's `label` is English, for exports).
  const periodLabel = useMemo(() => {
    if (range === 'daily') return new Date(`${day}T00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    if (range === 'monthly') return `${monthNames[month - 1]} ${year}`;
    return String(year);
  }, [range, day, month, year, locale, monthNames]);

  const bucketLabel = (b: PeriodReport['breakdown'][number], short = false) => {
    if (range === 'daily') return b.key;
    const d = new Date(`${b.key}T00:00`);
    if (range === 'monthly') return short ? String(d.getDate()) : d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    return d.toLocaleDateString(locale, { month: short ? 'short' : 'long' });
  };

  const s = report?.summary;
  const kpis = s
    ? [
        { label: t('reports.netSales'), value: omr(s.net_sales), sub: t('reports.ordersCount', { n: String(s.orders) }), icon: DollarSign },
        { label: t('acc.expenses'), value: omr(s.expenses), sub: periodLabel, icon: TrendingDown },
        { label: t('reports.netProfit'), value: omr(s.net_profit), sub: t('reports.afterCostsExpenses'), icon: Wallet, negative: s.net_profit < 0 },
        { label: t('reports.vatCollected'), value: omr(s.vat), sub: t('reports.vatOwed'), icon: Receipt },
      ]
    : [];

  const expenseByCategory = useMemo(() => {
    const rows = report?.expenses ?? [];
    const total = rows.reduce((sum, r) => sum + Number(r.total), 0) || 1;
    const colors = ['from-brand-400 to-brand-600', 'from-accent-400 to-accent-600', 'from-amber-400 to-amber-600', 'from-rose-400 to-rose-600', 'from-ink-400 to-ink-600'];
    return rows.map((r, i) => ({ label: r.category, value: Number(r.total), pct: (Number(r.total) / total) * 100, color: colors[i % colors.length] }));
  }, [report]);

  const topByQty = useMemo(() => [...(report?.products ?? [])].sort((a, b) => b.quantity - a.quantity).slice(0, 5), [report]);

  const rangeTabs = (
    <div className="flex gap-1 rounded-2xl bg-white/40 p-1">
      {(['daily', 'monthly', 'yearly'] as const).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={['rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition-all', range === r ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow' : 'text-ink-600 hover:bg-white/60'].join(' ')}
        >
          {t(`reports.${r}` as TranslationKey)}
        </button>
      ))}
    </div>
  );

  const selectCls = 'rounded-xl border border-white/50 bg-white/60 px-3 py-1.5 text-sm font-semibold text-ink-800 focus:border-brand-300 focus:outline-none';
  const periodPicker = (
    <div className="flex items-center gap-2">
      {range === 'daily' && (
        <input type="date" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} className={selectCls} aria-label={t('reports.selectDate')} />
      )}
      {range === 'monthly' && (
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls} aria-label={t('reports.selectMonth')}>
          {monthNames.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      )}
      {range !== 'daily' && (
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls} aria-label={t('reports.selectYear')}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-600" />
          <span className="font-display text-base font-bold text-ink-900">{t('reports.reportingPeriod')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodPicker}
          {rangeTabs}
        </div>
      </div>

      {loading || !report || !s ? (
        <div className="grid h-96 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <GlassCard key={k.label} sheen hover className="p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow"><Icon className="h-5 w-5" /></span>
                  <div className={['mt-4 font-display text-2xl font-bold', k.negative ? 'text-rose-600' : 'text-ink-900'].join(' ')}>{k.value}</div>
                  <div className="text-xs font-semibold text-ink-600">{k.label}</div>
                  <div className="text-[11px] text-ink-400">{k.sub}</div>
                </GlassCard>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900">{t('reports.salesTrend')}</h3>
                  <p className="text-xs text-ink-500">{t(`reports.breakdownSub.${range}` as TranslationKey)} · {periodLabel}</p>
                </div>
                {s.cancelled_orders > 0 && <Badge tone="neutral">{t('reports.cancelledNote', { n: String(s.cancelled_orders) })}</Badge>}
              </div>
              <MiniBarChart
                data={report.breakdown.map((b) => Number(b.net_sales))}
                labels={report.breakdown.map((b) => bucketLabel(b, true))}
                every={range === 'monthly' ? 5 : 1}
                noDataLabel={t('reports.noDataPeriod')}
              />
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="font-display text-base font-bold text-ink-900">{t('reports.reportCategory')}</h3>
              <p className="text-xs text-ink-500">{t('reports.pickDomain')}</p>
              <div className="mt-4 space-y-2">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const isActive = cat === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setCat(c.key)}
                      className={['group flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-all', isActive ? 'border-brand-300 bg-brand-50/60' : 'border-white/40 bg-white/30 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white/50'].join(' ')}
                    >
                      <span className={['grid h-10 w-10 place-items-center rounded-xl text-white shadow-glow transition-all', isActive ? 'bg-gradient-to-br from-brand-400 to-brand-700' : 'bg-gradient-to-br from-ink-400 to-ink-600'].join(' ')}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-ink-900">{c.label}</div>
                        <div className="text-xs text-ink-500">{c.desc}</div>
                      </div>
                      {isActive && <Sparkles className="h-4 w-4 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="p-5 lg:col-span-2">
              <h3 className="font-display text-base font-bold text-ink-900">{t('reports.detail', { category: categories.find((c) => c.key === cat)?.label ?? '' })}</h3>
              <p className="text-xs text-ink-500">{periodLabel}</p>
              <div className="mt-4 max-h-80 overflow-y-auto pe-1">
                <CategoryDetail
                  cat={cat}
                  report={report}
                  lowStock={lowStock}
                  inventoryValue={inventoryValue}
                  localName={localName}
                  bucketLabel={(b) => bucketLabel(b)}
                />
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-ink-900">{t('reports.topSellingProducts')}</h3>
                <Badge tone="brand"><PieChart className="h-3 w-3" /> {t('reports.top5')}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">{t('reports.byQuantity')}</p>
              <div className="mt-4 space-y-3">
                {topByQty.map((b) => {
                  const max = topByQty[0]?.quantity || 1;
                  return (
                    <div key={b.product}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-ink-700">{localName(b.product)}</span>
                        <span className="shrink-0 font-semibold text-ink-900">{b.quantity} {t('reports.sold')}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700" style={{ width: `${(b.quantity / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {topByQty.length === 0 && <p className="text-sm text-ink-400">{t('reports.noSalesPeriod')}</p>}
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-5">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">{t('reports.expenseBreakdown')}</h3>
                <p className="text-xs text-ink-500">{t('reports.whereMoneyWent')} · {periodLabel}</p>
              </div>
              <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-white/50">
                {expenseByCategory.map((e) => <div key={e.label} className={`h-full bg-gradient-to-r ${e.color}`} style={{ width: `${e.pct}%` }} title={`${e.label} · ${e.pct.toFixed(1)}%`} />)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {expenseByCategory.map((e) => (
                  <div key={e.label} className="rounded-xl border border-white/40 bg-white/30 p-3">
                    <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${e.color}`} /><span className="text-xs font-semibold text-ink-700">{e.label}</span></div>
                    <div className="mt-1.5 font-display text-base font-bold text-ink-900">{omr(e.value)}</div>
                    <div className="text-[10px] text-ink-400">{t('reports.pctOfTotal', { pct: e.pct.toFixed(1) })}</div>
                  </div>
                ))}
                {expenseByCategory.length === 0 && <p className="col-span-full text-sm text-ink-400">{t('reports.noExpensesPeriod')}</p>}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900">{t('reports.download')}</h3>
                  <p className="text-xs text-ink-500">{t('reports.downloadSub', { label: periodLabel })}</p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Download className="h-5 w-5" /></span>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {([
                  ['pdf', FileText, 'PDF', 'reports.pdfDesc', 'from-rose-500 to-brand-700'],
                  ['xlsx', FileSpreadsheet, 'Excel', 'reports.xlsxDesc', 'from-emerald-500 to-emerald-700'],
                  ['csv', FileDown, 'CSV', 'reports.csvDesc', 'from-sky-500 to-sky-700'],
                ] as const).map(([kind, Icon, name, descKey, grad]) => (
                  <button
                    key={kind}
                    onClick={() => download(kind)}
                    disabled={downloading !== null}
                    className="group flex flex-col items-start gap-2 rounded-2xl border border-white/50 bg-white/40 p-3 text-start transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white/70 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow`}>
                      {downloading === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="text-sm font-bold text-ink-900">{name}</span>
                    <span className="text-[11px] leading-snug text-ink-500">{t(descKey)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{t('reports.includes')}</p>
              {downloadError && <p className="mt-2 text-xs font-semibold text-rose-600">{t('reports.downloadFailed')}</p>}
            </GlassCard>
          </div>

          <BreakdownTable report={report} title={t('reports.breakdownTitle', { label: periodLabel })} bucketLabel={(b) => bucketLabel(b)} />
        </>
      )}
    </div>
  );
}

function BreakdownTable({ report, title, bucketLabel }: { report: PeriodReport; title: string; bucketLabel: (b: PeriodReport['breakdown'][number]) => string }) {
  const { t } = useLanguage();
  const [hideEmpty, setHideEmpty] = useState(true);
  const rows = hideEmpty ? report.breakdown.filter((r) => r.orders > 0 || Number(r.expenses) > 0) : report.breakdown;
  const s = report.summary;
  const unitKey = { daily: 'reports.col.hour', monthly: 'reports.col.day', yearly: 'reports.col.month' }[report.period] as TranslationKey;
  const num = (v: number) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const cols: TranslationKey[] = ['reports.col.orders', 'reports.col.netSales', 'reports.col.vat', 'reports.col.cogs', 'reports.col.expenses', 'reports.col.netProfit'];

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700"><Table2 className="h-4 w-4" /></span>
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
            <p className="text-xs text-ink-500">{t(`reports.breakdownSub.${report.period}` as TranslationKey)} · OMR</p>
          </div>
        </div>
        {report.period !== 'daily' && (
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-600">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-brand-600" />
            {t('reports.hideEmpty')}
          </label>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ink-200/60 text-xs text-ink-500">
              <th className="py-2 text-start font-semibold">{t(unitKey)}</th>
              {cols.map((c) => <th key={c} className="py-2 text-end font-semibold">{t(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={['border-b border-white/60', r.orders === 0 && Number(r.expenses) === 0 ? 'text-ink-300' : 'text-ink-800'].join(' ')}>
                <td className="py-2 font-medium">{bucketLabel(r)}</td>
                <td className="py-2 text-end tabular-nums">{r.orders}</td>
                <td className="py-2 text-end tabular-nums">{num(r.net_sales)}</td>
                <td className="py-2 text-end tabular-nums">{num(r.vat)}</td>
                <td className="py-2 text-end tabular-nums">{num(r.cogs)}</td>
                <td className="py-2 text-end tabular-nums">{num(r.expenses)}</td>
                <td className={['py-2 text-end font-semibold tabular-nums', r.net_profit < 0 ? 'text-rose-600' : ''].join(' ')}>{num(r.net_profit)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-ink-400">{t('reports.noDataPeriod')}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-200 font-bold text-ink-900">
              <td className="py-2.5">{t('reports.total')}</td>
              <td className="py-2.5 text-end tabular-nums">{s.orders}</td>
              <td className="py-2.5 text-end tabular-nums">{num(s.net_sales)}</td>
              <td className="py-2.5 text-end tabular-nums">{num(s.vat)}</td>
              <td className="py-2.5 text-end tabular-nums">{num(s.cogs)}</td>
              <td className="py-2.5 text-end tabular-nums">{num(s.expenses)}</td>
              <td className={['py-2.5 text-end tabular-nums', s.net_profit < 0 ? 'text-rose-600' : 'text-brand-700'].join(' ')}>{num(s.net_profit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassCard>
  );
}

function CategoryDetail({ cat, report, lowStock, inventoryValue, localName, bucketLabel }: {
  cat: CatKey;
  report: PeriodReport;
  lowStock: LowStockItem[];
  inventoryValue: number;
  localName: (name: string) => string;
  bucketLabel: (b: PeriodReport['breakdown'][number]) => string;
}) {
  const { t } = useLanguage();
  const s = report.summary;
  if (cat === 'sales') {
    return (
      <div className="space-y-2">
        {report.products.map((p) => (
          <Row key={p.product} label={localName(p.product)} value={`${p.quantity} ${t('reports.sold')} · ${omr(p.revenue)}`} />
        ))}
        {report.products.length === 0 && <p className="text-sm text-ink-400">{t('reports.noSalesPeriod')}</p>}
      </div>
    );
  }
  if (cat === 'expenses') {
    return (
      <div className="space-y-2">
        {report.expenses.map((e) => <Row key={e.category} label={e.category} value={`${omr(e.total)} · ${e.count}×`} />)}
        {report.expenses.length === 0 && <p className="text-sm text-ink-400">{t('reports.noExpensesPeriod')}</p>}
      </div>
    );
  }
  if (cat === 'profit') {
    return (
      <div className="space-y-2">
        <Row label={t('reports.grossSales')} value={omr(s.gross_sales)} />
        <Row label={t('reports.discounts')} value={`− ${omr(s.discounts)}`} />
        <Row label={t('reports.netSales')} value={omr(s.net_sales)} bold />
        <Row label={t('reports.cogs')} value={`− ${omr(s.cogs)}`} />
        <Row label={t('acc.expenses')} value={`− ${omr(s.expenses)}`} />
        <Row label={t('reports.netProfitRow')} value={omr(s.net_profit)} bold />
        <p className="pt-1 text-[11px] text-ink-400">{t('reports.vatNote')}</p>
      </div>
    );
  }
  if (cat === 'inventory') {
    return (
      <div className="space-y-2">
        <Row label={t('dash.inventoryValue')} value={omr(inventoryValue)} bold />
        {lowStock.map((i) => <Row key={i.id} label={i.name} value={`${Number(i.quantity_on_hand).toFixed(1)} / ${t('inv.reorderThreshold')} ${Number(i.reorder_threshold).toFixed(1)} ${i.unit}`} />)}
        {lowStock.length === 0 && <p className="text-sm text-ink-400">{t('reports.nothingLowStock')}</p>}
        <p className="pt-1 text-[11px] text-ink-400">{t('reports.stockIsNow')}</p>
      </div>
    );
  }
  if (cat === 'vat') {
    const rows = report.breakdown.filter((b) => Number(b.vat) > 0);
    return (
      <div className="space-y-2">
        {rows.map((b) => <Row key={b.key} label={bucketLabel(b)} value={omr(b.vat)} />)}
        {rows.length === 0 && <p className="text-sm text-ink-400">{t('reports.noSalesPeriod')}</p>}
        <Row label={t('reports.total')} value={omr(s.vat)} bold />
      </div>
    );
  }
  if (cat === 'cashflow') {
    return (
      <div className="space-y-2">
        {report.payments.map((c) => <Row key={c.method} label={PAYMENT_METHOD_KEY[c.method] ? t(PAYMENT_METHOD_KEY[c.method]) : c.label} value={`${omr(c.total)} (${t('reports.paymentsCount', { n: String(c.count) })})`} />)}
        {report.payments.length === 0 && <p className="text-sm text-ink-400">{t('reports.noPaymentsPeriod')}</p>}
        {report.payments.length > 0 && <Row label={t('reports.total')} value={omr(s.payments_received)} bold />}
      </div>
    );
  }
  return null;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/30 px-3 py-2 text-sm">
      <span className="truncate text-ink-600">{label}</span>
      <span className={['shrink-0 tabular-nums', bold ? 'font-bold text-brand-700' : 'font-semibold text-ink-900'].join(' ')}>{value}</span>
    </div>
  );
}

function MiniBarChart({ data, labels, every = 1, noDataLabel }: { data: number[]; labels: string[]; every?: number; noDataLabel: string }) {
  const max = Math.max(...data, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0 || max === 0) {
    return <div className="mt-6 grid h-44 place-items-center text-sm text-ink-400">{noDataLabel}</div>;
  }
  return (
    <div className="mt-6" dir="ltr">
      <div className="flex h-44 items-end gap-1">
        {data.map((v, i) => {
          const h = Math.round((v / max) * 100);
          const isHover = hover === i;
          return (
            <div key={i} className="group relative flex h-44 flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {isHover && (
                <div className="absolute -top-9 z-10 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                  {labels[i]} · {omr(v)}
                </div>
              )}
              <div
                className={['w-full max-w-[28px] rounded-t-md transition-all duration-500', v === 0 ? 'bg-ink-200/50' : isHover ? 'bg-gradient-to-t from-brand-500 to-brand-300' : 'bg-gradient-to-t from-brand-600 to-brand-400 opacity-80 group-hover:opacity-100'].join(' ')}
                style={{ height: v === 0 ? '2px' : `${Math.max(h, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-medium text-ink-400">
            {i % every === 0 || i === labels.length - 1 ? l : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
