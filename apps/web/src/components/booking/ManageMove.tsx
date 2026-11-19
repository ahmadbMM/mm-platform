"use client";

import { useEffect, useState } from "react";
import type { MoveTarget } from "@/lib/booking-manage-server";
import type { ManageWords } from "./Manage.words";
import { ManageDialog, mfWhen, sayError } from "./ManageDialog";
import { fillN, postManage } from "./manage-client";

// Reschedule on a ticket (the booking app's showRescheduleModal and rescheduleBooking): "Move your booking", "Pick another
// session to move all your riders to.", and the sessions it may move to (_rsTarget: another open circuit night, read on
// the server), each its day and time with Available, or Fully Booked and not to be picked when it has no room for every
// rider; "No other open sessions available." when there are none. A tap moves the whole booking there (POST
// /api/booking/move). A refusal is said in the app's words by the list, which stays open for another date; a move the
// server made for some riders only says how many moved.

type Props = { open: boolean; onClose: () => void; onMoved: (waitlisted: boolean) => void; onPartial: () => void; from: string; locale: string; w: ManageWords };

export default function ManageMove(p: Props) {
  return (
    <ManageDialog open={p.open} onClose={p.onClose} title={p.w.rsTitle} closeLabel={p.w.close} className="mg-rs-dlg" sub={<p className="mg-sub">{p.w.rsSub}</p>}>
      <MoveBody {...p} />
    </ManageDialog>
  );
}

/** The list, read each time the dialog opens. */
function MoveBody({ onMoved, onPartial, from, locale, w }: Props) {
  const [list, setList] = useState<MoveTarget[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let gone = false;
    void postManage<{ targets: MoveTarget[] }>("/api/booking/move", { from, list: true, locale }).then((a) => {
      if (gone) return;
      if (a.ok) setList(a.targets); else { setList([]); setErr(sayError(w, a)); }
    });
    return () => { gone = true; };
  }, [from, locale, w]);

  async function move(to: string) {
    if (busy) return;
    setBusy(to); setErr("");
    const a = await postManage<{ waitlisted: boolean }>("/api/booking/move", { from, to });
    setBusy(null);
    if (a.ok) { onMoved(!!a.waitlisted); return; }
    const why = a.error === "type_closed" ? w.rsTyClosed : a.error === "type_full" ? w.rsTyFull : sayError(w, a, { members: mfWhen(a.detail, locale) });
    // the server refuses rider by rider: the riders who did move are said (the booking is now on two dates)
    setErr(a.moved && a.of ? `${why} ${fillN(w.rsSplit, a.moved, a.of)}` : why);
    if (a.moved) onPartial(); // the ticket is drawn again behind the dialog, which stays open with what was said
  }

  return (
    <>
      {list === null ? <p className="mg-wait" aria-busy="true" /> : list.length === 0 && !err ? <p className="mg-empty">{w.rsNone}</p> : (
        <ul className="mg-rs">
          {list.map((s) => (
            <li key={s.id}>
              <button type="button" className={`mg-rs-o${s.full ? " full" : ""}`} disabled={s.full || !!busy} aria-busy={busy === s.id || undefined} onClick={() => move(s.id)}>
                <span className="mg-rs-d"><bdi>{s.day}</bdi>{s.time && <> · <bdi>{s.time}</bdi></>}</span>
                <span className="mg-rs-st">{s.full ? w.rsFull : w.rsAvail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="tk-brp-err" role="alert">{err}</p>}
    </>
  );
}
