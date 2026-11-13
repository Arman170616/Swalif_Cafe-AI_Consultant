import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Swalif Cafe menu for the login screen: a "القائمة | MENU" button styled like the printed
 * cover, which opens a popup with the full menu as a book — it opens right-to-left like
 * the printed Arabic menu and the viewer flips pages (arrows, arrow keys, or tapping a
 * page). Static content: the login screen has no auth to fetch the live menu with; the
 * same data lives in Products via Backend `seed_swalif_menu` — keep the two in sync.
 */

type Row = [name: string, small: string, large?: string];
type Section = { title: string; sizes?: boolean; sub?: boolean; rows: Row[] };

const MENU_PAGES: Section[][] = [
  [
    {
      title: 'القهوة الساخنة',
      sizes: true,
      rows: [
        ['اسبريسو', '1.000'],
        ['امريكانو', '1.100'],
        ['مكياتو', '1.000'],
        ['كورتادو', '1.000', '1.200'],
        ['كابتشينو', '1.100', '1.300'],
        ['موكا', '1.400', '1.600'],
        ['وايت موكا', '1.400', '1.600'],
        ['دارك موكا', '1.400', '1.600'],
        ['لاتيه', '1.100', '1.300'],
        ['سبانش لاتيه', '1.300', '1.500'],
        ['زعفران لاتيه', '1.600', '1.800'],
        ['فستق لاتيه', '1.500', '1.700'],
        ['فانيلا لاتيه', '1.400', '1.600'],
        ['روز لاتيه', '1.400', '1.600'],
        ['بندق لاتيه', '1.400', '1.600'],
        ['فلات وايت', '1.300'],
        ['ماتشا', '1.600'],
        ['شوكولاته', '1.000', '1.200'],
        ['قهوة تركية', '1.000'],
      ],
    },
  ],
  [
    {
      title: 'القهوة الباردة',
      rows: [
        ['امريكانو', '1.200'],
        ['موكا', '1.400'],
        ['وايت موكا', '1.600'],
        ['لاتيه', '1.300'],
        ['سبانش لاتيه', '1.500'],
        ['زعفران لاتيه', '1.800'],
        ['فانيلا لاتيه', '1.600'],
        ['روز لاتيه', '1.600'],
        ['فستق لاتيه', '1.700'],
        ['بندق لاتيه', '1.600'],
        ['فانيلا', '1.800'],
        ['بندق', '1.600'],
      ],
    },
  ],
  [
    { title: 'القهوة المقطرة', rows: [['V60', '1.600'], ['Siphon', '1.800'], ['Chemex', '1.600']] },
    {
      title: 'موهيتوس',
      rows: [
        ['فراولة', '1.300'],
        ['ليمون نعناع', '1.300'],
        ['باشن فروت', '1.300'],
        ['مكس بيري', '1.300'],
        ['بلو لاجون', '1.300'],
        ['ردبول', '2.000'],
        ['شاي مثلج خوخ', '1.200'],
      ],
    },
  ],
  [
    {
      title: 'العصائر الطازجة',
      rows: [
        ['برتقال', '1.200'],
        ['مانجو', '1.400'],
        ['فراولة', '1.400'],
        ['أفوكادو', '1.200'],
        ['ليمون نعناع', '1.200'],
        ['شمندر و برتقال و رمان', '1.600'],
        ['كوكتيل كلاسيك', '1.600'],
      ],
    },
    {
      title: 'سموذي',
      sizes: true,
      rows: [
        ['اوريو', '0.800', '1.400'],
        ['نوتيلا', '0.800', '1.400'],
        ['فراولة', '0.800', '1.400'],
        ['لوتس', '0.800', '1.400'],
        ['كت كات', '0.800', '1.400'],
        ['فانيلا', '0.800', '1.400'],
        ['مانجو', '0.800', '1.400'],
        ['موز', '0.800', '1.400'],
      ],
    },
  ],
  [
    { title: 'سلاشيز', rows: [['فراولة', '1.200'], ['كول بلو', '1.200']] },
    {
      title: 'فرابتشينو',
      rows: [
        ['اوريو', '1.600'],
        ['فستق', '1.600'],
        ['كراميل', '1.600'],
        ['كافي', '1.500'],
        ['موكا', '1.600'],
        ['وايت موكا', '1.600'],
        ['أفوجاتو', '1.600'],
        ['سوالف اون', '1.800'],
      ],
    },
  ],
  [
    { title: 'دلة قهوة', rows: [['دلة قهوة عربية', '2.500'], ['دلة قهوة سعودية', '2.500']] },
    {
      title: 'الحلا',
      rows: [
        ['تيراميسو', '2.200'],
        ['تشيز كيك اوريو', '1.400'],
        ['تشيز كيك لوتس', '1.400'],
        ['كوكيز', '1.200'],
        ['سان سبيستيان', '2.500'],
        ['شوكولاته فيريرو', '2.000'],
      ],
    },
  ],
  [
    { title: 'كرواسون', sub: true, rows: [['حلومي جبن مرتديلا', '1.000'], ['اومليت', '1.000'], ['نقانق', '1.000']] },
    {
      title: 'توست ساندويتش',
      sub: true,
      rows: [
        ['جبن مرتديلا', '0.800'],
        ['جبن تونه', '0.800'],
        ['دجاج', '0.800'],
        ['بيض', '0.800'],
        ['نقانق', '0.800'],
        ['كلوب ساندويتش', '1.200'],
      ],
    },
    {
      title: 'فطور أمريكي',
      sub: true,
      rows: [
        ['مرتديلا بيض (بيض-خبز-جبن-مرتديلا)', '1.500'],
        ['اومليت - نقانق - مربى - زبدة', '1.500'],
      ],
    },
    { title: 'كريب', sub: true, rows: [['كريب جبن و عسل', '1.200'], ['كريب جبن و بطاطس عمان', '1.200']] },
  ],
];

