"use client";

import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { useSaved } from "./useLists";
import { NAV_T } from "./w2.text";

// The header's Saved link (F07), beside the cart while the site's own store is open: a heart with how many products
// this browser saved, leading to /store/saved. Shown once something is saved, so the header stays as it is until then.
// Every page's header carries it, so it draws its own heart (icons.tsx's, stroke for stroke) and takes only its two texts.
export default function SavedLink() {
  const w = useLocalize(NAV_T);
  const n = useSaved().length;
  if (!n) return null;
  const label = n === 1 ? w.saved1 : w.savedN(String(n));
  return (
    <Link href="/store/saved" className="mm-nav-icon mm-nav-cart" title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19.6C7.4 16.4 4 13.2 4 9.4 4 7 5.9 5 8.2 5c1.6 0 3 .9 3.8 2.2C12.8 5.9 14.2 5 15.8 5 18.1 5 20 7 20 9.4c0 3.8-3.4 7-8 10.2z" />
      </svg>
      <span className="mm-cart-n" aria-hidden="true">{n > 99 ? "99+" : n}</span>
    </Link>
  );
}
