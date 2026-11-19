"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { intlOf } from "@/i18n/locales";
import type { ManageWords } from "./Manage.words";
import { fillN, type Answer } from "./manage-client";

// The ticket's change dialogs share one frame (TicketManage.tsx): a native dialog, centred on the page as every pop-up is
// (the owner, 2026-09-30), its title, a close button, and what is inside. It closes on Esc, on its close button and on a
// tap outside it, as TicketDir's and the bike report's do.

const XIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export function ManageDialog({ open, onClose, title, className = "", closeLabel, sub, children }: {
  open: boolean; onClose: () => void; title: string; className?: string; closeLabel: string; sub?: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    // a dialog inside this one (the locker terms) closing is not this one closing: React passes its close event up the tree
    <dialog ref={ref} className={`tk-dlg mg-dlg ${className}`} aria-labelledby={`${id}-t`} onClose={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className="tk-dlg-in">
          <h2 id={`${id}-t`} className="tk-dlg-t">{title}</h2>
          <button type="button" className="tk-dlg-x" aria-label={closeLabel} onClick={onClose}><XIc /></button>
          {sub}
          {children}
        </div>
      )}
    </dialog>
  );
}

/** A refusal in the booking app's words (its toasts, said here in the dialog by its buttons). `extra` gives the time
 *  members book first until and the like, when the answer has one. */
export function sayError(w: ManageWords, a: Extract<Answer, { ok: false }>, extra: { members?: string; group?: string } = {}): string {
  switch (a.error) {
    case "signin": return w.signin;
    case "closed": case "over": return w.closed;
    case "gone": return w.notLive;
    case "changed": return w.changed;
    case "waitlist_full": return w.wlFull;
    case "type_closed": return w.typeClosed;
    case "type_full": return w.typeFull;
    case "paid_type": return w.errPaidType;
    case "own_full": return w.errOwnFull;
    case "cap": return a.detail && /^\d+$/.test(a.detail) ? fillN(w.groupCap, a.detail) : extra.group ?? w.failed;
    case "waiver_outdated": return w.waiverOld;
    case "fix_first": return w.fixOwn;
    case "members_first": return extra.members ? fillN(w.mfRefused, extra.members) : w.rsNotOpen;
    case "not_open": return w.rsNotOpen;
    case "members": return w.members;
    case "paid_move": return w.rsPaid;
    case "no_room": return w.rsNoRoom;
    case "handed": return w.adHanded;
    case "out": return w.adOut;
    case "lk_full": return w.lkErrFull;
    case "lk_ended": return w.lkErrEnded;
    case "lk_not_open": return w.lkErrNotOpen;
    default: return w.failed;
  }
}

/** The moment members book first until, in the page's language ("Sun 23 Nov, 6 PM"), from a refusal's detail. */
export function mfWhen(iso: string | undefined, locale: string): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh", numberingSystem: "latn" }).format(new Date(ms));
  } catch { return ""; }
}
