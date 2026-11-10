"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import SignIn from "@/components/account/SignIn";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import {
  JCC_ACCOUNT_CAP, addonCap, addonCatRank, addonsCost, asciiDigits, codeOne, eventSteps, fromPrice, genderRefused, hasRideGroups, kidsHeight, maxRiders, needsBike, needsWaiver, nextStep, pgDue, prevStep, promoDiscount,
  refCodeKind, refCodeSessOk, regSteps, rentalTotal, riderPrices, RIDE_GROUPS, sessionAddons, typeOptions, validateRiders, waiverKind,
  type AddonItem, type AddonPick, type BikeType, type BookAccount, type BookSession, type PgField, type Prices, type Promo, type Refusal, type Rider, type RiderError, type RideGroup, type Step,
} from "@/lib/booking";
import type { Block } from "@/lib/journal";
import { funnel, funnelDone } from "@/lib/funnel";
import { radioKey, tabStop } from "@/lib/radio-keys";
import { riyalNum } from "@/components/booking/Sar";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { rpcResult } from "@/lib/rpc-client";
import { genderChip } from "@/lib/session-gender";
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
// A session for men only or women only (the owner, 2026-10-27; lib/session-gender.ts) wears its chip on its card,
// the summary and the review (a pool session open to both says Mixed), and an account of the other gender, or with
// none on file, is told "This session is for women only." when it picks the date, before anything is sent; the
// server checks it again, and the database's GENDER_ONLY reads the same.

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
  /** Our Instagram, where new dates go up first (the empty list's link); "" or absent for none. */
  instagram?: string;
};
type Props = {
  locale: string;
  events: FlowEvent[];
  prices: Prices;
  /** Each type's highest fare (ride_prices max_price, lib/biz.ts faresOf); a type quoted above its fare reads as a range. */
  maxPrices?: Prices;
  /** Riders per account on a circuit night: the booking app's Settings > Business (jcc_account_cap). */
  jccCap?: number;
  acct: BookAccount | null;
  items: AddonItem[];
  start: { ev: string | null; session: string | null };
  text: FlowText;
  links: FlowLinks;
  today: string;
  now: number;
  typeNames: Record<string, string>;
  routes: Record<string, TicketRoute | null>;
  /** Paying online (2026-11-10): staff's pay.bookings, the hold, the refund rule, and the account's wallet balance. */
  pay?: { mode: "required" | "optional" | "off"; holdMinutes: number; refundDays: number; wallet: number; terms?: CancelTerms | null };
};

/** The Terms' refunds clause as staff keep it (in English or Arabic), for the review's Cancellation terms pop-up. */
export type CancelTerms = { lang: string; title: string; blocks: Block[] };

type Modal =
  | { kind: "signin" } | { kind: "members" } | { kind: "rejected"; s: BookSession } | { kind: "fix" }
  | { kind: "gone" } | { kind: "terms" }
  | { kind: "gender"; s: BookSession; refusal: Refusal }
  | { kind: "profile"; community: boolean; ask: PgField[]; next: string | null }
  | { kind: "bike"; type: BikeType; slot: number } | { kind: "group"; g: RideGroup } | null;
/** `booked`: the rows the database stored (the route's), so a ticket my_bookings did not return in time is still counted. */
type Done = { tickets: TicketRow[]; booked: { id: string; status: string }[]; session: TicketSession | null; addonsSaved: boolean };

/** An amount as the booking app writes it (_sar): the riyal sign left of the number, isolated left to right, two decimals
 *  only when it has a fraction (57.50); a range "lo – hi" when a type's fare may rise. The sign is drawn for the eye alone
 *  and a screen reader reads `word` ("SAR", "ريال"; the research's row 18, components/booking/Sar.tsx). */
function Money({ n, hi, word }: { n: number; hi?: number; word: string }) {
  const one = (v: number) => <><span aria-hidden="true">{"\u20C1"}</span><span className="mm-sr">{word}</span> {riyalNum(v)}</>;
  return <bdi className="tk-amt" dir="ltr">{one(n)}{hi != null && hi !== n && <> – {one(hi)}</>}</bdi>;
}
/** A sentence with an amount (or any piece) where its {0} is: "Book and pay {0}". */
const fillNode = (tpl: string, node: React.ReactNode) => {
  const [a, b = ""] = tpl.split("{0}");
  return <>{a}{node}{b}</>;
};
const BIKE_IMG: Record<string, { img: string; model: string; easy?: boolean }> = {
  Road: { img: "road", model: "Climax" }, "Road Carbon": { img: "road-carbon", model: "DA54" }, Hybrid: { img: "hybrid", model: "Cross", easy: true },
  Mountain: { img: "mountain", model: "Strom · Monsoon" }, Kids: { img: "kids", model: "Beta" },
};
const GROUP_IMG: Record<RideGroup, string> = { beg: "group-jyc", int: "group-msr" };
const imgOf = (name: string) => `/site/experiences/bikes/${name}.webp`;

