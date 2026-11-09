// The site's own drawn icons (the booking app's monoline set: 1.75 stroke, round caps), in place of
// text arrows and crosses, which fonts draw differently and phones can turn into emoji. An arrow
// points the way the page reads: it turns round in Arabic and Urdu (site.css, .mm-ic-dir).
type P = { size?: number; className?: string };

export function ArrowIcon({ size = 18, className = "" }: P) {
  return (
    <svg className={`mm-ic mm-ic-dir ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className = "" }: P) {
  return (
    <svg className={`mm-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
