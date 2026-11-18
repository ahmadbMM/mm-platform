"use client";

import { useState } from "react";
import type { Fulfil } from "@/lib/store-delivery";
import { dayLabel } from "@/lib/store-checkout";
import { clock, openDays, pickOpen, HANDOVER_KEY, type Handover, type HandoverPick } from "@/lib/sx-b3-handover";
import { companyDigits, companyKey, companyProblems, COMPANY_FIELDS, type Company, type Pin, type SxDraft, type SxSettings } from "@/lib/sx-b3";
import type { SxText } from "./sx-B3.text";
import type { StoreText } from "./Store.text";
import { Field } from "./CheckoutFields";
import { Pills } from "./CheckoutBits";
import Modal from "./Modal";
import PinMap from "./PinMap";
import { SxIcon } from "./sx-b3-icons";

// Checkout's parts for the build of 2026-11-18 (builder B3), drawn inside CheckoutForm's steps so its own code stays as
// it was: buying for a company (N34, the Review step), the Jeddah delivery's map pin (N07, the Address step), the
// handover slot of "Collect fully built" (N13) and handing small things over at a booked session (N15, both in the
// Delivery step), and "I'm still learning" with a bike (N17, Review). Each shows only while staff have it on and the
// database has it (lib/sx-b3.ts sxSettings: a setting the migration adds).

/** What the checkout page hands checkout for these (server-read). */
export type SxCheckout = {
  settings: SxSettings;
  /** learn-to-ride is on and taking sign-ups (Experiences > Learn to ride) */
  learnOpen: boolean;
  /** the account's own booked sessions a small order can be handed over at (N15), named */
  sessions: { entry: string; date: string; label: string }[];
  handover: Handover;
  quote: { token: string; no: number; fulfil: Fulfil | null; slot: { day: string; time: string } | null; handover: HandoverPick | null; name: string; phone: string } | null;
  reserve: { narrow: number; wide: number };
};

type SetX = (patch: Partial<SxDraft>) => void;

// ── N34 ─────────────────────────────────────────────────────────────────────────────────────────────

export function CompanyBox({ d, set, errs, setErr, x, t, requiredLabel }: {
  d: SxDraft; set: SetX; errs: Record<string, string>; setErr: (f: string, msg: string) => void; x: SxText; t: StoreText; requiredLabel: string;
}) {
  const c = d.company;
  const put = (k: keyof Company, v: string) => { set({ company: { ...c, [k]: companyDigits(k, v) } }); setErr(fieldOf(k), ""); };
  // a field left: its own check (an empty one is said only once it was flagged, as the store's fields do)
  const check = (f: (typeof COMPANY_FIELDS)[number]) => {
    const k = companyKey(f);
    if (!k || (!c[k].trim() && !errs[f])) return;
    setErr(f, companyProblems(c).includes(f) ? x.checks[f] : "");
  };
  const field = (f: (typeof COMPANY_FIELDS)[number], label: string, opts: { optional?: boolean; num?: boolean; max: number; auto?: string } = { max: 80 }) => {
    const k = companyKey(f) as keyof Company;
    return (
      <Field id={`st-${f}`} label={label} required={!opts.optional} requiredLabel={requiredLabel} optional={opts.optional ? t.optional : undefined}
        value={c[k]} onValue={(v) => put(k, v)} onBlur={() => check(f)} error={errs[f]} maxLength={opts.max} autoComplete={opts.auto}
        {...(opts.num ? { inputMode: "numeric" as const, dir: "ltr" } : {})} />
    );
  };
  return (
    <div className="sx3-co">
      <label className={`bk-agree${d.buying ? " on" : ""}`}>
        <input type="checkbox" checked={d.buying} onChange={(e) => set({ buying: e.target.checked })} />
        <span><SxIcon name="building" size={18} className="sx3-ic" />{x.company}</span>
      </label>
      {d.buying && (
        <div className="sx3-co-fields">
          {field("coName", x.coName, { max: 100, auto: "organization" })}
          <div className="sx3-row2">
            {field("coVat", x.coVat, { num: true, max: 15 })}
            {field("coCr", x.coCr, { optional: true, num: true, max: 10 })}
          </div>
          <div className="sx3-row2">
            {field("coBuilding", x.coBuilding, { num: true, max: 4 })}
            {field("coStreet", x.coStreet, { max: 80 })}
          </div>
          <div className="st-row3">
            {field("coDistrict", x.coDistrict, { max: 60 })}
            {field("coCity", x.coCity, { max: 40 })}
            {field("coPostal", x.coPostal, { num: true, max: 5, auto: "postal-code" })}
          </div>
        </div>
      )}
    </div>
  );
}
const fieldOf = (k: keyof Company) => `co${k[0].toUpperCase()}${k.slice(1)}`;

