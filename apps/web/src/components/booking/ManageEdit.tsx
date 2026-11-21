"use client";

import { useEffect, useId, useState } from "react";
import { Link } from "@/i18n/navigation";
import { checkEdit, cleanRiderName, KIDS_MAX_CM, nameLocked, type EditError, type EditRider } from "@/lib/booking-manage";
import type { ManageCtx } from "@/lib/booking-manage-server";
import type { ManageWords } from "./Manage.words";
import { ManageDialog, mfWhen, sayError } from "./ManageDialog";
import { fillN, postManage } from "./manage-client";
import { Sar } from "./Sar";

// Edit on a ticket (the booking app's Edit: its Reserve form in modify mode, submitModifyBooking): the party as it stands,
// rider by rider, each rider's height and bike type, with the number of bikes (or places) where the ride takes a party.
// A rider already on the booking keeps their name, read-only (_modNameLocked); a rider added types theirs, and the
// waiver is agreed for them right above the button, as on the review (an edit that adds nobody asks nothing). The bike
// types are the session's own for this account (Any never; a type closed there greyed and saying so, kept for the rider
// who holds it), each with what it costs, none on a free ride. Update booking saves it (POST /api/booking/update).
//
// The Farm House Night's Edit (FarmDrop, the booking app's _fhDropOpen): who is on the booking by name, the holder
// marked You, and each family member taken off one at a time with a Yes, remove / Keep; nobody is added here.

const Minus = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 12h12" /></svg>;
const Plus = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M12 6v12M6 12h12" /></svg>;

type Waiver = { title: string; body: string; agree: string; version: string | null };

type Props = {
  open: boolean; onClose: () => void; onDone: () => void; ctx: ManageCtx; reload: () => Promise<void>; w: ManageWords;
  typeNames: Record<string, string>; sarWord: string; locale: string;
};

export default function ManageEdit(p: Props) {
  // the form is filled from the booking each time it opens, and again when its rows changed underneath, which it says
  // (modifyChangedMsg)
  const [note, setNote] = useState("");
  const close = () => { setNote(""); p.onClose(); };
  return (
    <ManageDialog open={p.open} onClose={close} title={p.w.update} closeLabel={p.w.close} className="mg-ed-dlg">
      <EditBody key={p.ctx.rows.map((r) => r.id).join(",")} {...p} onClose={close} note={note} onNote={setNote} />
    </ManageDialog>
  );
}