export default function BookingFlow({ locale, events, prices, maxPrices, jccCap = JCC_ACCOUNT_CAP, acct, items, start, text, links, today, now, typeNames, routes, pay }: Props) {
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
    // a Saturday ride booked at micromobility.sa/saturday is never picked here, even from an old address
    return s && acct && !s.satLink ? { s, gate: gateFor(s, acct) } : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the address is read once, as the page drew it
  const [selId, setSelId] = useState<string | null>(() => (resume && !resume.gate ? resume.s.id : null));
  const sel = all.find((s) => s.id === selId) ?? null;
  const [step, setStep] = useState<Step>(1);
  const [riders, setRiders] = useState<Rider[]>([{ name: "", height: acct?.height ? String(acct.height) : "", type: "" }]);
  const [group, setGroup] = useState<RideGroup | null>(null);
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
  const [payNow, setPayNow] = useState(true);
  const [walletOn, setWalletOn] = useState(false); // the wallet is the rider's choice, off by default
  // The promo code behind a link that opens it in place (the research's row 10), open while a code is in it.
  const [promoOpen, setPromoOpen] = useState(false);
  // A "Change" on the review (row 8): the step it opened goes straight back to the review once all is still in order.
  const [ret, setRet] = useState(false);
  // Sessions whose last place went to another device while this rider was booking (PLACE_GONE): read as full from then on.
  const [gone, setGone] = useState<string[]>([]);
  const isFull = (s: BookSession) => s.full || gone.includes(s.id);
  // the event's kind, for the funnel (lib/funnel.ts)
  const fk = () => evKey ?? sel?.kind ?? "";

  const focusTop = useCallback(() => {
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const h = top.current?.querySelector<HTMLElement>("[data-step-title]");
      try { h?.focus({ preventScroll: true }); } catch { /* old browsers */ }
    });
  }, []);
  const go = (n: Step) => { setStep(n); setErr(""); setFieldErr(null); if (n === 3) setRet(false); focusTop(); };

  // ── Picking a date, behind the app's gates (selectSessCard) ───────────────────────────────
  const pick = (s: BookSession, a: BookAccount | null = acctNow) => {
    if (s.opens || s.satLink) return;
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
    setSelId(s.id);
    funnel("pick", evKey ?? s.kind);
    // a party carried over from another night may be past this night's allowance
    const cap = maxRiders(s, a.live[s.id] ?? 0, jccCap);
    setRiders((rs) => (rs.length > cap ? rs.slice(0, cap) : rs).map((r) => ({
      ...r,
      // "my own bike" and carbon are not on every ride; a pick carried over is made again
      type: r.type && typeOptions(s, a.hidden).includes(r.type as BikeType) ? r.type : "",
    })));
  };

  // The funnel's steps (row 20, lib/funnel.ts): the dates of an event shown, the riders step, the review.
  useEffect(() => {
    if (done || !evKey) return;
    if (step === 1) funnel("list", evKey);
    else if (step === 2) funnel("step2", evKey);
    else if (step === 3) funnel("step3", evKey);
  }, [done, evKey, step]);

  // The fixed bar's height (row 7): the page scrolls a focused field clear of it (scroll-padding, experiences.css) and keeps
  // its own last lines above it, read from the bar itself as it grows (an error, the pay line) and shrinks.
  const footObs = useRef<ResizeObserver | null>(null);
  const footRef = useCallback((el: HTMLDivElement | null) => {
    footObs.current?.disconnect();
    footObs.current = null;
    const root = document.documentElement;
    if (!el) { root.style.removeProperty("--bk-foot-h"); return; }
    const set = () => root.style.setProperty("--bk-foot-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    if (typeof ResizeObserver !== "undefined") { footObs.current = new ResizeObserver(set); footObs.current.observe(el); }
  }, []);

  // Escape closes a pop-up.
  useEffect(() => {
    if (!modal) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [modal]);

  // the count comes from the event, so picking one of its dates never changes it (row 15); an event mixing rides and
  // sessions without a bike can only follow the date picked
  const steps = sel ? regSteps(sel) : (ev && eventSteps(ev.sessions)) || ([1, 2, 2.5, 3] as Step[]);
  const stepLabel = (v: Step) => (v === 1 ? t.stepRide : v === 2 ? t.stepRiders : v === 2.5 ? waiverCopy(sel).title : t.stepConfirm);
  function waiverCopy(s: BookSession | null) { return t.waiver[s ? waiverKind(s) : "bike"]; }
  // The page's title names the step (row 15; W3C's multi-page forms): "Confirm · Step 3 of 3 · Experiences …"; the page's
  // own title stands on the list of events and the tickets, and comes back as each step goes.
  const stepName = done ? "" : ev ? `${stepLabel(step)} · ${fill(t.stepOf, Math.max(0, steps.indexOf(step)) + 1, steps.length)}` : "";
  useEffect(() => {
    if (!stepName) return;
    const base = document.title;
    document.title = `${stepName} · ${base}`;
    return () => { document.title = base; };
  }, [stepName]);
  const free = !!sel?.free;
  const booked = sel && acctNow ? acctNow.live[sel.id] ?? 0 : 0;
  const cap = sel ? maxRiders(sel, booked, jccCap) : jccCap;
  const qty = riders.length;
  const typeName = (ty: string) => typeNames[ty] ?? ty;
  const pillName = (ty: string) => t.types[ty] ?? ty;
  // men only, women only or mixed: the booking app's .sg-chip (components/site/site.css)
  const chip = (s: BookSession) => {
    const c = genderChip(s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed });
    return c ? <span className={`sg-chip sg-${c.cls}`}>{c.label}</span> : null;
  };

  // ── Riders ───────────────────────────────────────────────────────────────────────────────
  const setQty = (d: number) => {
    if (!sel || sel.community) return;
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
  // The height as typed, its Arabic-Indic digits read as ASCII (row 6); a height of 144 cm or under picks the Kids bike
  // where the ride offers it (the owner, 2026-11-10).
  const setHeight = (i: number, raw: string) => {
    const v = asciiDigits(raw).replace(/\D/g, "").slice(0, 3);
    const kids = !!sel && kidsHeight(v) && typeOptions(sel, acctNow?.hidden ?? []).includes("Kids");
    setRider(i, kids ? { height: v, type: "Kids" } : { height: v });
  };
  // One message per mistake (row 5): at its field, nowhere else, and the field brought into view.
  const showRiderErr = (e: RiderError) => {
    const key = e.field === "group" ? "group" : e.field === "kids" ? `type-${e.i}` : `${e.field}-${e.i}`;
    const msg = e.field === "group" ? t.err.group : e.field === "height" ? t.err.height : e.field === "type" ? t.err.pick_type : e.field === "kids" ? t.err.kids : t.err.name;
    setFieldErr({ key, msg });
    requestAnimationFrame(() => document.getElementById(`bk-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const riderErr = () => (sel ? validateRiders(sel, riders, group, acctNow?.name ?? "") : null);
  const ridersOk = () => {
    if (!sel) return false;
    const e = riderErr();
    if (e) showRiderErr(e);
    return !e;
  };
  // The review's Change (row 8): the dates (null), or rider i's answers, the step then coming straight back to the review.
  const changeTo = (rider: number | null) => {
    setRet(true);
    if (rider === null) { go(1); return; }
    go(2);
    requestAnimationFrame(() => { const el = document.getElementById(`bk-h-${rider}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); });
  };
  // Back to the review after a Change (row 8) when nothing else is owed on the way: the riders complete, the waiver ticked.
  const reviewReady = (s: BookSession) => (!needsBike(s) || !riderErr()) && (!needsWaiver(s) || waiverOk === s.id);

  // ── Promo (applyPromoCode) ───────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const v = asciiDigits(promoIn.trim());
    if (!v) { setPromo(null); setPromoMsg(""); return; }
    setPromoBusy(true);
    let d: Record<string, unknown> | null = null;
    // Any code the browser asks about itself (metered per visitor); one that belongs to an
    // account is asked again by the server with the rider's own token.
    const r = await rpcResult<Record<string, unknown>>("promo_lookup", { p_code: v, p_id: null, p_token: null });
    if ("data" in r && r.data && typeof r.data === "object" && !Array.isArray(r.data)) d = r.data;
    if (d && d.ok !== true && d.reason === "not_yours" && acctNow) {
      let mine: Record<string, unknown> | null = null;
      try {
        const res = await fetch("/api/booking/promo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: v }) });
        const b = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        // the server's verdict on the code, or its meter (busy); a lookup it could not make (502) is none
        if (b && typeof b === "object" && (b.ok === true || (res.status < 500 && typeof b.reason === "string" && b.reason !== "generic"))) mine = b;
      } catch { /* lost on the way */ }
      d = mine;
    }
    setPromoBusy(false);
    // A lookup lost on the way is no verdict on the code (the booking app's applyPromoCode, bug hunt 2026-11-10): it
    // said "invalid", and riders gave up a real discount on a weak connection. What was applied stays.
    if (!d) { setPromoMsg(t.promoMsg.lost); return; }
    if (d.ok !== true) { setPromo(null); setPromoMsg(t.promoMsg[String(d.reason)] ?? t.promoMsg.invalid); return; }
    const refuse = (msg: string) => { setPromo(null); setPromoMsg(msg); };
    // a code for one session or one kind of ride (promo_codes.session_id, ride_kind; the app's n6rPcNotThis)
    const sid = typeof d.session_id === "string" ? d.session_id : "", rk = typeof d.ride_kind === "string" ? d.ride_kind : "";
    if (sel && ((sid && sid !== sel.id) || (rk && rk !== sel.kind))) { refuse(t.promoMsg.not_this); return; }
    const appliesTo = typeof d.applies_to === "string" && d.applies_to ? d.applies_to : null;
    if (appliesTo && !riders.some((x) => x.type === appliesTo)) { refuse(fill(t.promoTypeOnly, typeName(appliesTo))); return; }
    const code = String(d.code ?? v);
    // A personal one-use code (a referral code, a blood donation or volunteer free ride) pays for rider 1's own bike,
    // never Carbon; a referral code only on a circuit ride or a Petromin night (_ref_code_guard, _blood_code_guard).
    if (refCodeKind(code) && sel && !refCodeSessOk(sel)) { refuse(t.err.ref_code_session); return; }
    if (codeOne(code) && /carbon/i.test(riders[0]?.type ?? "")) { refuse(refCodeKind(code) ? t.err.ref_code_carbon : t.err.blood_code_carbon); return; }
    setPromo({ code, kind: String(d.kind ?? "pct"), value: Number(d.value) || 0, appliesTo, one: codeOne(code) });
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
  const [lo, hi] = sel ? rentalTotal(sel, riders, prices, acctLite, maxPrices) : [0, 0];
  const disc = sel ? promoDiscount(promo, sel, riders, prices, acctLite) : 0;
  const addonTotal = free ? 0 : addonsCost(addons, items);
  const word = t.sarWord;
  const freeAmt = <bdi className="tk-amt">{t.free}</bdi>;
  const grand = free ? freeAmt : disc > 0 ? <Money n={Math.max(0, lo - disc) + addonTotal} word={word} /> : <Money n={lo + addonTotal} hi={hi + addonTotal} word={word} />;
  const rental = free ? freeAmt : disc > 0 ? <Money n={Math.max(0, lo - disc)} word={word} /> : <Money n={lo} hi={hi} word={word} />;
  // Paid now online (2026-11-10): a paid ride that is not a race (paid to the organiser) or a Petromin night, with
  // something to pay, booked into a place (a waitlisted place pays nothing now). Required, or the rider's choice.
  const payable = !!sel && !free && !!pay && pay.mode !== "off" && !["vlap", "arena", "petromin"].includes(sel.kind) && !isFull(sel)
    && Math.max(0, lo - disc) + addonTotal > 0;
  const payingNow = payable && (pay!.mode === "required" || payNow);

  // ── Confirm (submitReg) ──────────────────────────────────────────────────────────────────
  const refused = (e: Refusal | string) => {
    funnel(e === "place_gone" ? "place_gone" : "refused", fk(), e === "place_gone" ? undefined : e);
    // the last place went to another device: nothing was kept, and the rider chooses (row 13)
    if (e === "place_gone" && sel) { setGone((g) => (g.includes(sel.id) ? g : [...g, sel.id])); setModal({ kind: "gone" }); return; }
    if (e === "signin") { setAcctNow(null); setModal({ kind: "signin" }); return; }
    if (e === "members") { setModal({ kind: "members" }); return; }
    if (e === "rejected" && sel) { setModal({ kind: "rejected", s: sel }); return; }
    if (e === "fix_first") { setModal({ kind: "fix" }); return; }
    if (e === "already" || e === "one_per_session") { setAlready(true); return; }
    if (e === "pick_type") { go(2); setFieldErr({ key: "type-0", msg: t.err.pick_type }); return; }
    if (e === "waiver" && sel) { setWaiverOk(null); go(2.5); return; }
    if (e === "cap") { setErr(fill(t.err.cap, String(cap))); return; }
    if (e === "group_cap") { setErr(fill(t.err.group_cap, String(cap))); return; }
    setErr(t.err[e] ?? t.err.generic);
  };
  // `waitlist`: the rider chose the waitlist (a full session, or the place-gone pop-up's Join waitlist); otherwise a
  // place is asked for, and one another device took first is refused rather than turned into a waitlist place.
  const submit = async (waitlist = false) => {
    if (!sel || busy) return;
    if (!acctNow) { setModal({ kind: "signin" }); return; }
    const re = needsBike(sel) ? riderErr() : null;
    if (re) { go(2); showRiderErr(re); return; }
    if (needsWaiver(sel) && waiverOk !== sel.id) { go(2.5); return; }
    // a session for the other gender is refused here, before anything is sent (the server and the database refuse it too)
    const sg = genderRefused(sel, acctNow.gender);
    if (sg) { setErr(t.err[sg]); return; }
    funnel("confirm", fk());
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
          payNow: payingNow && !waitlist,
          wallet: payingNow && !waitlist && walletOn,
          seatOnly: !waitlist && !isFull(sel),
          lang: locale,
        }),
      });
      const b = (await res.json().catch(() => ({}))) as {
        ok?: boolean; error?: string; tickets?: TicketRow[]; booked?: { id: string; status: string }[]; session?: TicketSession | null; addonsSaved?: boolean; pay?: { url?: string };
      };
      if (b.ok && b.pay?.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.pay.url)) {
        // the places are held while the rider pays on the payment page (it brings them back to their tickets)
        funnel("booked", fk(), "pay"); funnelDone();
        window.location.assign(b.pay.url);
        return;
      }
      if (b.ok && Array.isArray(b.tickets)) {
        const booked = Array.isArray(b.booked) ? b.booked.filter((x) => x && typeof x.id === "string") : [];
        const n = booked.length || b.tickets.length;
        const rowsNow: { status: string }[] = b.tickets.length ? b.tickets : booked;
        funnel(rowsNow.length > 0 && rowsNow.every((r) => r.status === "waitlist") ? "waitlisted" : "booked", fk()); funnelDone();
        setDone({ tickets: b.tickets, booked, session: b.session ?? null, addonsSaved: b.addonsSaved !== false });
        setAcctNow((a) => {
          if (!a) return a;
          // the next booking asks what this one made due (_pgDue counts the rows)
          const count = a.count + n, due = a.profileGate === "community" ? a.pgAsk : pgDue(a, count);
          return {
            ...a, live: { ...a.live, [sel.id]: (a.live[sel.id] ?? 0) + n }, height: a.height ?? (Number(riders[0]?.height) || null),
            count, pgAsk: due, profileGate: a.profileGate === "community" ? a.profileGate : due.length ? "profile" : "none",
          };
        });
        focusTop();
      } else {
        refused(b.error ?? "generic");
      }
    } catch {
      funnel("refused", fk(), "offline");
      setErr(t.err.offline);
    }
    setBusy(false);
  };
  const another = () => {
    setDone(null); setSelId(null); setStep(1); setAddons([]); setPromo(null); setPromoIn(""); setPromoMsg(""); setPromoOpen(false); setWaiverOk(null); setGroup(null); setAlready(false); setRet(false);
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
  const head = (title: string, id: string) => (
    <div className="bk-head">
      {stepper()}
      <h2 id={id} className="bk-title" tabIndex={-1} data-step-title>{title}</h2>
    </div>
  );
  const fromLine = (s: BookSession): React.ReactNode => {
    const p = fromPrice(s, prices);
    return !p ? null : p.kind === "free" ? t.free : fillNode(p.kind === "seat" ? t.perSeat : t.from, <Money n={p.n} word={word} />);
  };
  // One date is chosen among them (row 11): a radio group, one tab stop, the arrow keys. An arrow moves the choice with
  // the focus where choosing opens nothing (no sign-in, no gate); elsewhere it moves the focus, and Enter or Space chooses.
  const cardStop = (list: BookSession[]) => tabStop(list, (x) => x.id === selId, (x) => !x.opens && !x.satLink);
  const cardKeys = (e: React.KeyboardEvent<HTMLElement>, list: BookSession[]) => {
    const id = radioKey(e, rtl)?.dataset.id;
    const s = id ? list.find((x) => x.id === id) : undefined;
    if (s && acctNow && !gateFor(s, acctNow)) pick(s);
  };
  const card = (s: BookSession, stop: boolean) => {
    const named = s.kind !== "jcc";
    const sg = chip(s);
    const kicker = named || sg ? (
      <span className="sc-kicker">
        {named && <span className="sc-chip has-ic"><KindIc kind={s.kind} />{s.name}</span>}
        {sg}
        {s.kind === "workshop" && <span className="sc-partner">{t.partner}</span>}
      </span>
    ) : null;
    if (s.opens) {
      return (
        <div key={s.id} className={`sc-card ev-${s.kind} closed`} role="radio" aria-checked={false} aria-disabled="true">
          {kicker}
          {/* not open yet: a clock beside when it opens, never the grey alone */}
          <span className="sc-head"><span className="sc-dot" aria-hidden="true" /><span className="sc-date">{s.day}</span><span className="sc-spots closed"><Ic name="clock" size={13} />{s.opens}</span></span>
          <span className="sc-time"><bdi>{s.time}</bdi></span>
        </div>
      );
    }
    const on = selId === s.id;
    const rej = !!acctNow?.rejected.includes(s.id);
    const full = isFull(s);
    const low = !full && !s.approval && s.left != null && s.left > 0 && s.left <= 3;
    const meta = [s.collect, fromLine(s)].filter((x) => !!x);
    const body = (
      <>
        {kicker}
        <span className="sc-head">
          <span className={`sc-dot${on ? " on" : ""}`} aria-hidden="true" />
          <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
          <span className={`sc-spots${rej ? " rej" : full ? " full" : low ? " low" : ""}`}>{rej ? t.rejCard : full ? t.waitlist : low ? fill(s.left === 1 ? t.left1 : t.leftN, s.left!) : t.available}</span>
        </span>
        <span className="sc-time"><bdi>{s.time}</bdi></span>
        {meta.length > 0 && <span className="sc-meta">{meta.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
        {s.kind === "event" && s.description && <span className="sc-desc">{s.description}</span>}
      </>
    );
    // a Saturday ride while staff take its bookings at micromobility.sa/saturday with a ride code (2026-11-08): its card
    // goes there, for anyone with a code, member or not, as main's Experiences sends it
    if (s.satLink) return <a key={s.id} href={s.satLink} className={`sc-card ev-${s.kind}${rej ? " rej" : ""}`}>{body}</a>;
    return (
      <button key={s.id} type="button" className={`sc-card ev-${s.kind}${on ? " sel" : ""}${rej ? " rej" : ""}`} role="radio" aria-checked={on} tabIndex={stop ? 0 : -1} data-id={s.id} onClick={() => pick(s)}>
        {body}
      </button>
    );
  };
  const fErr = (key: string) => (fieldErr?.key === key ? <p className="bk-ferr" role="alert">{fieldErr.msg}</p> : null);
  // The promo code behind a link that opens it in place (row 10), on both steps, so a code from Instagram can still be
  // typed early; open while a code is applied, typed or answered.
  const promoShown = promoOpen || !!promo || !!promoIn || !!promoMsg;
  const promoBox = (slot: string) => (free ? null : !promoShown ? (
    <div className="bk-promo">
      <button type="button" className="bk-link" aria-expanded={false}
        onClick={() => { setPromoOpen(true); requestAnimationFrame(() => document.getElementById(`bk-promo-${slot}`)?.focus()); }}>{t.promo}</button>
    </div>
  ) : (
    <div className="bk-promo">
      <label htmlFor={`bk-promo-${slot}`}>{t.promo}</label>
      <div className="bk-promo-row">
        <input id={`bk-promo-${slot}`} type="text" value={promo ? promo.code : promoIn} disabled={!!promo} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} dir="ltr"
          onChange={(e) => setPromoIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyPromo(); } }} />
        {promo
          ? <button type="button" className="bk-btn2" onClick={removePromo}>{t.promoRemove}</button>
          : <button type="button" className="bk-btn2" onClick={() => void applyPromo()} disabled={promoBusy}>{t.promoApply}</button>}
      </div>
      {promoMsg && <p className="bk-ferr" role="alert">{promoMsg}</p>}
      {disc > 0 && promo && <p className="bk-disc"><span>{t.discount} ({promo.code})</span><bdi dir="ltr">− <Money n={disc} word={word} /></bdi></p>}
    </div>
  ));
  const side = () => sel && (
    <aside className="bk-side" aria-label={t.summary}>
      <p className="bk-side-h">{t.summary}</p>
      <p className="bk-side-k">{sel.kind === "jcc" ? ev?.title : sel.name}</p>
      {chip(sel) && <p className="bk-side-sg">{chip(sel)}</p>}
      <p className="bk-side-when">{sel.near && <><strong>{sel.near}</strong> · </>}{sel.day}</p>
      <p className="bk-side-time"><bdi>{sel.time}</bdi></p>
      {needsBike(sel) && <p className="bk-side-row"><span>{t.numBikes}</span><span>{qty}</span></p>}
      <p className="bk-side-total"><span>{t.total}</span>{grand}</p>
    </aside>
  );

  // ── The steps ────────────────────────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  // The bar under each step (row 12): Back and the step's button, one place for Back on every step; on a phone it is
  // fixed to the bottom of the screen, the booking's one floating bar, and the page scrolls focus clear of it (row 7).
  // `from`: the step it stands under; Back goes to the step before it, from the dates to the list of events
  const back = (from: Step) => {
    if (from === 1) { setEvKey(null); setSelId(null); setRet(false); focusTop(); }
    else if (sel) go(prevStep(sel, from));
  };
  const bar = (from: Step, children: React.ReactNode) => (
    <div className="bk-foot fix" ref={footRef}>
      <button type="button" className="bk-btn2" disabled={busy} onClick={() => back(from)}><Ic name="back" flip /> {t.back}</button>
      {children}
    </div>
  );
  // the event's own name on the circuit (the owner, 2026-11-10: one name, "Open Sports Day", the circuit its place)
  const selName = (s: BookSession) => (s.kind === "jcc" ? ev?.title || tk.venueCircuit : s.name);
  const wlChip = <span className="bk-wl-chip">{t.waitlist}</span>;
  if (done) {
    // the tickets my_bookings returned, else the rows the database stored: a booking whose tickets were not read in
    // time is never called booked when it went to the waitlist, and points to My Bookings for its codes
    const rows: { status: string }[] = done.tickets.length ? done.tickets : done.booked;
    const allWl = rows.length > 0 && rows.every((r) => r.status === "waitlist");
    const missing = done.tickets.length < done.booked.length;
    const appr = !!done.session?.approval || !!sel?.approval;
    const name = sel ? selName(sel) : t.ride;
    body = (
      <section aria-labelledby="bk-done-h">
        <div className="bk-head">
          <h2 id="bk-done-h" className="bk-title" tabIndex={-1} data-step-title>{allWl ? t.doneWl : appr ? t.doneReserved : t.doneBooked}</h2>
          {!(appr && allWl) && <p className="bk-sub">{appr ? t.doneReservedSub : missing ? t.doneInAccount : allWl ? t.doneWlSub : t.doneBookedSub}</p>}
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
    const stop = cardStop(ev.sessions);
    body = (
      <section aria-labelledby="bk-ride-h">
        {head(t.rideTitle, "bk-ride-h")}
        <p className="xs-picked">{ev.title}</p>
        {ev.note && <p className="bk-evnote">{ev.note}</p>}
        {ev.sessions.length === 0 ? (
          // no dates: the words, and our Instagram where new ones go up first (its sentence went, 2026-11-10)
          <div className="xs-empty"><p>{text.noDates || t.noRides}</p>{links.instagram && <p><a className="bk-link" href={links.instagram} target="_blank" rel="noopener">Instagram</a></p>}</div>
        ) : (
          <div className="sc-list" role="radiogroup" aria-labelledby="bk-ride-h" onKeyDown={(e) => cardKeys(e, ev.sessions)}>
            {ev.sessions.map((s, n) => card(s, n === stop))}
          </div>
        )}
        {sel?.community && isFull(sel) && <p className="bk-note bk-full"><span className="bk-full-dot" aria-hidden="true" />{t.fullNote}</p>}
        {ev.sessions.some((s) => s.members) && text.membersNote && <p className="xs-note">{text.membersNote}{links.club && <> <a href={links.club}>{text.clubLink}</a></>}</p>}
        {bar(1, (
          <>
            {/* the date picked, and Waitlist when it is full (row 1): the outcome said before Confirm, never a place in line */}
            {sel && (
              <span className="bk-foot-sum">
                <span className="bk-foot-k">{sel.near ?? sel.day}</span>
                <span className="bk-foot-v"><bdi>{sel.time}</bdi>{isFull(sel) && wlChip}</span>
              </span>
            )}
            <button type="button" className="bk-btn grow" disabled={!sel} onClick={() => { if (sel) go(ret && reviewReady(sel) ? 3 : nextStep(sel, 1)); }}>{t.cont}</button>
          </>
        ))}
      </section>
    );
  } else if (step === 2) {
    const opts = typeOptions(sel, acctNow?.hidden ?? []);
    // the party's total beside the button once every rider has a type (row 9): a number, never a range box before that
    const typed = riders.every((r) => !!r.type);
    body = (
      <section aria-labelledby="bk-riders-h">
        {head(t.ridersTitle, "bk-riders-h")}
        <div className="bk-card">
          {!sel.community && (
            <div className="bk-qty-row">
              <span className="bk-qty-k" id="bk-qty-k">{t.numBikes}</span>
              <div className="bk-qty" role="group" aria-labelledby="bk-qty-k">
                <button type="button" onClick={() => setQty(-1)} disabled={qty <= 1} aria-label={t.qtyDec}><Ic name="minus" size={18} /></button>
                <span aria-live="polite">{qty}</span>
                {/* at the account's allowance the button rests: the state says it, no line under it (2026-11-10) */}
                <button type="button" onClick={() => setQty(1)} disabled={qty >= cap} aria-label={t.qtyInc}><Ic name="plus" size={18} /></button>
              </div>
            </div>
          )}
          {riders.map((r, i) => {
            const tstop = tabStop(opts, (ty) => r.type === ty);
            return (
              <div key={i} className="bk-rider">
                {qty > 1 && <p className="bk-rider-h"><span className="bk-num">{i + 1}</span>{t.rider}</p>}
                {qty > 1 && (
                  <div className="bk-field" id={`bk-name-${i}`}>
                    <label htmlFor={`bk-name-in-${i}`}>{t.riderName}</label>
                    {/* rider 1 is the account holder; a companion's name is never the account's own (row 16), in its own direction */}
                    <input id={`bk-name-in-${i}`} type="text" autoComplete={i === 0 ? "name" : "off"} dir="auto" autoCapitalize="words" maxLength={60} placeholder={t.riderNamePh}
                      value={r.name} onChange={(e) => setRider(i, { name: e.target.value.replace(/[-‐-―]/g, " ") })} aria-invalid={fieldErr?.key === `name-${i}` || undefined} />
                    {fErr(`name-${i}`)}
                  </div>
                )}
                <div className="bk-field" id={`bk-height-${i}`}>
                  <label htmlFor={`bk-h-${i}`}>{t.height}</label>
                  {/* a text field for digits (row 6), Arabic-Indic ones read too; its unit beside it, no hint line (2026-11-10) */}
                  <div className="bk-unit-wrap">
                    <input id={`bk-h-${i}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3} placeholder={t.heightPh} value={r.height}
                      onChange={(e) => setHeight(i, e.target.value)} aria-describedby={`bk-h-u-${i}`} aria-invalid={fieldErr?.key === `height-${i}` || undefined} />
                    <span className="bk-unit" id={`bk-h-u-${i}`}>{t.cm}</span>
                  </div>
                  {fErr(`height-${i}`)}
                </div>
                <div className="bk-field" id={`bk-type-${i}`}>
                  <span className="bk-label" id={`bk-type-l-${i}`}>{t.typePref}</span>
                  <div className="bk-types" role="radiogroup" aria-labelledby={`bk-type-l-${i}`}
                    onKeyDown={(e) => { const ty = radioKey(e, rtl)?.dataset.ty; if (ty) setType(i, ty as BikeType); }}>
                    {opts.map((ty, n) => {
                      const on = r.type === ty;
                      const showPrice = !free && sel.seat == null && ty !== "Own";
                      const pill = (
                        <button type="button" className={`bk-pill${on ? " on" : ""}`} role="radio" aria-checked={on} tabIndex={n === tstop ? 0 : -1} data-ty={ty} onClick={() => setType(i, ty)}>
                          <span className="bk-pill-n">{pillName(ty)}</span>{showPrice && <span className="bk-pill-p"><Money n={prices[ty] ?? 0} word={word} /></span>}
                        </button>
                      );
                      return BIKE_IMG[ty] ? (
                        <span key={ty} className={`bk-pick${on ? " on" : ""}`}>{pill}
                          <button type="button" className="bk-info" aria-haspopup="dialog" aria-label={fill(t.bikeAria, pillName(ty))} onClick={() => setModal({ kind: "bike", type: ty, slot: i })}><Ic name="info" size={15} /></button>
                        </span>
                      ) : <span key={ty} className={`bk-pick solo${on ? " on" : ""}`}>{pill}</span>;
                    })}
                  </div>
                  {fErr(`type-${i}`)}
                </div>
                {i === 0 && hasRideGroups(sel) && (
                  <div className="bk-field" id="bk-group">
                    <span className="bk-label" id="bk-group-l">{t.groupLabel}</span>
                    <div className="bk-types one" role="radiogroup" aria-labelledby="bk-group-l"
                      onKeyDown={(e) => { const g = radioKey(e, rtl)?.dataset.g; if (g === "beg" || g === "int") { setGroup(g); if (fieldErr?.key === "group") setFieldErr(null); } }}>
                      {RIDE_GROUPS.map((g, n) => (
                        <span key={g} className={`bk-pick${group === g ? " on" : ""}`}>
                          <button type="button" className={`bk-pill${group === g ? " on" : ""}`} role="radio" aria-checked={group === g} tabIndex={(group ? group === g : n === 0) ? 0 : -1} data-g={g}
                            onClick={() => { setGroup(g); if (fieldErr?.key === "group") setFieldErr(null); }}>
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
            );
          })}
          {promoBox("riders")}
        </div>
        {bar(2, (
          <>
            {typed && !free && <span className="bk-foot-sum tot"><span className="bk-foot-k">{t.total}</span><span className="bk-foot-v">{rental}</span></span>}
            <button type="button" className="bk-btn grow" onClick={() => { if (ridersOk()) go(ret && (!needsWaiver(sel) || waiverOk === sel.id) ? 3 : nextStep(sel, 2)); }}>{t.toReview}</button>
          </>
        ))}
      </section>
    );
  } else if (step === 2.5) {
    const w = waiverCopy(sel), ok = waiverOk === sel.id;
    body = (
      <section aria-labelledby="bk-waiver-h">
        {head(w.title, "bk-waiver-h")}
        <div className="bk-card">
          <div className="bk-waiver" tabIndex={0} role="region" aria-label={w.title}>{w.body}</div>
          <label className={`bk-agree${ok ? " on" : ""}`}>
            <input type="checkbox" checked={ok} onChange={(e) => { setWaiverOk(e.target.checked ? sel.id : null); if (e.target.checked) funnel("waiver", fk()); }} />
            <span>{w.agree}</span>
          </label>
        </div>
        {bar(2.5, <button type="button" className="bk-btn grow" disabled={!ok} onClick={() => go(nextStep(sel, 2.5))}>{t.cont}</button>)}
      </section>
    );
  } else {
    const lines = riderPrices(sel, riders, prices, acctLite, maxPrices);
    const picked = addons.map((a) => ({ a, it: items.find((x) => x.id === a.id) })).filter((x) => !!x.it);
    const cats = [...new Set(sellable.map((x) => x.category || "Other"))].sort((a, b) => addonCatRank(a, items) - addonCatRank(b, items) || (t.cats[a] ?? a).localeCompare(t.cats[b] ?? b));
    // an add-on: the whole row takes it or puts it back (row 14; the tick alone was 24px), its count changed in place
    const row = (it: AddonItem) => {
      const q = addonQty(it.id), on = q > 0, c = addonCap(it);
      return (
        <div key={it.id} className={`bk-addon${on ? " on" : ""}`} onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setAddon(it.id, on ? -q : 1); }}>
          <button type="button" className={`bk-check${on ? " on" : ""}`} role="checkbox" aria-checked={on} aria-label={it.name} onClick={() => setAddon(it.id, on ? -q : 1)}>{on && <Ic name="tick" size={14} />}</button>
          {it.photo && <img className="bk-addon-img" src={it.photo} alt="" loading="lazy" decoding="async" />}
          <div className="bk-addon-txt"><span className="bk-addon-n">{it.name}</span>{it.brand && <span className="bk-addon-b"> · {it.brand}</span>}</div>
          {on && c > 1 && (
            <span className="bk-addon-q">
              <button type="button" onClick={() => setAddon(it.id, -1)} aria-label={`${t.qtyDec}: ${it.name}`}><Ic name="minus" size={14} /></button>
              <span aria-live="polite">{q}</span>
              <button type="button" onClick={() => setAddon(it.id, 1)} disabled={q >= c} aria-label={`${t.qtyInc}: ${it.name}`}><Ic name="plus" size={14} /></button>
            </span>
          )}
          <span className="bk-addon-p">{it.price > 0 ? <Money n={it.price} word={word} /> : t.free}</span>
        </div>
      );
    };
    const isAlready = already || booked > 0;
    const full = isFull(sel);
    // A "Change" on a block of the review (row 8): back to its step (the dates, or the riders at this rider's height),
    // which then comes straight back here.
    const change = (label: string, rider: number | null) => (
      <button type="button" className="bk-change" aria-label={`${t.change} · ${label}`} onClick={() => changeTo(rider)}>{t.change}</button>
    );
    body = (
      <section aria-labelledby="bk-review-h">
        {head(t.reviewTitle, "bk-review-h")}
        {sellable.length > 0 && (
          <div className="bk-card">
            <h3 className="bk-h3">{t.addonsTitle}</h3>
            {cats.length > 1 ? cats.map((c) => (
              <div key={c} className="bk-addon-cat"><p className="bk-cat">{t.cats[c] ?? c}</p>{sellable.filter((x) => (x.category || "Other") === c).map(row)}</div>
            )) : sellable.map(row)}
          </div>
        )}
        <div className="bk-card">
          <div className="bk-rv-head">
            <div>
              <p className="bk-k">{t.rideLabel}</p>
              <p className="bk-rv-date">{selName(sel)}<br />{sel.day}</p>
              <p className="bk-rv-time"><bdi>{sel.time}</bdi>{full && wlChip}</p>
              {chip(sel) && <p className="bk-rv-sg">{chip(sel)}</p>}
            </div>
            <div className="bk-rv-side">
              {change(sel.day, null)}
              {acctNow && <div className="bk-rv-by"><p className="bk-k">{t.bookedBy}</p><p className="bk-rv-name">{acctNow.name}</p></div>}
            </div>
          </div>
          <p className="bk-k bk-sec">{needsBike(sel) ? t.riders : t.participants} ({qty})</p>
          {riders.map((r, i) => {
            const l = lines[i];
            const who = (r.name.trim() || (i === 0 ? acctNow?.name : "")) || `${t.rider} ${i + 1}`;
            return (
              <div key={i} className="bk-rv-rider">
                <span className="bk-num">{i + 1}</span>
                <div className="bk-rv-mid">
                  <p className="bk-rv-name">{who}</p>
                  {needsBike(sel) && (
                    <p className="bk-rv-meta">
                      {r.type && <span className={`tk-type t-${r.type.toLowerCase().replace(/\s+/g, "")}`}>{typeName(r.type)}</span>}
                      {r.height && <bdi>{r.height} {t.cm}</bdi>}
                      {i === 0 && hasRideGroups(sel) && group && <span>{t.groups[group]} · <bdi>{fill(t.km, sel.km[group])}</bdi></span>}
                    </p>
                  )}
                </div>
                <span className="bk-rv-price">{l.kind === "free" ? t.free : l.kind === "house" ? t.onTheHouse : l.kind === "sar" ? <Money n={l.n} word={word} /> : <Money n={l.lo} hi={l.hi} word={word} />}</span>
                {needsBike(sel) && change(who, i)}
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
                  <span className="bk-rv-price"><Money n={(it!.price || 0) * a.qty} word={word} /></span>
                </div>
              ))}
            </>
          )}
          {promoBox("review")}
        </div>
        <div className="bk-card">
          {addonTotal > 0 && (
            <>
              <p className="bk-sum-row"><span>{t.rental}</span>{rental}</p>
              <p className="bk-sum-row"><span>{t.addons}</span><Money n={addonTotal} word={word} /></p>
            </>
          )}
          <p className={`bk-sum-tot${addonTotal > 0 ? " sep" : ""}`}><span>{t.total}</span>{grand}</p>
        </div>
        {payable && (
          <div className="bk-card bk-paybox">
            <h3 className="bk-h3" id="bk-pay-h">{t.pay.title}</h3>
            {pay!.mode === "optional" && (
              <div className="bk-types one" role="radiogroup" aria-labelledby="bk-pay-h"
                onKeyDown={(e) => { const v = radioKey(e, rtl)?.dataset.pay; if (v) setPayNow(v === "now"); }}>
                <span className={`bk-pick solo${payNow ? " on" : ""}`}>
                  <button type="button" role="radio" aria-checked={payNow} tabIndex={payNow ? 0 : -1} data-pay="now" className={`bk-pill${payNow ? " on" : ""}`} onClick={() => setPayNow(true)}><span className="bk-pill-n">{t.pay.now}</span></button>
                </span>
                <span className={`bk-pick solo${!payNow ? " on" : ""}`}>
                  <button type="button" role="radio" aria-checked={!payNow} tabIndex={payNow ? -1 : 0} data-pay="desk" className={`bk-pill${!payNow ? " on" : ""}`} onClick={() => setPayNow(false)}><span className="bk-pill-n">{t.pay.desk}</span></button>
                </span>
              </div>
            )}
            {payingNow && pay!.wallet > 0 && (
              <label className={`bk-agree${walletOn ? " on" : ""}`}>
                <input type="checkbox" checked={walletOn} onChange={(e) => setWalletOn(e.target.checked)} />
                <span>{fillNode(t.pay.wallet, <Money n={pay!.wallet} word={word} />)}</span>
              </label>
            )}
            {payingNow && <p className="bk-note">{fill(t.pay.held, pay!.holdMinutes)}</p>}
            {/* paid online now: the cancellation and refund terms one tap away, in a centred pop-up (the owner, 2026-11-10) */}
            {payingNow && (
              <button type="button" className="bk-termrow" aria-haspopup="dialog" onClick={() => setModal({ kind: "terms" })}>
                <span>{t.cancelTerms}</span><Ic name="go" flip size={16} />
              </button>
            )}
            {payingNow && (
              <p className="bk-paymarks" aria-label={t.pay.methods}>
                {["mada", "visa", "mastercard"].map((m) => <img key={m} src={`/site/payments/${m}.svg`} alt="" width={40} height={26} />)}
                <span>{t.pay.methods}</span>
              </p>
            )}
          </div>
        )}
        {isAlready && <div className="bk-already" role="status"><p className="bk-already-t">{t.already}</p></div>}
        {bar(3, isAlready ? (
          <a className="bk-btn grow" href={links.account}>{t.myBookings}</a>
        ) : (
          <>
            {err && <p className="bk-err" role="alert">{err}</p>}
            {/* the button says the outcome (row 1): Join waitlist on a full session, the amount when it is paid now */}
            <button type="button" className="bk-btn grow" disabled={busy} aria-busy={busy} onClick={() => void submit(full)}>
              {busy ? <span className="bk-spin" aria-hidden="true" /> : null}{full ? t.joinWl : payingNow ? fillNode(t.pay.confirm, grand) : t.confirm}
            </button>
            {payingNow && !full && <p className="bk-agree-note">{t.pay.agree}</p>}
          </>
        ))}
      </section>
    );
  }

  const wide = !done && !!ev && !!sel && step !== 1;
  return (
    <div className={`xs bk${rtl ? " rtl" : ""}`} ref={top}>
      {wide ? <div className="bk-layout"><div className="bk-main">{body}</div>{side()}</div> : body}
      {modal && <Pop modal={modal} close={() => setModal(null)} t={t} links={links} locale={locale} sel={sel} acct={acctNow} pay={pay}
        onGone={(wl) => {
          // Join waitlist: sent again as it was, for the waitlist; another ride: the dates, every rider's answers kept
          setModal(null);
          if (wl) void submit(true);
          else { setRet(true); go(1); }
        }}
        onPickBike={(slot, ty) => { setType(slot, ty); setModal(null); }}
        onPickGroup={(g) => { setGroup(g); if (fieldErr?.key === "group") setFieldErr(null); setModal(null); }}
        onProfileSaved={(next, v) => {
          const a = acctNow ? { ...acctNow, profileGate: "none" as const, pgAsk: [], birth: v.birth || acctNow.birth, nationality: v.nationality || acctNow.nationality } : null;
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
  if (a.profileGate !== "none") return { kind: "profile", community: a.profileGate === "community", ask: a.pgAsk.length ? a.pgAsk : ["birth", "nat"], next: s.id };
  // a session for men only or women only, to an account of the other gender or with none on file (2026-10-27)
  const sg = genderRefused(s, a.gender);
  if (sg) return { kind: "gender", s, refusal: sg };
  if (a.rejected.includes(s.id)) return { kind: "rejected", s };
  if (s.members && !a.member) return { kind: "members" };
  return null;
}

// ── The pop-ups: centred on every screen (never a bottom sheet) ─────────────────────────────────
type PopProps = {
  modal: NonNullable<Modal>; close: () => void; t: BookingText; links: FlowLinks; locale: string; sel: BookSession | null; acct: BookAccount | null;
  pay: Props["pay"]; onGone: (waitlist: boolean) => void;
  onPickBike: (slot: number, ty: BikeType) => void; onPickGroup: (g: RideGroup) => void;
  onProfileSaved: (next: string | null, v: { birth: string; nationality: string }) => void; pillName: (ty: string) => string;
};
function Pop({ modal, close, t, links, locale, sel, acct, pay, onGone, onPickBike, onPickGroup, onProfileSaved, pillName }: PopProps) {
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
  } else if (modal.kind === "gone") {
    // the last place went to another device while this rider booked it (PLACE_GONE, row 13): nothing was kept; the
    // waitlist or another date, the rider's answers kept either way. A session without a bike never says ride.
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.goneTitle}</h2>{x}</div>
        <div className="bk-pop-foot">
          <button type="button" className="bk-btn2" onClick={() => onGone(false)}>{sel && !needsBike(sel) ? t.goneOtherNb : t.goneOther}</button>
          <button type="button" className="bk-btn" onClick={() => onGone(true)}>{t.joinWl}</button>
        </div>
      </div>
    );
  } else if (modal.kind === "terms") {
    // the cancellation and refund terms of a booking paid online now (the owner, 2026-11-10, question 3): the refund rule
    // from staff's pay settings, then the Terms' refunds clause as staff keep it (English or Arabic, as the Terms page)
    const days = pay?.refundDays ?? 1;
    const terms = pay?.terms ?? null;
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.cancelTerms}</h2>{x}</div>
        <p className="bk-pop-msg">{days > 1 ? fill(t.pay.refundDays, days) : days === 0 ? t.pay.refundSameDay : t.pay.refund}</p>
        {terms && terms.blocks.length > 0 && (
          <div className="bk-terms" lang={terms.lang} dir={terms.lang === "ar" ? "rtl" : "ltr"}>
            {terms.title && <h3 className="bk-h3">{terms.title}</h3>}
            {terms.blocks.map((b, k) => ("h" in b ? <h4 key={k}>{b.h}</h4> : "ul" in b ? <ul key={k}>{b.ul.map((y, j) => <li key={j}>{y}</li>)}</ul> : <p key={k}>{b.p}</p>))}
          </div>
        )}
        <div className="bk-pop-foot"><button type="button" className="bk-btn" onClick={close}>{t.close}</button></div>
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
  } else if (modal.kind === "gender") {
    // a session for the other gender: its name and chip, and why it cannot be booked
    const c = genderChip(modal.s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed });
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><div><h2 id={label} className="bk-pop-title">{t.err[modal.refusal]}</h2>{modal.s.kind !== "jcc" && <p className={`bk-pop-kind ev-${modal.s.kind}`}>{modal.s.name}</p>}</div>{x}</div>
        {c && <p className="bk-pop-msg"><span className={`sg-chip sg-${c.cls}`}>{c.label}</span></p>}
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
    inner = <ProfileForm t={t} locale={locale} acct={acct} community={modal.community} ask={modal.ask} onSaved={(v) => onProfileSaved(modal.next, v)} close={close} />;
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
      <div ref={box} className={`bk-pop${modal.kind === "bike" || modal.kind === "group" ? " sheet" : ""}`} role={modal.kind === "gone" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={label}>{inner}</div>
    </div>
  );
}

// The profile page (_profileGate): the birth date as three pickers and the nationality, saved
// before the booking goes on; only what is asked (`ask`, _pgOpen's: the nationality from the first
// booking, the birth date from the fourth). A community member's go where the server asked for them.
function ProfileForm({ t, locale, acct, community, ask, onSaved, close }: {
  t: BookingText; locale: string; acct: BookAccount | null; community: boolean; ask: PgField[];
  onSaved: (v: { birth: string; nationality: string }) => void; close: () => void;
}) {
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
  const hb = ask.includes("birth"), hn = ask.includes("nat"), one = ask.length === 1;
  const filled = (!hb || !!birth) && (!hn || !!nat);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = { b: !hb || birth ? undefined : t.pgErrBirth, n: !hn || nat ? undefined : t.pgErrNat };
    setErrs(n);
    if (n.b || n.n) return;
    setSaving(true);
    try {
      const r = await fetch("/api/booking/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ birth: hb ? birth : "", nationality: hn ? nat : "", community, ask }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { onSaved({ birth: hb ? birth : "", nationality: hn ? nat : "" }); return; }
      setErrs(b.error === "birth" ? { b: t.pgErrBirth } : b.error === "nationality" ? { n: t.pgErrNat } : { net: true });
    } catch { setErrs({ net: true }); }
    setSaving(false);
  };
  return (
    <form className="bk-pop-body" onSubmit={save} noValidate>
      <div className="bk-pop-head"><div><p className="bk-kick">{community ? t.pgCommKicker : t.pgKicker}</p><h2 id="bk-pg-t" className="bk-pop-title">{community && !one ? t.pgCommTitle : one ? t.pgTitleOne : t.pgTitle}</h2></div>
        <button type="button" className="bk-x" onClick={close} aria-label={t.close}><Ic name="close" size={18} /></button></div>
      <p className="bk-sub sm">{community ? t.pgCommSub : one ? t.pgSubOne : t.pgSub}</p>
      {hb && <div className="bk-field">
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
      </div>}
      {hn && <div className="bk-field">
        <label htmlFor="bk-pg-nat">{t.nationality}</label>
        <select id="bk-pg-nat" value={nat} disabled={saving} onChange={(e) => setNat(e.target.value)}>
          <option value="">{t.chooseCountry}</option>
          {nat && !nats.some((o) => o.value === nat) && <option value={nat}>{nat}</option>}
          {nats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {errs.n && <p className="bk-ferr" role="alert">{errs.n}</p>}
      </div>}
      <p className="bk-note">{t.pgNote}</p>
      {errs.net && <p className="bk-err" role="alert">{t.pgErrNet}</p>}
      <button type="submit" className="bk-btn wide" disabled={saving || !filled}>{saving ? t.pgSaving : t.pgSave}</button>
    </form>
  );
}
