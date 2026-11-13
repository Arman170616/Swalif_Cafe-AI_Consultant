import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Animated Swalif Cafe menu for the login hero: a small book that opens (right-to-left,
 * like the printed Arabic menu), flips through a preview of the real menu pages, closes,
 * and loops. Purely decorative and static — the login screen has no auth to fetch the
 * live menu with; the full menu lives in Products (Backend `seed_swalif_menu`).
 */

type Row = [name: string, small: string, large?: string];
type Section = { title: string; sizes?: boolean; rows: Row[] };

const MENU_PAGES: Section[][] = [
  [
    {
      title: 'القهوة الساخنة',
      sizes: true,
      rows: [
        ['اسبريسو', '1.000'],
        ['كورتادو', '1.000', '1.200'],
        ['كابتشينو', '1.100', '1.300'],
        ['موكا', '1.400', '1.600'],
        ['لاتيه', '1.100', '1.300'],
        ['سبانش لاتيه', '1.300', '1.500'],
        ['زعفران لاتيه', '1.600', '1.800'],
        ['فستق لاتيه', '1.500', '1.700'],
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
        ['روز لاتيه', '1.600'],
        ['فستق لاتيه', '1.700'],
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
        ['ردبول', '2.000'],
      ],
    },
  ],
  [
    { title: 'العصائر الطازجة', rows: [['برتقال', '1.200'], ['مانجو', '1.400'], ['أفوكادو', '1.200']] },
    {
      title: 'سموذي',
      sizes: true,
      rows: [
        ['اوريو', '0.800', '1.400'],
        ['نوتيلا', '0.800', '1.400'],
        ['لوتس', '0.800', '1.400'],
        ['مانجو', '0.800', '1.400'],
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
        ['أفوجاتو', '1.600'],
        ['سوالف اون', '1.800'],
      ],
    },
  ],
  [
    { title: 'دلة قهوة', rows: [['قهوة عربية', '2.500'], ['قهوة سعودية', '2.500']] },
    {
      title: 'الحلا',
      rows: [
        ['تيراميسو', '2.200'],
        ['تشيز كيك لوتس', '1.400'],
        ['سان سبيستيان', '2.500'],
        ['شوكولاته فيريرو', '2.000'],
      ],
    },
  ],
  [
    {
      title: 'الفطور',
      rows: [
        ['كرواسون حلومي', '1.000'],
        ['توست جبن مرتديلا', '0.800'],
        ['كلوب ساندويتش', '1.200'],
        ['فطور أمريكي', '1.500'],
        ['كريب جبن و عسل', '1.200'],
      ],
    },
  ],
];

const PAPER = '#f6f2ef';
const INK = '#4a3b36';

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="text-center leading-none" style={{ color: '#2b1a14' }}>
      <div className={`font-arabic font-extrabold ${small ? 'text-sm' : 'text-lg'}`}>سوالف</div>
      <div className="mt-0.5 text-[5px] font-semibold tracking-[0.3em]">SWALIF CAFE</div>
    </div>
  );
}

/** Repeating "سوالف" watermark down both edges, like the printed cover. */
function WatermarkEdges() {
  const strip = (side: 'left' | 'right') => (
    <div
      className="absolute inset-y-0 flex w-3 flex-col items-center justify-around overflow-hidden font-arabic text-[6px] font-bold"
      style={{ [side]: 0, color: '#d9d1cb', background: '#ece6e1' } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: 14 }, (_, i) => (
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
      <div className="font-arabic text-xl font-bold" style={{ color: INK }}>
        القائمة
      </div>
      <div className="my-1 h-px w-16" style={{ background: INK, opacity: 0.4 }} />
      <div className="font-serif text-lg font-semibold tracking-wide" style={{ color: INK }}>
        MENU
      </div>
      <div className="absolute bottom-3">
        <Wordmark small />
      </div>
    </div>
  );
}

function EndPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center" style={{ background: PAPER }}>
      <Wordmark />
      <p className="font-arabic text-[8px] leading-relaxed" style={{ color: INK }}>
        كل لحظة حكاية، وكل قهوة عالم
      </p>
      <p className="font-arabic text-[7px]" style={{ color: '#8a7b74' }}>
        السعادة، صلالة · ٨ ص – ٣ ص
      </p>
    </div>
  );
}