function EditBody({ onClose, onDone, ctx, reload, w, typeNames, sarWord, locale, note, onNote }: Props & { note: string; onNote: (s: string) => void }) {
  const id = useId();
  const [riders, setRiders] = useState<EditRider[]>(() => ctx.rows.map((r) => ({ name: r.name, height: r.height ? String(r.height) : "", type: r.type === "Any" || r.type === "None" ? "" : r.type })));
  const [capNote, setCapNote] = useState(false);
  const [agree, setAgree] = useState(false);
  const [waiver, setWaiver] = useState<Waiver | null>(null);
  const [err, setErr] = useState<{ msg: string; i?: number; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const bike = ctx.session.bike, existing = ctx.rows.length;
  const nb = !bike;
  const adding = riders.length > existing;
  // the waiver's words, read when a rider is first added (the session's own, in the page's language)
  useEffect(() => {
    if (!adding || waiver) return;
    let gone = false;
    void postManage<{ waiver: Waiver }>("/api/booking/manage", { session: ctx.session.id, locale, waiver: true }).then((a) => { if (!gone && a.ok && a.waiver) setWaiver(a.waiver); });
    return () => { gone = true; };
  }, [adding, waiver, ctx.session.id, locale]);

  const set = (i: number, k: keyof EditRider, v: string) => { setRiders((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r))); setErr(null); onNote(""); };
  function step(d: 1 | -1) {
    setErr(null);
    if (d > 0 && riders.length >= ctx.cap) { setCapNote(!["event", "petromin", "farm"].includes(ctx.session.kind)); return; }
    setCapNote(false);
    if (d < 0 && riders.length <= 1) return;
    setRiders((rs) => (d > 0 ? [...rs, { name: "", height: "", type: "" }] : rs.slice(0, -1)));
  }
  const fare = (t: string) => ctx.types.find((x) => x.type === t)?.price ?? (ctx.session.free || t === "Own" ? 0 : null);
  const errText = (e: EditError) =>
    e.field === "height" ? w.errHeight : e.field === "type" ? w.errType : e.field === "kids" ? fillN(w.errKids, KIDS_MAX_CM) : e.field === "name" ? w.errName
      : e.field === "paid" ? w.errPaidType : e.field === "closed" ? w.typeClosed : e.field === "cap" ? fillN(w.capNote, ctx.acctCap) : "";

  async function save() {
    if (busy) return;
    const bad = checkEdit({ existing: ctx.rows, riders, bike, cap: ctx.cap, types: ctx.types, fare, waiver: agree });
    if (bad) {
      if (bad.field === "waiver") return; // the button waits for the tick
      setErr({ msg: errText(bad), i: bad.i, field: bad.field });
      if (bad.i >= 0) document.getElementById(`${id}-${bad.field === "name" ? "n" : bad.field === "height" ? "h" : "t"}-${bad.i}`)?.focus();
      return;
    }
    setBusy(true); setErr(null);
    const a = await postManage("/api/booking/update", { session: ctx.session.id, key: ctx.rows.map((r) => r.id), riders: riders.map((r, i) => ({ ...r, name: nameLocked(i, existing) ? "" : cleanRiderName(r.name) })), waiver: agree });
    setBusy(false);
    if (a.ok) { setAgree(false); onDone(); return; }
    if (a.error === "changed") { onNote(w.changed); setErr({ msg: w.changed }); await reload(); return; }
    if (a.error === "waiver_outdated") setTimeout(() => { try { window.location.reload(); } catch { /* none */ } }, 2500);
    setErr({ msg: sayError(w, a, { members: mfWhen(a.detail, locale) }), i: a.i, field: a.error === "paid_type" || a.error === "own_full" || a.error === "type_closed" ? "t" : undefined });
  }

  const typePill = (i: number, t: { type: string; price: number | null; closed: boolean }) => {
    const on = riders[i].type === t.type, kept = i < existing && ctx.rows[i].type === t.type, shut = t.closed && !kept;
    return (
      <label key={t.type} className={`mg-ty${shut ? " shut" : ""}`}>
        <input type="radio" name={`${id}-ty-${i}`} value={t.type} checked={on} disabled={shut} onChange={() => set(i, "type", t.type)} />
        <span className="mg-ty-n">{typeNames[t.type] ?? t.type}</span>
        {shut ? <span className="mg-ty-p">{w.tyClosed}</span> : t.price != null && t.price > 0 && <Sar n={t.price} word={sarWord} className="mg-ty-p" />}
      </label>
    );
  };

  return (
    <>
      {ctx.party && (
        <div className="mg-qty">
          <span className="mg-qty-l" id={`${id}-q`}>{bike ? w.numBikes : w.numPlaces}</span>
          <div className="mg-step" role="group" aria-labelledby={`${id}-q`}>
            <button type="button" aria-label={bike ? w.qtyDec : w.qtyDecS} disabled={riders.length <= 1} onClick={() => step(-1)}><Minus /></button>
            <span aria-live="polite">{riders.length}</span>
            <button type="button" aria-label={bike ? w.qtyInc : w.qtyIncS} onClick={() => step(1)}><Plus /></button>
          </div>
          {capNote && <p className="mg-note" role="status">{fillN(w.capNote, ctx.acctCap)}</p>}
        </div>
      )}
      <div className="mg-riders">
        {riders.map((r, i) => {
          const locked = nameLocked(i, existing);
          const mine = err?.i === i;
          return (
            <fieldset key={i} className="mg-rider">
              {riders.length > 1 && <legend className="mg-rider-h"><span className="mg-rider-n">{i + 1}</span>{nb ? w.place : w.rider}</legend>}
              {riders.length > 1 && (
                <div className="mg-f">
                  <label htmlFor={`${id}-n-${i}`}>{nb ? w.partName : w.riderName}</label>
                  <input id={`${id}-n-${i}`} type="text" dir="auto" autoComplete="off" autoCapitalize="words" maxLength={60} value={r.name}
                    placeholder={locked ? undefined : w.namePh} readOnly={locked} aria-readonly={locked || undefined} className={locked ? "locked" : undefined}
                    aria-invalid={mine && err?.field === "name" ? true : undefined}
                    onChange={(e) => !locked && set(i, "name", e.target.value.replace(/[-‐-―_]/g, " "))} />
                </div>
              )}
              {bike && (
                <div className="mg-f">
                  <label htmlFor={`${id}-h-${i}`}>{w.height}</label>
                  <div className="mg-unit">
                    <input id={`${id}-h-${i}`} type="text" inputMode="numeric" maxLength={3} autoComplete="off" placeholder={w.heightPh} value={r.height}
                      aria-invalid={mine && err?.field === "height" ? true : undefined} onChange={(e) => set(i, "height", e.target.value)} />
                    <span aria-hidden="true">{w.cm}</span>
                  </div>
                </div>
              )}
              {bike && (
                <div className="mg-f">
                  <span className="mg-f-l" id={`${id}-tl-${i}`}>{w.bikeType}</span>
                  <div id={`${id}-t-${i}`} tabIndex={-1} className="mg-tys" role="radiogroup" aria-labelledby={`${id}-tl-${i}`}>
                    {ctx.types.map((t) => typePill(i, t))}
                  </div>
                </div>
              )}
              {mine && err && <p className="tk-brp-err" role="alert">{err.msg}</p>}
            </fieldset>
          );
        })}
      </div>
      {adding && waiver && (
        <div className="mg-wv">
          <p className="mg-wv-t">{waiver.title}</p>
          <div className="mg-wv-b" tabIndex={0}>{waiver.body}</div>
          <label className="mg-wv-ok"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{waiver.agree}</span></label>
        </div>
      )}
      {!err && note && <p className="tk-brp-err" role="alert">{note}</p>}
      {err && err.i == null && (
        <p className="tk-brp-err" role="alert">{err.msg}{" "}{err.msg === w.fixOwn && <Link href="/account/personal">{w.fixAdd}</Link>}</p>
      )}
      <div className="tk-dlg-acts">
        <button type="button" className="mg-btn mg-go" disabled={busy || (adding && !agree)} aria-busy={busy || undefined} onClick={save}>{w.update}</button>
        <button type="button" className="mg-btn" onClick={onClose}>{w.close}</button>
      </div>
    </>
  );
}

