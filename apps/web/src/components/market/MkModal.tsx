"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { useLocalize } from "@/i18n/TxProvider";
import MkIcon from "./MkIcon";
import { T } from "./Market.text";

// The Marketplace's ONLY pop-up: centred on every screen (never a sheet from the bottom), with the keyboard kept inside
// it while it is open and handed back where it was after. Escape, a tap outside it and its close button shut it. It is
// drawn while it is mounted: `{open && <MkModal title=... onClose=...>...</MkModal>}`.
//   title      the pop-up's heading (its accessible name)
//   onClose    called by Escape, a tap outside and the close button
//   busy       while true (a request is on its way) nothing closes it, so an answer is never lost with it
//   wide       a wider box (560px) for a form; the default is 440px
// Its buttons go in a <div className="mk-pop-acts"> at the end of the children.
export default function MkModal({ title, onClose, busy = false, wide = false, children }: { title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode }) {
  const t = useLocalize(T);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const held = useRef(busy);
  // a tap outside closes it only when it began outside too: a text selection dragged out of the pop-up and let go over
  // the backdrop is a click on the backdrop, and it would close the pop-up with what was typed in it
  const downOutside = useRef(false);
  useEffect(() => { close.current = onClose; held.current = busy; });
  useDialogFocus(box, true);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !held.current) close.current(); };
    document.addEventListener("keydown", esc);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = was; };
  }, []);
  return (
    <div className="mk-backdrop" onPointerDown={(e) => { downOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { const out = downOutside.current; downOutside.current = false; if (out && e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={box} className={`mk-pop${wide ? " mk-pop-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="mk-pop-head">
          <h2 id={id} className="mk-pop-title">{title}</h2>
          <button type="button" className="mk-x" onClick={() => { if (!busy) onClose(); }} aria-label={t.close}><MkIcon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
