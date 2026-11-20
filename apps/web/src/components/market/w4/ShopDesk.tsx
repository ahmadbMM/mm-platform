"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_MY_SHOP, MK_SHOP_APPLY, mkErrorKey, shopHref, type MkMe, type MkShopMine } from "@/lib/market/core";
import { w4CanApply, w4State } from "@/lib/market/w4";
import MkIcon from "../MkIcon";
import MkSignIn from "../MkSignIn";
import { T as M, mkErrorText } from "../Market.text";
import { T } from "../w4.text";
import ShopFacts from "./ShopFacts";
import ShopForm from "./ShopForm";
import ShopState from "./ShopState";
import { w4Get } from "./api";

// The two shop pages of a signed-in account (W4):
//   page "apply"   /marketplace/shops/apply: the application form for an account with no shop; for one that has
//                  applied, the application's state, and the form again when it is waiting or was not approved
//                  (opened at once by ?edit=1, the way My shop links here). After sending, the state.
//   page "mine"    /marketplace/my-shop: the shop's state, staff's reason on a refusal with the way to send again,
//                  the details as sent, and for an approved shop its public page's link, how many of its listings
//                  are on sale, and the form for the details it may still change.
// What stands between the account and the form is said first and plainly, and then no form is offered: no birth date
// on file (with the way to add one), under 18, a paused account. The page reads the account's data on the server and
// hands it over; when that read failed the reason is here instead, and "Try again" reads it through the site's own
// routes. The states are drawn on the server too; the form in the browser only (it opens from what this browser kept).
export type ShopDeskProps = {
  page: "apply" | "mine";
  locale: string;
  me: MkMe | null;
  shop: MkShopMine | null;
  error: { error: string; detail: string } | null;
  tag: string;
  /** /marketplace/shops/apply?edit=1: open the form of a waiting or refused application at once. */
  edit?: boolean;
};

const never = () => () => {};
const BIRTH_HREF = "/account/personal";
type Data = { me: MkMe; shop: MkShopMine | null };

