"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isLkPeriod, LK_TIMES, lkDoors, lkFee, lkPeriods, lkTaken, type LkBoard, type LkOffer, type LkPeriod, type ManageError } from "@/lib/booking-manage";
import { fmtClock } from "@/lib/tickets";
import { riyadhClock } from "@/lib/workshop-days";
import { lkTerms, type ManageWords } from "./Manage.words";
import { ManageDialog, sayError } from "./ManageDialog";
import { fillN, postManage } from "./manage-client";
import { Sar } from "./Sar";

// A locker for an evening's ride (the owner, 2026-11-09; the booking app's review Locker block, _lkReviewHtml and its
// cabinet, _lkCabHtml): the times the session offers with their fees (6-8 PM, 9-11 PM or both on a JCC night, 7-9 PM on
// a Petromin night; a time already over tonight is not offered, a time with no locker left says Full; the time picked is
// tapped again to drop it), then the evening's cabinet to pick the doors, one per rider: three across, numbered across
// the rows and never mirrored right to left, each door free, taken, out of service or picked, a gap where a number is
// missing; and "By reserving you accept the locker terms", whose terms open in a pop-up. Reusable: the ticket's Add a
// locker and Change (LockerDialog, below), and the booking flow's review before a booking exists, which reserves what was
// picked once the booking is made (reserveLockers). It reads the session's offer and cabinet itself
// (POST /api/booking/locker {action: "board"}); a door picked that someone reserved meanwhile is dropped and said.
//
// For the booking flow (the lead's review step):
//   const [lk, setLk] = useState<LockerState>({ period: "", codes: [], fee: 0, ready: true, offered: false });
//   <LockerPick sessionId={s.id} day={s.date} locale={locale} max={riders.length} value={lk} onChange={setLk}
//     words={manageWords(locale)} sarWord={t.sarWord} />
//   ...the total adds lk.fee; the Book button waits while !lk.ready (a time picked with no door yet: lkPickDoor);
//   after the booking: if (lk.period) await reserveLockers(bookedRows.filter(r => r.status !== "active").map(r => r.id), lk)
//   ...an answer {ok: false} is said with lockerSay(words, answer, true) (the booking stands: lkErrJustTaken, lkErrOffline);
//   {ok: true, swap: true} with words.lkGotOther and the code the database held instead.

export type LockerChoice = { period: LkPeriod | ""; codes: string[] };
/** What the picker says about the choice: the fee it adds (a time's fee for each door picked, one door while the cabinet
 *  could not be read), whether a booking may go ahead with it (a time picked has a door, once the cabinet is read), and
 *  whether the session offers lockers at all (nothing is drawn when it does not). */
export type LockerState = LockerChoice & { fee: number; ready: boolean; offered: boolean };
export type LockerPickProps = {
  /** The session the locker is for, and its date (YYYY-MM-DD): the evening's cabinet. */
  sessionId: string; day: string;
  /** The page's language: the times, and the terms (English and Arabic; the rest read the English). */
  locale: string;
  /** Doors one may pick: one per rider (the review's party size; on a ticket, the rows without a locker). */
  max: number;
  value: LockerChoice;
  onChange: (v: LockerState) => void;
  /** The words (Manage.words.ts manageWords(locale)) and "SAR" in the page's language for a screen reader. */
  words: ManageWords; sarWord: string;
  /** Change mode: the rental being changed, whose own door stays its to keep; one door, a time always picked. */
  current?: { period: LkPeriod; code: string | null } | null;
  /** Draws the "Locker" heading (the ticket's dialog has its own title). */
  heading?: boolean;
};

const Tick = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const END: Record<LkPeriod, string> = { early: "20:00", late: "23:00", both: "23:00", pm: "21:00" };
/** A time over tonight: the offer's own word (read on the server's clock), else this device's clock (_lkOver). */
const over = (o: LkOffer, day: string, p: LkPeriod) => {
  if (o.ended[p]) return true;
  const now = riyadhClock(new Date());
  return day < now.slice(0, 10) || (day === now.slice(0, 10) && now.slice(11, 16) >= END[p]);
};
export const periodText = (p: LkPeriod, locale: string) => `${fmtClock(LK_TIMES[p][0], locale)} - ${fmtClock(LK_TIMES[p][1], locale)}`;

