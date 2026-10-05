"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import SignIn from "@/components/account/SignIn";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import {
  addonCap, addonCatRank, addonsCost, fromPrice, hasRideGroups, maxRiders, needsBike, needsWaiver, nextStep, prevStep, promoDiscount,
  regSteps, rentalTotal, riderPrices, RIDE_GROUPS, sessionAddons, typeOptions, validateRiders, waiverKind,
  type AddonItem, type AddonPick, type BikeType, type BookAccount, type BookSession, type Prices, type Promo, type Refusal, type Rider, type RideGroup, type Step,
} from "@/lib/booking";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { rpcResult } from "@/lib/rpc-client";
import { ticketCue, type AddonItem as TicketAddonItem, type TicketRoute, type TicketRow, type TicketSession } from "@/lib/tickets";
import { Ic, KindIc } from "./BookIcons";
import { T, type BookingText } from "./Booking.text";

// Booking a ride on the website (the owner, 2026-10-03: "full booking on the website"), as the
// booking app's own wizard books one (renderRegister): the event, then the Ride step (the date, as
// its session cards), Riders (only where there is a bike), the waiver (every booking: the ride's,
// the swim's, or the activity waiver for anything else), and Review & confirm, then one ticket per rider. Every gate the app has stands
// in front of the same step: sign in, a member's ride, a ride the rider was turned down for, the
// details staff asked for, the profile page. The booking itself is the server's
// (app/api/booking): the price is the database's, never this page's.

export type FlowEvent = { key: string; title: string; meta: string; logo: string; note: string; sessions: BookSession[] };
export type FlowText = { eventTitle: string; noDates: string; membersNote: string; clubLink: string; gather: string; start: string };
export type FlowLinks = {
  /** The community application (Apply for membership). */
  apply: string;
  /** My Bookings on this site. */
  account: string;
  /** The booking app: sign-up there, and the corrections staff asked for. */
  signup: string;
  app: string;
  /** The Club page, "" while staff have it switched off (its address then leads Home), so no link is offered. */
  club: string;
  /** Directions to the circuit. */
  place: string | null;
};
type Props = {
  locale: string;
  events: FlowEvent[];
  prices: Prices;
  acct: BookAccount | null;
  items: AddonItem[];
  start: { ev: string | null; session: string | null };
  text: FlowText;
  links: FlowLinks;
  today: string;
  now: number;
  typeNames: Record<string, string>;
  routes: Record<string, TicketRoute | null>;
};

type Modal =
  | { kind: "signin" } | { kind: "members" } | { kind: "rejected"; s: BookSession } | { kind: "fix" }
  | { kind: "profile"; community: boolean; next: string | null }
  | { kind: "bike"; type: BikeType; slot: number } | { kind: "group"; g: RideGroup } | null;
type Done = { tickets: TicketRow[]; session: TicketSession | null; addonsSaved: boolean };

/** An amount as the booking app writes it (_sar): the riyal sign left of the number, isolated. */
const sar = (n: number) => `⁦⃁ ${Math.round((Number(n) || 0) * 100) / 100}⁩`;
const sarRange = (lo: number, hi: number) => (lo === hi ? sar(lo) : `⁦${sar(lo)} – ${sar(hi)}⁩`);
const Amt = ({ children }: { children: string }) => <bdi className="tk-amt">{children}</bdi>;
const BIKE_IMG: Record<string, { img: string; model: string; easy?: boolean }> = {
  Road: { img: "road", model: "Climax" }, "Road Carbon": { img: "road-carbon", model: "DA54" }, Hybrid: { img: "hybrid", model: "Cross", easy: true },
  Mountain: { img: "mountain", model: "Strom · Monsoon" }, Kids: { img: "kids", model: "Beta" },
};
const GROUP_IMG: Record<RideGroup, string> = { beg: "group-jyc", int: "group-msr" };
const imgOf = (name: string) => `/site/experiences/bikes/${name}.webp`;