/** The Farm House Night's Edit: who is on the booking, a family member taken off one at a time (POST /api/booking/update
 *  {session, drop}). */
export function FarmDrop({ open, onClose, onDropped, ctx, w }: { open: boolean; onClose: () => void; onDropped: () => void; ctx: ManageCtx; w: ManageWords }) {
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const close = () => { setAsk(null); setErr(""); onClose(); };
  async function drop(row: string) {
    if (busy) return;
    setBusy(true); setErr("");
    const a = await postManage("/api/booking/update", { session: ctx.session.id, drop: row });
    setBusy(false); setAsk(null);
    if (a.ok) { onDropped(); return; }
    setErr(sayError(w, a));
  }
  return (
    <ManageDialog open={open} onClose={close} title={w.fhTitle} closeLabel={w.close} className="mg-fh-dlg">
      <ul className="mg-fh">
        {ctx.rows.map((r) => (
          <li key={r.id} className="mg-fh-row">
            <span className="mg-fh-n" dir="auto">{r.name}</span>
            {r.id === ctx.holder ? <span className="mg-fh-you">{w.fhYou}</span>
              : ask === r.id ? (
                <span className="mg-fh-ask">
                  <button type="button" className="mg-sm mg-red" disabled={busy} onClick={() => drop(r.id)}>{w.fhYes}</button>
                  <button type="button" className="mg-sm" onClick={() => setAsk(null)}>{w.fhNo}</button>
                </span>
              ) : <button type="button" className="mg-sm" onClick={() => setAsk(r.id)}>{w.fhDrop}</button>}
          </li>
        ))}
      </ul>
      {err && <p className="tk-brp-err" role="alert">{err}</p>}
      <div className="tk-dlg-acts"><button type="button" className="mg-btn mg-go" onClick={close}>{w.done}</button></div>
    </ManageDialog>
  );
}