type Read = { offer: LkOffer | null; board: LkBoard | null; at: number };
/** A read of the cabinet older than eight seconds (_lkRegDoor reads it again before a door is taken on it). */
const stale = (at: number) => Date.now() - at > 8000;
async function readBoard(session: string, day: string): Promise<Read | null> {
  const a = await postManage<{ offer: LkOffer | null; board: LkBoard | null }>("/api/booking/locker", { action: "board", session, day });
  return a.ok ? { offer: a.offer ?? null, board: a.board ?? null, at: Date.now() } : null;
}

export default function LockerPick({ sessionId, day, locale, max, value, onChange, words: w, sarWord, current = null, heading = true }: LockerPickProps) {
  const id = useId();
  const [read, setRead] = useState<Read | null>(null);
  const [msg, setMsg] = useState("");
  const [terms, setTerms] = useState(false);
  const cb = useRef(onChange), val = useRef(value);
  useEffect(() => { cb.current = onChange; val.current = value; }, [onChange, value]);
  const one = !!current;
  const cap = one ? 1 : Math.max(1, max);

  const tell = useCallback((v: LockerChoice, r: Read | null) => {
    const o = r?.offer;
    const p = v.period;
    const n = r?.board ? Math.min(v.codes.length, cap) : 1;
    cb.current({ ...v, fee: o && p ? Math.round(lkFee(o, p) * n * 100) / 100 : 0, ready: !p || !r?.board || v.codes.length > 0, offered: !!o && lkPeriods(o.kind).length > 0 });
  }, [cap]);

  /** What a read of the cabinet answers: kept, and a door picked here that someone reserved meanwhile is dropped (a
   *  reserved locker is nobody else's), and said. */
  const apply = useCallback((r: Read) => {
    setRead(r);
    const v = val.current;
    if (r.board && v.period) {
      const tk = lkTaken(r.board, v.period, current);
      const gone = v.codes.filter((c) => tk.has(c));
      if (gone.length) { setMsg(fillN(w.lkPickGone, gone.join(", "))); tell({ ...v, codes: v.codes.filter((c) => !tk.has(c)) }, r); return; }
    }
    tell(v, r);
  }, [current, tell, w.lkPickGone]);
  useEffect(() => {
    let gone = false;
    void readBoard(sessionId, day).then((r) => { if (!gone && r) apply(r); });
    return () => { gone = true; };
  }, [sessionId, day, apply]);
  const again = () => { void readBoard(sessionId, day).then((r) => { if (r) apply(r); }); };

  const o = read?.offer;
  if (!o) return null;
  const ps = lkPeriods(o.kind).filter((q) => !over(o, day, q)); // tonight's times already over are not offered
  if (!ps.length) return null;
  const p = value.period && ps.includes(value.period) ? value.period : "";
  const b = p ? read?.board ?? null : null;
  const pickPeriod = (q: LkPeriod) => {
    setMsg("");
    if (one) { if (q !== p) tell({ period: q, codes: value.codes }, read); return; } // a change keeps a time
    tell({ period: p === q ? "" : q, codes: [] }, read);
  };
  const tk = b && p ? lkTaken(b, p, current) : new Set<string>();
  const picked = value.codes.filter((c) => !tk.has(c) && !!b?.units.some((u) => u.code === c && !u.out)).slice(0, cap);
  // one door per rider, and no more than the time has left (a change has its own door to move)
  const most = one ? 1 : Math.min(cap, Math.max(picked.length, p ? o.left[p] : 0));
  const door = (c: string) => {
    setMsg("");
    const a = picked.includes(c) ? picked.filter((x) => x !== c) : one ? [c] : [...picked, c];
    tell({ period: p, codes: a }, read);
    if (!picked.includes(c) && read && stale(read.at)) again(); // a door picked on an older read: read again
  };
  const t = lkTerms(locale);
  const termsAt = w.lkTermsLine.indexOf("{0}");

  return (
    <div className="tk-lk-pick">
      {heading && <p className="tk-lk-h" id={`${id}-h`}>{w.lkTitle}</p>}
      <div className="tk-lk-ps" role="radiogroup" aria-labelledby={heading ? `${id}-h` : undefined} aria-label={heading ? undefined : w.lkPeriod}>
        {ps.map((q) => {
          const on = p === q, full = !on && o.left[q] < 1 && !(current?.period === q);
          return (
            <button key={q} type="button" role="radio" aria-checked={on} disabled={full} className={`tk-lk-p${on ? " on" : ""}${full ? " full" : ""}`} onClick={() => pickPeriod(q)}>
              <span className="tk-lk-chk" aria-hidden="true">{on && <Tick />}</span>
              <span className="tk-lk-pt"><bdi>{periodText(q, locale)}</bdi>{full && <span className="tk-lk-full"> {w.lkFull}</span>}</span>
              <Sar n={lkFee(o, q)} word={sarWord} className="tk-lk-fee" />
            </button>
          );
        })}
      </div>
      {b && (
        <>
          <p className="tk-lk-h2" id={`${id}-d`}>{w.lkPickDoor}</p>
          {/* left to right in Arabic and Urdu too: 1 stays top left, as on the cabinet */}
          <div className="tk-lk-cab" dir="ltr" role="group" aria-labelledby={`${id}-d`}>
            {lkDoors(b).map((u, i) => {
              if (!u) return <span key={`g${i}`} className="tk-lk-d gap" aria-hidden="true" />;
              const on = picked.includes(u.code), no = u.out || tk.has(u.code);
              return (
                <button key={u.code} type="button" className={`tk-lk-d${on ? " on" : ""}${no ? " no" : ""}`} aria-pressed={on}
                  disabled={!on && (no || (!one && picked.length >= most))} onClick={() => door(u.code)}
                  aria-label={fillN(w.lkDoor, u.code) + (no ? ` · ${u.out ? w.lkOut : w.lkFull}` : "")}><b>{u.code}</b></button>
              );
            })}
          </div>
          <p className="tk-lk-terms">
            {termsAt >= 0 ? w.lkTermsLine.slice(0, termsAt) : `${w.lkTermsLine} `}
            <button type="button" className="tk-lk-terms-a" onClick={() => setTerms(true)}>{w.lkTermsLink}</button>
            {termsAt >= 0 ? w.lkTermsLine.slice(termsAt + 3) : ""}
          </p>
        </>
      )}
      {msg && <p className="tk-brp-err" role="alert">{msg}</p>}
      <ManageDialog open={terms} onClose={() => setTerms(false)} title={t.title} closeLabel={w.close} className="tk-lk-terms-dlg">
        <ul className="tk-lk-terms-ul" {...(t.en ? { lang: "en", dir: "ltr" } : {})}>{t.lines.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <div className="tk-dlg-acts"><button type="button" className="mg-btn mg-go" onClick={() => setTerms(false)}>{w.close}</button></div>
      </ManageDialog>
    </div>
  );
}

type Reserved = { ok: true; swap: boolean; lockers: { bookingId: string; code: string }[] };
/** Reserves what the picker holds on bookings just made or already held (customer_locker_reserve, the booking app's
 *  _lkAfterBook): one locker for each door picked, on the first rows in order (one with no door picked when the cabinet
 *  could not be read). Rows on the waitlist may hold one; a paid row cannot. A door someone took in the last moments is
 *  reserved again with none picked, and the database holds a free one for the rider ({swap: true}: lkGotOther). */
export async function reserveLockers(bookingIds: string[], choice: LockerChoice): Promise<Reserved | { ok: false; error: ManageError | "network" }> {
  if (!isLkPeriod(choice.period) || !bookingIds.length) return { ok: false, error: "invalid" };
  const n = Math.min(bookingIds.length, Math.max(1, choice.codes.length));
  const a = await postManage<Omit<Reserved, "ok">>("/api/booking/locker", { action: "reserve", ids: bookingIds.slice(0, n), period: choice.period, codes: choice.codes.length >= n ? choice.codes.slice(0, n) : null });
  return a.ok ? { ok: true, swap: !!a.swap, lockers: Array.isArray(a.lockers) ? a.lockers : [] } : { ok: false, error: a.error };
}
/** A locker refusal in the booking app's words (_lkRiderSay). `booked`: said after a booking was made, which stands. */
export function lockerSay(w: ManageWords, a: { error: ManageError | "network" }, booked = false, code = ""): string {
  if (a.error === "lk_full") return w.lkErrFull;
  if (a.error === "lk_taken") return booked ? w.lkErrJustTaken : code ? fillN(w.lkPickGone, code) : w.lkErrFull;
  if (a.error === "lk_ended") return w.lkErrEnded;
  if (a.error === "lk_not_open") return w.lkErrNotOpen;
  return booked ? w.lkErrOffline : w.failed;
}

/** The ticket's locker dialog: Add a locker on the booking's rows that hold none, or Change a rental's time or door. */
export function LockerDialog({ open, onClose, onDone, mode, sessionId, day, locale, words: w, sarWord }: {
  open: boolean; onClose: () => void; onDone: () => void; sessionId: string; day: string; locale: string; words: ManageWords; sarWord: string;
  mode: { kind: "add"; ids: string[] } | { kind: "change"; rental: string; current: { period: LkPeriod; code: string | null } };
}) {
  const start = (): LockerState => ({ period: mode.kind === "change" ? mode.current.period : "", codes: mode.kind === "change" && mode.current.code ? [mode.current.code] : [], fee: 0, ready: true, offered: true });
  const [v, setV] = useState<LockerState>(start);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [said, setSaid] = useState("");
  const close = () => { setV(start()); setErr(""); setSaid(""); onClose(); };
  async function go() {
    if (busy) return;
    if (!v.period) { setErr(w.lkPickPeriod); return; }
    if (!v.ready || (mode.kind === "change" && !v.codes.length)) { setErr(w.lkPickDoor); return; }
    setBusy(true); setErr("");
    if (mode.kind === "add") {
      const a = await reserveLockers(mode.ids, v);
      setBusy(false);
      if (!a.ok) { setErr(lockerSay(w, a)); return; }
      onDone();
      const got = a.lockers.map((x) => x.code).filter(Boolean);
      if (a.swap && got.length) { setSaid(fillN(w.lkGotOther, got.join(", "))); return; }
      close();
      return;
    }
    if (v.period === mode.current.period && v.codes[0] === mode.current.code) { setBusy(false); close(); return; }
    const a = await postManage("/api/booking/locker", { action: "change", rental: mode.rental, period: v.period, code: v.codes[0] });
    setBusy(false);
    if (a.ok) { onDone(); close(); return; }
    setErr(a.error.startsWith("lk_") ? lockerSay(w, a, false, v.codes[0]) : sayError(w, a));
  }
  return (
    <ManageDialog open={open} onClose={close} title={mode.kind === "add" ? w.lkAdd : w.lkTitle} closeLabel={w.close} className="tk-lk-dlg">
      {said ? <p className="mg-sub" role="status">{said}</p> : (
        <LockerPick sessionId={sessionId} day={day} locale={locale} max={mode.kind === "add" ? mode.ids.length : 1} value={v} onChange={setV}
          words={w} sarWord={sarWord} current={mode.kind === "change" ? mode.current : null} heading={false} />
      )}
      {err && <p className="tk-brp-err" role="alert">{err}</p>}
      <div className="tk-dlg-acts">
        {said ? <button type="button" className="mg-btn mg-go" onClick={close}>{w.done}</button> : (
          <button type="button" className="mg-btn mg-go" disabled={busy || !v.period} aria-busy={busy || undefined} onClick={go}>{mode.kind === "add" ? w.lkAddGo : w.save}</button>
        )}
        {!said && <button type="button" className="mg-btn" onClick={close}>{w.close}</button>}
      </div>
    </ManageDialog>
  );
}
