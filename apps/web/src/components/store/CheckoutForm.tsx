"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import SignIn from "@/components/account/SignIn";
import { cartLines, shipsKsa, subtotalOf, type CartItem } from "@/lib/cart";
import { sized } from "@/lib/img";
import { deliveryFee, type PaySettings } from "@/lib/pay/settings";
import { pick, sar, variantLabel, vatIn, type StoreProduct } from "@/lib/store-core";
import { deliveryOptions, type Fulfil } from "@/lib/store-delivery";
import { checkoutBody, EMPTY_ADDRESS, formProblems, refusalPlace, type Address, type Contact } from "@/lib/store-form";
import { T } from "./Store.text";
import { T as PayT } from "@/components/pay/Pay.text";
import PayMarks from "@/components/pay/PayMarks";
import { Amt, Ic, NoPhoto } from "./bits";
import { AddressFields, Field } from "./CheckoutFields";
import Modal from "./Modal";
import { cartClear, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";
import type { Whens } from "./CartView";

// micromobility.sa/store/checkout: one page. Contact (filled in from the account when signed in; a guest
// orders with a name and a mobile), how to have the order, the address when it is delivered, a note, the
// wallet for a signed-in account with a balance, and the summary with the button that places the order and
// obliges payment (the Saudi E-Commerce Implementing Regulations, art. 7(2)). The server prices the order;
// on its answer the page goes to the payment page, or to the order when the wallet paid it all. A refusal is
// put where it belongs, and nothing the customer typed is cleared: what they type is kept for this visit,
// so signing in (which reloads the page) or coming back from the payment page keeps it too.
export type CheckoutAccount = { name: string; phone: string; email: string } | null;
type Props = {
  locale: string; products: StoreProduct[]; settings: PaySettings; whens: Whens; showroom: { address: string; hours: string };
  account: CheckoutAccount; balance: number; links: { returns: string | null; terms: string | null };
};
type Draft = { contact: Contact; address: Address; note: string; fulfil: Fulfil | null };
const DRAFT_KEY = "mm-checkout";

function loadDraft(account: CheckoutAccount): Draft {
  let d: Partial<Draft> = {};
  try { d = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "{}") as Partial<Draft>; } catch { /* none kept */ }
  const c = d.contact ?? { name: "", phone: "", email: "" };
  return {
    contact: { name: c.name || account?.name || "", phone: c.phone || account?.phone || "", email: c.email || account?.email || "" },
    address: { ...EMPTY_ADDRESS, ...(d.address ?? {}) },
    note: typeof d.note === "string" ? d.note : "",
    // the way picked on the cart wins: the cart and checkout keep it in one place (useCart's FULFIL_KEY)
    fulfil: (savedFulfil() ?? d.fulfil ?? null) as Fulfil | null,
  };
}

export default function CheckoutForm(props: Props) {
  const t = useLocalize(T);
  const live = useCart();
  const ready = useHydrated();
  // The order placed, the page leaves for the payment page with the cart emptied: the order stays drawn as it was
  // (its button busy) until that page opens, never "Your cart is empty" meanwhile - the cart is emptied once that is
  // on screen. Back from the payment page out of the browser's cache, the page is drawn again as it is now.
  const [leaving, setLeaving] = useState<{ cart: CartItem[]; url: string } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!leaving) return;
    cartClear();
    try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* gone with the visit */ }
    window.location.assign(leaving.url);
  }, [leaving]);
  useEffect(() => {
    const back = (e: PageTransitionEvent) => { if (e.persisted) { setLeaving(null); setRound((r) => r + 1); } };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);
  if (!ready) return <div className="st-cart-wait" aria-busy="true" />;
  const cart = leaving?.cart ?? live;
  if (!cart.length) {
    return (
      <div className="st-empty">
        <p>{t.cartEmpty}</p>
        <Link href="/store" className="bk-btn">{t.browse}</Link>
      </div>
    );
  }
  return <Checkout key={round} {...props} cart={cart} onPlaced={(url) => setLeaving({ cart, url })} />;
}