const PAPER = '#f6f2ef';
const INK = '#4a3b36';
const PAGE_W = 300;
const PAGE_H = 470;

function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const word = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' }[size];
  const sub = { sm: 'text-[6px]', md: 'text-[7px]', lg: 'text-[9px]' }[size];
  return (
    <div className="text-center leading-none" style={{ color: '#2b1a14' }}>
      <div className={`font-arabic font-extrabold ${word}`}>سوالف</div>
      <div className={`mt-1 font-semibold tracking-[0.35em] ${sub}`}>SWALIF CAFE</div>
    </div>
  );
}

/** Repeating "سوالف" watermark down both edges, like the printed cover. */
function WatermarkEdges({ count = 22, text = 'text-[9px]', width = 'w-5' }) {
  const strip = (side: 'left' | 'right') => (
    <div
      className={`absolute inset-y-0 flex flex-col items-center justify-around overflow-hidden font-arabic font-bold ${width} ${text}`}
      style={{ [side]: 0, color: '#d6cec7', background: '#ebe5e0' } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>سوالف</span>
      ))}
    </div>
  );
  return (
    <>
      {strip('left')}
      {strip('right')}
    </>
  );
}

function CoverPage() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center" style={{ background: PAPER }}>
      <WatermarkEdges />
      <div className="font-arabic text-4xl font-bold" style={{ color: INK }}>
        القائمة
      </div>
      <div className="my-2 h-px w-32" style={{ background: INK, opacity: 0.4 }} />
      <div className="font-serif text-4xl font-semibold tracking-wide" style={{ color: INK }}>
        MENU
      </div>
      <div className="absolute bottom-8">
        <Wordmark />
      </div>
    </div>
  );
}

function EndPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: PAPER }}>
      <Wordmark size="lg" />
      <p className="font-arabic text-base leading-relaxed" style={{ color: INK }}>
        كل لحظة حكاية، وكل قهوة عالم
      </p>
      <div className="h-px w-20" style={{ background: INK, opacity: 0.3 }} />
      <p className="font-arabic text-sm" style={{ color: '#8a7b74' }}>
        السعادة، صلالة
        <br />
        أبوابنا مفتوحة لكم دائماً · ٨:٠٠ ص – ٣:٠٠ ص
      </p>
    </div>
  );
}