// ── N07 ─────────────────────────────────────────────────────────────────────────────────────────────

export function PinBox({ pin, set, err, x, t }: { pin: Pin | null; set: SetX; err?: string; x: SxText; t: StoreText }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sx3-pin" id="st-pin">
      {pin ? (
        <div className="sx3-pin-on">
          <SxIcon name="pin" size={20} className="sx3-ic" />
          <b>{x.pinned}</b>
          <button type="button" className="st-co-edit" onClick={() => setOpen(true)}>{x.change}</button>
          <button type="button" className="sx3-icbtn" onClick={() => set({ pin: null })} aria-label={x.removeOf(x.pinned)} title={t.remove}><SxIcon name="trash" size={20} /></button>
        </div>
      ) : (
        <button type="button" className="bk-btn2 sx3-pin-go" onClick={() => setOpen(true)}><SxIcon name="pin" size={18} />{x.pinIt}</button>
      )}
      {err && <p className="bk-ferr" role="alert">{err}</p>}
      {open && (
        <Modal title={x.pinTitle} onClose={() => setOpen(false)} closeLabel={t.close}>
          <PinMap start={pin} x={x} onUse={(p) => { set({ pin: p }); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

// ── N13 ─────────────────────────────────────────────────────────────────────────────────────────────

/** The handover slot (optional: no slot is any time in opening hours). The days with a free slot, then that day's free
 *  times. A pick is kept for the buy box too (sessionStorage mm-handover, the contract in SX/results/B3.md). */
export function HandoverBox({ h, pick, set, err, x, intl }: { h: Handover; pick: HandoverPick | null; set: SetX; err?: string; x: SxText; intl: string }) {
  const days = openDays(h);
  const [day, setDay] = useState<string>(() => (pick && days.some((d) => d.day === pick.day) ? pick.day : "any"));
  if (!days.length) return null;
  const keep = (p: HandoverPick | null) => {
    set({ handover: p });
    try { if (p) window.sessionStorage.setItem(HANDOVER_KEY, JSON.stringify(p)); else window.sessionStorage.removeItem(HANDOVER_KEY); } catch { /* not kept */ }
  };
  const live = pickOpen(h, pick);
  const slots = days.find((d) => d.day === day)?.slots.filter((s) => s.open) ?? [];
  return (
    <div className="st-co-slot sx3-ho" id="st-handover">
      <Pills name="sx3-ho-day" label={x.handoverDay} value={day}
        items={[{ value: "any", label: x.anyTime }, ...days.map((d) => ({ value: d.day, label: dayLabel(d.day, intl) }))]}
        onPick={(v) => { setDay(v); if (v === "any" || v !== pick?.day) keep(null); }} />
      {day !== "any" && slots.length > 0 && (
        <Pills name="sx3-ho-time" label={x.handoverTime} value={live && pick?.day === day ? pick.at : null}
          items={slots.map((s) => ({ value: s.at, label: clock(s.at, intl) }))}
          onPick={(at) => keep({ day, at })} error={err} />
      )}
      {day === "any" && err && <p className="bk-ferr" role="alert">{err}</p>}
    </div>
  );
}

/** "Handover Sat 21 Nov · 4:00 PM" for the step's summary; "" with none. */
export function handoverText(h: Handover, pick: HandoverPick | null, x: SxText, intl: string): string {
  const s = pickOpen(h, pick);
  return s && pick ? `${x.handover} ${dayLabel(pick.day, intl)} · ${clock(s.at, intl)}` : "";
}

// ── N15 ─────────────────────────────────────────────────────────────────────────────────────────────

/** The sessions to choose from once "At my next session" is the way: the soonest is picked to start with. */
export function SessionPick({ sessions, value, set, err, x }: { sessions: SxCheckout["sessions"]; value: string | null; set: SetX; err?: string; x: SxText }) {
  if (sessions.length < 2) return err ? <p className="bk-ferr" role="alert">{err}</p> : null;
  return (
    <div className="st-co-slot" id="st-session">
      <Pills name="sx3-session" label={x.session} value={value} items={sessions.map((s) => ({ value: s.entry, label: s.label }))} onPick={(v) => set({ session: v })} error={err} />
    </div>
  );
}

// ── N17 ─────────────────────────────────────────────────────────────────────────────────────────────

export function LearningTick({ on, set, x }: { on: boolean; set: SetX; x: SxText }) {
  return (
    <label className={`bk-agree${on ? " on" : ""}`}>
      <input type="checkbox" checked={on} onChange={(e) => set({ learning: e.target.checked })} />
      <span>{x.learning}</span>
    </label>
  );
}
