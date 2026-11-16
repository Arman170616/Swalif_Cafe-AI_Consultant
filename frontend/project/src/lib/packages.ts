// Monthly packages — mirrors Backend crm (PackagePlan / CustomerPackage serializers).

export type PackagePlan = {
  id: number;
  name: string;
  description: string;
  /** excl. VAT, like menu prices — 5% VAT is added at sale */
  price: string;
  drinks_per_month: number;
  daily_limit: number | null;
  categories: number[];
  category_names: string[];
  is_active: boolean;
  active_clients: number;
};

export type PackageStatus = 'active' | 'expired' | 'used_up' | 'upcoming';

export type CustomerPackage = {
  id: number;
  customer: number;
  customer_name: string;
  customer_phone: string;
  plan: number;
  plan_name: string;
  price: string;
  total_paid: string | null;
  drinks_total: number;
  drinks_used: number;
  drinks_remaining: number;
  daily_limit: number | null;
  used_today: number;
  start_date: string;
  end_date: string;
  status: PackageStatus;
  days_left: number;
  eligible_categories: number[];
  sale_order: number | null;
  redemptions: { id: number; order: number; quantity: number; cancelled: boolean; items: string[]; created_at: string }[];
  created_at: string;
};

export const VAT_RATE = 0.05;
export const withVat = (price: string | number) => Number(price) * (1 + VAT_RATE);

export const STATUS_STYLE: Record<PackageStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  upcoming: 'border-sky-200 bg-sky-50 text-sky-700',
  used_up: 'border-amber-200 bg-amber-50 text-amber-700',
  expired: 'border-ink-200 bg-ink-50 text-ink-500',
};

/** Drinks still redeemable today, honouring the daily limit. */
export function leftToday(p: CustomerPackage) {
  const daily = p.daily_limit ? Math.max(p.daily_limit - p.used_today, 0) : Infinity;
  return Math.min(p.drinks_remaining, daily);
}
