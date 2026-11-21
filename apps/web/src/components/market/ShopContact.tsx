"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { mkErrorKey, mkWaHref, shopHref, type MkError, type MkShopContact } from "@/lib/market/core";
import { mapHref, phoneShown, signInHref, telHref } from "@/lib/market/w3";
import { mkPost } from "@/lib/market/w3-client";
import { herePath } from "@/lib/signup";
import MkIcon from "./MkIcon";
import MkModal from "./MkModal";
import { T as S, mkErrorText } from "./Market.text";
import { useFocusAfter, useFocusKept } from "./w3/focus";
import { T } from "./w3.text";
import "./w3.css";

// A shop's contact buttons, on its page and wherever else its listing is shown: Call, WhatsApp and Map. The map link
// is the shop's own and anyone may open it. The two numbers are never sent with a page: a signed-in account's first
// tap on Call or WhatsApp asks for them (/api/market/contact/shop, thirty shops a day per account) and shows them in
// a centred pop-up as real links; from then on the two buttons are those links themselves, and a number the shop did
// not give has no button. A visitor with no account is sent to sign in and comes back to the same page.
//   slug       the shop's slug
//   name       the shop's trade name in the page's language (the pop-up names the shop under its heading, in the
//              name's own direction; the WhatsApp message names it)
//   signedIn   whether the page was drawn for a signed-in account (a visitor is sent to sign in)
//   mapUrl     the shop's map link, which anyone may open (the shop's map_url), or null
export type ShopContactProps = { slug: string; name: string; signedIn: boolean; mapUrl: string | null; className?: string };

type Load = { state: "idle" } | { state: "loading" } | { state: "ready"; phone: string | null; whatsapp: string | null } | { state: "fail"; error: MkError; detail: string };
const never = () => () => {};

export default function ShopContact({ slug, name, signedIn, mapUrl, className = "" }: ShopContactProps) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  // this page's address, for the way back from the sign-in: the shop's own page until the browser knows better
  const here = useSyncExternalStore(never, () => herePath(window.location.pathname, window.location.search), () => shopHref(slug));
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const wrap = useRef<HTMLDivElement>(null);
  const about = useRef<HTMLParagraphElement>(null);
  // the button that opened the pop-up is the number's own link once the numbers are known: the keyboard goes to the
  // first of the buttons when the pop-up closes, and stays in the pop-up when "Try again" gives way to the numbers
  useFocusAfter(open, wrap);
  useFocusKept(about, load.state);

  const ask = () => {
    setLoad({ state: "loading" });
    void mkPost<MkShopContact>("/api/market/contact/shop", { slug }).then((r) =>
      setLoad(r.ok ? { state: "ready", phone: r.phone ?? null, whatsapp: r.whatsapp ?? null } : { state: "fail", error: r.error, detail: r.detail }));
  };
  const tap = () => {
    setOpen(true);
    if (load.state === "idle" || load.state === "fail") ask();
  };

  const map = mapHref(mapUrl);
  const known = load.state === "ready";
  const tel = known ? telHref(load.phone) : null;
  const wa = known ? mkWaHref(load.whatsapp ?? "", w.shopHello(name)) : null;
  const signIn = signInHref(here);

  return (
    <div ref={wrap} className={`mk-w3-shop${className ? ` ${className}` : ""}`}>
      {!signedIn
        ? <a className="mk-btn2" href={signIn}><MkIcon name="phone" size={18} />{w.call}</a>
        : known
          ? tel && <a className="mk-btn2" href={tel}><MkIcon name="phone" size={18} />{w.call}</a>
          : <button type="button" className="mk-btn2" onClick={tap} aria-haspopup="dialog"><MkIcon name="phone" size={18} />{w.call}</button>}
      {!signedIn
        ? <a className="mk-btn" href={signIn}><MkIcon name="whatsapp" size={18} />{w.whatsapp}</a>
        : known
          ? wa && <a className="mk-btn" href={wa} target="_blank" rel="noopener noreferrer"><MkIcon name="whatsapp" size={18} />{w.whatsapp}</a>
          : <button type="button" className="mk-btn" onClick={tap} aria-haspopup="dialog"><MkIcon name="whatsapp" size={18} />{w.whatsapp}</button>}
      {map && <a className="mk-btn2" href={map} target="_blank" rel="noopener noreferrer"><MkIcon name="map" size={18} />{w.map}</a>}
      {open && (
        <MkModal title={s.contactShop} onClose={() => setOpen(false)}>
          <p ref={about} className="mk-w3-about mk-user" dir="auto">{name}</p>
          {(load.state === "loading" || load.state === "idle") && <p className="mk-w3-wait" role="status" aria-busy="true">{w.loading}</p>}
          {load.state === "fail" && (
            <>
              <p className="mk-err" role="alert">{mkErrorText(s, mkErrorKey(load.error, load.detail))}</p>
              <div className="mk-pop-acts">
                {load.error === "signin"
                  ? <a className="mk-btn" href={signIn}>{w.account}</a>
                  : load.error !== "limit" && load.error !== "gone" && load.error !== "absent" && <button type="button" className="mk-btn" onClick={ask}>{s.retry}</button>}
                <button type="button" className="mk-btn2" onClick={() => setOpen(false)}>{s.close}</button>
              </div>
            </>
          )}
          {load.state === "ready" && (
            <div className="mk-w3-nums">
              {tel && (
                <a className="mk-btn2 mk-btn-wide" href={tel}>
                  <MkIcon name="phone" size={18} /><span className="mm-sr">{w.call}</span><bdi dir="ltr">{phoneShown(load.phone)}</bdi>
                </a>
              )}
              {wa && <a className="mk-btn mk-btn-wide" href={wa} target="_blank" rel="noopener noreferrer"><MkIcon name="whatsapp" size={18} />{w.whatsapp}</a>}
              {!tel && !wa && <p>{w.noNumber}</p>}
            </div>
          )}
        </MkModal>
      )}
    </div>
  );
}
