"use client";

import { useState } from "react";
import type { ManageWords } from "./Manage.words";
import { LockerDialog } from "./LockerPick";
import { ManageDialog, sayError } from "./ManageDialog";
import { announce, postManage, useManage, useRefresh } from "./manage-client";
import { Sar } from "./Sar";

// A locker on the booking, in view on the ticket (the booking app's _lkTkHtml): each rider's time and, once given, the
// number that the desk is told, and its fee; and while the key is not handed and the booking not paid, Change (another
// time or door, on the cabinet: LockerPick) and Remove ("Remove the locker from this booking?", _lkTkRemove: its fee comes
// off the bill; customer_locker_cancel). Change is not offered on a booking already paid, whose fee is the desk's to change.
// The lines are drawn by the ticket (lib/tickets.ts lockerText); the buttons wait for the booking's read.

export type LockerLine = { rowId: string; who: string | null; text: string; amount: number | null };

export default function TicketLockers({ sessionId, day, ids, locale, lines, heading, w, sarWord }: {
  sessionId: string; day: string; ids: string[]; locale: string; lines: LockerLine[]; heading: string; w: ManageWords; sarWord: string;
}) {
  const router = useRefresh();
  const { ctx, reload } = useManage(sessionId, true);
  const [change, setChange] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const done = () => { announce({ action: "locker", session: sessionId, ids }); router?.refresh(); void reload(); };
  const rental = (rowId: string) => ctx?.lockers.rentals.find((r) => r.bookingId === rowId && r.status === "reserved") ?? null;
  const live = (rowId: string) => ctx?.rows.find((r) => r.id === rowId) ?? null;
  const by = [...new Set(lines.map((l) => l.rowId))];
  const ch = change ? rental(change) : null;

  async function drop() {
    if (!remove || busy) return;
    setBusy(true); setErr("");
    const a = await postManage("/api/booking/locker", { action: "cancel", ids: [remove] });
    setBusy(false);
    if (!a.ok) { setErr(sayError(w, a)); return; }
    setRemove(null); done();
  }

  return (
    <>
      {by.map((rowId) => {
        const mine = lines.filter((l) => l.rowId === rowId), r = rental(rowId), row = live(rowId);
        const can = !!r && !!row && !row.paid;
        return (
          <div key={`lk-${rowId}`} className="tk-addons tk-lk-line">
            <p className="tk-addons-h">{mine[0].who && <><bdi>{mine[0].who}</bdi> · </>}{heading}</p>
            {mine.map((l, i) => (
              <div key={i} className="tk-ad">
                <span className="tk-ad-n"><bdi>{l.text}</bdi></span>
                {can && i === 0 && (
                  <span className="tk-lk-acts">
                    {!r.billPaid && <button type="button" className="tk-lk-x" aria-haspopup="dialog" onClick={() => setChange(rowId)}>{w.lkChange}</button>}
                    <button type="button" className="tk-lk-x" aria-haspopup="dialog" onClick={() => { setErr(""); setRemove(rowId); }}>{w.lkRemove}</button>
                  </span>
                )}
                {l.amount !== null && <Sar n={l.amount} word={sarWord} />}
              </div>
            ))}
          </div>
        );
      })}
      {ch && (
        <LockerDialog open={!!change} onClose={() => setChange(null)} onDone={done} mode={{ kind: "change", rental: ch.id, current: { period: ch.period, code: ch.code } }}
          sessionId={sessionId} day={day} locale={locale} words={w} sarWord={sarWord} />
      )}
      <ManageDialog open={!!remove} onClose={() => setRemove(null)} title={w.lkRemoveQ} closeLabel={w.close} className="tk-lk-rm-dlg">
        {err && <p className="tk-brp-err" role="alert">{err}</p>}
        <div className="tk-dlg-acts">
          <button type="button" className="mg-btn mg-red" disabled={busy} aria-busy={busy || undefined} onClick={drop}>{w.lkRemove}</button>
          <button type="button" className="mg-btn" onClick={() => setRemove(null)}>{w.cancelBtn}</button>
        </div>
      </ManageDialog>
    </>
  );
}