function Checkout({ locale, products, settings, whens, showroom, account, balance, links, cart, onPlaced }: Props & { cart: CartItem[]; onPlaced: (url: string) => void }) {
  const t = useLocalize(T);
  const payT = useLocalize(PayT);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(account));
  const [wallet, setWallet] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [lineErr, setLineErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [signin, setSignin] = useState(false);
  const top = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* not kept */ }
  }, [draft]);

  const lines = cartLines(cart, { products });
  const subtotal = subtotalOf(lines);
  const options = deliveryOptions(settings, { subtotal, shipKsa: shipsKsa(lines) });
  const way = options.find((o) => o.id === draft.fulfil) ?? options[0];
  const fulfil: Fulfil = way?.id ?? "pickup";
  const fee = deliveryFee(settings, fulfil, subtotal) ?? 0;
  const total = Math.round((subtotal + fee) * 100) / 100;
  // The card takes no less than 1 SAR (Moyasar's least): a wallet that would leave it less leaves it 1 SAR, as
  // store_checkout does (bug hunt 2026-11-10, rentals 20261110235200); the summary says what the order will take.
  const take = wallet && account && balance > 0 ? Math.min(balance, total) : 0;
  const left = Math.round((total - take) * 100) / 100;
  const fromWallet = left > 0 && left < 1 ? Math.max(Math.round((total - 1) * 100) / 100, 0) : take;
  const due = Math.round((total - fromWallet) * 100) / 100;
  const blocked = lines.some((l) => l.issue);

  const setContact = (patch: Partial<Contact>) => { setDraft((d) => ({ ...d, contact: { ...d.contact, ...patch } })); setErrs((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ""])) })); };
  const setAddress = (patch: Partial<Address>) => { setDraft((d) => ({ ...d, address: { ...d.address, ...patch } })); setErrs((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ""])), address: "" })); };
  const fail = (m: string) => { setMsg(m); requestAnimationFrame(() => top.current?.focus()); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    setLineErr({});
    if (blocked) return fail(t.fixCart);
    const bad = formProblems({ fulfil, contact: draft.contact, address: draft.address });
    if (bad.length) {
      setErrs(Object.fromEntries(bad.map((k) => [k, t.errs[k] ?? t.errs.fix])));
      setMsg(t.errs.fix);
      const first = document.getElementById(`st-${bad[0]}`);
      requestAnimationFrame(() => first?.focus());
      return;
    }
    setBusy(true);
    try {
      const body = checkoutBody({ items: cart, fulfil, contact: draft.contact, address: draft.address, note: draft.note, wallet: fromWallet > 0, lang: locale });
      const r = await fetch("/api/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string; variant?: string | null };
      if (b.ok && b.url) {
        onPlaced(b.url); // the cart emptied and off to the next page (CheckoutForm)
        return; // the button stays busy while the next page loads
      }
      const code = b.error || "generic";
      const place = refusalPlace(code);
      if (place.line && b.variant) setLineErr({ [b.variant]: t.lineIssue[code] ?? t.lineIssue.gone });
      if (place.field === "address") setErrs((x) => ({ ...x, address: t.errs.address }));
      else if (place.field) setErrs((x) => ({ ...x, [place.field as string]: t.errs[place.field as string] }));
      fail(code === "city" ? t.errs.address : t.errs[code] ?? t.errs.generic);
    } catch {
      fail(t.errs.network);
    }
    setBusy(false);
  }

  const wayName = (id: Fulfil) => (id === "pickup" ? t.pickup : id === "jeddah" ? t.jeddah : t.ksa);
  return (
    <>
      <form className="st-co" onSubmit={submit} noValidate>
        <div className="st-co-main">
          {account ? (
            <p className="st-who"><Ic name="user" size={18} />{t.signedAs(account.name)}</p>
          ) : (
            <div className="st-guest">
              <div><b>{t.guest}</b><p>{t.guestSub}</p></div>
              <button type="button" className="bk-btn2" onClick={() => setSignin(true)}>{t.signIn}</button>
            </div>
          )}

          <section className="bk-card" aria-labelledby="st-co-contact">
            <h2 id="st-co-contact" className="bk-h3">{t.contact}</h2>
            <Field id="st-name" label={t.name} value={draft.contact.name} onValue={(v) => setContact({ name: v })} error={errs.name} autoComplete="name" maxLength={60} />
            <Field id="st-phone" label={t.phone} value={draft.contact.phone} onValue={(v) => setContact({ phone: v })} error={errs.phone} hint={t.phoneWhy}
              type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05X XXX XXXX" maxLength={20} />
            <Field id="st-email" label={t.email} optional={t.optional} value={draft.contact.email} onValue={(v) => setContact({ email: v })} error={errs.email}
              type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={120} />
          </section>

          <section className="bk-card" aria-labelledby="st-co-way">
            <h2 id="st-co-way" className="bk-h3">{t.how}</h2>
            <div className="st-ways-pick big" role="radiogroup" aria-labelledby="st-co-way">
              {options.map((o) => (
                <label key={o.id} className={fulfil === o.id ? "on" : undefined}>
                  <input type="radio" name="st-fulfil" value={o.id} checked={fulfil === o.id} onChange={() => { saveFulfil(o.id); setDraft((d) => ({ ...d, fulfil: o.id })); }} />
                  <span>
                    <b>{wayName(o.id)}</b>
                    <small>{o.id === "pickup" ? [showroom.address, showroom.hours].filter(Boolean).join(" · ") : whens[o.id] ? t.arrives(whens[o.id] as string) : ""}</small>
                  </span>
                  <em>{o.fee === 0 ? t.free : <Amt>{sar(o.fee)}</Amt>}</em>
                </label>
              ))}
            </div>
            {!shipsKsa(lines) && settings.delivery.ksa.on && <p className="bk-note">{t.noCourier}</p>}
          </section>

          {fulfil !== "pickup" && (
            <section className="bk-card" aria-labelledby="st-co-addr">
              <h2 id="st-co-addr" className="bk-h3">{t.address}</h2>
              {errs.address && <p className="bk-ferr" role="alert">{errs.address}</p>}
              <AddressFields t={t} fulfil={fulfil} a={draft.address} set={setAddress} errs={errs} />
            </section>
          )}

          <section className="bk-card" aria-labelledby="st-co-note">
            <h2 id="st-co-note" className="bk-h3">{t.note}</h2>
            <div className="bk-field st-field">
              <label htmlFor="st-note">{t.noteLabel} <span className="bk-hint">{t.optional}</span></label>
              <textarea id="st-note" rows={3} maxLength={300} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
            </div>
          </section>

          {account && balance > 0 && (
            <section className="bk-card" aria-labelledby="st-co-wallet">
              <h2 id="st-co-wallet" className="bk-h3">{t.wallet}</h2>
              <label className={`bk-agree${wallet ? " on" : ""}`}>
                <input type="checkbox" role="switch" checked={wallet} onChange={(e) => setWallet(e.target.checked)} />
                <span>{t.useWallet} <small className="st-bal"><Amt>{t.balance(sar(balance))}</Amt></small></span>
              </label>
            </section>
          )}
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
          <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(subtotal)}</Amt></p>
          <p className="bk-sum-row"><span>{wayName(fulfil)}</span>{fee === 0 ? <span>{t.free}</span> : <Amt>{sar(fee)}</Amt>}</p>
          <p className="bk-sum-tot sep"><span>{t.total}</span><Amt>{sar(total)}</Amt></p>
          <p className="st-vatline">{t.vatOf(sar(vatIn(total)))}</p>
          {fromWallet > 0 && (
            <>
              <p className="bk-sum-row"><span>{t.fromWallet}</span><Amt>{`− ${sar(fromWallet)}`}</Amt></p>
              <p className="bk-sum-row st-due"><span>{t.toPay}</span><Amt>{sar(due)}</Amt></p>
            </>
          )}
          <p ref={top} tabIndex={-1} className="bk-err st-co-msg" role="alert">{msg}</p>
          <button type="submit" className="bk-btn wide st-place" disabled={busy || blocked} aria-busy={busy}>
            {busy ? <><span className="bk-spin" aria-hidden="true" />{t.placing}</> : <><Ic name="lock" size={17} />{t.place(sar(total))}</>}
          </button>
          <p className="st-oblige">{t.oblige}</p>
          <PayMarks label={payT.methods} compact />
          {(links.returns || links.terms) && (
            <p className="st-legal">
              {links.returns && <a href={links.returns}>{t.returnsLink}</a>}
              {links.terms && <a href={links.terms}>{t.terms}</a>}
            </p>
          )}
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
