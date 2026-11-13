import {
  CakeSlice,
  Citrus,
  Coffee,
  Croissant,
  CupSoda,
  GlassWater,
  Martini,
  Pencil,
  Plus,
  Snowflake,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';

export type MenuCategory = { id: number; name: string };
export type MenuProduct = {
  id: number;
  name: string;
  price: string;
  category: number | null;
  category_name: string | null;
  is_active: boolean;
};
export type MenuView = 'grid' | 'list';

/** Menu names are stored bilingual — "Spanish Latte (S) · سبانش لاتيه" (see Backend
 * seed_swalif_menu). Split them so the UI can lead with the viewer's language and show
 * the size as a badge. Names typed without " · " just come back as `en`. */
export function splitName(name: string) {
  const [enRaw, ar] = name.split(' · ');
  const m = enRaw.match(/^(.*?)\s*\((S|L)\)$/);
  return { en: m ? m[1] : enRaw, ar: ar?.trim() || null, size: m ? (m[2] as 'S' | 'L') : null };
}

export function useLocalName() {
  const { lang } = useLanguage();
  return (name: string) => {
    const s = splitName(name);
    return lang === 'ar' && s.ar ? s.ar : s.en;
  };
}

function iconFor(categoryName: string | null | undefined): LucideIcon {
  const n = (categoryName ?? '').toLowerCase();
  if (n.includes('iced') || n.includes('frapp')) return CupSoda;
  if (n.includes('mojito')) return Martini;
  if (n.includes('juice')) return Citrus;
  if (n.includes('smoothie')) return GlassWater;
  if (n.includes('slush')) return Snowflake;
  if (n.includes('dessert')) return CakeSlice;
  if (n.includes('breakfast')) return Croissant;
  if (n.includes('coffee') || n.includes('dallah')) return Coffee;
  return UtensilsCrossed;
}

type Props = {
  products: MenuProduct[];
  categories: MenuCategory[];
  /** Group under category headings (the "All" tab); false for a single category or search. */
  grouped: boolean;
  view: MenuView;
  canEdit: boolean;
  cartQty: Record<number, number>;
  onAdd: (p: MenuProduct) => void;
  onEdit: (p: MenuProduct) => void;
};

export function MenuItems({ products, categories, grouped, view, canEdit, cartQty, onAdd, onEdit }: Props) {
  const { t } = useLanguage();
  const localName = useLocalName();

  // Products already arrive in menu order (category position, then item position).
  const groups: { key: string; title: string | null; categoryName: string | null; items: MenuProduct[] }[] = [];
  if (grouped) {
    for (const c of categories) {
      const items = products.filter((p) => p.category === c.id);
      if (items.length) groups.push({ key: String(c.id), title: localName(c.name), categoryName: c.name, items });
    }
    const other = products.filter((p) => p.category === null || !categories.some((c) => c.id === p.category));
    if (other.length) groups.push({ key: 'other', title: t('pos.uncategorized'), categoryName: null, items: other });
  } else {
    groups.push({ key: 'flat', title: null, categoryName: null, items: products });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const GroupIcon = iconFor(g.categoryName);
        return (
          <section key={g.key}>
            {g.title && (
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-100 text-brand-700">
                  <GroupIcon className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-sm font-bold text-ink-900">{g.title}</h4>
                <span className="text-[11px] text-ink-400">{t('pos.itemCount', { count: String(g.items.length) })}</span>
                <span className="h-px flex-1 bg-ink-200/60" />
              </div>
            )}
            {view === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {g.items.map((p) => (
                  <GridCard key={p.id} product={p} qty={cartQty[p.id] ?? 0} canEdit={canEdit} onAdd={onAdd} onEdit={onEdit} />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-white/60 overflow-hidden rounded-2xl border border-white/50 bg-white/40">
                {g.items.map((p) => (
                  <ListRow key={p.id} product={p} qty={cartQty[p.id] ?? 0} canEdit={canEdit} onAdd={onAdd} onEdit={onEdit} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

type ItemProps = {
  product: MenuProduct;
  qty: number;
  canEdit: boolean;
  onAdd: (p: MenuProduct) => void;
  onEdit: (p: MenuProduct) => void;
};

function useNames(product: MenuProduct) {
  const { lang } = useLanguage();
  const s = splitName(product.name);
  const primary = lang === 'ar' && s.ar ? s.ar : s.en;
  const secondary = lang === 'ar' && s.ar ? (s.en !== s.ar ? s.en : null) : s.ar;
  return { primary, secondary, size: s.size };
}

function SizeBadge({ size }: { size: 'S' | 'L' | null }) {
  if (!size) return null;
  return (
    <span
      className={[
        'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none',
        size === 'L' ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700',
      ].join(' ')}
    >
      {size}
    </span>
  );
}

function QtyBadge({ qty }: { qty: number }) {
  if (!qty) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow">
      {qty}
    </span>
  );
}

function GridCard({ product, qty, canEdit, onAdd, onEdit }: ItemProps) {
  const { t } = useLanguage();
  const { primary, secondary, size } = useNames(product);
  const Icon = iconFor(product.category_name);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd(product)}
      onKeyDown={(e) => e.key === 'Enter' && onAdd(product)}
      className={[
        'group relative flex cursor-pointer flex-col rounded-2xl border bg-white/40 p-3 text-start transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:bg-white/60 hover:shadow-glass',
        qty ? 'border-amber-300' : 'border-white/50',
      ].join(' ')}
    >
      <div className="relative grid h-12 w-full place-items-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700">
        <Icon className="h-5 w-5" />
        <span className="absolute bottom-1.5 end-1.5">
          <SizeBadge size={size} />
        </span>
      </div>
      <div className="mt-2 line-clamp-2 text-xs font-semibold leading-tight text-ink-900">{primary}</div>
      {secondary && <div className="mt-0.5 truncate text-[11px] text-ink-500">{secondary}</div>}
      <div className="mt-auto pt-1 font-display text-sm font-bold text-amber-700">OMR {Number(product.price).toFixed(3)}</div>

      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(product);
          }}
          className="absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-600 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
          title={t('pos.editMenuItem')}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <span className="absolute end-2 top-2">
        {qty ? (
          <QtyBadge qty={qty} />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
            <Plus className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
    </div>
  );
}

function ListRow({ product, qty, canEdit, onAdd, onEdit }: ItemProps) {
  const { t } = useLanguage();
  const { primary, secondary, size } = useNames(product);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd(product)}
      onKeyDown={(e) => e.key === 'Enter' && onAdd(product)}
      className={[
        'group flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-white/70',
        qty ? 'bg-amber-50/70' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-sm font-semibold text-ink-900">{primary}</span>
        <SizeBadge size={size} />
        {secondary && <span className="truncate text-xs text-ink-500">{secondary}</span>}
      </div>
      <span className="shrink-0 font-display text-sm font-bold tabular-nums text-amber-700">
        {Number(product.price).toFixed(3)}
      </span>
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(product);
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 opacity-0 transition-opacity hover:bg-white hover:text-ink-700 group-hover:opacity-100"
          title={t('pos.editMenuItem')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="relative shrink-0">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500 text-white shadow-sm transition-transform group-hover:scale-110">
          <Plus className="h-4 w-4" />
        </span>
        {qty > 0 && (
          <span className="absolute -end-1.5 -top-1.5">
            <QtyBadge qty={qty} />
          </span>
        )}
      </span>
    </div>
  );
}
