/**
 * Swalif Cafe (سوالف كافيه) logo badge — the Arabic calligraphy wordmark on a cream
 * tile, matching the shop's cup/Instagram branding. Drawn as inline SVG (not an <img>)
 * so the text picks up the page's "Cairo" web font and scales crisply at any size;
 * size/rounding is controlled entirely via `className`.
 */
export function BrandMark({ className = 'h-9 w-9 rounded-xl' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Swalif Cafe"
      className={`${className} shrink-0 overflow-hidden bg-[#f7f1e6] shadow-glow ring-1 ring-black/5`}
    >
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="'Cairo', sans-serif"
        fontWeight="800"
        fontSize="26"
        fill="#2b1a14"
      >
        سوالف
      </text>
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fontFamily="'Inter', 'Cairo', system-ui, sans-serif"
        fontWeight="600"
        fontSize="8.5"
        letterSpacing="2.5"
        fill="#7a2340"
      >
        SWALIF CAFE
      </text>
    </svg>
  );
}
