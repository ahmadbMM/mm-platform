"use client";

import { useRef, useState } from "react";
import { TickIcon } from "@/components/site/Icons";
import type { ManageWords } from "./Manage.words";
import ManageCancel from "./ManageCancel";
import ManageEdit, { FarmDrop } from "./ManageEdit";
import ManageAddons from "./ManageAddons";
import ManageMove from "./ManageMove";
import { LockerDialog } from "./LockerPick";
import { announce, useManage, useRefresh, type BookingChange } from "./manage-client";

// The ticket's own changes, made on the website (the user, 2026-11-19: "make sure all customers can do everything they want
// in the booking app to do it on the main website"): the booking app's ticket actions (renderBookingTicket's cu-tk-actions)
// as real actions here, no longer links that hand the rider over to it. Edit (the party: heights, bike types, riders added
// or removed; the Farm House Night's family by name), Reschedule (another circuit night), Add-ons, Add a locker, and
// Cancel - Leave waitlist when nothing is held - each in a centred dialog with the app's own words. Victory Lap's and
// Arena Heros' Change details stays the booking app's (`vlEdit`: the race, division, shirt and partner are its own steps).
// What the dialogs need is read once for the booking (lib/booking-manage-server.ts manageContext) and every change goes
// through the booking app's token-checked functions (app/api/booking/*). After a change the page is drawn again
// (router.refresh) and a page that drew the ticket itself hears of it ("mm:booking-changed"); the ticket says what happened
// in its own place: a cancelled booking turns into one Cancelled chip with nothing to press.

export type ManageText = { edit: string; reschedule: string; cancel: string; leaveWl: string; vlEdit: string; cancelled: string; sarWord: string };

const Again = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

type Open = null | "cancel" | "edit" | "farm" | "addons" | "move" | "locker";

export default function TicketManage({ sessionId, day, ids, locale, allWl, noBike, can, vlEdit, t, w, typeNames, cancel = null }: {
  sessionId: string; day: string; ids: string[]; locale: string; allWl: boolean; noBike: boolean;
  /** What this ticket offers (TicketCard decides it by the kind, as the booking app's ticket does). */
  can: { edit: boolean; farm: boolean; move: boolean; extras: boolean };
  vlEdit: string | null; t: ManageText; w: ManageWords; typeNames: Record<string, string>;
  /** Staging: a place paid online is cancelled by its own button (components/pay/TicketPay.tsx TicketPayCancel), drawn in
   *  place of the plain Cancel. */
  cancel?: React.ReactNode;
}) {
  const router = useRefresh();
  const box = useRef<HTMLDivElement>(null);
  const { ctx, error, reload } = useManage(sessionId, true);
  const [open, setOpen] = useState<Open>(null);
  const [wait, setWait] = useState<Open>(null);
  const [done, setDone] = useState<null | "cancelled" | "moved" | "movedWl">(null);

  const changed = (action: BookingChange["action"]) => {
    announce({ action, session: sessionId, ids });
    router?.refresh();
    void reload();
  };
  /** Opens a dialog once the booking's read is in (a tap before it lands waits for it). */
  async function show(which: Exclude<Open, null>) {
    if (!ctx) { setWait(which); await reload(); setWait(null); }
    setOpen(which);
  }
  const mark = (state: string) => box.current?.closest(".tk-card")?.setAttribute("data-state", state);

  if (done === "cancelled") return <div className="tk-manage" ref={box}><span className="tk-cx-chip" role="status">{t.cancelled}</span></div>;
  if (done) return <div className="tk-manage" ref={box}><span className="tk-stc-ok" role="status"><TickIcon size={16} />{done === "movedWl" ? w.rsWl : w.rsDone}</span></div>;

  const rows = ctx?.rows ?? [];
  const lk = ctx?.lockers;
  // Add a locker: the rows that may still take one (live, not paid, none held), on a session offering a time not over yet
  const held = new Set((lk?.rentals ?? []).filter((r) => r.status === "reserved" || r.status === "in_use").map((r) => r.bookingId));
  const free = rows.filter((r) => !r.paid && !held.has(r.id)).map((r) => r.id);
  const lkOn = !!lk?.kind && !!lk.offer && free.length > 0 && Object.entries(lk.offer.ended).some(([p, e]) => !e && (lk.kind === "pm" ? p === "pm" : p !== "pm"));
  const extras = can.extras && !!ctx && ctx.addons.length > 0;
  const editOn = can.farm ? (ctx ? ctx.rows.length > 1 : ids.length > 1) : can.edit && (!ctx || ctx.session.bike || ctx.party);
  const busy = (x: Open) => (wait === x ? { "aria-busy": true as const } : {});

  return (
    <div className="tk-manage" ref={box}>
      {vlEdit && <a className="tk-btn solid" href={vlEdit}>{t.vlEdit}</a>}
      {editOn && <button type="button" className="tk-btn solid" aria-haspopup="dialog" {...busy(can.farm ? "farm" : "edit")} onClick={() => show(can.farm ? "farm" : "edit")}>{t.edit}</button>}
      {can.move && <button type="button" className="tk-btn" aria-haspopup="dialog" {...busy("move")} onClick={() => show("move")}><Again /> {t.reschedule}</button>}
      {extras && <button type="button" className="tk-btn" aria-haspopup="dialog" onClick={() => show("addons")}>{w.adBtn}</button>}
      {lkOn && <button type="button" className="tk-btn" aria-haspopup="dialog" onClick={() => show("locker")}>{w.lkAdd}</button>}
      {cancel ?? <button type="button" className="tk-btn red" aria-haspopup="dialog" {...busy("cancel")} onClick={() => show("cancel")}>{allWl ? t.leaveWl : t.cancel}</button>}
      {/* the booking could not be read: said under the buttons (nothing of it is live any more, or no answer) */}
      {open && !ctx && error && <p className="tk-stc-err" role="alert">{error === "gone" ? w.notLive : error === "signin" ? w.signin : w.failed}</p>}
      {ctx && (
        <>
          <ManageCancel open={open === "cancel"} onClose={() => setOpen(null)} booking={ctx.rows[0]?.id ?? ids[0]} count={ctx.rows.length} allWl={allWl} noBike={noBike}
            reasons={ctx.reasons} w={w} onDone={() => { setOpen(null); setDone("cancelled"); mark("cancelled"); changed("cancel"); }} />
          {can.edit && <ManageEdit open={open === "edit"} onClose={() => setOpen(null)} ctx={ctx} reload={reload} w={w} typeNames={typeNames} sarWord={t.sarWord} locale={locale}
            onDone={() => { setOpen(null); changed("edit"); }} />}
          {can.farm && <FarmDrop open={open === "farm"} onClose={() => setOpen(null)} ctx={ctx} w={w} onDropped={() => changed("drop")} />}
          {extras && <ManageAddons open={open === "addons"} ctx={ctx} w={w} sarWord={t.sarWord} onClose={(c) => { setOpen(null); if (c) changed("addons"); }} />}
          {can.move && <ManageMove open={open === "move"} onClose={() => setOpen(null)} from={sessionId} locale={locale} w={w}
            onMoved={(wl) => { setOpen(null); setDone(wl ? "movedWl" : "moved"); mark("moved"); changed("move"); }} onPartial={() => changed("move")} />}
          {lkOn && <LockerDialog open={open === "locker"} onClose={() => setOpen(null)} onDone={() => changed("locker")} mode={{ kind: "add", ids: free }}
            sessionId={sessionId} day={day} locale={locale} words={w} sarWord={t.sarWord} />}
        </>
      )}
    </div>
  );
}
