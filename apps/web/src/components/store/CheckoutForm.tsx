"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import SignIn from "@/components/account/SignIn";
import { cartLines, shipsKsa, type CartItem } from "@/lib/cart";
import { sized } from "@/lib/img";
import type { PaySettings } from "@/lib/pay/settings";
import { pick, sar, variantLabel, vatIn, type StoreProduct } from "@/lib/store-core";
import { deliveryOptions, type Fulfil } from "@/lib/store-delivery";
import { checkoutBody, EMPTY_ADDRESS, refusalPlace, type Address, type Contact } from "@/lib/store-form";
import { slotDays, type District, type Slots } from "@/lib/store-settings";
import {
  checkoutMoney, checkoutProblems, dayLabel, digitalOnly, districtOutcome, fieldCheck, firstOpen, hasBike, hasGiftCard, nextStep, stepOfField,
  stepsFor, timeLabel, type Check, type StepId, type Way,
} from "@/lib/store-checkout";
import { T } from "./Store.text";
import { T as W } from "./w4.text";
import { T as PayT } from "@/components/pay/Pay.text";
import PayMarks from "@/components/pay/PayMarks";
import { Amt, Ic, NoPhoto } from "./bits";
import { AddressFields, Field } from "./CheckoutFields";
import { CodeRow, GiftCardBox, Off, Pills, Step, type StepState } from "./CheckoutBits";
import Modal from "./Modal";
import { cartClear, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";
import { useGiftCard, usePromo } from "./useCode";
import type { Whens } from "./CartView";

// micromobility.sa/store/checkout (store build 2026-11-15, O12-C): steps that close into a summary when done - Contact
// (filled in from the account when signed in; a guest orders with a name and a mobile), Delivery (the way, and a
// scheduled Jeddah day and time when staff offer them, F78), Address (when delivered: the national address, the short
// address looked up when staff switch that on, F76; a Jeddah district the shop does not serve sets the order to be
// collected instead, F79) and Review (a note, a gift order's note, F58; the wallet; a gift card, F57) - beside the
// summary with the code (F67, only beside the discount licence), the starter sets' saving (F31), the all-in total, the
// Terms and Returns, and the button that places the order and obliges payment (the Saudi E-Commerce Implementing
// Regulations, art. 7(2)); payment is the next page (O13-A). Every field marks itself needed or optional (F74) and says
// what is wrong as it is left (F77). The server prices the order; on its answer the page goes to the payment page, or
// to the order when a gift card or the wallet paid it all. A refusal is put where it belongs, and nothing the customer
// typed is cleared: what they type is kept for this visit, so signing in (which reloads the page) or coming back from
// the payment page keeps it too. "Buy now" (?buy=, F35) checks out that line with its extras and leaves the cart alone.
export type CheckoutAccount = { name: string; phone: string; email: string } | null;
type Props = {
  locale: string; intl: string; products: StoreProduct[]; settings: PaySettings; whens: Whens; showroom: { address: string; hours: string };
  account: CheckoutAccount; balance: number; links: { returns: string; terms: string | null };
  licence: string | null; today: string; slots: Slots | null; districts: District[] | null; lookup: boolean;
  /** The buy-now lines (?buy=…&with=…), checked out instead of the cart; null: the cart. */
  buy: CartItem[] | null;
};
type Draft = { contact: Contact; address: Address; note: string; fulfil: Fulfil | null; slot: { day: string; time: string } | null; gift: boolean; giftNote: string };
const DRAFT_KEY = "mm-checkout";

function loadDraft(account: CheckoutAccount): Draft {
  let d: Partial<Draft> = {};
  try { d = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "{}") as Partial<Draft>; } catch { /* none kept */ }
  const c = d.contact ?? { name: "", phone: "", email: "" };
  const slot = d.slot && typeof d.slot.day === "string" && typeof d.slot.time === "string" ? d.slot : null;
  return {
    contact: { name: c.name || account?.name || "", phone: c.phone || account?.phone || "", email: c.email || account?.email || "" },
    address: { ...EMPTY_ADDRESS, ...(d.address ?? {}) },
    note: typeof d.note === "string" ? d.note : "",
    // the way picked on the cart wins: the cart and checkout keep it in one place (useCart's FULFIL_KEY)
    fulfil: (savedFulfil() ?? d.fulfil ?? null) as Fulfil | null,
    slot, gift: d.gift === true, giftNote: typeof d.giftNote === "string" ? d.giftNote.slice(0, 200) : "",
  };
}

