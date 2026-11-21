"use client";

import { useEffect, useRef, type RefObject } from "react";

// Where the keyboard is after one of the contact side's pop-ups (W3). The pop-up itself (components/market/MkModal.tsx)
// takes the keyboard when it opens and hands it back to the control that opened it when it closes. Two cases are left,
// and in both the keyboard would otherwise be on nothing (the page's body), so the next Tab starts from the top of the
// page: the control that opened the pop-up is no longer there when it closes, and the control that had the keyboard
// inside the pop-up goes away while it is still open.

const CONTROL = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]';
const lost = (): boolean => { const at = document.activeElement; return !at || at === document.body; };

/** After a pop-up closed (`open` went from true to false) and its opener is gone - "Share my WhatsApp" once the number
 *  is shared, "Report" once it is reported, a shop's Call button once it is the number's own link - the keyboard goes
 *  to `to`: that element when it can take it, else the first control inside it. It does nothing while the opener is
 *  still there (the pop-up gave the keyboard back to it). */
export function useFocusAfter(open: boolean, to: RefObject<HTMLElement | null>): void {
  const was = useRef(false);
  useEffect(() => {
    if (open) { was.current = true; return; }
    if (!was.current) return;
    was.current = false;
    const el = to.current;
    if (!el || !lost()) return;
    (el.matches(CONTROL) ? el : el.querySelector<HTMLElement>(CONTROL))?.focus({ preventScroll: true });
  }, [open, to]);
}

/** Inside a pop-up whose content changes while it is open ("Try again" gives way to what it asked for): when the
 *  control that had the keyboard went with the old content, the pop-up's first control takes it.
 *    inside   any element of the pop-up's content (none while the pop-up is shut: nothing is done)
 *    when     the value that changes when the content does */
export function useFocusKept(inside: RefObject<HTMLElement | null>, when: unknown): void {
  useEffect(() => {
    if (!lost()) return;
    inside.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>(CONTROL)?.focus({ preventScroll: true });
  }, [inside, when]);
}
