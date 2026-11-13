import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  Clock,
  Info,
  PackageMinus,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useLanguage } from '../../contexts/LanguageContext';

type NotificationT = { id: number; notif_type: string; message: string; is_read: boolean; created_at: string };

function unwrap<T>(res: { results?: T[] } | T[]): T[] {
  return Array.isArray(res) ? res : res.results ?? [];
}

// One icon + colour per backend NotifType, so the list can be scanned at a glance.
const TYPE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  low_stock: { icon: PackageMinus, tone: 'bg-amber-100 text-amber-700' },
  expiry: { icon: CalendarClock, tone: 'bg-rose-100 text-rose-700' },
  daily_sales: { icon: TrendingUp, tone: 'bg-emerald-100 text-emerald-700' },
  attendance: { icon: Clock, tone: 'bg-sky-100 text-sky-700' },
  system: { icon: Info, tone: 'bg-brand-100 text-brand-700' },
};

export function NotificationBell() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationT[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api.get<{ results?: NotificationT[] } | NotificationT[]>('/notifications/notifications/').then((res) =>
      setItems(unwrap(res))
    );
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // no websockets in scope — poll instead
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    await api.post('/notifications/notifications/mark_all_read/');
    load();
  }

  async function markRead(n: NotificationT) {
    if (n.is_read) return;
    await api.post(`/notifications/notifications/${n.id}/mark_read/`);
    load();
  }

  function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('notif.justNow');
    if (mins < 60) return t('notif.minutesAgo', { n: String(mins) });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notif.hoursAgo', { n: String(hours) });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('notif.daysAgo', { n: String(days) });
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-GB', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'relative grid h-9 w-9 place-items-center rounded-full border border-white/50 text-ink-600 transition-colors hover:bg-white/60',
          open ? 'bg-white/70' : 'bg-white/40',
        ].join(' ')}
        title={t('notif.title')}
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Solid surface on purpose: this panel lives inside the Topbar, which already has a
        // backdrop-filter, and nested backdrop-filters don't blur the page behind — a
        // translucent "glass" panel here lets dashboard cards bleed through the text.
        <div className="absolute end-0 top-12 z-30 w-[22rem] max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-glass-lg rtl:origin-top-left">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink-900">{t('notif.title')}</p>
              <p className="text-[11px] text-ink-500">
                {unreadCount > 0 ? t('notif.unread', { count: String(unreadCount) }) : t('notif.allCaughtUp')}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notif.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 divide-y divide-ink-100/70 overflow-y-auto">
            {items.map((n) => {
              const style = TYPE_STYLE[n.notif_type] ?? TYPE_STYLE.system;
              const Icon = style.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={[
                    'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-ink-50',
                    n.is_read ? '' : 'bg-brand-50/40',
                  ].join(' ')}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${style.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        'block text-xs leading-snug',
                        n.is_read ? 'text-ink-500' : 'font-semibold text-ink-900',
                      ].join(' ')}
                    >
                      {n.message}
                    </span>
                    <span
                      className="mt-1 block text-[10px] text-ink-400"
                      title={new Date(n.created_at).toLocaleString()}
                    >
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                  {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              );
            })}

            {items.length === 0 && (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-50 text-ink-400">
                  <BellOff className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-700">{t('notif.empty')}</p>
                <p className="mt-1 text-xs text-ink-400">{t('notif.emptyHint')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