export default function CheckoutForm(props: Props) {
  const t = useLocalize(T);
  const live = useCart();
  const ready = useHydrated();
  // The order placed, the page leaves for the payment page with the cart emptied: the order stays drawn as it was
  // (its button busy) until that page opens, never "Your cart is empty" meanwhile - the cart is emptied once that is
  // on screen (a buy-now order leaves it as it was). Back from the payment page out of the browser's cache, the page is
  // drawn again as it is now.
  const [leaving, setLeaving] = useState<{ cart: CartItem[]; url: string; buy: boolean } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!leaving) return;
    if (!leaving.buy) cartClear();
    try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* gone with the visit */ }
    window.location.assign(leaving.url);
  }, [leaving]);
  useEffect(() => {
    const back = (e: PageTransitionEvent) => { if (e.persisted) { setLeaving(null); setRound((r) => r + 1); } };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);
  if (!ready) return <div className="st-cart-wait" aria-busy="true" />;
  const cart = leaving?.cart ?? (props.buy?.length ? props.buy : live);
  if (!cart.length) {
    return (
      <div className="st-empty">
        <p>{t.cartEmpty}</p>
        <Link href="/store" className="bk-btn">{t.browse}</Link>
      </div>
    );
  }
  return <Checkout key={round} {...props} cart={cart} onPlaced={(url) => setLeaving({ cart, url, buy: !!props.buy?.length })} />;
}

