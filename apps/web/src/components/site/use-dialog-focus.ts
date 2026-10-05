import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A modal dialog (aria-modal) keeps the keyboard inside it while `open`: `first` - else its first
 *  control - takes the focus when it opens, Tab and Shift+Tab go round its own controls, and when it
 *  closes (Escape, a tap outside, its close button) the focus goes back to `back` - else to what had
 *  it before - so the visitor carries on where they were. */
export function useDialogFocus(box: RefObject<HTMLElement | null>, open: boolean, opts: { first?: RefObject<HTMLElement | null>; back?: RefObject<HTMLElement | null> } = {}) {
  const { first, back } = opts;
  useEffect(() => {
    const el = box.current;
    if (!open || !el) return;
    const to = back?.current ?? (document.activeElement as HTMLElement | null); // where the focus goes back to
    (first?.current ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length > 0);
      if (!all.length) { e.preventDefault(); return; }
      const at = document.activeElement, a = all[0], z = all[all.length - 1];
      if (e.shiftKey ? at === a || !el.contains(at) : at === z || !el.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? z : a).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (to && to.isConnected) to.focus({ preventScroll: true });
    };
  }, [box, open, first, back]);
}
