"use client";

import { useId, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import {
  MK_INBOX, MK_PRICE_MAX, MK_PRICE_MIN, listingHref, mkAmtText, mkCityName, mkDaysLeft, mkErrorKey, mkPick, sellHref, statusKey,
  type MkAction, type MkCommission, type MkListingMine,
} from "@/lib/market/core";
import { W2_STATE_OF, w2Acts, w2GroupOf, w2GroupsIn, w2Whole, type W2Act, type W2Group } from "@/lib/market/w2";
import MkAmt from "../MkAmt";
import MkIcon from "../MkIcon";
import MkModal from "../MkModal";
import MkPhoto from "../MkPhoto";
import MkSignIn from "../MkSignIn";
import { T as M, mkErrorText } from "../Market.text";
import { T } from "../w2.text";
import ConfirmDelete from "./ConfirmDelete";
import ShareButton from "./ShareButton";
import { w2Get, w2Post } from "./api";
import { w2RefusalText } from "./say";

// /marketplace/mine: the account's own listings, the newest change first, each with its state as a chip and only the
// actions that state allows (lib/market/w2.ts w2Acts): a draft is carried on with or deleted; a listing on sale is
// reserved, marked sold, edited, shared or deleted, and renewed in its last week; a reserved one goes back on sale; a
// sold one can go back on sale while the sale can still fall through; an expired one is reposted in one tap. A listing
// our team is checking, or one our team removed, says so plainly (with the reason staff wrote) and offers nothing.
// Marking a listing sold asks what it sold for, and then - when the honour commission is above 0 - a centred pop-up
// shows the commission on that price and the way staff ask for it to be paid. Nothing is enforced and nothing is
// collected here: the sale was between the two people.
export type MyListingsProps = {
  locale: string;
  items: MkListingMine[] | null;
  error: { error: string; detail: string } | null;
  /** How staff ask for the commission to be paid (site_content marketplace.commission_how), for a sold listing's
   *  "Commission" button; marking a listing sold answers its own copy. */
  how: { en: string; ar: string };
  /** The moment the page was drawn on the server, so the browser draws the same days left as the server did. */
  now: number;
};

type Pop =
  | { kind: "sold"; l: MkListingMine }
  | { kind: "commission"; price: number; c: MkCommission }
  | { kind: "delete"; l: MkListingMine };
type StateAnswer = { listing: MkListingMine; commission: MkCommission | null };

export default function MyListings({ locale, items, error, how, now }: MyListingsProps) {
  const t = useLocalize(M);
  const m = useLocalize(T);
  const uid = useId();
  const [list, setList] = useState(items);
  const [why, setWhy] = useState(error);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<W2Group | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowErr, setRowErr] = useState<{ id: number; text: string } | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [popBusy, setPopBusy] = useState(false);
  const [popErr, setPopErr] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  async function reload() {
    setLoading(true);
    const r = await w2Get<{ items: MkListingMine[] }>("/api/market/listing/mine");
    setLoading(false);
    if (r.ok) { setList(r.items); setWhy(null); } else setWhy({ error: r.error, detail: r.detail });
  }
  const signedOut = () => { setPop(null); setList(null); setWhy({ error: "signin", detail: "" }); };
  const put = (l: MkListingMine) => setList((all) => (all ?? []).map((x) => (x.id === l.id ? l : x)));
  const ask = (l: MkListingMine, action: MkAction, sold: number | null = null) =>
    w2Post<StateAnswer>("/api/market/listing/state", { id: l.id, action, ...(sold !== null ? { price: sold } : {}) });

  // reserve, back on sale, renew, repost: one tap, said on the listing's own card when it cannot be done
  async function tap(l: MkListingMine, action: MkAction) {
    if (busyId !== null) return;
    setBusyId(l.id);
    setRowErr(null);
    const r = await ask(l, action);
    setBusyId(null);
    if (r.ok) return put(r.listing);
    if (r.error === "signin") return signedOut();
    setRowErr({ id: l.id, text: w2RefusalText(t, m, r.error, r.detail) });
  }
  const open = (p: Pop) => { setPopErr(null); setPopBusy(false); setPop(p); };
  async function sell(l: MkListingMine) {
    const n = w2Whole(price);
    if (n === null || n < MK_PRICE_MIN || n > MK_PRICE_MAX) { setPopErr(m.need.price); return; }
    setPopBusy(true);
    setPopErr(null);
    const r = await ask(l, "sold", n);
    setPopBusy(false);
    if (!r.ok) { if (r.error === "signin") return signedOut(); setPopErr(w2RefusalText(t, m, r.error, r.detail)); return; }
    put(r.listing);
    if (r.commission && r.commission.pct > 0) setPop({ kind: "commission", price: n, c: r.commission });
    else setPop(null);
  }
  async function remove(l: MkListingMine) {
    setPopBusy(true);
    setPopErr(null);
    const r = await ask(l, "deleted");
    setPopBusy(false);
    if (!r.ok && r.error !== "gone") { if (r.error === "signin") return signedOut(); setPopErr(w2RefusalText(t, m, r.error, r.detail)); return; }
    setList((all) => (all ?? []).filter((x) => x.id !== l.id));
    setPop(null);
  }

  if (loading) return <div className="mk-w2-skel" role="status" aria-busy="true"><span /><span /><span /></div>;
  if (!list) {
    if (why?.error === "signin") return <MkSignIn locale={locale} />;
    const absent = why?.error === "absent";
    return (
      <div className="mk-box">
        <p className="mk-err" role="alert">{absent ? t.errors.absent : why && why.error !== "generic" ? mkErrorText(t, mkErrorKey(why.error, why.detail)) : m.loadFail}</p>
        {!absent && <div><button type="button" className="mk-btn2" onClick={() => void reload()}><MkIcon name="again" size={18} />{t.retry}</button></div>}
      </div>
    );
  }
  if (!list.length) return <div className="mk-empty"><p>{m.empty}</p></div>;

  const groups = w2GroupsIn(list);
  const at = group !== "all" && groups.includes(group) ? group : "all";
  const shown = at === "all" ? list : list.filter((l) => w2GroupOf(l.status) === at);
  const ends = (l: MkListingMine) => {
    const d = mkDaysLeft(l.expires_at, now);
    return d === null ? "" : d <= 0 ? m.endsToday : d === 1 ? m.endsTomorrow : m.endsIn(d);
  };
  const button = (l: MkListingMine, a: W2Act) => {
    const off = busyId !== null;
    switch (a) {
      case "continue": return <Link key={a} className="mk-btn mk-w2-act" href={sellHref(l.id)}>{m.act.continue}</Link>;
      case "edit": return <Link key={a} className="mk-btn2 mk-w2-act" href={sellHref(l.id)}>{m.act.edit}</Link>;
      case "sold": return <button key={a} type="button" className="mk-btn2 mk-w2-act" disabled={off} onClick={() => { setPrice(l.price ? String(l.price) : ""); open({ kind: "sold", l }); }}>{m.act.sold}</button>;
      case "reserve": case "unreserve": case "unsold":
        return <button key={a} type="button" className="mk-btn2 mk-w2-act" disabled={off} aria-busy={busyId === l.id || undefined} onClick={() => void tap(l, W2_STATE_OF[a] ?? "live")}>{m.act[a]}</button>;
      case "repost": return <button key={a} type="button" className="mk-btn mk-w2-act" disabled={off} aria-busy={busyId === l.id || undefined} onClick={() => void tap(l, "renew")}><MkIcon name="again" size={18} />{m.act.repost}</button>;
      case "share": return <ShareButton key={a} id={l.id} title={l.title ?? ""} label={m.act.share} copied={m.linkCopied} className="mk-w2-ib mk-w2-push" iconOnly />;
      case "delete": return <button key={a} type="button" className={`mk-w2-ib mk-w2-ib-red${w2Acts(l, now).includes("share") ? "" : " mk-w2-push"}`} aria-label={m.act.delete} title={m.act.delete} disabled={off} onClick={() => open({ kind: "delete", l })}><MkIcon name="trash" size={18} /></button>;
      default: return null; // "view" is the card's own link; "renew" is the renew card's button
    }
  };

  return (
    <>
      {groups.length > 1 && (
        <div className="mk-chips mk-w2-groups" role="group" aria-label={t.myListings}>
          <button type="button" className="mk-chip" aria-pressed={at === "all"} onClick={() => setGroup("all")}>{m.all}</button>
          {groups.map((g) => <button key={g} type="button" className="mk-chip" aria-pressed={at === g} onClick={() => setGroup(g)}>{m.groups[g]}</button>)}
        </div>
      )}
      <ul className="mk-w2-list">
        {shown.map((l) => {
          const acts = w2Acts(l, now);
          const name = l.title?.trim() || m.untitled;
          const top = (
            <>
              <MkPhoto name={l.photos[0] ?? null} alt="" small noPhoto={t.noPhoto} className="mk-w2-thumb" />
              <span className="mk-w2-item-main">
                <span className="mk-w2-item-title"><bdi dir="auto">{name}</bdi></span>
                <span className="mk-w2-item-meta">
                  {l.price !== null && <MkAmt n={l.price} word={t.sar} />}
                  {l.city && <span>{mkCityName(l.city, locale)}</span>}
                </span>
              </span>
            </>
          );
          const owed = l.status === "sold" && (l.commission_due ?? 0) > 0 && !l.commission_received;
          return (
            <li key={l.id} className="mk-card mk-w2-item">
              <div className="mk-w2-item-head">
                <span className={`mk-status mk-status-${l.status}`}>{t[statusKey(l.status)]}</span>
                {l.threads > 0 && l.status !== "held" && l.status !== "hidden" && (
                  <Link className="mk-link mk-w2-msgs" href={MK_INBOX}>
                    <MkIcon name="chat" size={16} />{m.messages}
                    {l.unread > 0 && <span className="mk-w2-badge" aria-label={m.unread(l.unread)}>{l.unread}</span>}
                  </Link>
                )}
              </div>
              {acts.includes("view") ? <Link className="mk-w2-item-top" href={listingHref(l.id)}>{top}</Link> : <div className="mk-w2-item-top">{top}</div>}
              {l.status === "held" && <p className="mk-w2-note">{m.heldNote}</p>}
              {l.status === "hidden" && (
                <>
                  <p className="mk-w2-note">{m.hiddenNote}</p>
                  {l.hidden_reason?.trim() && <p className="mk-w2-reason"><b>{m.reason}</b><span className="mk-user" dir="auto">{l.hidden_reason}</span></p>}
                </>
              )}
              {l.status === "sold" && l.sold_price !== null && (
                <p className="mk-w2-soldfor">
                  <span>{m.soldFor} <MkAmt n={l.sold_price} word={t.sar} /></span>
                  {owed && (
                    <button type="button" className="mk-link" onClick={() => open({ kind: "commission", price: l.sold_price ?? 0, c: { pct: l.commission_pct ?? 0, due: l.commission_due ?? 0, how_en: how.en, how_ar: how.ar } })}>
                      {m.commission}
                    </button>
                  )}
                </p>
              )}
              {acts.includes("renew") && (
                <div className="mk-w2-renew">
                  <span><MkIcon name="clock" size={16} />{ends(l)}</span>
                  <button type="button" className="mk-btn mk-w2-act" disabled={busyId !== null} aria-busy={busyId === l.id || undefined} onClick={() => void tap(l, "renew")}>{m.act.renew}</button>
                </div>
              )}
              {acts.some((a) => a !== "view" && a !== "renew") && <div className="mk-w2-item-acts">{acts.map((a) => button(l, a))}</div>}
              {rowErr?.id === l.id && <p className="mk-err" role="alert">{rowErr.text}</p>}
            </li>
          );
        })}
      </ul>

      {pop?.kind === "sold" && (
        <MkModal title={m.soldTitle} onClose={() => setPop(null)} busy={popBusy}>
          <form className="mk-w2-soldform" onSubmit={(e) => { e.preventDefault(); if (!popBusy) void sell(pop.l); }} noValidate>
            <p className="mk-w2-about"><bdi dir="auto">{pop.l.title?.trim() || m.untitled}</bdi></p>
            <div className="mk-field">
              <label htmlFor={`${uid}-sold`}>{m.soldPrice}</label>
              <span className="mk-w2-money">
                <span className="mk-amt" aria-hidden="true">{"⃁"}</span>
                <input id={`${uid}-sold`} type="text" inputMode="numeric" dir="ltr" autoComplete="off" maxLength={12} value={price} onChange={(e) => { setPrice(e.target.value); setPopErr(null); }} aria-invalid={popErr ? true : undefined} />
              </span>
            </div>
            {popErr && <p className="mk-err mk-w2-poperr" role="alert">{popErr}</p>}
            <div className="mk-pop-acts">
              <button type="button" className="mk-btn2" onClick={() => setPop(null)} disabled={popBusy}>{t.cancel}</button>
              <button type="submit" className="mk-btn" disabled={popBusy} aria-busy={popBusy || undefined}>{m.act.sold}</button>
            </div>
          </form>
        </MkModal>
      )}
      {pop?.kind === "commission" && (
        <MkModal title={m.commission} onClose={() => setPop(null)}>
          <p className="mk-w2-due"><MkAmt n={pop.c.due} word={t.sar} /></p>
          <p className="mk-w2-of">{m.commissionOf(String(pop.c.pct), mkAmtText(pop.price))}</p>
          {mkPick(locale, pop.c.how_en, pop.c.how_ar).trim() && <p className="mk-w2-how mk-user" dir="auto">{mkPick(locale, pop.c.how_en, pop.c.how_ar)}</p>}
          <div className="mk-pop-acts"><button type="button" className="mk-btn" onClick={() => setPop(null)}>{t.done}</button></div>
        </MkModal>
      )}
      {pop?.kind === "delete" && <ConfirmDelete l={pop.l} t={t} m={m} busy={popBusy} error={popErr} onCancel={() => setPop(null)} onConfirm={() => void remove(pop.l)} />}
    </>
  );
}