function Checkout(props: Props & { cart: CartItem[]; onPlaced: (url: string) => void }) {
  const { locale, intl, products, settings, whens, showroom, account, balance, links, licence, today, slots, districts, lookup, cart, onPlaced } = props;
  const t = useLocalize(T);
  const w = useLocalize(W);
  const payT = useLocalize(PayT);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(account));
  const [wallet, setWallet] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [lineErr, setLineErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [signin, setSignin] = useState(false);
  const [switched, setSwitched] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [foundMsg, setFoundMsg] = useState("");
  const top = useRef<HTMLParagraphElement>(null);
  const promo = usePromo(cart, !!licence);
  const gift = useGiftCard();

  useEffect(() => {
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* not kept */ }
  }, [draft]);

  const lines = cartLines(cart, { products });
  const digital = digitalOnly(lines);
  const bike = hasBike(lines);
  const giftLines = hasGiftCard(lines);
  // the discounts come first (they do not hang on the way); the ways' fees are on what the goods cost after them
  const before = checkoutMoney({ lines, settings, way: "pickup", licence, code: promo.hit?.discount });
  const options = digital ? [] : deliveryOptions(settings, { subtotal: before.subtotal - before.discount, shipKsa: shipsKsa(lines) });
  const picked = options.find((o) => o.id === draft.fulfil) ?? options[0];
  const way: Way = digital ? "digital" : picked?.id ?? "pickup";
  const pickupOn = options.some((o) => o.id === "pickup");
  const money = checkoutMoney({ lines, settings, way, licence, code: promo.hit?.discount, gift: giftLines ? 0 : gift.card?.balance, wallet: wallet && account ? balance : 0 });
  const giftValue = lines.filter((l) => l.product?.kind === "gift_card").reduce((n, l) => n + l.total, 0);
  const blocked = lines.some((l) => l.issue);
  const steps = stepsFor(way);
  const slotsOn = way === "jeddah" && slots ? slots : null;
  const problems = checkoutProblems({ way, contact: draft.contact, address: draft.address, slot: draft.slot, slots, today, districts });
  const [view, setView] = useState<{ open: StepId; seen: StepId[] }>(() => {
    // a way nobody picked yet (not on the cart, not here before) is asked for, even though one is ticked to start with
    const fix = firstOpen(steps, problems);
    const first = !draft.fulfil && steps.includes("delivery") && steps.indexOf("delivery") < steps.indexOf(fix) ? "delivery" : fix;
    return { open: first, seen: steps.slice(0, steps.indexOf(first)) };
  });
  const open = steps.includes(view.open) ? view.open : firstOpen(steps, problems);

  // the step that opens is announced: the keyboard follows it to its heading
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) { opened.current = true; return; }
    const h = document.getElementById(`st-co-${open}-h`);
    h?.focus({ preventScroll: true });
    h?.closest("section")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const words = (c: Check | string): string => {
    const k = typeof c === "string" ? { code: c } : c;
    if (!k) return "";
    if (k.code === "phone_len") return w.phoneLen(k.n ?? 0);
    if (k.code === "postal_len") return w.postalLen(k.n ?? 0);
    if (k.code === "extra_len") return w.extraLen(k.n ?? 0);
    return w.checks[k.code] ?? t.errs[k.code] ?? t.errs.fix;
  };
  const valueOf = (f: string): string => (f in draft.contact ? draft.contact[f as keyof Contact] : f in draft.address ? draft.address[f as keyof Address] : "");
  /** What is wrong with a field, as specifically as it can be said (F77). */
  const problemOf = (f: string) => (f === "slot" || f === "district_unserved" ? words(f) : words(fieldCheck(f, valueOf(f), way) ?? f));
  // a field left (F77): its own check; an empty field is said only once it was flagged, or on Continue
  const check = (f: string) => {
    const v = valueOf(f);
    if (!v.trim() && !errs[f]) return;
    const c = fieldCheck(f, v, way);
    const unserved = f === "district" && !c && districtOutcome(districts, way, v, pickupOn) !== "ok";
    setErrs((e) => ({ ...e, [f]: c ? words(c) : "", ...(f === "district" ? { district_unserved: unserved ? words("district_unserved") : "" } : {}) }));
  };
  const clear = (keys: string[]) => setErrs((e) => ({ ...e, ...Object.fromEntries(keys.map((k) => [k, ""])) }));
  const setContact = (patch: Partial<Contact>) => { setDraft((d) => ({ ...d, contact: { ...d.contact, ...patch } })); clear(Object.keys(patch)); };
  const setAddress = (patch: Partial<Address>) => {
    setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }));
    clear([...Object.keys(patch), "address", ...("district" in patch ? ["district_unserved"] : [])]);
  };
  const setWay = (id: Fulfil) => { saveFulfil(id); setSwitched(null); setDraft((d) => ({ ...d, fulfil: id })); clear(["fulfil", "slot"]); };
  const fail = (m: string) => { setMsg(m); requestAnimationFrame(() => top.current?.focus()); };
  // the field to fix gets the keyboard once its step is open (two frames: the step opens, then draws its fields)
  const focusField = (f: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(f === "slot" ? "st-co-slot" : f === "district_unserved" ? "st-district" : `st-${f}`);
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : el?.querySelector<HTMLElement>("input, textarea"))?.focus();
  }));

  function wayName(id: Way): string {
    if (id === "pickup") return bike ? w.pickupBuilt : t.pickup;
    if (id === "jeddah") return bike ? w.jeddahBuilt : t.jeddah;
    return id === "ksa" ? t.ksa : "";
  }

  /** A Jeddah district the shop does not serve (F79): collected at the showroom instead, said in the delivery step. */
  const unservedSwitch = (): boolean => {
    const d = draft.address.district.trim();
    if (districtOutcome(districts, way, d, pickupOn) !== "switch") return false;
    saveFulfil("pickup");
    setDraft((x) => ({ ...x, fulfil: "pickup" }));
    setSwitched(d);
    clear(["district_unserved", "district"]);
    setView((v) => ({ open: "delivery", seen: [...new Set<StepId>([...v.seen, "contact"])] }));
    return true;
  };

  /** Continue: the step's own fields checked; done, the next step that needs anything opens. */
  function go(st: StepId) {
    const mine = problems.filter((f) => stepOfField(f) === st);
    if (st === "address" && mine.length === 1 && mine[0] === "district_unserved" && unservedSwitch()) return;
    if (mine.length) {
      setErrs((e) => ({ ...e, ...Object.fromEntries(mine.map((f) => [f, problemOf(f)])) }));
      focusField(mine[0]);
      return;
    }
    const seen = [...new Set<StepId>([...view.seen, st])];
    setView({ open: nextStep(steps, st, seen, problems), seen });
  }
  const edit = (st: StepId) => setView((v) => ({ open: st, seen: [...new Set<StepId>([...v.seen, open])] }));

  async function find() {
    const short = draft.address.short;
    const c = fieldCheck("short", short, "ksa");
    if (c) { setErrs((e) => ({ ...e, short: words(c) })); focusField("short"); return; }
    setFinding(true); setFoundMsg("");
    try {
      const r = await fetch(`/api/store/address?short=${encodeURIComponent(short)}&lang=${locale === "ar" ? "ar" : "en"}`);
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; address?: Partial<Address> };
      if (b.ok && b.address) {
        const got = b.address, patch: Partial<Address> = {};
        for (const k of ["district", "street", "building", "postal", "extra", ...(way === "ksa" ? ["city"] : [])] as (keyof Address)[]) {
          const v = typeof got[k] === "string" ? (got[k] as string).trim() : "";
          if (v) patch[k] = v;
        }
        setAddress(patch);
        setFoundMsg(w.found);
      } else setErrs((e) => ({ ...e, short: words(b.error === "not_found" ? "lookup" : "lookup_off") }));
    } catch {
      setErrs((e) => ({ ...e, short: t.errs.network }));
    }
    setFinding(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    setLineErr({});
    if (blocked) return fail(t.fixCart);
    if (problems.length) {
      if (problems.includes("district_unserved") && unservedSwitch()) return fail(w.unserved(draft.address.district.trim(), wayName("pickup")));
      setErrs((x) => ({ ...x, ...Object.fromEntries(problems.map((f) => [f, problemOf(f)])) }));
      const st = stepOfField(problems[0]);
      setView((v) => ({ open: st, seen: [...new Set<StepId>([...v.seen, ...steps.slice(0, steps.indexOf(st))])] }));
      setMsg(t.errs.fix);
      focusField(problems[0]);
      return;
    }
    setBusy(true);
    try {
      const body = checkoutBody({
        items: cart, fulfil: way, contact: draft.contact, address: draft.address, note: draft.note, wallet: money.wallet > 0, lang: locale,
        promo: promo.hit?.code ?? promo.want ?? undefined, giftCard: !giftLines && gift.card ? gift.card.code : undefined,
        gift: !digital && draft.gift, giftNote: draft.giftNote, slot: slotsOn ? draft.slot : null,
      });
      const r = await fetch("/api/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string; variant?: string | null };
      if (b.ok && b.url) {
        promo.remove(); // the code is the order's now
        onPlaced(b.url); // the cart emptied and off to the next page (CheckoutForm)
        return; // the button stays busy while the next page loads
      }
      const code = b.error || "generic";
      const place = refusalPlace(code);
      if (place.line && b.variant) setLineErr({ [b.variant]: t.lineIssue[code] ?? t.lineIssue.gone });
      const field = place.field === "district" ? "district_unserved" : place.field;
      if (field && field !== "promo" && field !== "giftCard") {
        setErrs((x) => ({ ...x, [field]: field === "address" ? t.errs.address : words(field === "district_unserved" || field === "slot" ? field : code) }));
        setView((v) => ({ ...v, open: stepOfField(field) }));
      }
      fail(code === "city" ? t.errs.address : w.checks[code] ?? t.errs[code] ?? t.errs.generic);
    } catch {
      fail(t.errs.network);
    }
    setBusy(false);
  }

  const days = slotsOn ? slotDays(slotsOn, today) : [];
  const slotText = (s: { day: string; time: string } | null) => {
    const tm = s && slotsOn?.times.find((x) => x.id === s.time);
    return s && tm && days.includes(s.day) ? `${dayLabel(s.day, intl)} · ${timeLabel(tm, intl)}` : "";
  };
  const wayLine = (id: Way) => {
    if (id === "pickup") return [whens.pickup ? w.ready(whens.pickup) : "", showroom.address, showroom.hours].filter(Boolean).join(" · ");
    if (id === "jeddah" && slotsOn) return slotText(draft.slot);
    return id !== "digital" && whens[id] ? t.arrives(whens[id] as string) : "";
  };
  const stateOf = (st: StepId): StepState => (st === open ? "open" : view.seen.includes(st) ? "done" : "todo");
  const delivered = way === "jeddah" || way === "ksa";
  const title: Record<StepId, string> = { contact: t.contact, delivery: t.how, address: t.address, review: w.review };
  const a = draft.address;
  const summaries: Record<StepId, string> = {
    contact: [draft.contact.name, draft.contact.phone, draft.contact.email].map((x) => x.trim()).filter(Boolean).join(" · "),
    delivery: [wayName(way), wayLine(way)].filter(Boolean).join(" · "),
    address: [a.district, a.street, a.building, way === "ksa" ? a.city : t.jeddahCity, a.short].map((x) => x.trim()).filter(Boolean).join(", "),
    review: "",
  };

  const sections: Record<StepId, React.ReactNode> = {
    contact: (
      <>
        <Field id="st-name" label={t.name} required requiredLabel={w.required} value={draft.contact.name} onValue={(v) => setContact({ name: v })} onBlur={() => check("name")}
          error={errs.name} autoComplete="name" maxLength={60} />
        <Field id="st-phone" label={delivered ? w.phoneDriver : t.phone} required requiredLabel={w.required} value={draft.contact.phone} onValue={(v) => setContact({ phone: v })}
          onBlur={() => check("phone")} error={errs.phone} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05X XXX XXXX" maxLength={20} />
        <Field id="st-email" label={t.email} optional={t.optional} value={draft.contact.email} onValue={(v) => setContact({ email: v })} onBlur={() => check("email")}
          error={errs.email} type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={120} />
      </>
    ),
    delivery: (
      <>
        {switched && way === "pickup" && <p className="st-co-switched" role="status">{w.unserved(switched, wayName("pickup"))}</p>}
        {options.length ? (
          <div className="st-ways-pick big" role="radiogroup" aria-labelledby="st-co-delivery-h">
            {options.map((o) => (
              <label key={o.id} className={way === o.id ? "on" : undefined}>
                <input type="radio" name="st-fulfil" value={o.id} checked={way === o.id} onChange={() => setWay(o.id)} />
                <span><b>{wayName(o.id)}</b>{wayLine(o.id) && <small>{wayLine(o.id)}</small>}</span>
                <em>{o.fee === 0 ? t.free : <Amt>{sar(o.fee)}</Amt>}</em>
              </label>
            ))}
          </div>
        ) : <p className="bk-ferr" role="alert">{t.errs.fulfil}</p>}
        {slotsOn && days.length > 0 && (
          <div className="st-co-slot" id="st-co-slot">
            <Pills name="st-co-slot-day" label={w.slotDay} value={draft.slot && days.includes(draft.slot.day) ? draft.slot.day : null}
              items={days.map((d) => ({ value: d, label: dayLabel(d, intl) }))}
              onPick={(d) => { setDraft((x) => ({ ...x, slot: { day: d, time: x.slot?.time ?? "" } })); clear(["slot"]); }} />
            <Pills name="st-co-slot-time" label={w.slotTime} value={draft.slot?.time && slotsOn.times.some((x) => x.id === draft.slot?.time) ? draft.slot.time : null}
              items={slotsOn.times.map((x) => ({ value: x.id, label: timeLabel(x, intl) }))}
              onPick={(tm) => { setDraft((x) => ({ ...x, slot: { day: x.slot?.day ?? "", time: tm } })); clear(["slot"]); }} error={errs.slot} />
          </div>
        )}
      </>
    ),
    address: (
      <>
        {errs.address && <p className="bk-ferr" role="alert">{errs.address}</p>}
        <AddressFields t={t} way={way} a={draft.address} set={setAddress} errs={errs} check={check} requiredLabel={w.required}
          districts={districts && way === "jeddah" ? districts.map((d) => pick(locale, d.en, d.ar)) : null}
          lookup={lookup ? { label: w.find, busy: w.finding, busyNow: finding, find: () => void find() } : null} />
        <p className="mm-sr" role="status">{foundMsg}</p>
      </>
    ),
    review: (
      <>
        <div className="bk-field st-field">
          <label htmlFor="st-note">{t.noteLabel}<span className="bk-hint"> {t.optional}</span></label>
          <textarea id="st-note" rows={3} maxLength={300} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
        </div>
        {!digital && (
          <>
            <label className={`bk-agree${draft.gift ? " on" : ""}`}>
              <input type="checkbox" checked={draft.gift} onChange={(e) => setDraft((d) => ({ ...d, gift: e.target.checked }))} />
              <span>{w.isGift}</span>
            </label>
            {draft.gift && (
              <div className="bk-field st-field st-co-giftnote">
                <label htmlFor="st-giftNote">{w.giftNote}<span className="bk-hint"> {t.optional}</span></label>
                <textarea id="st-giftNote" rows={3} maxLength={200} value={draft.giftNote} onChange={(e) => setDraft((d) => ({ ...d, giftNote: e.target.value }))} />
              </div>
            )}
          </>
        )}
        {account && balance > 0 && (
          <label className={`bk-agree${wallet ? " on" : ""}`}>
            <input type="checkbox" role="switch" checked={wallet} onChange={(e) => setWallet(e.target.checked)} />
            <span>{t.useWallet} <small className="st-bal"><Amt>{t.balance(sar(balance))}</Amt></small></span>
          </label>
        )}
        {!giftLines && <GiftCardBox gift={gift} taken={money.gift} intl={intl} t={t} w={w} />}
      </>
    ),
  };

  return (
    <>
      <form className="st-co" onSubmit={submit} noValidate>
        <div className="st-co-main">
          {account ? (
            <p className="st-who"><Ic name="user" size={18} />{t.signedAs(account.name)}</p>
          ) : (
            <div className="st-guest">
              <div><b>{t.guest}</b></div>
              <button type="button" className="bk-btn2" onClick={() => setSignin(true)}>{t.signIn}</button>
            </div>
          )}
          {steps.map((st, i) => (
            <Step key={st} id={st} n={i + 1} of={steps.length} title={title[st]} state={stateOf(st)} summary={summaries[st] || undefined}
              onEdit={() => edit(st)} onContinue={st === "review" ? undefined : () => go(st)} w={w}>
              {sections[st]}
            </Step>
          ))}
        </div>

        <aside className="st-sum st-co-sum" aria-labelledby="st-co-sum">
          <h2 id="st-co-sum" className="st-sum-h">{t.summary}</h2>
          <ul className="st-mini">
            {lines.map((l) => {
              const p = l.product, v = l.variant;
              const issue = lineErr[l.item.variant] || (l.issue === "gone" ? t.gone : l.issue === "out" ? t.out : l.issue === "short" ? t.short(v?.stock ?? 0) : "");
              return (
                <li key={l.item.variant} className={issue ? "bad" : undefined}>
                  <span className="st-mini-img">{p?.images[0] ? <img src={sized(p.images[0], 640)} alt="" loading="lazy" /> : <NoPhoto />}<i>{l.item.qty}</i></span>
                  <span className="st-mini-mid">
                    <b>{p ? pick(locale, p.name_en, p.name_ar) : t.unavailable}</b>
                    {v && variantLabel(v, locale) && <small>{variantLabel(v, locale)}</small>}
                    {issue && <small className="st-line-issue">{issue}</small>}
                  </span>
                  <Amt>{sar(l.unit * l.item.qty)}</Amt>
                </li>
              );
            })}
          </ul>
          <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(money.subtotal)}</Amt></p>
          {money.setOff > 0 && <p className="bk-sum-row st-co-off"><span>{w.setLine}</span><Off n={money.setOff} /></p>}
          {licence && <CodeRow promo={promo} off={money.codeOff} t={t} w={w} />}
          {!digital && <p className="bk-sum-row"><span>{wayName(way)}</span>{(money.fee ?? 0) === 0 ? <span>{t.free}</span> : <Amt>{sar(money.fee ?? 0)}</Amt>}</p>}
          <p className="bk-sum-tot sep"><span>{t.total}</span><Amt>{sar(money.total)}</Amt></p>
          <p className="st-vatline">{t.vatOf(sar(vatIn(Math.max(0, money.total - giftValue))))}</p>
          {money.gift > 0 && <p className="bk-sum-row"><span>{w.giftLine}</span><Off n={money.gift} /></p>}
          {money.wallet > 0 && <p className="bk-sum-row"><span>{t.fromWallet}</span><Off n={money.wallet} /></p>}
          {(money.gift > 0 || money.wallet > 0) && <p className="bk-sum-row st-due"><span>{t.toPay}</span><Amt>{sar(money.due)}</Amt></p>}
          <p ref={top} tabIndex={-1} className="bk-err st-co-msg" role="alert">{msg}</p>
          {/* the pre-contract statement (L05): the Terms and the returns policy, side by side above the button */}
          <p className="st-legal st-co-legal">
            {links.terms && <a href={links.terms} target="_blank" rel="noopener">{t.terms}</a>}
            <a href={links.returns} target="_blank" rel="noopener">{payT.returns}</a>
          </p>
          <button type="submit" className="bk-btn wide st-place" disabled={busy || blocked} aria-busy={busy}>
            {busy ? <><span className="bk-spin" aria-hidden="true" />{t.placing}</> : <><Ic name="lock" size={17} />{t.place(sar(money.total))}</>}
          </button>
          <p className="st-oblige">{t.oblige}</p>
          <PayMarks label={payT.methods} compact />
        </aside>
      </form>
      {/* outside the form: the sign-in is a form of its own */}
      {signin && (
        <Modal title={t.signTitle} onClose={() => setSignin(false)} closeLabel={t.close}>
          <p className="bk-sub sm">{t.signSub}</p>
          <SignIn locale={locale} />
        </Modal>
      )}
    </>
  );
}