function ItemsPage({ sections }: { sections: Section[] }) {
  return (
    <div dir="rtl" className="flex h-full flex-col px-3 pb-2 pt-3 font-arabic" style={{ background: PAPER, color: INK }}>
      <div className="flex-1 space-y-2.5">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="relative inline-block">
              <span className="absolute inset-x-[-4px] bottom-0 h-1.5" style={{ background: '#d8d3c9' }} aria-hidden="true" />
              <span className="relative text-[10px] font-bold lg:text-xs">{s.title}</span>
            </div>
            {s.sizes && (
              <div className="mt-1 flex justify-end gap-2 border-b pb-0.5 text-[6px] lg:text-[7px]" style={{ borderColor: '#cfc7c0' }}>
                <span className="w-6 text-center">S</span>
                <span className="w-6 text-center">L</span>
              </div>
            )}
            <div className="mt-1 space-y-[3px]">
              {s.rows.map(([name, sm, lg]) => (
                <div key={name} className="flex items-baseline justify-between gap-1 text-[7px] leading-tight lg:text-[8.5px]">
                  <span className="truncate">{name}</span>
                  <span className="flex shrink-0 gap-2 tabular-nums" dir="ltr">
                    {s.sizes && <span className="w-6 text-center opacity-70">{lg ?? '-'}</span>}
                    <span className="w-6 text-center">{sm}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-1 opacity-80">
        <Wordmark small />
      </div>
    </div>
  );
}

// Page order: cover, the menu pages, then a closing page. Leaf k carries pages[2k] on its
// front and pages[2k+1] on its back; odd count means the last leaf's back stays blank.
const PAGES: ReactNode[] = [
  <CoverPage key="cover" />,
  ...MENU_PAGES.map((sections, i) => <ItemsPage key={i} sections={sections} />),
  <EndPage key="end" />,
];
const LEAVES = Math.ceil(PAGES.length / 2);
const MAX_FLIPPED = LEAVES - 1; // keep the last leaf down so the final spread stays open

const face: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: 6,
};

export function MenuBook() {
  const [flipped, setFlipped] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setFlipped(1);
      return;
    }
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (current === 0) {
        current = 1; // open the cover
        timer = setTimeout(step, 3200);
      } else if (current < MAX_FLIPPED) {
        current += 1;
        timer = setTimeout(step, current === MAX_FLIPPED ? 4500 : 3200);
      } else {
        current = 0; // close the book, then start over
        timer = setTimeout(step, 2600);
      }
      setFlipped(current);
    };
    timer = setTimeout(step, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex justify-center" dir="ltr" aria-label="Swalif Cafe menu" role="img">
      <div style={{ perspective: '1600px' }}>
        <div
          className="relative h-[210px] w-[290px] transition-transform duration-1000 ease-in-out sm:h-[250px] sm:w-[350px] lg:h-[280px] lg:w-[400px]"
          // closed book sits centered (only its left half exists), open book is centered as a spread
          style={{ transform: flipped === 0 ? 'translateX(25%)' : 'translateX(0)', transformStyle: 'preserve-3d' }}
        >
          {/* soft shadow under the open spread */}
          <div
            className="absolute -bottom-3 left-[6%] right-[6%] h-4 rounded-[50%] bg-black/40 blur-md transition-opacity duration-1000"
            style={{ opacity: flipped === 0 ? 0.5 : 0.9 }}
            aria-hidden="true"
          />
          {Array.from({ length: LEAVES }, (_, k) => {
            const isFlipped = k < flipped;
            return (
              <div
                key={k}
                className="absolute inset-y-0 left-0 w-1/2 transition-transform duration-1000 ease-in-out"
                style={{
                  transformOrigin: 'right center',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  zIndex: isFlipped ? LEAVES + k : LEAVES - k,
                }}
              >
                <div style={{ ...face, boxShadow: 'inset -10px 0 14px -10px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.35)' }}>
                  {PAGES[2 * k]}
                </div>
                <div
                  style={{
                    ...face,
                    transform: 'rotateY(180deg)',
                    boxShadow: 'inset 10px 0 14px -10px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.35)',
                  }}
                >
                  {PAGES[2 * k + 1] ?? <div className="h-full" style={{ background: PAPER }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
