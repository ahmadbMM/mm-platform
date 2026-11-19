"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { intlOf, isRtl } from "@/i18n/locales";
import SignIn from "@/components/account/SignIn";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import {
  EVENT_SEAT_MAX, JCC_ACCOUNT_CAP, addonCap, addonCatRank, addonsCost, asciiDigits, codeOne, eventSteps, fromPrice, genderRefused, hasDetailsStep, hasRideGroups, kidsHeight, maxRiders, needsBike, needsWaiver, nextStep, partyOf, partyRide, pgDue, prevStep, promoDiscount,
  refCodeKind, refCodeSessOk, regSteps, rentalTotal, riderDone, riderPrices, RIDE_GROUPS, sessionAddons, setParty, typeOptions, unnamedPlace, validateRiders, waiverKind, datesLive,
  type AddonItem, type AddonPick, type BikeType, type BookAccount, type BookSession, type PartyRider, type PgField, type Prices, type Promo, type Refusal, type Rider, type RiderError, type RideGroup, type Step,
} from "@/lib/booking";
import { funnel, funnelDone } from "@/lib/funnel";
import { radioKey, tabStop } from "@/lib/radio-keys";
import { riyalNum } from "@/components/booking/Sar";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { rpcResult } from "@/lib/rpc-client";
import { genderChip } from "@/lib/session-gender";
import { ticketCue, type AddonItem as TicketAddonItem, type TicketRoute, type TicketRow, type TicketSession } from "@/lib/tickets";
import { Ic, KindIc } from "./BookIcons";
import { CalendarIcon } from "@/components/site/Icons";
import { T, type BookingText } from "./Booking.text";
import { bookMoreWords, type BookMoreWords } from "./BookMore.words";
import PartyStepper from "./PartyStepper";
import "./booking-flow.css";

// Booking on micromobility.sa itself (the owner, 2026-10-03: "full booking on the website"; the user, 2026-11-19: "make
// sure all customers can do everything they want in the booking app to do it on the main website"), as the booking app's
// own wizard books one (renderRegister): the date, the details (the riders where there is a bike, an event's seats, the
// Farm House Night's family), and Review & confirm with the waiver ticked right above the button, then one ticket per
// place. Staging's flow (its BookingFlow.tsx), less its online payment (paid rides are paid at the desk, as in the booking
// app, until Moyasar can run on live), its packs, gifts and early bird, and its bar fixed to the bottom of a phone's screen
// (the owner: no bottom bars). Experiences' last step opens it on the date picked there (?ev=&session=); Back from its
// first step goes back to Experiences.
// Every gate the app has stands in front of the same step: sign in (or Create account, on this site), a member's ride, a
// ride the rider was turned down for, the details staff asked for (each one opens its own page of My Account), the profile
// page (the nationality from the first booking, the birth date from the fourth), a session for the other gender. The
// account is read when the steps open (/api/booking/account), never drawn into the page. The booking itself is the
// server's (app/api/booking): every price is the database's, never this page's, and its refusals are said in the app's
// words.

export type FlowEvent = { key: string; title: string; meta: string; logo: string; note: string; sessions: BookSession[] };
export type FlowText = { eventTitle: string; noDates: string; membersNote: string; clubLink: string; gather: string; start: string;
  /** The dates' title (Experiences > Steps: "Pick a date"). */
  dateTitle?: string };
export type FlowLinks = {
  /** The community application (Apply for membership). */
  apply: string;
  /** My Bookings on this site (/bookings). */
  account: string;
  /** Create account on this site (/signup), with the way back to this ride. */
  signup: string;
  /** Each detail staff may ask for, by the page of My Account that holds it (customer_fix_fields' names). */
  fix: Record<string, string>;
  /** The Club page, "" while staff have it switched off. */
  club: string;
  /** Directions to the circuit. */
  place: string | null;
};
type Props = {
  locale: string;
  events: FlowEvent[];
  prices: Prices;
  /** Each type's highest fare (ride_prices max_price, lib/biz.ts faresOf); a type quoted above its fare reads as a range. */
  maxPrices?: Prices;
  /** Riders per account on a circuit night: the booking app's Settings > Business (jcc_account_cap). */
  jccCap?: number;
  /** Seats per account on a ticketed event: Settings > Business (event_seat_max). */
  seatMax?: number;
  items: AddonItem[];
  start: { ev: string | null; session: string | null };
  text: FlowText;
  links: FlowLinks;
  today: string;
  now: number;
  typeNames: Record<string, string>;
  routes: Record<string, TicketRoute | null>;
  /** Experiences itself: Back from the first step and Book another go there. */
  exit: string;
};

type Modal =
  | { kind: "signin" } | { kind: "members" } | { kind: "rejected"; s: BookSession } | { kind: "fix" }
  | { kind: "gone" }
  | { kind: "gender"; s: BookSession; refusal: Refusal }
  | { kind: "profile"; community: boolean; ask: PgField[]; next: string | null }
  | { kind: "bike"; type: BikeType; slot: number } | { kind: "group"; g: RideGroup } | { kind: "waiver" } | null;
/** `booked`: the rows the database stored (the route's), so a ticket my_bookings did not return in time is still counted. */
type Done = { tickets: TicketRow[]; booked: { id: string; status: string }[]; session: TicketSession | null; addonsSaved: boolean };

/** An amount as the booking app writes it (_sar): the riyal sign left of the number, isolated left to right, two decimals
 *  only when it has a fraction (57.50); a range "lo – hi" when a type's fare may rise. The sign is drawn for the eye alone
 *  and a screen reader reads `word` ("SAR", "ريال"; components/booking/Sar.tsx). */
function Money({ n, hi, word }: { n: number; hi?: number; word: string }) {
  const one = (v: number) => <><span aria-hidden="true">{"⃁"}</span><span className="mm-sr">{word}</span> {riyalNum(v)}</>;
  return <bdi className="tk-amt" dir="ltr">{one(n)}{hi != null && hi !== n && <> – {one(hi)}</>}</bdi>;
}
/** A sentence with an amount (or any piece) where its {0} is. */
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

type AcctState = "loading" | "ready" | "error";

