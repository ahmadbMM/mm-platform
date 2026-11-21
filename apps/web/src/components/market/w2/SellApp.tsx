"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_MINE, mkErrorKey, sellHref, statusKey, type MkCategory, type MkListingMine, type MkMe } from "@/lib/market/core";
import { w2Editable } from "@/lib/market/w2";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";
import MkSignIn from "../MkSignIn";
import { T as M, mkErrorText } from "../Market.text";
import { T } from "../w2.text";
import ConfirmDelete from "./ConfirmDelete";
import SellForm from "./SellForm";
import { w2Get, w2Post } from "./api";
import { W2_BIRTH_HREF, w2RefusalText } from "./say";

// /marketplace/sell and /marketplace/sell/<id>, for a signed-in account: what stands between the account and the form
// is said first, plainly, and then nothing else is offered - no birth date on file (with the way to add one), under
// 18, a paused account, a listing that is no longer the account's or cannot be edited now. Otherwise: the account's
// drafts to carry on with (when it has any and no listing was named), and the form.
// The page reads the account's data on the server and hands it over (`me`, `mine`); when that read failed, the reason
// is here instead and "Try again" reads it through the site's own routes. The form itself is drawn in the browser
// only, because it opens from what this browser kept of it (SellForm).
export type SellAppProps = {
  locale: string;
  /** The listing to edit (/marketplace/sell/<id>), or null for a new one. */
  listingId: number | null;
  cats: MkCategory[];
  me: MkMe | null;
  mine: MkListingMine[] | null;
  error: { error: string; detail: string } | null;
};

const never = () => () => {};
type Data = { me: MkMe; mine: MkListingMine[] };

