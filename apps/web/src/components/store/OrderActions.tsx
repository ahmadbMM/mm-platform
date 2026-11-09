"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import type { CartItem } from "@/lib/cart";
import { T } from "./Store.text";
import { Ic } from "./bits";
import { cartRestore } from "./useCart";

// An order page's buttons that need the browser: copy the order number, print or save the page as a PDF,
// and put the items of an order that was never paid back into the cart.

export function CopyNo({ text }: { text: string }) {
  const t = useLocalize(T);
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 2000); } catch { /* the number is on the screen to copy by hand */ }
  };
  return (
    <button type="button" className="st-copy" onClick={copy}>
      <Ic name={done ? "tick" : "copy"} size={16} /><span aria-live="polite">{done ? t.copied : t.copy}</span>
    </button>
  );
}

export function PrintButton() {
  const t = useLocalize(T);
  return <button type="button" className="bk-btn2" onClick={() => window.print()}><Ic name="print" size={18} />{t.print}</button>;
}

export function PutBack({ items }: { items: CartItem[] }) {
  const t = useLocalize(T);
  const [done, setDone] = useState(false);
  if (done) return <p className="st-ok" role="status">{t.putBackDone} <Link href="/store/cart">{t.viewCart}</Link></p>;
  return <button type="button" className="bk-btn" onClick={() => { cartRestore(items); setDone(true); }}><Ic name="bag" size={18} />{t.putBack}</button>;
}