export default function BookingFlow({ locale, events, prices, maxPrices, jccCap = JCC_ACCOUNT_CAP, seatMax = EVENT_SEAT_MAX, items, start, text, links, today, now, typeNames, routes, exit }: Props) {
  const t = useLocalize(T);
  const tk = useLocalize(TICKET);
  const m = bookMoreWords(locale);
  const rtl = isRtl(locale);
  const top = useRef<HTMLDivElement>(null);
  const ev = events.find((e) => e.key === start.ev) ?? events[0] ?? null;
  const evKey = ev?.key ?? null;
  const all = useMemo(() => events.flatMap((e) => e.sessions), [events]);
  // The add-ons the tickets list on the confirmation, by name and price (TicketCard addonItems).
  const ticketItems = useMemo(() => new Map<string, TicketAddonItem>(items.map((x) => [x.id, { name: x.name, price: x.price }])), [items]);
  const [acctState, setAcctState] = useState<AcctState>("loading");
  const [acctNow, setAcctNow] = useState<BookAccount | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = all.find((s) => s.id === selId) ?? null;
  const [step, setStep] = useState<Step>(1);
  const [riders, setRiders] = useState<PartyRider[]>([{ name: "", height: "", type: "" }]);
  const [openRider, setOpenRider] = useState(0);
  const [hEdit, setHEdit] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [waiverOk, setWaiverOk] = useState<string | null>(null); // the session the tick was given for
  const [addons, setAddons] = useState<AddonPick[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoIn, setPromoIn] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ key: string; msg: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [already, setAlready] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [done, setDone] = useState<Done | null>(null);
  // A "Change" on the review: the step it opened goes straight back to the review once all is still in order.
  const [ret, setRet] = useState(false);
  // Sessions whose last place went to another device while this rider was booking (PLACE_GONE): read as full from then on.
  const [gone, setGone] = useState<string[]>([]);
  const isFull = (s: BookSession) => s.full || gone.includes(s.id);
  const fk = () => evKey ?? sel?.kind ?? "";

  const focusTop = useCallback(() => {
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const h = top.current?.querySelector<HTMLElement>("[data-step-title]");
      try { h?.focus({ preventScroll: true }); } catch { /* old browsers */ }
    });
  }, []);
  const go = (n: Step) => {
    setStep(n); setErr(""); setFieldErr(null); if (n === 3) setRet(false);
    if (n === 2) setOpenRider(Math.max(0, riders.findIndex((r) => !riderDone(r, riders.length > 1))));
    focusTop();
  };

  // Sign in first, then back to this very ride: the address carries it across the reload (SignIn reloads the page).
  const keepRide = (s: BookSession | null) => {
    if (!s) return;
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("ev", evKey ?? ""); u.searchParams.set("session", s.id);
      window.history.replaceState(window.history.state, "", u.toString());
    } catch { /* the ride is picked again by hand */ }
  };

  // ── Picking a date, behind the app's gates (selectSessCard) ───────────────────────────────
  // `advance`: on to the date's next step at once (the date was chosen on Experiences, or Continue was pressed).
  const pick = (s: BookSession, a: BookAccount | null = acctNow, advance = false) => {
    if (s.opens || s.satLink || s.handoff || s.fbk) return;
    if (!a) {
      keepRide(s);
      setSelId(s.id);
      setModal({ kind: "signin" });
      return;
    }
    const gate = gateFor(s, a);
    if (gate) { setModal(gate); return; }
    if (selId !== s.id) { setAddons([]); setPromo(null); setPromoIn(""); setPromoMsg(""); setAlready(false); setErr(""); }
    setSelId(s.id);
    funnel("pick", evKey ?? s.kind);
    // a party carried over from another night may be past this night's allowance
    const cap = maxRiders(s, a.live[s.id] ?? 0, jccCap, seatMax);
    const rs = (riders.length > cap ? riders.slice(0, cap) : riders).map((r, i) => ({
      ...r,
      // "my own bike" and carbon are not on every ride; a pick carried over is made again
      type: r.type && typeOptions(s, a.hidden).includes(r.type as BikeType) ? r.type : ("" as const),
      height: r.height || (i === 0 && a.height ? String(a.height) : ""),
    }));
    setRiders(rs);
    if (advance) { setStep(nextStep(s, 1)); setOpenRider(0); focusTop(); }
  };

  // The account, read as the steps open (and again after a sign-in reloads the page): then the date Experiences sent, through
  // the same gates as a tap on its card.
  // null: signed out; undefined: the read failed.
  const loadAcct = async (): Promise<BookAccount | null | undefined> => {
    setAcctState("loading");
    try {
      const r = await fetch("/api/booking/account", { cache: "no-store" });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; signedIn?: boolean; acct?: BookAccount } | null;
      if (!b?.ok) { setAcctState("error"); return undefined; }
      const a = b.signedIn && b.acct ? b.acct : null;
      setAcctNow(a); setAcctState("ready");
      return a;
    } catch {
      setAcctState("error");
      return undefined;
    }
  };
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadAcct().then((a) => {
      const s = start.session ? all.find((x) => x.id === start.session) : undefined;
      if (!s || s.opens || s.satLink || s.handoff || s.fbk) return;
      // signed in, on through the date's gates; signed out, the sign-in pop-up asks first and the page comes back to this
      // date; a read that failed leaves the date picked with Try again
      setSelId(s.id);
      if (a) pick(s, a, true);
      else if (a === null) setModal({ kind: "signin" });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the steps open once, on the date the address names

  // The funnel's steps (lib/funnel.ts): the dates of an event shown, the details step, the review.
  useEffect(() => {
    if (done || !evKey) return;
    if (step === 1) funnel("list", evKey);
    else if (step === 2) funnel("step2", evKey);
    else if (step === 3) funnel("step3", evKey);
  }, [done, evKey, step]);

  // Escape closes a pop-up.
  useEffect(() => {
    if (!modal) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [modal]);

  const steps = sel ? regSteps(sel) : (ev && eventSteps(ev.sessions)) || ([1, 2, 3] as Step[]);
  const stepLabel = (v: Step) => (v === 1 ? t.stepRide : v === 2 ? (sel && !needsBike(sel) ? t.participants : t.stepRiders) : t.stepConfirm);
  const stepName = done ? "" : ev ? `${stepLabel(step)} · ${fill(t.stepOf, Math.max(0, steps.indexOf(step)) + 1, steps.length)}` : "";
  useEffect(() => {
    if (!stepName) return;
    const base = document.title;
    document.title = `${stepName} · ${base}`;
    return () => { document.title = base; };
  }, [stepName]);
  const free = !!sel?.free;
  const booked = sel && acctNow ? acctNow.live[sel.id] ?? 0 : 0;
  const cap = sel ? maxRiders(sel, booked, jccCap, seatMax) : jccCap;
  const qty = riders.length;
  const typeName = (ty: string) => typeNames[ty] ?? ty;
  const pillName = (ty: string) => t.types[ty] ?? ty;
  // men only, women only or mixed: the booking app's .sg-chip (components/site/site.css)
  const chip = (s: BookSession) => {
    const c = genderChip(s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed });
    return c ? <span className={`sg-chip sg-${c.cls}`}>{c.label}</span> : null;
  };

  // ── Riders ───────────────────────────────────────────────────────────────────────────────
  // A party that names each place (an event's seats, the Farm House Night's family): its count, the first place the
  // account holder's
  const setQty = (d: number) => {
    if (!sel || !partyRide(sel)) return;
    const n = Math.max(1, Math.min(cap, qty + d));
    setRiders((rs) => (n > rs.length ? [...rs.map((r, i) => (i === 0 && !r.name && acctNow ? { ...r, name: acctNow.name } : r)), ...Array.from({ length: n - rs.length }, () => ({ name: "", height: "", type: "" as const }))] : rs.slice(0, n)));
    setFieldErr(null);
  };
  const kidsOn = (s: BookSession) => typeOptions(s, acctNow?.hidden ?? []).includes("Kids");
  const setPartyN = (a: number, k: number) => {
    const kt = sel && kidsOn(sel) ? "Kids" : null;
    setRiders((rs) => setParty(rs, a, k, cap, kt).map((r, i) => (i === 0 && !r.name && acctNow && a + k > 1 ? { ...r, name: acctNow.name } : r)));
    setFieldErr(null);
  };
  const setRider = (i: number, p: Partial<Rider>) => {
    setRiders((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
    if (fieldErr?.key.endsWith(`-${i}`)) setFieldErr(null);
  };
  const setType = (i: number, ty: BikeType) => setRider(i, { type: ty });
  // The height as typed, its Arabic-Indic digits read as ASCII; a height of 144 cm or under picks the Kids bike where the
  // ride offers it (the owner, 2026-11-10).
  const setHeight = (i: number, raw: string) => {
    const v = asciiDigits(raw).replace(/\D/g, "").slice(0, 3);
    const kids = !!sel && kidsHeight(v) && typeOptions(sel, acctNow?.hidden ?? []).includes("Kids");
    setRider(i, kids ? { height: v, type: "Kids" } : { height: v });
  };
  // One message per mistake: at its field, nowhere else, and the field brought into view.
  const showRiderErr = (e: RiderError) => {
    const key = e.field === "group" ? "group" : e.field === "kids" ? `type-${e.i}` : `${e.field}-${e.i}`;
    const msg = e.field === "group" ? t.err.group : e.field === "height" ? t.err.height : e.field === "type" ? t.err.pick_type : e.field === "kids" ? t.err.kids : t.err.name;
    setFieldErr({ key, msg });
    setOpenRider(e.field === "group" ? 0 : e.i);
    if (e.i === 0 && e.field === "height") setHEdit(true);
    requestAnimationFrame(() => document.getElementById(`bk-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const riderErr = (): RiderError | null => {
    if (!sel) return null;
    if (needsBike(sel)) return validateRiders(sel, riders, group, acctNow?.name ?? "");
    const i = unnamedPlace(riders, acctNow?.name ?? "");
    return i >= 0 ? { i, field: "name" } : null;
  };
  const ridersOk = () => {
    if (!sel) return false;
    const e = riderErr();
    if (e) showRiderErr(e);
    return !e;
  };
  const changeTo = (rider: number | null) => {
    setRet(true);
    if (rider === null) { go(1); return; }
    go(2); setOpenRider(rider); if (rider === 0) setHEdit(true);
    requestAnimationFrame(() => { const el = document.getElementById(`bk-h-${rider}`) ?? document.getElementById(`bk-name-in-${rider}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); });
  };
  const reviewReady = () => !riderErr();

  // ── Promo (applyPromoCode) ───────────────────────────────────────────────────────────────
  const applyPromo = async (codeIn?: string) => {
    if (codeIn != null) setPromoIn(codeIn);
    const v = asciiDigits((codeIn ?? promoIn).trim());
    if (!v) { setPromo(null); setPromoMsg(""); return; }
    setPromoBusy(true);
    let d: Record<string, unknown> | null = null;
    // Any code the browser asks about itself (metered per visitor); one that belongs to an account is asked again by the
    // server with the rider's own token.
    const r = await rpcResult<Record<string, unknown>>("promo_lookup", { p_code: v, p_id: null, p_token: null });
    if ("data" in r && r.data && typeof r.data === "object" && !Array.isArray(r.data)) d = r.data;
    if (d && d.ok !== true && d.reason === "not_yours" && acctNow) {
      let mine: Record<string, unknown> | null = null;
      try {
        const res = await fetch("/api/booking/promo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: v }) });
        const b = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (b && typeof b === "object" && (b.ok === true || (res.status < 500 && typeof b.reason === "string" && b.reason !== "generic"))) mine = b;
      } catch { /* lost on the way */ }
      d = mine;
    }
    setPromoBusy(false);
    // A lookup lost on the way is no verdict on the code: what was applied stays.
    if (!d) { setPromoMsg(t.promoMsg.lost); return; }
    if (d.ok !== true) { setPromo(null); setPromoMsg(t.promoMsg[String(d.reason)] ?? t.promoMsg.invalid); return; }
    const refuse = (msg: string) => { setPromo(null); setPromoMsg(msg); };
    // a code for one session or one kind of ride (promo_codes.session_id, ride_kind; the app's n6rPcNotThis)
    const sid = typeof d.session_id === "string" ? d.session_id : "", rk = typeof d.ride_kind === "string" ? d.ride_kind : "";
    if (sel && ((sid && sid !== sel.id) || (rk && rk !== sel.kind))) { refuse(t.promoMsg.not_this); return; }
    const appliesTo = typeof d.applies_to === "string" && d.applies_to ? d.applies_to : null;
    if (appliesTo && !riders.some((x) => x.type === appliesTo)) { refuse(fill(t.promoTypeOnly, typeName(appliesTo))); return; }
    const code = String(d.code ?? v);
    // A personal one-use code pays for rider 1's own bike, never Carbon; a referral code only on a circuit ride or a
    // Petromin night (_ref_code_guard, _blood_code_guard).
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

  // ── Confirm (submitReg) ──────────────────────────────────────────────────────────────────
  // A refusal in the booking app's words: its own (Booking.text.ts) and the ones it has added since (BookMore.words.ts).
  const errText = (e: Refusal | string, detail?: string): string => errWords(e, detail, t, m, locale, cap);
  const refused = (e: Refusal | string, detail?: string) => {
    funnel(e === "place_gone" ? "place_gone" : "refused", fk(), e === "place_gone" ? undefined : e);
    if (e === "place_gone" && sel) { setGone((g) => (g.includes(sel.id) ? g : [...g, sel.id])); setModal({ kind: "gone" }); return; }
    if (e === "signin") { keepRide(sel); setAcctNow(null); setModal({ kind: "signin" }); return; }
    if (e === "members") { setModal({ kind: "members" }); return; }
    if (e === "rejected" && sel) { setModal({ kind: "rejected", s: sel }); return; }
    if (e === "fix_first") { void loadAcct().then(() => setModal({ kind: "fix" })); return; }
    if (e === "already" || e === "one_per_session") { setAlready(true); return; }
    // a type closed or full since this page was read, or none picked: back to the riders, that rider's type to choose again
    if ((e === "pick_type" || e === "type_closed" || e === "type_full" || e === "member_bikes_full") && sel && needsBike(sel)) { go(2); setFieldErr({ key: "type-0", msg: errText(e) }); return; }
    // the waiver is ticked on the review: its row is brought into view, the tick cleared
    if (e === "waiver" && sel) { setWaiverOk(null); if (step !== 3) go(3); requestAnimationFrame(() => document.getElementById("bk-waiver")?.scrollIntoView({ behavior: "smooth", block: "center" })); return; }
    // a page older than the waiver in force: said, then the page reloads into the current one (the booking app's own way)
    if (e === "waiver_outdated") { setErr(errText(e)); window.setTimeout(() => { try { window.location.reload(); } catch { /* stays */ } }, 2500); return; }
    setErr(errText(e, detail));
  };
  // `waitlist`: the rider chose the waitlist (a full session, or the place-gone pop-up's Join waitlist); otherwise a place is
  // asked for, and one another device took first is refused rather than turned into a waitlist place.
  const submit = async (waitlist = false) => {
    if (!sel || busy) return;
    if (!acctNow) { keepRide(sel); setModal({ kind: "signin" }); return; }
    const re = riderErr();
    if (re) { if (hasDetailsStep(sel)) go(2); showRiderErr(re); return; }
    if (needsWaiver(sel) && waiverOk !== sel.id) { document.getElementById("bk-waiver")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
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
          riders: riders.map((r) => ({ name: r.name.trim(), height: needsBike(sel) ? r.height : "", type: needsBike(sel) ? r.type : "" })),
          group: hasRideGroups(sel) ? group : null,
          addons: free ? [] : addons,
          promo: promo ? { code: promo.code, appliesTo: promo.appliesTo } : null,
          waiver: needsWaiver(sel) ? waiverOk === sel.id : false,
          seatOnly: !waitlist && !isFull(sel),
        }),
      });
      const b = (await res.json().catch(() => ({}))) as {
        ok?: boolean; error?: string; detail?: string; tickets?: TicketRow[]; booked?: { id: string; status: string }[]; session?: TicketSession | null; addonsSaved?: boolean;
      };
      if (b.ok && Array.isArray(b.tickets)) {
        const bookedRows = Array.isArray(b.booked) ? b.booked.filter((x) => x && typeof x.id === "string") : [];
        const n = bookedRows.length || b.tickets.length;
        const rowsNow: { status: string }[] = b.tickets.length ? b.tickets : bookedRows;
        funnel(rowsNow.length > 0 && rowsNow.every((r) => r.status === "waitlist") ? "waitlisted" : "booked", fk()); funnelDone();
        setDone({ tickets: b.tickets, booked: bookedRows, session: b.session ?? null, addonsSaved: b.addonsSaved !== false });
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
        refused(b.error ?? "generic", b.detail);
      }
    } catch {
      funnel("refused", fk(), "offline");
      setErr(t.err.offline);
    }
    setBusy(false);
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
  const cardStop = (list: BookSession[]) => tabStop(list, (x) => x.id === selId, (x) => !x.opens && !x.satLink && !x.handoff && !x.fbk);
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
    // Full, no waitlist: listed at full strength, Fully booked where its places would be said, where to go next under its
    // time, and no radio, so nothing chooses it.
    if (s.fbk) {
      return (
        <div key={s.id} className={`sc-card fbk ev-${s.kind}`}>
          {kicker}
          <span className="sc-head"><span className="sc-dot" aria-hidden="true" /><span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span><span className="sc-spots full">{t.fbk}</span></span>
          <span className="sc-time"><bdi>{s.time}</bdi></span>
          <span className="sc-meta sc-fbk-l"><CalendarIcon size={13} /><bdi>{s.kind === "saturday" ? t.fbkSat : t.fbkNext}</bdi></span>
        </div>
      );
    }
    if (s.opens) {
      // members book first: held from a visitor who is not a member, behind a lock, and when everyone may under its time
      const mfHold = !!s.mf?.held;
      return (
        <div key={s.id} className={`sc-card ev-${s.kind} closed`} role="radio" aria-checked={false} aria-disabled="true">
          {kicker}
          <span className="sc-head"><span className="sc-dot" aria-hidden="true" /><span className="sc-date">{s.day}</span><span className={`sc-spots closed${mfHold ? " mf" : ""}`}><Ic name={mfHold ? "lock" : "clock"} size={13} />{mfHold ? s.mf?.label : s.opens}</span></span>
          <span className="sc-time"><bdi>{s.time}</bdi></span>
          {mfHold && <span className="sc-meta sc-mf-l"><Ic name="clock" size={13} /><bdi>{s.opens}</bdi></span>}
        </div>
      );
    }
    const on = selId === s.id;
    const rej = !!acctNow?.rejected.includes(s.id);
    const full = isFull(s);
    const low = !full && !s.approval && s.left != null && s.left > 0 && s.left <= 3;
    const fewOn = !rej && !full && !low && !!s.few;
    const mfMark = !rej && !full && !low && !fewOn && !!s.mf;
    const meta = [s.collect, s.handoff ? null : fromLine(s)].filter((x) => !!x);
    const out = s.satLink || s.handoff; // a card that goes elsewhere wears an arrow, never a radio dot
    const body = (
      <>
        {kicker}
        <span className="sc-head">
          {!out && <span className={`sc-dot${on ? " on" : ""}`} aria-hidden="true" />}
          <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
          <span className={`sc-spots${rej ? " rej" : full ? " full" : low || fewOn ? " low" : mfMark ? " mf" : ""}`}>{rej ? t.rejCard : full ? t.waitlist : low ? fill(s.left === 1 ? t.left1 : t.leftN, s.left!) : fewOn ? t.few : mfMark ? <><Ic name="people" size={13} />{s.mf?.label}</> : t.available}</span>
        </span>
        <span className="sc-time"><bdi>{s.time}</bdi></span>
        {meta.length > 0 && <span className="sc-meta">{meta.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
        {s.kind === "event" && s.description && <span className="sc-desc">{s.description}</span>}
      </>
    );
    if (out) return <a key={s.id} href={out} className={`sc-card ev-${s.kind}${rej ? " rej" : ""}`}>{body}<Ic name="go" size={16} flip className="sc-go" /></a>;
    return (
      <button key={s.id} type="button" className={`sc-card ev-${s.kind}${on ? " sel" : ""}${rej ? " rej" : ""}`} role="radio" aria-checked={on} tabIndex={stop ? 0 : -1} data-id={s.id} onClick={() => pick(s)}>
        {body}
      </button>
    );
  };
  const fErr = (key: string) => (fieldErr?.key === key ? <p className="bk-ferr" role="alert">{fieldErr.msg}</p> : null);
  // The promo code behind a link that opens it in place, open while a code is applied, typed or answered. None on a free
  // ride (no pay controls on a free ride, the owner, 2026-10-06).
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
  const selName = (s: BookSession) => (s.kind === "jcc" ? ev?.title || tk.venueCircuit : s.name);
  const side = () => sel && (
    <aside className="bk-side" aria-label={t.summary}>
      <p className="bk-side-h">{t.summary}</p>
      <p className="bk-side-k">{selName(sel)}</p>
      {chip(sel) && <p className="bk-side-sg">{chip(sel)}</p>}
      <p className="bk-side-when">{sel.near && <><strong>{sel.near}</strong> · </>}{sel.day}</p>
      <p className="bk-side-time"><bdi>{sel.time}</bdi></p>
      {needsBike(sel) && <p className="bk-side-row"><span>{t.numBikes}</span><span>{qty}</span></p>}
      {!needsBike(sel) && qty > 1 && <p className="bk-side-row"><span>{t.participants}</span><span>{qty}</span></p>}
      {!free && <p className="bk-side-total"><span>{t.total}</span>{grand}</p>}
    </aside>
  );

  // ── The steps ────────────────────────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  // Back on every step goes to the step before it; from the first step (or a step the date opened on), to Experiences.
  const back = (from: Step) => {
    if (from === 1) { window.location.assign(exit); return; }
    if (sel) go(prevStep(sel, from));
  };
  // The bar under each step: Back and the step's button, in the page (never fixed to the bottom of the screen).
  const bar = (from: Step, children: React.ReactNode) => (
    <div className="bk-foot">
      <button type="button" className="bk-btn2" disabled={busy} onClick={() => back(from)}><Ic name="back" flip /> {t.back}</button>
      {children}
    </div>
  );
  const wlChip = <span className="bk-wl-chip">{t.waitlist}</span>;
  if (done) {
    const rows: { status: string }[] = done.tickets.length ? done.tickets : done.booked;
    const allWl = rows.length > 0 && rows.every((r) => r.status === "waitlist");
    const missing = done.tickets.length < done.booked.length;
    const appr = !!done.session?.approval || !!sel?.approval;
    const name = sel ? selName(sel) : t.ride;
    const ds = done.session;
    const isBooked = !allWl && !appr;
    body = (
      <section aria-labelledby="bk-done-h">
        <div className="bk-head">
          <h2 id="bk-done-h" className="bk-title sx6-done-h" tabIndex={-1} data-step-title>{isBooked && <span className="sx6-done-tick" aria-hidden="true"><Ic name="tick" size={18} /></span>}{allWl ? t.doneWl : appr ? t.doneReserved : t.doneBooked}</h2>
          {missing && <p className="bk-sub">{t.doneInAccount}</p>}
        </div>
        {!done.addonsSaved && <p className="bk-warn" role="status">{t.addonsNotSaved}</p>}
        <div className="tk-grid bk-tickets">
          {done.tickets.map((r) => (
            <TicketCard key={r.id} locale={locale} today={today} rows={[r]} session={ds ?? undefined} name={name}
              cue={ticketCue([r], ds ?? undefined, null)} t={tk} gather={text.gather} start={text.start} typeName={typeName}
              links={{ edit: null, manage: links.account, place: ds?.approval ? ds.meetUrl : links.place }}
              route={routes[r.sessionId] ?? null} now={now} wallet={{ bookingId: r.id, groupIds: [r.id] }} addonItems={ticketItems} />
          ))}
        </div>
        <div className="bk-foot">
          <a className="bk-btn2" href={links.account}>{t.myBookings}</a>
          <a className="bk-btn" href={exit}>{t.another}</a>
        </div>
      </section>
    );
  } else if (!ev) {
    body = (
      <section aria-labelledby="xs-h1">
        <h2 id="xs-h1" className="xs-title" tabIndex={-1} data-step-title>{text.eventTitle}</h2>
        <div className="xs-empty"><p>{text.noDates || t.noRides}</p></div>
        <div className="bk-foot"><a className="bk-btn2" href={exit}><Ic name="back" flip /> {t.back}</a></div>
      </section>
    );
  } else if (acctState !== "ready" && !modal) {
    // the account is being read (or could not be): the steps wait for it, with Try again when it failed
    body = (
      <section aria-labelledby="bk-wait-h">
        <h2 id="bk-wait-h" className="mm-sr">{ev.title}</h2>
        {acctState === "loading"
          ? <p className="bk-wait" role="status"><span className="bk-spin" aria-hidden="true" /> {m.loading}</p>
          : <div className="bk-wait"><p className="bk-err" role="alert">{t.err.offline}</p><button type="button" className="bk-btn" onClick={() => void loadAcct().then((a) => { if (a && sel) pick(sel, a, true); })}>{m.retry}</button></div>}
      </section>
    );
  } else if (step === 1 || !sel) {
    const stop = cardStop(ev.sessions);
    const live1 = datesLive(ev.sessions);
    body = (
      <section aria-labelledby="bk-ride-h">
        {head(text.dateTitle || t.rideTitle, "bk-ride-h")}
        <p className="xs-picked">{ev.title}</p>
        {ev.note && <p className="bk-evnote">{ev.note}</p>}
        {ev.sessions.length === 0 ? (
          <div className="xs-empty"><p>{text.noDates || t.noRides}</p></div>
        ) : (
          <div className="sc-list" role="radiogroup" aria-labelledby="bk-ride-h" onKeyDown={(e) => cardKeys(e, ev.sessions)}>
            {ev.sessions.map((s, n) => card(s, n === stop))}
          </div>
        )}
        {sel?.community && isFull(sel) && <p className="bk-note bk-full"><span className="bk-full-dot" aria-hidden="true" />{t.fullNote}</p>}
        {ev.sessions.some((s) => s.members) && text.membersNote && <p className="xs-note">{text.membersNote}{links.club && <> <a href={links.club}>{text.clubLink}</a></>}</p>}
        {bar(1, (
          <>
            {sel && (
              <span className="bk-foot-sum">
                <span className="bk-foot-k">{sel.near ?? sel.day}</span>
                <span className="bk-foot-v"><bdi>{sel.time}</bdi>{isFull(sel) && wlChip}</span>
              </span>
            )}
            {live1 && <button type="button" className="bk-btn grow" disabled={!sel} onClick={() => { if (sel) { if (!acctNow || gateFor(sel, acctNow)) { pick(sel); return; } go(ret && reviewReady() ? 3 : nextStep(sel, 1)); } }}>{t.cont}</button>}
          </>
        ))}
      </section>
    );
  } else if (step === 2 && !needsBike(sel)) {
    // the places a party books where there is no bike (the booking app's riders step for an event and the Farm House
    // Night): how many, and each one's name, the first the account holder's
    const farm = sel.kind === "farm";
    body = (
      <section aria-labelledby="bk-riders-h">
        {head(farm ? m.people : t.participants, "bk-riders-h")}
        <div className="bk-card">
          <div className="bk-qty-row">
            <span className="bk-qty-k" id="bk-seats-k">{farm ? m.people : t.numSeats}</span>
            <div className="bk-qty" role="group" aria-labelledby="bk-seats-k">
              <button type="button" onClick={() => setQty(-1)} disabled={qty <= 1} aria-label={t.fewer}><Ic name="minus" size={18} /></button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty(1)} disabled={qty >= cap} aria-label={t.more}><Ic name="plus" size={18} /></button>
            </div>
          </div>
          {riders.map((r, i) => (
            <div key={i} className="bk-field" id={`bk-name-${i}`}>
              <label htmlFor={`bk-name-in-${i}`}>{farm ? (i === 0 ? m.you : `${m.fam} ${i}`) : `${t.fullName} ${i + 1}`}</label>
              <input id={`bk-name-in-${i}`} type="text" autoComplete={i === 0 ? "name" : "off"} dir="auto" autoCapitalize="words" maxLength={60}
                value={i === 0 && !r.name && acctNow ? acctNow.name : r.name} readOnly={farm && i === 0}
                onChange={(e) => setRider(i, { name: e.target.value.replace(/[-‐-―]/g, " ") })} aria-invalid={fieldErr?.key === `name-${i}` || undefined} />
              {fErr(`name-${i}`)}
            </div>
          ))}
        </div>
        {bar(2, <button type="button" className="bk-btn grow" onClick={() => { if (ridersOk()) go(3); }}>{t.toReview}</button>)}
      </section>
    );
  } else if (step === 2) {
    const opts = typeOptions(sel, acctNow?.hidden ?? []);
    const typed = riders.every((r) => !!r.type);
    const pty = partyOf(riders);
    body = (
      <section aria-labelledby="bk-riders-h">
        {head(t.ridersTitle, "bk-riders-h")}
        <div className="bk-card">
          {/* the party: adults and children 5+, at the account's allowance the + rests; one place on a community ride */}
          {!sel.community && cap > 1 && <PartyStepper adults={pty.adults} kids={pty.kids} cap={cap} kidsOk={kidsOn(sel)} onChange={setPartyN} />}
          {riders.map((r, i) => {
            const tstop = tabStop(opts, (ty) => r.type === ty);
            const open = qty === 1 || openRider === i;
            const kidsIn = riders.some((x) => x.child);
            const sum = [`${t.rider} ${i + 1}`, r.child ? t.child : kidsIn ? t.adult : "", r.type ? pillName(r.type) : ""].filter(Boolean).join(" · ");
            const hRow = i === 0 && !hEdit && !!acctNow?.height && r.height === String(acctNow.height) && fieldErr?.key !== "height-0";
            return (
              <div key={i} className={`bk-rider${qty > 1 ? " sx6-fold" : ""}`}>
                {qty > 1 && (
                  <button type="button" className="bk-rider-h sx6-rider-h" aria-expanded={open} aria-controls={`bk-rb-${i}`} onClick={() => setOpenRider(open ? -1 : i)}>
                    <span className="bk-num">{!open && riderDone(r, true) ? <Ic name="tick" size={12} /> : i + 1}</span>
                    <span className="sx6-rider-s">{sum}</span>
                    <Ic name="go" size={16} className={`sx6-chev${open ? " on" : ""}`} />
                  </button>
                )}
                {open && <div id={`bk-rb-${i}`}>
                  {qty > 1 && (
                    <div className="bk-field" id={`bk-name-${i}`}>
                      <label htmlFor={`bk-name-in-${i}`}>{t.riderName}</label>
                      <input id={`bk-name-in-${i}`} type="text" autoComplete={i === 0 ? "name" : "off"} dir="auto" autoCapitalize="words" maxLength={60} placeholder={t.riderNamePh}
                        value={r.name} onChange={(e) => setRider(i, { name: e.target.value.replace(/[-‐-―]/g, " ") })} aria-invalid={fieldErr?.key === `name-${i}` || undefined} />
                      {fErr(`name-${i}`)}
                    </div>
                  )}
                  <div className="bk-field" id={`bk-height-${i}`}>
                    {hRow ? (
                      <p className="sx6-fact"><span className="sx6-fact-k">{t.height}</span><bdi className="sx6-fact-v">{r.height} {t.cm}</bdi>
                        <button type="button" className="bk-change" aria-label={`${t.change} · ${t.height}`} onClick={() => { setHEdit(true); requestAnimationFrame(() => document.getElementById("bk-h-0")?.focus()); }}>{t.change}</button></p>
                    ) : (
                      <>
                        <label htmlFor={`bk-h-${i}`}>{t.height}</label>
                        <div className="bk-unit-wrap">
                          <input id={`bk-h-${i}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3} placeholder={t.heightPh} value={r.height}
                            onChange={(e) => setHeight(i, e.target.value)} aria-describedby={`bk-h-u-${i}`} aria-invalid={fieldErr?.key === `height-${i}` || undefined} />
                          <span className="bk-unit" id={`bk-h-u-${i}`}>{t.cm}</span>
                        </div>
                      </>
                    )}
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
                </div>}
              </div>
            );
          })}
          {promoBox("riders")}
        </div>
        {bar(2, (
          <>
            {typed && !free && <span className="bk-foot-sum tot"><span className="bk-foot-k">{t.total}</span><span className="bk-foot-v">{grand}</span></span>}
            <button type="button" className="bk-btn grow" onClick={() => { if (ridersOk()) go(nextStep(sel, 2)); }}>{t.toReview}</button>
          </>
        ))}
      </section>
    );
  } else {
    const lines = riderPrices(sel, riders, prices, acctLite, maxPrices);
    const picked = addons.map((a) => ({ a, it: items.find((x) => x.id === a.id) })).filter((x) => !!x.it);
    const cats = [...new Set(sellable.map((x) => x.category || "Other"))].sort((a, b) => addonCatRank(a, items) - addonCatRank(b, items) || (t.cats[a] ?? a).localeCompare(t.cats[b] ?? b));
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
    const wvAsk = needsWaiver(sel) && !isAlready;
    const wvOk = waiverOk === sel.id;
    const w = waiverWords(sel, t, m);
    const addonN = addons.reduce((n, a) => n + a.qty, 0);
    const change = (label: string, rider: number | null) => (
      <button type="button" className="bk-change" aria-label={`${t.change} · ${label}`} onClick={() => changeTo(rider)}>{t.change}</button>
    );
    body = (
      <section aria-labelledby="bk-review-h">
        {head(t.reviewTitle, "bk-review-h")}
        {sellable.length > 0 && (
          <div className="bk-card">
            <h3 className="bk-h3 sx6-fold-h">
              <button type="button" className="sx6-fold-tog" aria-expanded={addonsOpen} aria-controls="bk-ad-body" onClick={() => setAddonsOpen((o) => !o)}>
                <span>{t.addonsTitle}</span>{addonN > 0 && <span className="sx6-count">{addonN}</span>}<Ic name="go" size={18} className={`sx6-chev${addonsOpen ? " on" : ""}`} />
              </button>
            </h3>
            {addonsOpen && <div id="bk-ad-body">
              {cats.length > 1 ? cats.map((c) => (
                <div key={c} className="bk-addon-cat"><p className="bk-cat">{t.cats[c] ?? c}</p>{sellable.filter((x) => (x.category || "Other") === c).map(row)}</div>
              )) : sellable.map(row)}
            </div>}
          </div>
        )}
        <div className="bk-card">
          <div className="bk-rv-head">
            <div>
              <p className="bk-k">{needsBike(sel) ? t.rideLabel : t.ride}</p>
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
                {/* a free ride shows no pay controls and no price per place: its total says Free (the owner, 2026-10-06) */}
                {!free && <span className="bk-rv-price">{l.kind === "free" ? t.free : l.kind === "house" ? t.onTheHouse : l.kind === "sar" ? <Money n={l.n} word={word} /> : <Money n={l.lo} hi={l.hi} word={word} />}</span>}
                {hasDetailsStep(sel) && change(who, i)}
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
        {wvAsk && (
          <div className="bk-card sx6-wv" id="bk-waiver">
            <h3 className="bk-h3 sx6-fold-h">
              <button type="button" className="sx6-fold-tog" aria-haspopup="dialog" onClick={() => setModal({ kind: "waiver" })}><span>{w.title}</span><Ic name="go" size={18} flip /></button>
            </h3>
            <div className={`bk-agree sx6-agree${wvOk ? " on" : ""}`}>
              <input type="checkbox" id="bk-wv-cb" checked={wvOk} aria-labelledby="bk-wv-l" onChange={(e) => { setWaiverOk(e.target.checked ? sel.id : null); if (e.target.checked) funnel("waiver", fk()); }} />
              <button type="button" id="bk-wv-l" className="sx6-agree-l" aria-haspopup="dialog" onClick={() => setModal({ kind: "waiver" })}>{w.agree}</button>
            </div>
          </div>
        )}
        {isAlready && <div className="bk-already" role="status"><p className="bk-already-t">{t.already}</p></div>}
        {bar(3, isAlready ? (
          <a className="bk-btn grow" href={links.account}>{t.myBookings}</a>
        ) : (
          <>
            {err && <p className="bk-err" role="alert">{err}</p>}
            {/* the button says the outcome: Join waitlist on a full session, else Book; it rests until the waiver is ticked */}
            <button type="button" className="bk-btn grow" disabled={busy || (wvAsk && !wvOk)} aria-busy={busy} onClick={() => void submit(full)}>
              {busy ? <span className="bk-spin" aria-hidden="true" /> : null}{full ? t.joinWl : t.book}
            </button>
          </>
        ))}
      </section>
    );
  }

  const wide = !done && !!ev && !!sel && step !== 1 && acctState === "ready";
  return (
    <div className={`xs bk${rtl ? " rtl" : ""}`} ref={top}>
      {wide ? <div className="bk-layout"><div className="bk-main">{body}</div>{side()}</div> : body}
      {modal && <Pop modal={modal} close={() => setModal(null)} t={t} m={m} links={links} locale={locale} sel={sel} acct={acctNow}
        onGone={(wl) => {
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
          if (s && a) pick(s, a, step === 1);
        }} pillName={pillName}
        onAgree={sel ? () => { setWaiverOk(sel.id); funnel("waiver", fk()); setModal(null); } : undefined} />}
    </div>
  );
}

/** The waiver a session is agreed under, in the booking app's words: the ride's, the swim's, the activity's (Booking.text.ts),
 *  or the Farm House Night's own (BookMore.words.ts). */
function waiverWords(s: Pick<BookSession, "kind">, t: BookingText, m: BookMoreWords): { title: string; body: string; agree: string } {
  const k = waiverKind(s);
  if (k === "farm") return { title: m.farmWaiverTitle, body: m.farmWaiverBody, agree: m.farmWaiverAgree };
  return t.waiver[k === "blood" ? "activity" : k];
}

/** A refusal in the booking app's words. `detail`: MEMBERS_FIRST's moment everyone may book, GROUP_CAP's number. */
function errWords(e: string, detail: string | undefined, t: BookingText, m: BookMoreWords, locale: string, cap: number): string {
  if (e === "type_closed") return m.typeClosed;
  if (e === "type_full") return m.typeFull;
  if (e === "member_bikes_full") return m.mbFull;
  if (e === "waiver_outdated") return m.waiverOutdated;
  if (e === "members_first") {
    const at = Date.parse(detail ?? "");
    let when = "";
    if (Number.isFinite(at)) {
      try { when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(at)); } catch { /* none */ }
    }
    return when ? fill(m.mfRefused, when) : t.err.not_open;
  }
  if (e === "cap") return fill(t.err.cap, String(cap));
  if (e === "group_cap") return fill(t.err.group_cap, (/\d+/.exec(detail ?? "") ?? [String(cap)])[0]);
  const errs = t.err as Record<string, string>;
  return errs[e] ?? t.err.generic;
}

/** The gate in front of a date for a signed-in rider (selectSessCard): the details staff asked for, the profile page, a
 *  session for the other gender, a ride they were turned down for, a members' ride. Null: book on. */
function gateFor(s: BookSession, a: BookAccount): Modal {
  if (a.asks.length) return { kind: "fix" };
  if (a.profileGate !== "none") return { kind: "profile", community: a.profileGate === "community", ask: a.pgAsk.length ? a.pgAsk : ["birth", "nat"], next: s.id };
  const sg = genderRefused(s, a.gender);
  if (sg) return { kind: "gender", s, refusal: sg };
  if (a.rejected.includes(s.id)) return { kind: "rejected", s };
  if (s.members && !a.member) return { kind: "members" };
  return null;
}

// ── The pop-ups: centred on every screen (never a bottom sheet) ─────────────────────────────────
type PopProps = {
  modal: NonNullable<Modal>; close: () => void; t: BookingText; m: BookMoreWords; links: FlowLinks; locale: string; sel: BookSession | null; acct: BookAccount | null;
  onGone: (waitlist: boolean) => void;
  onPickBike: (slot: number, ty: BikeType) => void; onPickGroup: (g: RideGroup) => void;
  onProfileSaved: (next: string | null, v: { birth: string; nationality: string }) => void; pillName: (ty: string) => string;
  /** The waiver's words in the pop-up its row opens, and its I agree, which ticks it. */
  onAgree?: () => void;
};
function Pop({ modal, close, t, m, links, locale, sel, acct, onGone, onPickBike, onPickGroup, onProfileSaved, pillName, onAgree }: PopProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    return () => { try { from?.focus(); } catch { /* gone */ } };
  }, []);
  useEffect(() => {
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("button, input, select, a[href]")?.focus());
  }, [modal.kind]);
  const x = <button type="button" className="bk-x" onClick={close} aria-label={t.close}><Ic name="close" size={18} /></button>;
  let inner: React.ReactNode = null;
  let label = "bk-pop-t";
  if (modal.kind === "signin") {
    // sign in here (SignIn reloads the page, which comes back to this ride), or make an account on this site
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.signTitle}</h2>{x}</div>
        <SignIn locale={locale} />
      </div>
    );
  } else if (modal.kind === "gone") {
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.goneTitle}</h2>{x}</div>
        <div className="bk-pop-foot">
          <button type="button" className="bk-btn2" onClick={() => onGone(false)}>{sel && !needsBike(sel) ? t.goneOtherNb : t.goneOther}</button>
          <button type="button" className="bk-btn" onClick={() => onGone(true)}>{t.joinWl}</button>
        </div>
      </div>
    );
  } else if (modal.kind === "waiver") {
    const w = sel ? waiverWords(sel, t, m) : t.waiver.bike;
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{w.title}</h2>{x}</div>
        <div className="bk-waiver sx6-wv-body" tabIndex={0} role="region" aria-label={w.title}>{w.body}</div>
        <div className="bk-pop-foot">
          <button type="button" className="bk-btn2" onClick={close}>{t.close}</button>
          {onAgree && <button type="button" className="bk-btn" onClick={onAgree}>{t.agree}</button>}
        </div>
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
    const c = genderChip(modal.s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed });
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><div><h2 id={label} className="bk-pop-title">{t.err[modal.refusal as "men_only" | "women_only"]}</h2>{modal.s.kind !== "jcc" && <p className={`bk-pop-kind ev-${modal.s.kind}`}>{modal.s.name}</p>}</div>{x}</div>
        {c && <p className="bk-pop-msg"><span className={`sg-chip sg-${c.cls}`}>{c.label}</span></p>}
        <div className="bk-pop-foot"><button type="button" className="bk-btn" onClick={close}>{t.rejOk}</button></div>
      </div>
    );
  } else if (modal.kind === "fix") {
    // the details staff asked for (customer_fix_fields, the database's FIX_FIRST): each one a way to its own page of My
    // Account on this site, where it is put right; the booking goes on once none is owed
    const asks = acct?.asks ?? [];
    inner = (
      <div className="bk-pop-body">
        <div className="bk-pop-head"><h2 id={label} className="bk-pop-title">{t.fixTitle}</h2>{x}</div>
        {asks.length > 0 && <ul className="bk-fixlist">{asks.map((k) => <li key={k}>{links.fix[k] ? <a href={links.fix[k]}>{t.fixFields[k] ?? k}</a> : (t.fixFields[k] ?? k)}</li>)}</ul>}
        <a className="bk-btn wide" href={links.fix[asks[0] ?? ""] ?? links.fix.name ?? links.account}>{t.fixGo}</a>
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

// The profile page (_profileGate): the birth date as three pickers and the nationality, saved before the booking goes on;
// only what is asked (the nationality from the first booking, the birth date from the fourth). A community member's go
// where the server asked for them.
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
  // the names come from the browser's Intl (lib/nationality.ts: Saudi Arabia first and in its place), drawn once the pop-up is up
  useEffect(() => { requestAnimationFrame(() => { setNats(natOptions(locale)); setMonths(monthNames(locale)); }); }, [locale]);
  const year = new Date().getFullYear();
  const years = Array.from({ length: 96 }, (_, i) => String(year - 5 - i));
  const dim = bd.y && bd.m ? new Date(Number(bd.y), Number(bd.m), 0).getDate() : 31;
  const birth = bd.y && bd.m && bd.d && Number(bd.d) <= dim ? `${bd.y}-${bd.m}-${bd.d}` : "";
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
      {hb && <div className="bk-field">
        <span className="bk-label" id="bk-pg-b">{t.birth}</span>
        <div className="bk-dob" role="group" aria-labelledby="bk-pg-b">
          <select aria-label={t.day} value={bd.d} disabled={saving} onChange={(e) => setBd({ ...bd, d: e.target.value })}>
            <option value="">{t.day}</option>
            {Array.from({ length: dim }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
          </select>
          <select aria-label={t.month} value={bd.m} disabled={saving} onChange={(e) => setBd({ ...bd, m: e.target.value, d: bd.d && Number(bd.d) > (bd.y && e.target.value ? new Date(Number(bd.y), Number(e.target.value), 0).getDate() : 31) ? "" : bd.d })}>
            <option value="">{t.month}</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((mm, i) => <option key={mm} value={mm}>{months[i] ?? mm}</option>)}
          </select>
          <select aria-label={t.year} value={bd.y} disabled={saving} onChange={(e) => setBd({ ...bd, y: e.target.value, d: bd.d && Number(bd.d) > (e.target.value && bd.m ? new Date(Number(e.target.value), Number(bd.m), 0).getDate() : 31) ? "" : bd.d })}>
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
      {errs.net && <p className="bk-err" role="alert">{t.pgErrNet}</p>}
      <button type="submit" className="bk-btn wide" disabled={saving || !filled}>{saving ? t.pgSaving : t.pgSave}</button>
    </form>
  );
}