function ItemsPage({ sections, pageNo }: { sections: Section[]; pageNo: number }) {
  return (
    <div dir="rtl" className="flex h-full flex-col px-6 pb-3 pt-5 font-arabic" style={{ background: PAPER, color: INK }}>
      <div className="flex-1 space-y-4">
        {sections.map((s) => (
          <div key={s.title}>
            {s.sub ? (
              <div className="border-b pb-0.5 text-[13px] font-bold" style={{ borderColor: '#cfc7c0' }}>
                {s.title}
              </div>
            ) : (
              <div className="relative inline-block">
                <span className="absolute inset-x-[-8px] bottom-0.5 h-2.5" style={{ background: '#d8d3c9' }} aria-hidden="true" />
                <span className="relative text-lg font-bold">{s.title}</span>
              </div>
            )}
            {s.sizes && (
              <div className="mt-1 flex justify-end gap-3 border-b pb-0.5 text-[10px] font-semibold" style={{ borderColor: '#cfc7c0' }}>
                <span className="w-10 text-center">S</span>
                <span className="w-10 text-center">L</span>
              </div>
            )}
            <div className="mt-1 space-y-[2px]">
              {s.rows.map(([name, sm, lg]) => (
                <div key={name} className="flex items-baseline justify-between gap-2 text-[12px] leading-[1.35]">
                  <span className="truncate">{name}</span>
                  <span className="flex shrink-0 gap-3 tabular-nums" dir="ltr">
                    {s.sizes && <span className="w-10 text-center opacity-70">{lg ?? '-'}</span>}
                    <span className="w-10 text-center">{sm}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end justify-between pt-2">
        <span className="text-[10px] opacity-50" dir="ltr">
          {pageNo}
        </span>
        <div className="opacity-80">
          <Wordmark size="sm" />
        </div>
        <span className="w-3" />
      </div>
    </div>
  );
}

// Page order: cover, the menu pages, then a closing page. Leaf k carries pages[2k] on its
// front and pages[2k+1] on its back; odd count means the last leaf's back stays blank.
const PAGES: ReactNode[] = [
  <CoverPage key="cover" />,
  ...MENU_PAGES.map((sections, i) => <ItemsPage key={i} sections={sections} pageNo={i + 1} />),
  <EndPage key="end" />,
];
const LEAVES = Math.ceil(PAGES.length / 2);
const MAX_FLIPPED = LEAVES - 1; // the last leaf stays down so the final spread is open

const face: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: 8,
};

/** The 3D book itself. `flipped` = how many leaves have been turned (0 = closed cover). */
function Book({ flipped, onPrev, onNext }: { flipped: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ perspective: '2200px' }}>
      <div
        className="relative transition-transform duration-700 ease-in-out"
        // closed: only the cover (left half) exists, so shift it to the middle
        style={{
          width: PAGE_W * 2,
          height: PAGE_H,
          transform: flipped === 0 ? 'translateX(25%)' : 'translateX(0)',
          transformStyle: 'preserve-3d',
        }}
      >
        {Array.from({ length: LEAVES }, (_, k) => {
          const isFlipped = k < flipped;
          return (
            <div
              key={k}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer transition-transform duration-1000 ease-in-out"
              style={{
                transformOrigin: 'right center',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                zIndex: isFlipped ? LEAVES + k : LEAVES - k,
              }}
              // RTL book: tapping the left page turns forward, the right page turns back
              onClick={isFlipped ? onPrev : onNext}
            >
              <div style={{ ...face, boxShadow: 'inset -16px 0 20px -14px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.35)' }}>
                {PAGES[2 * k]}
              </div>
              <div
                style={{
                  ...face,
                  transform: 'rotateY(180deg)',
                  boxShadow: 'inset 16px 0 20px -14px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.35)',
                }}
              >
                {PAGES[2 * k + 1] ?? <div className="h-full" style={{ background: PAPER }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Scale the fixed-size book down to fit small screens. */
function useFitScale() {
  const calc = () => Math.min(1, (window.innerWidth - 24) / (PAGE_W * 2), (window.innerHeight - 150) / PAGE_H);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = () => setScale(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

function MenuModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [flipped, setFlipped] = useState(0);
  const scale = useFitScale();
  const next = () => setFlipped((f) => Math.min(MAX_FLIPPED, f + 1));
  const prev = () => setFlipped((f) => Math.max(0, f - 1));

  useEffect(() => {
    const id = setTimeout(() => setFlipped(1), 450); // open the cover once the popup is in
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // RTL book: ← is forward, → is back
      if (e.key === 'ArrowLeft') setFlipped((f) => Math.min(MAX_FLIPPED, f + 1));
      if (e.key === 'ArrowRight') setFlipped((f) => Math.max(0, f - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const navBtn =
    'grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 disabled:pointer-events-none disabled:opacity-30';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-950/80 px-3 backdrop-blur-sm animate-fade-up"
      style={{ animationDuration: '0.3s' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('auth.viewMenu')}
    >
      <button onClick={onClose} className={`${navBtn} absolute end-4 top-4`} title={t('menu.close')}>
        <X className="h-5 w-5" />
      </button>

      {/* layout box sized to the scaled book so the controls sit right under it */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: PAGE_W * 2 * scale, height: PAGE_H * scale }}
        className="relative"
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <Book flipped={flipped} onPrev={prev} onNext={next} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4" dir="ltr" onClick={(e) => e.stopPropagation()}>
        <button onClick={next} disabled={flipped >= MAX_FLIPPED} className={navBtn} title={t('menu.next')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: MAX_FLIPPED + 1 }, (_, i) => (
            <span
              key={i}
              className={['h-1.5 rounded-full transition-all', MAX_FLIPPED - i === flipped ? 'w-5 bg-accent-300' : 'w-1.5 bg-white/40'].join(' ')}
            />
          ))}
        </div>
        <button onClick={prev} disabled={flipped === 0} className={navBtn} title={t('menu.prev')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body
  );
}

/** Top-bar trigger on the login screen (next to the language switch): a cream pill in the
 * printed menu's colours that opens the full menu popup. */
export function MenuButton({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={[
          'group flex items-center gap-2 rounded-full py-1.5 pe-3.5 ps-1.5 text-xs font-bold shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-300',
          className,
        ].join(' ')}
        style={{ background: PAPER, color: INK }}
        aria-haspopup="dialog"
        title={t('auth.viewMenu')}
      >
        <span className="relative grid h-6 w-6 place-items-center rounded-full bg-brand-700 text-white">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="absolute -end-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-accent-400 ring-2 ring-[#f6f2ef]" />
        </span>
        <span className="font-arabic">القائمة</span>
        <span className="h-3 w-px" style={{ background: INK, opacity: 0.3 }} />
        <span className="font-serif tracking-wide">MENU</span>
      </button>
      {open && <MenuModal onClose={close} />}
    </>
  );
}