export default function SellApp({ locale, listingId, cats, me, mine, error }: SellAppProps) {
  const t = useLocalize(M);
  const m = useLocalize(T);
  const up = useSyncExternalStore(never, () => true, () => false);
  const [data, setData] = useState<Data | null>(me && mine ? { me, mine } : null);
  const [why, setWhy] = useState(error);
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [full, setFull] = useState(false);
  const [del, setDel] = useState<MkListingMine | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  // a deleted draft takes its Delete button with it: the keyboard goes to the drafts' heading, not to the page's top
  const asked = useRef(false);
  useEffect(() => {
    if (del) { asked.current = true; return; }
    if (!asked.current) return;
    asked.current = false;
    const on = document.activeElement;
    if (on && on !== document.body && on.isConnected) return;
    document.getElementById("mk-w2-drafts-h")?.focus({ preventScroll: true });
  }, [del]);

  async function reload() {
    if (!cats.length) { window.location.reload(); return; } // the categories come with the page
    setLoading(true);
    const [a, b] = await Promise.all([
      w2Get<{ signedIn?: boolean; me?: MkMe }>("/api/market/me"),
      w2Get<{ items: MkListingMine[] }>("/api/market/listing/mine"),
    ]);
    setLoading(false);
    if (a.ok && a.me && b.ok) { setData({ me: a.me, mine: b.items }); setWhy(null); return; }
    const no = !a.ok ? a : !b.ok ? b : null;
    setWhy(no ? { error: no.error, detail: no.detail } : { error: "signin", detail: "" });
  }
  async function remove() {
    if (!del || !data) return;
    setDelBusy(true);
    const r = await w2Post<{ listing: MkListingMine }>("/api/market/listing/state", { id: del.id, action: "deleted" });
    setDelBusy(false);
    if (!r.ok && r.error !== "gone") { setDelErr(w2RefusalText(t, m, r.error, r.detail)); return; }
    setData({ me: data.me, mine: data.mine.filter((l) => l.id !== del.id) });
    setFull(false);
    setDel(null);
  }

  const title = <h1>{listingId === null ? t.sell : m.editTitle}</h1>;
  if (!up || loading) return <>{title}<div className="mk-skel" role="status" aria-busy="true"><span /><span /><span /></div></>;
  if (!data) {
    if (why?.error === "signin") return <MkSignIn locale={locale} />;
    const absent = why?.error === "absent";
    return (
      <>
        {title}
        <div className="mk-box">
          <p className="mk-err" role="alert">{mkErrorText(t, mkErrorKey(why?.error ?? "generic", why?.detail))}</p>
          {!absent && <div><button type="button" className="mk-btn2" onClick={() => void reload()}><MkIcon name="again" size={18} />{t.retry}</button></div>}
        </div>
      </>
    );
  }

  const refuse = (text: string, o: { birth?: boolean; status?: MkListingMine["status"]; mine?: boolean } = {}) => (
    <>
      {title}
      <div className="mk-box">
        {o.status && <div><span className={`mk-status mk-status-${o.status}`}>{t[statusKey(o.status)]}</span></div>}
        <p className="mk-w2-plain">{text}</p>
        {o.birth && <div><Link className="mk-btn" href={W2_BIRTH_HREF}>{m.addBirth}</Link></div>}
        {o.mine && <div><Link className="mk-btn2" href={MK_MINE}>{t.myListings}</Link></div>}
      </div>
    </>
  );
  if (data.me.adult === null) return refuse(t.errors.birth, { birth: true });
  if (data.me.adult === false) return refuse(t.errors.adult);
  if (data.me.seller.status === "suspended") return refuse(t.errors.suspended);
  if (!cats.length) {
    return (
      <>
        {title}
        <div className="mk-box">
          <p className="mk-err" role="alert">{t.errors.generic}</p>
          <div><button type="button" className="mk-btn2" onClick={() => window.location.reload()}><MkIcon name="again" size={18} />{t.retry}</button></div>
        </div>
      </>
    );
  }

  if (listingId !== null) {
    const l = data.mine.find((x) => x.id === listingId);
    if (!l) return refuse(t.errors.gone, { mine: true });
    if (!w2Editable(l.status)) return refuse(m.notEditable, { status: l.status, mine: true });
    return <SellForm key={l.id} locale={locale} cats={cats} me={data.me} listing={l} />;
  }

  const drafts = data.mine.filter((l) => l.status === "draft");
  if (!drafts.length || fresh) return <SellForm key="new" locale={locale} cats={cats} me={data.me} listing={null} />;
  const start = () => {
    // ten drafts at most: the eleventh is refused here, in words, before anything is filled in
    if (drafts.length >= data.me.limits.drafts) setFull(true);
    else setFresh(true);
  };
  return (
    <>
      {title}
      <section className="mk-w2-drafts" aria-labelledby="mk-w2-drafts-h">
        <h2 id="mk-w2-drafts-h" tabIndex={-1}>{m.drafts}</h2>
        <ul className="mk-w2-list">
          {drafts.map((l) => (
            <li key={l.id} className="mk-card mk-w2-item">
              <div className="mk-w2-item-top">
                <MkPhoto name={l.photos[0] ?? null} alt="" small noPhoto={t.noPhoto} className="mk-w2-thumb" />
                <div className="mk-w2-item-main">
                  <p className="mk-w2-item-title"><bdi dir="auto">{l.title?.trim() || m.untitled}</bdi></p>
                </div>
              </div>
              <div className="mk-w2-item-acts">
                <Link className="mk-btn mk-w2-act" href={sellHref(l.id)}>{m.act.continue}</Link>
                <button type="button" className="mk-w2-ib mk-w2-ib-red mk-w2-push" aria-label={m.act.delete} title={m.act.delete} onClick={() => { setDelErr(null); setDel(l); }}><MkIcon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
        {full && <p className="mk-err" role="alert">{t.errors.limit_drafts}</p>}
        <div><button type="button" className="mk-btn" onClick={start}><MkIcon name="plus" size={18} />{m.newListing}</button></div>
      </section>
      {del && <ConfirmDelete l={del} t={t} m={m} busy={delBusy} error={delErr} onCancel={() => setDel(null)} onConfirm={() => void remove()} />}
    </>
  );
}
