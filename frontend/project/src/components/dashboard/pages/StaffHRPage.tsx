import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Trophy,
  DollarSign,
  CalendarCheck,
  Clock,
  LogIn,
  LogOut,
  Download,
  Plus,
  Loader2,
  Star,
} from 'lucide-react';
import { GlassCard, GlassButton } from '../../ui';
import { api, ApiError, downloadFile } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TranslationKey } from '../../../lib/translations';

/* ─── API types (mirrors HRPage.tsx, scoped to "me" by the backend) ────────── */

type Employee = { id: number; user: number; username: string; full_name: string; position: string; hire_date: string; base_salary: string; is_active: boolean };
type Attendance = { id: number; date: string; check_in: string | null; check_out: string | null; status: string; hours_worked: number; approval_status: 'pending' | 'approved' | 'rejected' };
type Payslip = { id: number; period_start: string; period_end: string; base_salary: string; overtime_amount: string; bonus: string; deductions: string; net_salary: string; generated_at: string };
type Leave = { id: number; leave_type: string; start_date: string; end_date: string; reason: string; status: string };
type Performance = { orders_served: number; revenue_generated: number; average_rating: number | null; rank: number };

function unwrap<T>(res: { results?: T[] } | T[]): T[] {
  return Array.isArray(res) ? res : res.results ?? [];
}

