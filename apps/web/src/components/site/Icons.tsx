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

/** An arrow pointing back, against the way the page reads (a "back to the list" link). */
export function BackIcon({ size = 18, className = "" }: P) {
  return (
    <svg className={`mm-ic mm-ic-dir ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/** A tick: done, earned, chosen. */
export function TickIcon({ size = 16, className = "" }: P) {
  return (
    <svg className={`mm-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** A filled star, for a rating. */
export function StarIcon({ size = 16, className = "" }: P) {
  return (
    <svg className={`mm-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

/** A clock: a time still to come (a date not open to book yet). */
export function ClockIcon({ size = 14, className = "" }: P) {
  return (
    <svg className={`mm-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" />
    </svg>
  );
}

/** An "i" in a ring: more about this (the booking app's bike-pill info mark). */
export function InfoIcon({ size = 18, className = "" }: P) {
  return (
    <svg className={`mm-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4M12 7.7v.1" />
    </svg>
  );
}