export default function ShopDesk({ page, locale, me, shop, error, tag, edit = false }: ShopDeskProps) {
  const t = useLocalize(M);
  const w = useLocalize(T);
  const up = useSyncExternalStore(never, () => true, () => false);
  const [data, setData] = useState<Data | null>(me ? { me, shop } : null);
  const [why, setWhy] = useState(error);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(page === "apply" ? shop === null || (edit && w4CanApply(w4State(shop))) : false);
  const [flash, setFlash] = useState<"sent" | "saved" | null>(null);
  const [logoMissed, setLogoMissed] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  const toHead = () => { window.requestAnimationFrame(() => head.current?.focus()); };

  async function reload() {
    setLoading(true);
    const [a, b] = await Promise.all([
      w4Get<{ signedIn?: boolean; me?: MkMe }>("/api/market/me"),
      w4Get<{ shop: MkShopMine | null }>("/api/market/shop/mine"),
    ]);
    setLoading(false);
    if (a.ok && a.me && b.ok) {
      setData({ me: a.me, shop: b.shop ?? null });
      setWhy(null);
      if (page === "apply" && !b.shop) setForm(true);
      return;
    }
    const no = !a.ok ? a : !b.ok ? b : null;
    setWhy(no ? { error: no.error, detail: no.detail } : { error: "signin", detail: "" });
  }
  function done(saved: MkShopMine, note: "logo" | null) {
    if (!data) return;
    setData({ me: data.me, shop: saved });
    setForm(false);
    setFlash(page === "apply" ? "sent" : "saved");
    setLogoMissed(note === "logo");
    toHead();
  }
  function signedOut() {
    setData(null);
    setWhy({ error: "signin", detail: "" });
  }

  const title = <h1 ref={head} tabIndex={-1}>{page === "apply" ? w.applyTitle : w.myShop}</h1>;
  const waiting = <div className="mk-w4-wrap">{title}<div className="mk-w4-skel" role="status" aria-busy="true" aria-label={t.name}><span /><span /><span /></div></div>;
  if (loading) return waiting;
  if (!data) {
    if (why?.error === "signin") return <MkSignIn locale={locale} />;
    return (
      <div className="mk-w4-wrap">
        {title}
        <div className="mk-empty" role="alert">
          <p>{mkErrorText(t, mkErrorKey(why?.error, why?.detail))}</p>
          {why?.error !== "absent" && <button type="button" className="mk-btn2" onClick={reload}><MkIcon name="again" size={18} />{t.retry}</button>}
        </div>
      </div>
    );
  }

  const mine = data.shop;
  const state = w4State(mine);
  // what stands in the way of the form, said in the shared words
  const block = data.me.seller.status === "suspended" ? "suspended" : data.me.adult === null ? "birth" : data.me.adult === false ? "adult" : null;
  const blocked = block && (
    <div className="mk-empty" role="alert">
      <p>{t.errors[block]}</p>
      {block === "birth" && <Link className="mk-btn2" href={BIRTH_HREF}>{w.addBirth}</Link>}
    </div>
  );

  if (form && !block && (page === "mine" ? state === "approved" : w4CanApply(state))) {
    if (!up) return waiting; // the form opens from what this browser kept: it is drawn there, never on the server
    return (
      <div className="mk-w4-wrap">
        {title}
        <ShopForm locale={locale} mode={page === "mine" ? "edit" : "apply"} shop={mine} termsVersion={data.me.terms_version} tag={tag}
          onDone={done} onSignedOut={signedOut} onCancel={mine ? () => { setForm(false); toHead(); } : undefined} />
      </div>
    );
  }

  const openForm = () => { setFlash(null); setLogoMissed(false); setForm(true); toHead(); };
  const missed = logoMissed && <p className="mk-err" role="alert">{w.logoFail}</p>;

  if (page === "apply") {
    return (
      <div className="mk-w4-wrap">
        {title}
        {mine ? (
          <>
            <ShopState shop={mine} w={w} title={flash === "sent" ? w.sentTitle : undefined}>
              {!block && state === "pending" && <button type="button" className="mk-btn2" onClick={openForm}><MkIcon name="edit" size={18} />{w.change}</button>}
              {!block && state === "rejected" && <button type="button" className="mk-btn" onClick={openForm}><MkIcon name="edit" size={18} />{w.editAgain}</button>}
              <Link className={state === "approved" ? "mk-btn" : "mk-btn2"} href={MK_MY_SHOP}><MkIcon name="shop" size={18} />{w.myShop}</Link>
            </ShopState>
            {missed}
            {blocked}
          </>
        ) : blocked}
      </div>
    );
  }

  return (
    <div className="mk-w4-wrap">
      {title}
      {!mine ? (
        <>
          <div className="mk-empty">
            <p>{w.state.none}</p>
            {!block && <Link className="mk-btn" href={MK_SHOP_APPLY}><MkIcon name="shop" size={18} />{w.applyCta}</Link>}
          </div>
          {blocked}
        </>
      ) : (
        <>
          <ShopState shop={mine} w={w}>
            {state === "approved" && <Link className="mk-btn" href={shopHref(mine.slug)}><MkIcon name="shop" size={18} />{w.openPage}</Link>}
            {!block && state === "approved" && <button type="button" className="mk-btn2" onClick={openForm}><MkIcon name="edit" size={18} />{w.edit}</button>}
            {!block && state === "pending" && <Link className="mk-btn2" href={`${MK_SHOP_APPLY}?edit=1`}><MkIcon name="edit" size={18} />{w.change}</Link>}
            {!block && state === "rejected" && <Link className="mk-btn" href={`${MK_SHOP_APPLY}?edit=1`}><MkIcon name="edit" size={18} />{w.editAgain}</Link>}
          </ShopState>
          {flash === "saved" && <p className="mk-w4-saved" role="status"><MkIcon name="tick" size={18} />{w.saved}</p>}
          {missed}
          {state === "approved" && (
            <p className="mk-w4-count">
              <span>{w.onSale}</span>
              <bdi>{w.onSaleOf(mine.live, mine.live_cap)}</bdi>
            </p>
          )}
          <ShopFacts shop={mine} locale={locale} t={t} w={w} />
          {blocked}
        </>
      )}
    </div>
  );
}
