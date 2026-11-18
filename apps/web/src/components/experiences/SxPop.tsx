"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { Ic } from "./BookIcons";

// A centred pop-up in the booking's own look (bk-backdrop, bk-pop; R3: centred at every width, never a bottom sheet,
// scrolling inside under 90svh), as components/store/Modal.tsx behaves: Escape, a tap that starts and ends outside, and
// its close button shut it; the keyboard stays inside while it is open and goes back where it was after.
export default function SxPop({ title, close, onClose, children }: { title: string; close: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const shut = useRef(onClose);
  const downOut = useRef(false);
  useEffect(() => { shut.current = onClose; });
  useDialogFocus(box, true);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") shut.current(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  return (
    <div className="bk-backdrop" onPointerDown={(e) => { downOut.current = e.target === e.currentTarget; }}
      onClick={(e) => { const out = downOut.current; downOut.current = false; if (out && e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="bk-pop sx6-pop" role="dialog" aria-modal="true" aria-labelledby="sx6-pop-t">
        <div className="bk-pop-body">
          <div className="bk-pop-head"><h2 id="sx6-pop-t" className="bk-pop-title">{title}</h2>
            <button type="button" className="bk-x" onClick={onClose} aria-label={close}><Ic name="close" size={18} /></button></div>
          {children}
        </div>
      </div>
    </div>
  );
}
