// The Experiences list's and session page's drawn marks (the Experiences build of 2026-11-18): the site's monoline style,
// a 24 grid, stroke 1.75 with round ends, in the colour they sit in. Never an emoji or a character standing in (R1).
const P = {
  pin: <><path d="M12 21s-6.4-5.7-6.4-11a6.4 6.4 0 0 1 12.8 0c0 5.3-6.4 11-6.4 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" /></>,
  sun: <><path d="M4 17.5h16M7.5 17.5a4.5 4.5 0 0 1 9 0M12 6.5v2.2M5.6 9.6l1.5 1.5M18.4 9.6l-1.5 1.5M3.5 14h1.8M18.7 14h1.8" /></>,
  temp: <><path d="M10 13.6V5.4a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0z" /><path d="M12 9.5v6.3" /></>,
  out: <path d="M13.5 5.5h5v5M18.5 5.5 11 13M16.5 13.5v4a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 17.5V9.5A1.5 1.5 0 0 1 7 8h4" />,
  go: <path d="M9.4 5.4 16 12l-6.6 6.6" />,
  back: <path d="M14.6 5.4 8 12l6.6 6.6" />,
  star: <path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />,
  calPlus: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.8v3.4M16 3.8v3.4M4 10h16M12 12.6v4.4M9.8 14.8h4.4" /></>,
  chat: <path d="M5.2 18.6l1-3.2A7 7 0 1 1 9 18.1z" />,
  check: <path d="M5 12.6l4.3 4.3L19 7.4" />,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4M12 7.7v.1" /></>,
  bottle: <path d="M10 3.6h4M10.4 3.6v2.6L8.6 8.6v10.6A1.4 1.4 0 0 0 10 20.6h4a1.4 1.4 0 0 0 1.4-1.4V8.6l-1.8-2.4V3.6M8.6 12h6.8" />,
  people: <><circle cx="9" cy="8.6" r="3.1" /><path d="M3.4 19.4c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5M15.2 5.9a3 3 0 0 1 0 5.6M17.6 14.6c1.7.6 2.8 2.2 3.1 4.8" /></>,
  lang: <><circle cx="12" cy="12" r="8.6" /><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" /></>,
  bike: <><circle cx="5.9" cy="15.6" r="3.9" /><circle cx="18.1" cy="15.6" r="3.9" /><path d="M5.9 15.6L9.4 8.7l2.3 6.9zM9.4 8.7h6.4l-4.1 6.9M15.8 8.7l2.3 6.9M9.4 8.7L8.9 6.6M7.5 6.6h3M15.8 8.7l-.7-2.5h2.7" /></>,
  cup: <path d="M5.5 9h11v4.5a5.5 5.5 0 0 1-11 0zM16.5 10.5h1.2a2.3 2.3 0 0 1 0 4.6h-1.6M8.5 3.8v2.4M11 3.8v2.4M13.5 3.8v2.4" />,
  terms: <><path d="M7 3.8h7.2L18 7.6v12.6H7z" /><path d="M14 3.8v4h4M9.6 12h5.8M9.6 15.4h5.8" /></>,
  pace: <><path d="M4.6 16.8a7.6 7.6 0 1 1 14.8 0" /><path d="M12 15.4l3.6-4.6" /></>,
} as const;
export type XpIconName = keyof typeof P;

export function XIc({ name, size = 18, className = "" }: { name: XpIconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={`xq-ic${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{P[name]}</svg>
  );
}
