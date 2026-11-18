"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { Ic } from "./bits";

// A pop-up, centred on every screen (never a bottom sheet): Escape, a tap outside it and its close button
// shut it; the keyboard stays inside while it is open and goes back where it was after.
export default function Modal({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  // a tap outside closes it only when it began outside too: a text selection dragged out of the pop-up and let go over
  // the backdrop is a click on the backdrop, and it closed the pop-up with what was typed in it (bug hunt 2026-11-18)
  const downOutside = useRef(false);
  useEffect(() => { close.current = onClose; });
  useDialogFocus(box, true);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", esc);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = was; };
  }, []);
  return (
    <div className="bk-backdrop" onPointerDown={(e) => { downOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { const out = downOutside.current; downOutside.current = false; if (out && e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="bk-pop" role="dialog" aria-modal="true" aria-labelledby="st-pop-t">
        <div className="bk-pop-body">
          <div className="bk-pop-head">
            <h2 id="st-pop-t" className="bk-pop-title">{title}</h2>
            <button type="button" className="st-x" onClick={onClose} aria-label={closeLabel}><Ic name="close" size={18} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