export default function BookingFlow({ locale, events, prices, acct, items, start, text, links, today, now, typeNames, routes }: Props) {
  const t = useLocalize(T);
  const tk = useLocalize(TICKET);
  const rtl = isRtl(locale);
  const top = useRef<HTMLDivElement>(null);
  const [evKey, setEvKey] = useState<string | null>(() => (start.ev && events.some((e) => e.key === start.ev) ? start.ev : null));
  const ev = events.find((e) => e.key === evKey) ?? null;
  const all = useMemo(() => events.flatMap((e) => e.sessions), [events]);
  // The add-ons the tickets list on the confirmation, by name and price (TicketCard addonItems).
  const ticketItems = useMemo(() => new Map<string, TicketAddonItem>(items.map((x) => [x.id, { name: x.name, price: x.price }])), [items]);
  // Back from signing in (or a link with ?ev=&session=): the ride picked before, through the gates.
  const resume = useMemo(() => {
    const s = start.session ? all.find((x) => x.id === start.session) : undefined;
    return s && acct ? { s, gate: gateFor(s, acct) } : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the address is read once, as the page drew it
  const [selId, setSelId] = useState<string | null>(() => (resume && !resume.gate ? resume.s.id : null));
  const sel = all.find((s) => s.id === selId) ?? null;
  const [step, setStep] = useState<Step>(1);
  const [riders, setRiders] = useState<Rider[]>([{ name: "", height: acct?.height ? String(acct.height) : "", type: "" }]);
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [capNote, setCapNote] = useState(false);
  const [waiverOk, setWaiverOk] = useState<string | null>(null); // the session the tick was given for
  const [addons, setAddons] = useState<AddonPick[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoIn, setPromoIn] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ key: string; msg: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [already, setAlready] = useState(false);
  const [modal, setModal] = useState<Modal>(() => resume?.gate ?? null);
  const [done, setDone] = useState<Done | null>(null);
  const [acctNow, setAcctNow] = useState<BookAccount | null>(acct);

  const focusTop = useCallback(() => {
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const h = top.current?.querySelector<HTMLElement>("[data-step-title]");
      try { h?.focus({ preventScroll: true }); } catch { /* old browsers */ }
    });
  }, []);
  const go = (n: Step) => { setStep(n); setErr(""); setFieldErr(null); focusTop(); };

  // ── Picking a date, behind the app's gates (selectSessCard) ───────────────────────────────
  const pick = (s: BookSession, a: BookAccount | null = acctNow) => {
    if (s.opens) return;
    if (!a) {
      // Sign in first, then back to this very ride: the address carries it across the reload.
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("ev", evKey ?? ""); u.searchParams.set("session", s.id);
        window.history.replaceState(window.history.state, "", u.toString());
      } catch { /* the ride is picked again by hand */ }
      setModal({ kind: "signin" });
      return;
    }
    const gate = gateFor(s, a);
    if (gate) { setModal(gate); return; }
    if (selId !== s.id) { setAddons([]); setPromo(null); setPromoIn(""); setPromoMsg(""); setAlready(false); setErr(""); }
    setCapNote(false);
    setSelId(s.id);
    // a party carried over from another night may be past this night's allowance
    const cap = maxRiders(s, a.live[s.id] ?? 0);
    setRiders((rs) => (rs.length > cap ? rs.slice(0, cap) : rs).map((r) => ({
      ...r,
      // "my own bike" and carbon are not on every ride; a pick carried over is made again
      type: r.type && typeOptions(s, a.hidden).includes(r.type as BikeType) ? r.type : "",
    })));
  };

  // Escape closes a pop-up.
  useEffect(() => {
    if (!modal) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [modal]);

  const steps = sel ? regSteps(sel) : ([1, 2, 2.5, 3] as Step[]);
  const stepLabel = (v: Step) => (v === 1 ? t.stepRide : v === 2 ? t.stepRiders : v === 2.5 ? waiverCopy(sel).title : t.stepConfirm);
  function waiverCopy(s: BookSession | null) { return t.waiver[s ? waiverKind(s) : "bike"]; }
  const free = !!sel?.free;
  const booked = sel && acctNow ? acctNow.live[sel.id] ?? 0 : 0;
  const cap = sel ? maxRiders(sel, booked) : 3;
  const qty = riders.length;
  const typeName = (ty: string) => typeNames[ty] ?? ty;
  const pillName = (ty: string) => t.types[ty] ?? ty;

  // ── Riders ───────────────────────────────────────────────────────────────────────────────
  const setQty = (d: number) => {
    if (!sel || sel.community) return;
    setCapNote(d > 0 && qty + d > cap);
    const n = Math.max(1, Math.min(cap, qty + d));
    // rider 1 is the account holder: their name is filled in once the party has names to give
    setRiders((rs) => (n > rs.length ? [...rs.map((r, i) => (i === 0 && !r.name && acctNow ? { ...r, name: acctNow.name } : r)), ...Array.from({ length: n - rs.length }, () => ({ name: "", height: "", type: "" as const }))] : rs.slice(0, n)));
    setFieldErr(null);
  };
  const setRider = (i: number, p: Partial<Rider>) => {
    setRiders((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
    if (fieldErr?.key.endsWith(`-${i}`)) setFieldErr(null);
  };
  const setType = (i: number, ty: BikeType) => setRider(i, { type: ty });
  const ridersOk = () => {
    if (!sel) return false;
    const e = validateRiders(sel, riders, group, acctNow?.name ?? "");
    if (!e) return true;
    const key = e.field === "group" ? "group" : `${e.field}-${e.i}`;
    const msg = e.field === "group" ? t.err.group : e.field === "height" ? t.err.height : e.field === "type" ? t.err.pick_type : t.err.name;
    setFieldErr({ key, msg });
    requestAnimationFrame(() => document.getElementById(`bk-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return false;
  };

  // ── Promo (applyPromoCode) ───────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const v = promoIn.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
    if (!v) { setPromo(null); setPromoMsg(""); return; }
    setPromoBusy(true);
    let d: Record<string, unknown> | null = null;
    // Any code the browser asks about itself (metered per visitor); one that belongs to an
    // account is asked again by the server with the rider's own token.
    const r = await rpcResult<Record<string, unknown>>("promo_lookup", { p_code: v, p_id: null, p_token: null });
    if ("data" in r && r.data && typeof r.data === "object") d = r.data;
    if (d && d.ok !== true && d.reason === "not_yours" && acctNow) {
      try {
        const res = await fetch("/api/booking/promo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: v }) });
        d = (await res.json()) as Record<string, unknown>;
      } catch { d = null; }
    }
    setPromoBusy(false);
    if (!d) { setPromo(null); setPromoMsg(t.err.offline); return; }
    if (d.ok !== true) { setPromo(null); setPromoMsg(t.promoMsg[String(d.reason)] ?? t.promoMsg.invalid); return; }
    const appliesTo = typeof d.applies_to === "string" && d.applies_to ? d.applies_to : null;
    if (appliesTo && !riders.some((x) => x.type === appliesTo)) { setPromo(null); setPromoMsg(fill(t.promoTypeOnly, typeName(appliesTo))); return; }
    setPromo({ code: String(d.code ?? v), kind: String(d.kind ?? "pct"), value: Number(d.value) || 0, appliesTo });
    setPromoMsg("");
  };
  const removePromo = () => { setPromo(null); setPromoIn(""); setPromoMsg(""); };

  // ── Add-ons (_setRegAddonQty) ───────────────────────────────────────────────────────────
  const sellable = sel ? sessionAddons(sel, items) : [];
  const addonQty = (id: string) => addons.find((a) => a.id === id)?.qty ?? 0;
  const setAddon = (id: string, delta: number) => {
    const it = items.find((x) => x.id === id);
    const max = addonCap(it);
    setAddons((as) => {
      const a = as.find((x) => x.id === id);
      if (!a) return delta > 0 ? [...as, { id, qty: 1 }] : as;
      const q = Math.min(max, Math.max(0, a.qty + delta));
      return q <= 0 ? as.filter((x) => x.id !== id) : as.map((x) => (x.id === id ? { ...x, qty: q } : x));
    });
  };

  // ── Totals ───────────────────────────────────────────────────────────────────────────────
  const acctLite = acctNow ? { name: acctNow.name, house: acctNow.house } : null;
  const [lo, hi] = sel ? rentalTotal(sel, riders, prices, acctLite) : [0, 0];
  const disc = sel ? promoDiscount(promo, sel, riders, prices, acctLite) : 0;
  const addonTotal = free ? 0 : addonsCost(addons, items);
  const grand = free ? t.free : disc > 0 ? sar(Math.max(0, lo - disc) + addonTotal) : sarRange(lo + addonTotal, hi + addonTotal);
  const rental = free ? t.free : disc > 0 ? sar(Math.max(0, lo - disc)) : sarRange(lo, hi);

  // ── Confirm (submitReg) ──────────────────────────────────────────────────────────────────
  const refused = (e: Refusal | string) => {
    if (e === "signin") { setAcctNow(null); setModal({ kind: "signin" }); return; }
    if (e === "members") { setModal({ kind: "members" }); return; }
    if (e === "rejected" && sel) { setModal({ kind: "rejected", s: sel }); return; }
    if (e === "fix_first") { setModal({ kind: "fix" }); return; }
    if (e === "already" || e === "one_per_session") { setAlready(true); return; }
    if (e === "pick_type") { setRiders((rs) => rs.map((r) => ({ ...r }))); go(2); setFieldErr({ key: "type-0", msg: t.err.pick_type }); return; }
    if (e === "waiver" && sel) { setWaiverOk(null); go(2.5); return; }
    if (e === "cap") { setErr(fill(t.err.cap, String(cap))); return; }
    if (e === "group_cap") { setErr(fill(t.err.group_cap, String(cap))); return; }
    setErr(t.err[e] ?? t.err.generic);
  };
  const submit = async () => {
    if (!sel || busy) return;
    if (!acctNow) { setModal({ kind: "signin" }); return; }
    if (needsBike(sel) && !ridersOk()) { go(2); return; }
    if (needsWaiver(sel) && waiverOk !== sel.id) { go(2.5); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sel.id,
          riders: riders.map((r) => ({ name: r.name.trim(), height: r.height, type: needsBike(sel) ? r.type : "" })),
          group: hasRideGroups(sel) ? group : null,
          addons: free ? [] : addons,
          promo: promo ? { code: promo.code, appliesTo: promo.appliesTo } : null,
          waiver: needsWaiver(sel) ? waiverOk === sel.id : false,
        }),
      });
      const b = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; tickets?: TicketRow[]; session?: TicketSession | null; addonsSaved?: boolean };
      if (b.ok && Array.isArray(b.tickets)) {
        setDone({ tickets: b.tickets, session: b.session ?? null, addonsSaved: b.addonsSaved !== false });
        setAcctNow((a) => (a ? { ...a, live: { ...a.live, [sel.id]: (a.live[sel.id] ?? 0) + b.tickets!.length }, height: a.height ?? (Number(riders[0]?.height) || null) } : a));
        focusTop();
      } else {
        refused(b.error ?? "generic");
      }
    } catch {
      setErr(t.err.offline);
    }
    setBusy(false);
  };
  const another = () => {
    setDone(null); setSelId(null); setStep(1); setAddons([]); setPromo(null); setPromoIn(""); setPromoMsg(""); setWaiverOk(null); setGroup(null); setAlready(false);
    setRiders([{ name: "", height: acctNow?.height ? String(acctNow.height) : "", type: "" }]);
    setEvKey(null);
    focusTop();
  };

  // ── Pieces ───────────────────────────────────────────────────────────────────────────────
  const stepper = () => {
    const ci = Math.max(0, steps.indexOf(step)), n = steps.length;
    return (
      <div className="bk-stepper" role="group" aria-label={fill(t.stepOf, ci + 1, n)}>
        {steps.map((v, i) => {
          const isDone = i < ci, on = i === ci;
          return (
            <div key={v} className="bk-step-wrap">
              <span className="bk-step">
                <span className={`bk-step-c${isDone || on ? " on" : ""}`} aria-current={on ? "step" : undefined}>{isDone ? <Ic name="tick" size={14} /> : i + 1}</span>
                {on && <span className="bk-step-lbl">{stepLabel(v)}</span>}
              </span>
              {i < n - 1 && <span aria-hidden="true" className={`bk-step-ln${isDone ? " on" : ""}`} />}
            </div>
          );
        })}
      </div>
    );
  };
  const head = (title: string, msg: string) => (
    <div className="bk-head">
      {stepper()}
      <h2 className="bk-title" tabIndex={-1} data-step-title>{title}</h2>
      {msg && <p className="bk-sub">{msg}</p>}
    </div>
  );
  const fromLine = (s: BookSession) => {
    const p = fromPrice(s, prices);
    return !p ? null : p.kind === "free" ? t.free : p.kind === "seat" ? fill(t.perSeat, sar(p.n)) : fill(t.from, sar(p.n));
  };
  const card = (s: BookSession) => {
    const named = s.kind !== "jcc";
    const kicker = named ? (
      <span className="sc-kicker">
        <span className="sc-chip has-ic"><KindIc kind={s.kind} />{s.name}</span>
        {s.kind === "workshop" && <span className="sc-partner">{t.partner}</span>}
      </span>
    ) : null;
    if (s.opens) {
      return (
        <div key={s.id} className={`sc-card ev-${s.kind} closed`} aria-disabled="true">
          {kicker}
          <span className="sc-head"><span className="sc-dot" aria-hidden="true" /><span className="sc-date">{s.day}</span><span className="sc-spots closed">{s.opens}</span></span>
          <span className="sc-time"><bdi>{s.time}</bdi></span>
        </div>
      );
    }
    const on = selId === s.id;
    const rej = !!acctNow?.rejected.includes(s.id);
    const low = !s.full && !s.approval && s.left != null && s.left > 0 && s.left <= 3;
    const meta = [s.collect, fromLine(s)].filter((x): x is string => !!x);
    return (
      <button key={s.id} type="button" className={`sc-card ev-${s.kind}${on ? " sel" : ""}${rej ? " rej" : ""}`} aria-pressed={on} onClick={() => pick(s)}>
        {kicker}
        <span className="sc-head">
          <span className={`sc-dot${on ? " on" : ""}`} aria-hidden="true" />
          <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
          <span className={`sc-spots${rej ? " rej" : s.full ? " full" : low ? " low" : ""}`}>{rej ? t.rejCard : s.full ? t.waitlist : low ? fill(s.left === 1 ? t.left1 : t.leftN, s.left!) : t.available}</span>
        </span>
        <span className="sc-time"><bdi>{s.time}</bdi></span>
        {meta.length > 0 && <span className="sc-meta">{meta.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
        {s.kind === "event" && s.description && <span className="sc-desc">{s.description}</span>}
      </button>
    );
  };
  const fErr = (key: string) => (fieldErr?.key === key ? <p className="bk-ferr" role="alert">{fieldErr.msg}</p> : null);
  const promoBox = (slot: string) => (free ? null : (
    <div className="bk-promo">
      <label htmlFor={`bk-promo-${slot}`}>{t.promo}</label>
      <div className="bk-promo-row">
        <input id={`bk-promo-${slot}`} type="text" value={promo ? promo.code : promoIn} disabled={!!promo} autoCapitalize="characters" maxLength={40} dir="ltr"
          onChange={(e) => setPromoIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyPromo(); } }} />
        {promo
          ? <button type="button" className="bk-btn2" onClick={removePromo}>{t.promoRemove}</button>
          : <button type="button" className="bk-btn2" onClick={() => void applyPromo()} disabled={promoBusy}>{t.promoApply}</button>}
      </div>
      {promoMsg && <p className="bk-ferr" role="alert">{promoMsg}</p>}
      {disc > 0 && promo && <p className="bk-disc"><span>{t.discount} ({promo.code})</span><bdi dir="ltr">− <Amt>{sar(disc)}</Amt></bdi></p>}
    </div>
  ));
  const priceBox = () => {
    if (!sel || !needsBike(sel)) return null;
    if (free) return <div className="bk-price"><span className="bk-price-k">{t.pricePerBike}</span><span className="bk-price-v">{t.free}</span></div>;
    const lines = riderPrices(sel, riders, prices, acctLite);
    const word = (l: (typeof lines)[number]) => (l.kind === "free" ? t.free : l.kind === "house" ? t.onTheHouse : l.kind === "sar" ? sar(l.n) : sarRange(l.lo, l.hi));
    const own = riders.every((r) => r.type === "Own");
    return (
      <>
        <div className="bk-price">
          <span className="bk-price-k">{qty > 1 ? lines.map((l, i) => <span key={i}>{i > 0 && " · "}{t.bike} {i + 1}: <Amt>{word(l)}</Amt></span>) : t.pricePerBike}</span>
          <span className="bk-price-v"><Amt>{sarRange(lo, hi)}</Amt></span>
        </div>
        {hi > 0 && <p className="bk-note">{t.payAtBooth}</p>}
        {!own && !sel.approval && <p className="bk-note">{t.fcfs}</p>}
      </>
    );
  };
  const side = () => sel && (
    <aside className="bk-side" aria-label={t.summary}>
      <p className="bk-side-h">{t.summary}</p>
      {sel.kind !== "jcc" && <p className="bk-side-k">{sel.name}</p>}
      <p className="bk-side-when">{sel.near && <><strong>{sel.near}</strong> · </>}{sel.day}</p>
      <p className="bk-side-time"><bdi>{sel.time}</bdi></p>
      {needsBike(sel) && <p className="bk-side-row"><span>{t.numBikes}</span><span>{qty}</span></p>}
      <p className="bk-side-total"><span>{t.total}</span><Amt>{grand}</Amt></p>
      {!free && needsBike(sel) && <p className="bk-note">{t.payAtBooth}</p>}
    </aside>
  );

  // ── The steps ────────────────────────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  if (done) {
    const allWl = done.tickets.length > 0 && done.tickets.every((r) => r.status === "waitlist");
    const appr = !!done.session?.approval || !!sel?.approval;
    const name = sel ? (sel.kind === "jcc" ? tk.venueCircuit : sel.name) : t.ride;
    body = (
      <section aria-labelledby="bk-done-h">
        <div className="bk-head">
          <h2 id="bk-done-h" className="bk-title" tabIndex={-1} data-step-title>{allWl ? t.doneWl : appr ? t.doneReserved : t.doneBooked}</h2>
          {!(appr && allWl) && <p className="bk-sub">{appr ? t.doneReservedSub : allWl ? t.doneWlSub : t.doneBookedSub}</p>}
        </div>
        {!done.addonsSaved && <p className="bk-warn" role="status">{t.addonsNotSaved}</p>}
        <div className="tk-grid bk-tickets">
          {done.tickets.map((r) => (
            <TicketCard key={r.id} locale={locale} today={today} rows={[r]} session={done.session ?? undefined} name={name}
              cue={ticketCue([r], done.session ?? undefined, null)} t={tk} gather={text.gather} start={text.start} typeName={typeName}
              links={{ edit: null, manage: links.account, place: done.session?.approval ? done.session.meetUrl : links.place }} manage={false}
              route={routes[r.sessionId] ?? null} now={now} wallet={{ bookingId: r.id, groupIds: [r.id] }} addonItems={ticketItems} />
          ))}
        </div>
        <div className="bk-foot">
          <a className="bk-btn2" href={links.account}>{t.myBookings}</a>
          <button type="button" className="bk-btn" onClick={another}>{t.another}</button>
        </div>
      </section>
    );
  } else if (!ev) {
    body = (
      <section aria-labelledby="xs-h1">
        <h2 id="xs-h1" className="xs-title" tabIndex={-1} data-step-title>{text.eventTitle}</h2>
        <div className="xs-events">
          {events.map((e) => (
            <button key={e.key} type="button" className={`xs-event ev-${e.key}`} onClick={() => { setEvKey(e.key); setSelId(null); setStep(1); focusTop(); }}>
              {e.logo && <span className="xs-logo"><img src={e.logo} alt="" /></span>}
              <span className="xs-copy"><span className="xs-ev-title">{e.title}</span>{e.meta && <span className="xs-ev-meta">{e.meta}</span>}</span>
            </button>
          ))}
        </div>
      </section>
    );
  } else if (step === 1 || !sel) {
    const join = ev.key === "community" || ev.key === "workshop";
    body = (
      <section>
        <button type="button" className="xs-back" onClick={() => { setEvKey(null); setSelId(null); focusTop(); }}><Ic name="back" flip /> {t.allEvents}</button>
        {head(t.rideTitle, join ? t.rideMsgJoin : t.rideMsg)}
        <p className="xs-picked">{ev.title}</p>
        {ev.note && <p className="bk-evnote">{ev.note}</p>}
        {ev.sessions.length === 0 ? (
          <div className="xs-empty"><p>{text.noDates || t.noRides}</p><p className="bk-sub">{t.noRidesSub}</p></div>
        ) : (
          <div className="sc-list">{ev.sessions.map(card)}</div>
        )}
        {sel?.community && sel.full && <p className="bk-note bk-full"><span className="bk-full-dot" aria-hidden="true" />{t.fullNote}</p>}
        {ev.sessions.some((s) => s.members) && text.membersNote && <p className="xs-note">{text.membersNote}{links.club && <> <a href={links.club}>{text.clubLink}</a></>}</p>}
        {ev.sessions.length > 0 && (
          <div className="bk-foot">
            {!sel && <p className="bk-why" id="bk-why1">{t.pickFirst}</p>}
            <button type="button" className="bk-btn wide" disabled={!sel} aria-describedby={sel ? undefined : "bk-why1"} onClick={() => sel && go(nextStep(sel, 1))}>{t.cont}</button>
          </div>
        )}
      </section>
    );
  } else if (step === 2) {
    const opts = typeOptions(sel, acctNow?.hidden ?? []);
    body = (
      <section>
        {head(t.ridersTitle, t.ridersMsg)}
        <div className="bk-card">
          {!sel.community && (
            <div className="bk-qty-row">
              <span className="bk-qty-k">{t.numBikes}</span>
              <div className="bk-qty-col">
                <div className="bk-qty">
                  <button type="button" onClick={() => setQty(-1)} aria-label={t.qtyDec}><Ic name="minus" size={18} /></button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" onClick={() => setQty(1)} aria-label={t.qtyInc}><Ic name="plus" size={18} /></button>
                </div>
                {capNote && <p className="bk-capnote" role="status">{fill(t.capNote, 3)}</p>}
              </div>
            </div>
          )}
          {riders.map((r, i) => (
            <div key={i} className="bk-rider">
              {qty > 1 && <p className="bk-rider-h"><span className="bk-num">{i + 1}</span>{t.rider}</p>}
              {qty > 1 && (
                <div className="bk-field" id={`bk-name-${i}`}>
                  <label htmlFor={`bk-name-in-${i}`}>{t.riderName}</label>
                  <input id={`bk-name-in-${i}`} type="text" autoComplete="name" autoCapitalize="words" maxLength={60} placeholder={t.riderNamePh}
                    value={r.name} onChange={(e) => setRider(i, { name: e.target.value.replace(/[-‐-―]/g, " ") })} aria-invalid={fieldErr?.key === `name-${i}` || undefined} />
                  {fErr(`name-${i}`)}
                </div>
              )}
              <div className="bk-field" id={`bk-height-${i}`}>
                <label htmlFor={`bk-h-${i}`}>{t.height} <span className="bk-hint">{t.heightHint}</span></label>
                <input id={`bk-h-${i}`} type="number" inputMode="numeric" min={100} max={250} placeholder={t.heightPh} value={r.height}
                  onChange={(e) => setRider(i, { height: e.target.value.slice(0, 3) })} aria-invalid={fieldErr?.key === `height-${i}` || undefined} />
                {fErr(`height-${i}`)}
              </div>
              <div className="bk-field" id={`bk-type-${i}`}>
                <span className="bk-label" id={`bk-type-l-${i}`}>{t.typePref}</span>
                <div className="bk-types" role="group" aria-labelledby={`bk-type-l-${i}`}>
                  {opts.map((ty) => {
                    const on = r.type === ty;
                    const showPrice = !free && sel.seat == null && ty !== "Own";
                    const pill = (
                      <button type="button" className={`bk-pill${on ? " on" : ""}`} aria-pressed={on} onClick={() => setType(i, ty)}>
                        <span className="bk-pill-n">{pillName(ty)}</span>{showPrice && <span className="bk-pill-p"><Amt>{sar(prices[ty] ?? 0)}</Amt></span>}
                      </button>
                    );
                    return BIKE_IMG[ty] ? (
                      <span key={ty} className={`bk-pick${on ? " on" : ""}`}>{pill}
                        <button type="button" className="bk-info" aria-haspopup="dialog" aria-label={fill(t.bikeAria, pillName(ty))} onClick={() => setModal({ kind: "bike", type: ty, slot: i })}><Ic name="info" size={15} /></button>
                      </span>
                    ) : <span key={ty} className={`bk-pick solo${on ? " on" : ""}`}>{pill}</span>;
                  })}
                </div>
                {opts.includes("Hybrid") && <p className="bk-hint2">{t.typeHint}</p>}
                {fErr(`type-${i}`)}
              </div>
              {i === 0 && hasRideGroups(sel) && (
                <div className="bk-field" id="bk-group">
                  <span className="bk-label" id="bk-group-l">{t.groupLabel}</span>
                  <div className="bk-types one" role="group" aria-labelledby="bk-group-l">
                    {RIDE_GROUPS.map((g) => (
                      <span key={g} className={`bk-pick${group === g ? " on" : ""}`}>
                        <button type="button" className={`bk-pill${group === g ? " on" : ""}`} aria-pressed={group === g} onClick={() => { setGroup(g); if (fieldErr?.key === "group") setFieldErr(null); }}>
                          <span className="bk-pill-n">{t.groups[g]}</span><span className="bk-pill-p">{fill(t.km, sel.km[g])}</span>
                        </button>
                        <button type="button" className="bk-info" aria-haspopup="dialog" aria-label={fill(t.groupAria, t.groups[g])} onClick={() => setModal({ kind: "group", g })}><Ic name="info" size={15} /></button>
                      </span>
                    ))}
                  </div>
                  {fErr("group")}
                </div>
              )}
            </div>
          ))}
          <div className="bk-pricewrap">{priceBox()}</div>
          {promoBox("riders")}
        </div>
        <div className="bk-foot">
          <button type="button" className="bk-btn2" onClick={() => go(prevStep(sel, 2))}>{t.back}</button>
          <button type="button" className="bk-btn grow" onClick={() => { if (ridersOk()) go(nextStep(sel, 2)); }}>{t.toReview}</button>
        </div>
      </section>
    );
  } else if (step === 2.5) {
    const w = waiverCopy(sel), ok = waiverOk === sel.id;
    body = (
      <section>
        {head(w.title, t.waiverSub)}
        <div className="bk-card">
          <div className="bk-waiver" tabIndex={0} role="region" aria-label={w.title}>{w.body}</div>
          <label className={`bk-agree${ok ? " on" : ""}`}>
            <input type="checkbox" checked={ok} onChange={(e) => setWaiverOk(e.target.checked ? sel.id : null)} />
            <span>{w.agree}</span>
          </label>
        </div>
        <div className="bk-foot">
          {!ok && <p className="bk-why" id="bk-why2">{t.tickFirst}</p>}
          <button type="button" className="bk-btn2" onClick={() => go(prevStep(sel, 2.5))}>{t.back}</button>
          <button type="button" className="bk-btn grow" disabled={!ok} aria-describedby={ok ? undefined : "bk-why2"} onClick={() => go(nextStep(sel, 2.5))}>{t.cont}</button>
        </div>
      </section>
    );
  } else {
    const lines = riderPrices(sel, riders, prices, acctLite);
    const picked = addons.map((a) => ({ a, it: items.find((x) => x.id === a.id) })).filter((x) => !!x.it);
    const cats = [...new Set(sellable.map((x) => x.category || "Other"))].sort((a, b) => addonCatRank(a, items) - addonCatRank(b, items) || (t.cats[a] ?? a).localeCompare(t.cats[b] ?? b));
    const row = (it: AddonItem) => {
      const q = addonQty(it.id), on = q > 0, c = addonCap(it);
      return (
        <div key={it.id} className={`bk-addon${on ? " on" : ""}`}>
          <button type="button" className={`bk-check${on ? " on" : ""}`} aria-pressed={on} aria-label={it.name} onClick={() => setAddon(it.id, on ? -q : 1)}>{on && <Ic name="tick" size={14} />}</button>
          {it.photo && <img className="bk-addon-img" src={it.photo} alt="" loading="lazy" decoding="async" />}
          <div className="bk-addon-txt"><span className="bk-addon-n">{it.name}</span>{it.brand && <span className="bk-addon-b"> · {it.brand}</span>}</div>
          {on && c > 1 && (
            <span className="bk-addon-q">
              <button type="button" onClick={() => setAddon(it.id, -1)} aria-label={`${t.qtyDec}: ${it.name}`}><Ic name="minus" size={14} /></button>
              <span>{q}</span>
              <button type="button" onClick={() => setAddon(it.id, 1)} disabled={q >= c} aria-label={`${t.qtyInc}: ${it.name}`}><Ic name="plus" size={14} /></button>
            </span>
          )}
          <span className="bk-addon-p">{it.price > 0 ? <Amt>{sar(it.price)}</Amt> : t.free}</span>
        </div>
      );
    };
    const isAlready = already || booked > 0;
    body = (
      <section>
        {head(t.reviewTitle, t.reviewMsg)}
        {sellable.length > 0 && (
          <div className="bk-card">
            <h3 className="bk-h3">{t.addonsTitle}</h3>
            <p className="bk-sub sm">{t.addonsSub}</p>
            {cats.length > 1 ? cats.map((c) => (
              <div key={c} className="bk-addon-cat"><p className="bk-cat">{t.cats[c] ?? c}</p>{sellable.filter((x) => (x.category || "Other") === c).map(row)}</div>
            )) : sellable.map(row)}
          </div>
        )}
        <div className="bk-card">
          <div className="bk-rv-head">
            <div>
              <p className="bk-k">{t.rideLabel}</p>
              <p className="bk-rv-date">{sel.kind !== "jcc" && <>{sel.name}<br /></>}{sel.day}</p>
              <p className="bk-rv-time"><bdi>{sel.time}</bdi></p>
            </div>
            {acctNow && <div className="bk-rv-by"><p className="bk-k">{t.bookedBy}</p><p className="bk-rv-name">{acctNow.name}</p></div>}
          </div>
          <p className="bk-k bk-sec">{needsBike(sel) ? t.riders : t.participants} ({qty})</p>
          {riders.map((r, i) => {
            const l = lines[i];
            return (
              <div key={i} className="bk-rv-rider">
                <span className="bk-num">{i + 1}</span>
                <div className="bk-rv-mid">
                  <p className="bk-rv-name">{(r.name.trim() || (i === 0 ? acctNow?.name : "")) || `${t.rider} ${i + 1}`}</p>
                  {needsBike(sel) && (
                    <p className="bk-rv-meta">
                      {r.type && <span className={`tk-type t-${r.type.toLowerCase().replace(/\s+/g, "")}`}>{typeName(r.type)}</span>}
                      {r.height && <bdi>{r.height} {t.cm}</bdi>}
                      {i === 0 && hasRideGroups(sel) && group && <span>{t.groups[group]} · <bdi>{fill(t.km, sel.km[group])}</bdi></span>}
                    </p>
                  )}
                </div>
                <span className="bk-rv-price">{l.kind === "free" ? t.free : l.kind === "house" ? t.onTheHouse : <Amt>{l.kind === "sar" ? sar(l.n) : sarRange(l.lo, l.hi)}</Amt>}</span>
              </div>
            );
          })}
          {picked.length > 0 && (
            <>
              <p className="bk-k bk-sec">{t.addons} ({picked.reduce((s2, x) => s2 + x.a.qty, 0)})</p>
              {picked.map(({ a, it }) => (
                <div key={a.id} className="bk-rv-rider">
                  {it!.photo ? <img className="bk-addon-img sm" src={it!.photo} alt="" loading="lazy" decoding="async" /> : <span className="bk-num"><Ic name="plus" size={12} /></span>}
                  <div className="bk-rv-mid"><p className="bk-rv-name">{it!.name}{a.qty > 1 && <span className="bk-rv-q"> ×{a.qty}</span>}</p>{it!.brand && <p className="bk-rv-meta">{it!.brand}</p>}</div>
                  <span className="bk-rv-price"><Amt>{sar((it!.price || 0) * a.qty)}</Amt></span>
                </div>
              ))}
            </>
          )}
          {promoBox("review")}
        </div>
        <div className="bk-card">
          {addonTotal > 0 && (
            <>
              <p className="bk-sum-row"><span>{t.rental}</span><Amt>{rental}</Amt></p>
              <p className="bk-sum-row"><span>{t.addons}</span><Amt>{sar(addonTotal)}</Amt></p>
            </>
          )}
          <p className={`bk-sum-tot${addonTotal > 0 ? " sep" : ""}`}><span>{t.total}</span><Amt>{grand}</Amt></p>
          {!free && needsBike(sel) && hi + addonTotal > 0 && <p className="bk-note">{t.payAtBooth}</p>}
        </div>
        {isAlready ? (
          <div className="bk-already" role="status">
            <p className="bk-already-t">{t.already}</p>
            <p className="bk-sub sm">{t.alreadySub}</p>
            <a className="bk-btn wide" href={links.account}>{t.myBookings}</a>
          </div>
        ) : (
          <div className="bk-foot">
            {err && <p className="bk-err" role="alert">{err}</p>}
            <button type="button" className="bk-btn2" disabled={busy} onClick={() => go(prevStep(sel, 3))}>{t.back}</button>
            <button type="button" className="bk-btn grow" disabled={busy} aria-busy={busy} onClick={() => void submit()}>{busy ? <span className="bk-spin" aria-hidden="true" /> : null}{t.confirm}</button>
          </div>
        )}
      </section>
    );
  }

  const wide = !done && !!ev && !!sel && step !== 1;
  return (
    <div className={`xs bk${rtl ? " rtl" : ""}`} ref={top}>
      {wide ? <div className="bk-layout"><div className="bk-main">{body}</div>{side()}</div> : body}
      {modal && <Pop modal={modal} close={() => setModal(null)} t={t} links={links} locale={locale} sel={sel} acct={acctNow}
        onPickBike={(slot, ty) => { setType(slot, ty); setModal(null); }}
        onPickGroup={(g) => { setGroup(g); if (fieldErr?.key === "group") setFieldErr(null); setModal(null); }}
        onProfileSaved={(next) => {
          const a = acctNow ? { ...acctNow, profileGate: "none" as const } : null;
          setAcctNow(a); setModal(null);
          const s = next ? all.find((x) => x.id === next) : null;
          if (s && a) pick(s, a);
        }} pillName={pillName} />}
    </div>
  );
}

/** The gate in front of a date for a signed-in rider (selectSessCard): the details staff asked
 *  for, the profile page, a ride they were turned down for, a members' ride. Null: book on. */
function gateFor(s: BookSession, a: BookAccount): Modal {
  if (a.asks.length) return { kind: "fix" };
  if (a.profileGate !== "none") return { kind: "profile", community: a.profileGate === "community", next: s.id };
  if (a.rejected.includes(s.id)) return { kind: "rejected", s };
  if (s.members && !a.member) return { kind: "members" };
  return null;
}

// ── The pop-ups: centred on every screen (never a bottom sheet) ─────────────────────────────────
type PopProps = {
  modal: NonNullable<Modal>; close: () => void; t: BookingText; links: FlowLinks; locale: string; sel: BookSession | null; acct: BookAccount | null;
  onPickBike: (slot: number, ty: BikeType) => void; onPickGroup: (g: RideGroup) => void; onProfileSaved: (next: string | null) => void; pillName: (ty: string) => string;
};
function Pop({ modal, close, t, links, locale, sel, acct, onPickBike, onPickGroup, onProfileSaved, pillName }: PopProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("button, input, select, a[href]")?.focus());
    return () => { try { from?.focus(); } catch { /* gone */ } };
  }, []);
  const x = <button type="button" className="bk-x" onClick={close} aria-label={t.close}><Ic name="close" size={18} /></button>;
  let inner: React.ReactNode = null;
  let label = "bk-pop-t";
  if (modal.kind === "signin") {
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.signTitle}</h2>{x}</div>
        <p className="bk-sub sm">{t.signSub}</p>
        <SignIn locale={locale} />
        <p className="bk-pop-alt"><a href={links.signup}>{t.signCreate}</a></p>
      </div>
    );
  } else if (modal.kind === "members") {
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><span className="bk-lock"><Ic name="lock" size={16} /></span><h2 id={label} className="bk-pop-title">{t.membersTitle}</h2>{x}</div>
        <p className="bk-pop-msg">{t.membersMsg}</p>
        <a className="bk-btn wide" href={links.apply}>{t.membersApply}</a>
      </div>
    );
  } else if (modal.kind === "rejected") {
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><div><h2 id={label} className="bk-pop-title">{t.rejTitle}</h2>{modal.s.kind !== "jcc" && <p className={`bk-pop-kind ev-${modal.s.kind}`}>{modal.s.name}</p>}</div>{x}</div>
        <p className="bk-pop-msg">{t.rejMsg}</p>
        <p className="bk-pop-msg">{t.rejNext}</p>
        <div className="bk-pop-foot"><button type="button" className="bk-btn" onClick={close}>{t.rejOk}</button></div>
      </div>
    );
  } else if (modal.kind === "fix") {
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.fixTitle}</h2>{x}</div>
        <p className="bk-pop-msg">{t.fixMsg}</p>
        {acct && acct.asks.length > 0 && <ul className="bk-fixlist">{acct.asks.map((k) => <li key={k}>{t.fixFields[k] ?? k}</li>)}</ul>}
        <a className="bk-btn wide" href={links.app}>{t.fixGo}</a>
      </div>
    );
  } else if (modal.kind === "profile") {
    inner = <ProfileForm t={t} locale={locale} acct={acct} community={modal.community} onSaved={() => onProfileSaved(modal.next)} close={close} />;
    label = "bk-pg-t";
  } else if (modal.kind === "bike") {
    const info = BIKE_IMG[modal.type], b = t.bikeInfo[modal.type];
    inner = (
      <>
        <div className="bk-sheet-media"><img src={imgOf(info.img)} alt={`Alvas · ${pillName(modal.type)}`} decoding="async" /></div>
        <div className="bk-pop-body">
          <div className="bk-pop-head"><div><p className="bk-kick">{info.model ? `Alvas ${info.model}` : t.bikeFleet}</p><h2 id={label} className="bk-pop-title">{pillName(modal.type)}</h2></div>{x}</div>
          <span className={`bk-level${info.easy ? " easy" : ""}`}>{b?.level}</span>
          <p className="bk-pop-msg">{b?.brief}</p>
          <p className="bk-pop-for"><b>{t.bestFor}</b> {b?.good}</p>
          <div className="bk-pop-foot">
            <button type="button" className="bk-btn2" onClick={close}>{t.close}</button>
            <button type="button" className="bk-btn" onClick={() => onPickBike(modal.slot, modal.type)}>{t.chooseBike}</button>
          </div>
        </div>
      </>
    );
  } else if (modal.kind === "group") {
    const g = modal.g;
    inner = (
      <>
        <div className="bk-sheet-media"><img src={imgOf(GROUP_IMG[g])} alt={t.groupPlace[g]} decoding="async" /></div>
        <div className="bk-pop-body">
          <div className="bk-pop-head"><div><p className="bk-kick">{t.turnPoint} · {t.groupPlace[g]}</p><h2 id={label} className="bk-pop-title">{t.groups[g]}</h2></div>{x}</div>
          <span className={`bk-level${g === "beg" ? " easy" : ""}`}>{fill(t.km, sel?.km[g] ?? (g === "beg" ? 20 : 40))}</span>
          <p className="bk-pop-msg">{t.groupBrief[g]}</p>
          <div className="bk-pop-foot">
            <button type="button" className="bk-btn2" onClick={close}>{t.close}</button>
            <button type="button" className="bk-btn" onClick={() => onPickGroup(g)}>{t.chooseGroup}</button>
          </div>
        </div>
      </>
    );
  }
  return (
    <div className="bk-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={box} className={`bk-pop${modal.kind === "bike" || modal.kind === "group" ? " sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={label}>{inner}</div>
    </div>
  );
}

// The profile page (_profileGate): the birth date as three pickers and the nationality, saved
// before the booking goes on. A community member's two go where the server asked for them.
function ProfileForm({ t, locale, acct, community, onSaved, close }: { t: BookingText; locale: string; acct: BookAccount | null; community: boolean; onSaved: () => void; close: () => void }) {
  const init = /^\d{4}-\d{2}-\d{2}$/.test(acct?.birth ?? "") ? acct!.birth : "";
  const [bd, setBd] = useState({ y: init.slice(0, 4), m: init.slice(5, 7), d: init.slice(8, 10) });
  const [nat, setNat] = useState(acct?.nationality ?? "");
  const [nats, setNats] = useState<NatOption[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [errs, setErrs] = useState<{ b?: string; n?: string; net?: boolean }>({});
  const [saving, setSaving] = useState(false);
  // the names come from the browser's Intl (lib/nationality.ts), drawn once the pop-up is up
  useEffect(() => { requestAnimationFrame(() => { setNats(natOptions(locale)); setMonths(monthNames(locale)); }); }, [locale]);
  const year = new Date().getFullYear();
  const years = Array.from({ length: 96 }, (_, i) => String(year - 5 - i));
  const dim = bd.y && bd.m ? new Date(Number(bd.y), Number(bd.m), 0).getDate() : 31;
  const birth = bd.y && bd.m && bd.d ? `${bd.y}-${bd.m}-${bd.d}` : "";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = { b: birth ? undefined : t.pgErrBirth, n: nat ? undefined : t.pgErrNat };
    setErrs(n);
    if (n.b || n.n) return;
    setSaving(true);
    try {
      const r = await fetch("/api/booking/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ birth, nationality: nat, community }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { onSaved(); return; }
      setErrs(b.error === "birth" ? { b: t.pgErrBirth } : b.error === "nationality" ? { n: t.pgErrNat } : { net: true });
    } catch { setErrs({ net: true }); }
    setSaving(false);
  };
  return (
    <form className="bk-pop-body" onSubmit={save} noValidate>
      <div className="bk-pop-head"><div><p className="bk-kick">{community ? t.pgCommKicker : t.pgKicker}</p><h2 id="bk-pg-t" className="bk-pop-title">{community ? t.pgCommTitle : t.pgTitle}</h2></div>
        <button type="button" className="bk-x" onClick={close} aria-label={t.close}><Ic name="close" size={18} /></button></div>
      <p className="bk-sub sm">{community ? t.pgCommSub : t.pgSub}</p>
      <div className="bk-field">
        <span className="bk-label" id="bk-pg-b">{t.birth}</span>
        <div className="bk-dob" role="group" aria-labelledby="bk-pg-b">
          <select aria-label={t.day} value={bd.d} disabled={saving} onChange={(e) => setBd({ ...bd, d: e.target.value })}>
            <option value="">{t.day}</option>
            {Array.from({ length: dim }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
          </select>
          <select aria-label={t.month} value={bd.m} disabled={saving} onChange={(e) => setBd({ ...bd, m: e.target.value, d: bd.d && Number(bd.d) > (bd.y && e.target.value ? new Date(Number(bd.y), Number(e.target.value), 0).getDate() : 31) ? "" : bd.d })}>
            <option value="">{t.month}</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m, i) => <option key={m} value={m}>{months[i] ?? m}</option>)}
          </select>
          <select aria-label={t.year} value={bd.y} disabled={saving} onChange={(e) => setBd({ ...bd, y: e.target.value })}>
            <option value="">{t.year}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {errs.b && <p className="bk-ferr" role="alert">{errs.b}</p>}
      </div>
      <div className="bk-field">
        <label htmlFor="bk-pg-nat">{t.nationality}</label>
        <select id="bk-pg-nat" value={nat} disabled={saving} onChange={(e) => setNat(e.target.value)}>
          <option value="">{t.chooseCountry}</option>
          {nat && !nats.some((o) => o.value === nat) && <option value={nat}>{nat}</option>}
          {nats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {errs.n && <p className="bk-ferr" role="alert">{errs.n}</p>}
      </div>
      <p className="bk-note">{t.pgNote}</p>
      {errs.net && <p className="bk-err" role="alert">{t.pgErrNet}</p>}
      <button type="submit" className="bk-btn wide" disabled={saving || !birth || !nat}>{saving ? t.pgSaving : t.pgSave}</button>
    </form>
  );
}
