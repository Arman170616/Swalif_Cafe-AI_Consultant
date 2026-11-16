import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { type NavKey } from './components/dashboard/Sidebar';
import { OverviewPage } from './components/dashboard/pages/OverviewPage';
import { POSPage } from './components/dashboard/pages/POSPage';
import { InventoryPage } from './components/dashboard/pages/InventoryPage';
import { AccountingPage } from './components/dashboard/pages/AccountingPage';
import { HRPage } from './components/dashboard/pages/HRPage';
import { StaffHRPage } from './components/dashboard/pages/StaffHRPage';
import { ReportsPage } from './components/dashboard/pages/ReportsPage';
import { HelpPage } from './components/dashboard/pages/HelpPage';
import { PackagesPage } from './components/dashboard/pages/PackagesPage';
import { AuthPage } from './pages/auth/AuthPage';
import { RequireRole } from './components/RequireRole';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './contexts/LanguageContext';
import type { TranslationKey } from './lib/translations';

const meta: Record<NavKey, { titleKey: TranslationKey; subtitleKey: TranslationKey }> = {
  dashboard: { titleKey: 'title.dashboard', subtitleKey: 'subtitle.dashboard' },
  pos: { titleKey: 'title.pos', subtitleKey: 'subtitle.pos' },
  inventory: { titleKey: 'title.inventory', subtitleKey: 'subtitle.inventory' },
  accounting: { titleKey: 'title.accounting', subtitleKey: 'subtitle.accounting' },
  hr: { titleKey: 'title.hr', subtitleKey: 'subtitle.hr' },
  reports: { titleKey: 'title.reports', subtitleKey: 'subtitle.reports' },
  packages: { titleKey: 'title.packages', subtitleKey: 'subtitle.packages' },
  help: { titleKey: 'title.help', subtitleKey: 'subtitle.help' },
};

function App() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [active, setActive] = useState<NavKey>('dashboard');

  useEffect(() => {
    // Staff's only module is HR & Payroll (self-service) — Dashboard and Sales & POS
    // aren't in their sidebar, so land them there instead of a 403'd page.
    if (user && user.role === 'staff' && (active === 'dashboard' || active === 'pos')) setActive('hr');
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const m = meta[active];
  return (
    <DashboardLayout active={active} onNavigate={setActive} title={t(m.titleKey)} subtitle={t(m.subtitleKey)}>
      {active === 'dashboard' && (
        <RequireRole roles={['admin', 'manager']}>
          <OverviewPage onViewReports={() => setActive('reports')} />
        </RequireRole>
      )}
      {active === 'pos' && (
        <RequireRole roles={['admin', 'manager']}>
          <POSPage />
        </RequireRole>
      )}
      {active === 'inventory' && (
        <RequireRole roles={['admin', 'manager']}>
          <InventoryPage />
        </RequireRole>
      )}
      {active === 'accounting' && (
        <RequireRole roles={['admin', 'manager']}>
          <AccountingPage />
        </RequireRole>
      )}
      {active === 'hr' && (
        user?.role === 'staff' ? (
          <StaffHRPage />
        ) : (
          <RequireRole roles={['admin', 'manager']}>
            <HRPage />
          </RequireRole>
        )
      )}
      {active === 'reports' && (
        <RequireRole roles={['admin']}>
          <ReportsPage />
        </RequireRole>
      )}
      {active === 'packages' && (
        <RequireRole roles={['admin', 'manager']}>
          <PackagesPage />
        </RequireRole>
      )}
      {active === 'help' && <HelpPage />}
    </DashboardLayout>
  );
}

export default App;
