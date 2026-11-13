import {
  LayoutDashboard,
  Calculator,
  ShoppingCart,
  Boxes,
  Briefcase,
  FileBarChart,
  LifeBuoy,
  X,
  LogOut,
} from 'lucide-react';
import type { Role } from '../../contexts/AuthContext';
import { BrandMark } from '../BrandMark';
import { LanguageSwitch } from '../LanguageSwitch';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TranslationKey } from '../../lib/translations';

export type NavKey =
  | 'dashboard'
  | 'accounting'
  | 'pos'
  | 'inventory'
  | 'hr'
  | 'reports'
  | 'help';

type NavItem = {
  key: NavKey;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  badge?: TranslationKey;
  /** Omit to allow every role; otherwise only these roles see the item. */
  roles?: Role[];
};

// Mirrors the backend's actual permission classes (accounts/permissions.py, per-viewset
// role gates) so the sidebar never offers a route that would just 403.
const groups: { titleKey: TranslationKey; items: NavItem[] }[] = [
  {
    titleKey: 'nav.overview',
    items: [{ key: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] }],
  },
  {
    titleKey: 'nav.operations',
    items: [
      { key: 'pos', labelKey: 'nav.pos', icon: ShoppingCart, badge: 'nav.live', roles: ['admin', 'manager'] },
      { key: 'inventory', labelKey: 'nav.inventory', icon: Boxes, roles: ['admin', 'manager'] },
    ],
  },
  {
    titleKey: 'nav.finance',
    items: [
      { key: 'accounting', labelKey: 'nav.accounting', icon: Calculator, roles: ['admin', 'manager'] },
      { key: 'reports', labelKey: 'nav.reports', icon: FileBarChart, roles: ['admin'] },
    ],
  },
  {
    titleKey: 'nav.people',
    items: [{ key: 'hr', labelKey: 'nav.hr', icon: Briefcase, roles: ['admin', 'manager', 'staff'] }],
  },
];

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  onSignOut,
  role,
}: {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  role: Role | undefined;
}) {
  const { t } = useLanguage();
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || (role && it.roles.includes(role))) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 start-0 z-40 w-72 transform transition-transform duration-300 lg:translate-x-0',
          // max-lg: scopes the closed/off-screen state to below the lg breakpoint, so it
          // never competes on specificity with lg:translate-x-0 — an unscoped
          // `rtl:translate-x-full` has higher specificity than `lg:translate-x-0` (an
          // extra [dir="rtl"] attribute selector), which made the sidebar stay permanently
          // off-screen at desktop widths whenever the app was in Arabic.
          open ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full',
        ].join(' ')}
      >
        <div className="glass-strong m-3 flex h-[calc(100%-1.5rem)] flex-col rounded-3xl p-4 shadow-glass-lg">
          {/* Logo */}
          <div className="flex items-center justify-between px-2 py-2">
            <a className="flex items-center gap-2.5">
              <BrandMark className="h-9 w-9 rounded-xl" />
              <span className="font-display text-lg font-bold text-ink-900">
                Swalif<span className="text-brand-600">.</span>
              </span>
            </a>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-white/50 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-2 pt-2 sm:hidden">
            <LanguageSwitch className="w-full justify-center" />
          </div>

          {/* Nav */}
          <nav className="no-scrollbar mt-3 flex-1 space-y-5 overflow-y-auto pb-4">
            {visibleGroups.map((g) => (
              <div key={g.titleKey}>
                <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-400">
                  {t(g.titleKey)}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const isActive = active === it.key;
                    return (
                      <button
                        key={it.key}
                        onClick={() => onNavigate(it.key)}
                        className={[
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-glow'
                            : 'text-ink-600 hover:bg-white/60 hover:text-ink-900',
                        ].join(' ')}
                      >
                        <Icon
                          className={[
                            'h-4.5 w-4.5 shrink-0',
                            isActive ? 'text-white' : 'text-ink-500 group-hover:text-brand-600',
                          ].join(' ')}
                        />
                        <span className="flex-1 text-start">{t(it.labelKey)}</span>
                        {it.badge && (
                          <span
                            className={[
                              'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                              isActive
                                ? 'bg-white/25 text-white'
                                : 'bg-brand-100 text-brand-700',
                            ].join(' ')}
                          >
                            {t(it.badge)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom */}
          <div className="mt-2 space-y-1 border-t border-white/40 pt-3">
            <button
              onClick={() => onNavigate('help')}
              className={[
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active === 'help'
                  ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-glow'
                  : 'text-ink-600 hover:bg-white/60 hover:text-ink-900',
              ].join(' ')}
            >
              <LifeBuoy className="h-4.5 w-4.5" /> {t('nav.help')}
            </button>
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-white/60 hover:text-ink-900"
            >
              <LogOut className="h-4.5 w-4.5" /> {t('nav.signOut')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