export function StaffHRPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'performance' | 'attendance' | 'payroll' | 'leave'>('performance');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<Leave[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [showNewLeave, setShowNewLeave] = useState(false);
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Employee>('/hr/my-employee/').catch((err) => {
        if (err instanceof ApiError && err.status === 404) { setNotFound(true); return null; }
        throw err;
      }),
      api.get<{ results?: Attendance[] } | Attendance[]>('/hr/attendance/'),
      api.get<{ results?: Payslip[] } | Payslip[]>('/payroll/payslips/'),
      api.get<{ results?: Leave[] } | Leave[]>('/hr/leave/'),
      api.get<Performance[]>('/analytics/employee-performance/'),
    ])
      .then(([e, a, p, l, perf]) => {
        setEmployee(e);
        setAttendance(unwrap(a));
        setPayslips(unwrap(p));
        setLeaveRequests(unwrap(l));
        setPerformance(perf[0] ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find((a) => a.date === today) ?? null;

  const approvedRecords = useMemo(() => attendance.filter((a) => a.approval_status === 'approved'), [attendance]);
  const attendanceRate = approvedRecords.length
    ? Math.round((approvedRecords.filter((a) => a.status === 'present').length / approvedRecords.length) * 100)
    : null;
  const openLeaves = leaveRequests.filter((l) => l.status === 'pending').length;

  async function checkIn() {
    setActing(true);
    try {
      if (!employee) return;
      await api.post('/hr/attendance/', { employee: employee.id, date: today, status: 'present', check_in: new Date().toISOString() });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('staffHr.checkInFailed'));
    } finally {
      setActing(false);
    }
  }
  async function checkOut() {
    if (!todayRecord) return;
    setActing(true);
    try {
      await api.patch(`/hr/attendance/${todayRecord.id}/`, { check_out: new Date().toISOString() });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('staffHr.checkOutFailed'));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="grid h-96 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>;
  }

  if (notFound || !employee) {
    return (
      <GlassCard variant="strong" className="p-10 text-center">
        <h2 className="font-display text-xl font-bold text-ink-900">{t('staffHr.noProfileTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
          {t('staffHr.noProfileDesc', { username: user?.username ?? '' })}
        </p>
      </GlassCard>
    );
  }

  const kpis = [
    { label: t('staffHr.thisMonth'), value: performance ? String(performance.orders_served) : '0', icon: Trophy, sub: t('staffHr.ordersServed') },
    { label: t('staffHr.revenueGenerated'), value: `OMR ${(performance?.revenue_generated ?? 0).toLocaleString()}`, icon: DollarSign, sub: t('pos.last30Days') },
    { label: t('hr.attendanceRate'), value: attendanceRate != null ? `${attendanceRate}%` : '—', icon: CalendarCheck, sub: t('staffHr.approvedRecords') },
    { label: t('staffHr.openLeaveRequests'), value: String(openLeaves), icon: Clock, sub: t('staffHr.pendingApproval') },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <GlassCard key={k.label} sheen hover className="p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 font-display text-2xl font-bold text-ink-900">{k.value}</div>
              <div className="text-xs text-ink-500">{k.label}</div>
              <div className="mt-0.5 text-[10px] text-ink-400">{k.sub}</div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
            {(employee.full_name || employee.username).slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="font-display text-base font-bold text-ink-900">{employee.full_name || employee.username}</div>
            <div className="text-xs text-ink-500">{employee.position} · {t('staffHr.joined', { date: employee.hire_date })}</div>
          </div>
        </div>

        <div className="mt-5 flex gap-1 rounded-2xl bg-white/40 p-1">
          {(['performance', 'attendance', 'payroll', 'leave'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={['rounded-xl px-4 py-1.5 text-sm font-semibold transition-all capitalize', activeTab === tab ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow' : 'text-ink-600 hover:bg-white/60'].join(' ')}
            >
              {tab === 'performance' ? t('pos.performance') : t(`hr.${tab}` as TranslationKey)}
            </button>
          ))}
        </div>

        {activeTab === 'performance' && (
          <div className="mt-5">
            {performance ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/40 bg-white/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500"><Trophy className="h-3.5 w-3.5 text-amber-500" /> {t('staffHr.rank')}</div>
                  <div className="mt-2 font-display text-2xl font-bold text-ink-900">#{performance.rank}</div>
                </div>
                <div className="rounded-2xl border border-white/40 bg-white/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500"><DollarSign className="h-3.5 w-3.5 text-brand-600" /> {t('staffHr.revenueGenerated')}</div>
                  <div className="mt-2 font-display text-2xl font-bold text-ink-900">OMR {performance.revenue_generated.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-white/40 bg-white/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500"><Star className="h-3.5 w-3.5 text-amber-500" /> {t('staffHr.averageRating')}</div>
                  <div className="mt-2 font-display text-2xl font-bold text-ink-900">{performance.average_rating != null ? performance.average_rating.toFixed(1) : '—'}</div>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-400">{t('staffHr.noOrdersPeriod')}</p>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/30 p-4">
              <div>
                <div className="text-sm font-semibold text-ink-900">{t('staffHr.today', { date: today })}</div>
                <div className="mt-1 text-xs text-ink-500">
                  {todayRecord
                    ? <>
                        {t('staffHr.checkedInAt', { time: todayRecord.check_in ? new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' })}
                        {todayRecord.check_out ? t('staffHr.checkedOutAt', { time: new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : ''}
                      </>
                    : t('staffHr.notCheckedInYet')}
                </div>
                {todayRecord && <ApprovalStatusPill status={todayRecord.approval_status} />}
              </div>
              <div className="flex gap-2">
                {!todayRecord && <GlassButton variant="primary" size="sm" disabled={acting} onClick={checkIn}><LogIn className="h-3.5 w-3.5" /> {t('staffHr.checkIn')}</GlassButton>}
                {todayRecord && !todayRecord.check_out && <GlassButton variant="primary" size="sm" disabled={acting} onClick={checkOut}><LogOut className="h-3.5 w-3.5" /> {t('staffHr.checkOut')}</GlassButton>}
              </div>
            </div>
            <p className="mb-2 mt-5 text-xs text-ink-500">{t('staffHr.checkInExplainer')}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-start text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-ink-400">
                    <th className="pb-3 font-semibold">{t('common.date')}</th>
                    <th className="pb-3 font-semibold">{t('common.status')}</th>
                    <th className="pb-3 font-semibold">{t('hr.checkInCol')}</th>
                    <th className="pb-3 font-semibold">{t('hr.checkOutCol')}</th>
                    <th className="pb-3 font-semibold">{t('hr.approvalCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {attendance.map((a) => (
                    <tr key={a.id} className="hover:bg-white/30">
                      <td className="py-3 text-ink-900">{a.date}</td>
                      <td className="py-3 capitalize text-ink-600">{t(`hr.attStatus.${a.status}` as TranslationKey)}</td>
                      <td className="py-3 text-ink-600">{a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-3 text-ink-600">{a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-3"><ApprovalStatusPill status={a.approval_status} /></td>
                    </tr>
                  ))}
                  {attendance.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-ink-400">{t('staffHr.noAttendanceYet')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-start text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-3 font-semibold">{t('hr.periodCol')}</th>
                  <th className="pb-3 text-end font-semibold">{t('hr.baseCol')}</th>
                  <th className="pb-3 text-end font-semibold">{t('hr.overtimeCol')}</th>
                  <th className="pb-3 text-end font-semibold">{t('hr.netCol')}</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-white/30">
                    <td className="py-3 text-ink-600">{p.period_start} → {p.period_end}</td>
                    <td className="py-3 text-end text-ink-600">OMR {Number(p.base_salary).toFixed(2)}</td>
                    <td className="py-3 text-end text-ink-600">OMR {Number(p.overtime_amount).toFixed(2)}</td>
                    <td className="py-3 text-end font-semibold text-brand-700">OMR {Number(p.net_salary).toFixed(2)}</td>
                    <td className="py-3 text-end">
                      <button onClick={() => downloadFile(`/payroll/payslips/${p.id}/pdf/`, `payslip-${p.id}.pdf`)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-white/60 hover:text-ink-700">
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {payslips.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-ink-400">{t('staffHr.noPayslipsYet')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="mt-5">
            <div className="flex justify-end">
              <GlassButton variant="primary" size="sm" onClick={() => setShowNewLeave((v) => !v)}>
                <Plus className="h-3.5 w-3.5" /> {t('hr.newRequest')}
              </GlassButton>
            </div>
            {showNewLeave && (
              <NewLeaveForm employeeId={employee.id} onSaved={() => { setShowNewLeave(false); load(); }} onCancel={() => setShowNewLeave(false)} />
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-start text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-ink-400">
                    <th className="pb-3 font-semibold">{t('hr.typeCol')}</th>
                    <th className="pb-3 font-semibold">{t('hr.fromCol')}</th>
                    <th className="pb-3 font-semibold">{t('hr.toCol')}</th>
                    <th className="pb-3 font-semibold">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {leaveRequests.map((l) => (
                    <tr key={l.id} className="hover:bg-white/30">
                      <td className="py-3 capitalize text-ink-900">{t(`hr.leaveType.${l.leave_type}` as TranslationKey)}</td>
                      <td className="py-3 text-ink-600">{l.start_date}</td>
                      <td className="py-3 text-ink-600">{l.end_date}</td>
                      <td className="py-3"><LeaveStatusPill status={l.status} /></td>
                    </tr>
                  ))}
                  {leaveRequests.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-ink-400">{t('staffHr.noLeaveYet')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* ─── inline form ────────────────────────────────────────────────────────── */

function NewLeaveForm({ employeeId, onSaved, onCancel }: { employeeId: number; onSaved: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/hr/leave/', { employee: employeeId, leave_type: leaveType, start_date: startDate, end_date: endDate, reason });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('hr.submitLeaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-white/50 bg-white/40 p-4 sm:grid-cols-6">
      <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm sm:col-span-2">
        <option value="annual">{t('hr.leaveType.annual')}</option>
        <option value="sick">{t('hr.leaveType.sick')}</option>
        <option value="unpaid">{t('hr.leaveType.unpaid')}</option>
        <option value="other">{t('hr.leaveType.other')}</option>
      </select>
      <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm sm:col-span-2" />
      <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm sm:col-span-2" />
      <input placeholder={t('hr.reasonOptional')} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm sm:col-span-4" />
      {error && <p className="sm:col-span-6 text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2 sm:col-span-6">
        <GlassButton type="submit" variant="primary" size="sm" disabled={saving}>{saving ? t('staffHr.submitting') : t('hr.submit')}</GlassButton>
        <GlassButton type="button" variant="ghost" size="sm" onClick={onCancel}>{t('common.cancel')}</GlassButton>
      </div>
    </form>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function ApprovalStatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const map: Record<string, string> = {
    approved: 'bg-brand-100/70 text-brand-700 border-brand-200/60',
    pending: 'bg-amber-100/70 text-amber-700 border-amber-200/60',
    rejected: 'bg-rose-100/70 text-rose-600 border-rose-200/60',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${map[status] ?? map.pending}`}>{t(`hr.status.${status}` as TranslationKey)}</span>;
}

function LeaveStatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const map: Record<string, string> = {
    approved: 'bg-brand-100/70 text-brand-700 border-brand-200/60',
    pending: 'bg-amber-100/70 text-amber-700 border-amber-200/60',
    rejected: 'bg-rose-100/70 text-rose-600 border-rose-200/60',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${map[status] ?? map.pending}`}>{t(`hr.status.${status}` as TranslationKey)}</span>;
}
