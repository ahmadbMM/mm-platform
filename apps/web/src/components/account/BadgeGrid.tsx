"use client";

import { useRef, useState } from "react";
import Medal from "./Medal";
import ShareImage, { ShareIc } from "./ShareImage";
import { badgeReqWords } from "./BadgeRequest.words";
import { shareWords } from "./BadgeShare.words";
import { fill } from "@/i18n/tx";
import { intlOf } from "@/i18n/locales";
import { lastReq, PDF_MAX, type AskChoice, type BadgeReq } from "@/lib/badge-request";
import { TickIcon } from "@/components/site/Icons";
import { badgeSubject, type ShareSubject } from "@/lib/share-picture";

// Every badge on My Account, as the booking app's account page draws them (_mrBadgesRow,
// _mrBadgeInfo): the earned ones in a grid of equal tiles, the ones still to earn folded under one
// dashed button that shows four of them greyed and how many there are, and a badge's popup -
// what it means, how it is earned, its progress, a dated badge's window, and for one staff gave,
// their note and the day. A ladder (badges that count the same thing to a higher number, the booking
// app's BDG_LADDERS, 2026-10-09) is one tile: its top level reached, a dot per level under its name,
// and every level listed in its popup. The words arrive ready from the page (RideRecord); nothing is
// fetched here. A rider may ask for a badge staff give (rentals 20261108210000, the booking app's _bdr*):
// Request a badge under the badges and Request this badge in a popup open the request dialog (a
// comment, a picture or a PDF), sent to /api/account/badge-request; a waiting request shows on its tile.
// An earned badge's popup offers Share (the booking app's _shrBadge, new features build F12, 2026-11-13): the picture's
// pop-up (ShareImage.tsx) takes the popup's place, and closing it gives the focus back to the badge's tile.
export type BadgeView = {
  slug: string; icon: string; color: string; on: boolean;
  name: string; how: string; about: string;
  /** "4/5", "78%" on a badge still to earn; null when there is no count. */
  prog: string | null;
  /** "Given by the MicroMobility team · 3 Oct 2026" and the note staff wrote. */
  given: { line: string; note: string | null } | null;
  /** "On now, until 29 Feb 2027" / "Opens 1 Dec 2026" on a dated badge not yet earned. */
  season: string | null;
  /** A ladder's levels, lowest first, and how many are reached; null on any other badge. */
  levels: BadgeLevel[] | null;
  lvN: number;
  /** The level its popup offers to ask for (a badge staff give, not reached), and every level of it a request may name. */
  ask: string | null;
  askSlugs: string[];
  /** The day its picture names (when it was given or reached), in the page's words; "" for none. */
  day?: string;
};
/** The badge requests: the account's own, newest first, and the badges the dialog offers; null: none offered. */
export type BadgeAsk = { reqs: BadgeReq[]; choices: AskChoice[]; locale: string };
type Proof = { url: string; kind: "image" | "pdf"; name: string };
type ReqForm = { slug: string; note: string; proof: Proof | null; busy: boolean; err: string };
export type BadgeLevel = { slug: string; icon: string; color: string; on: boolean; name: string; how: string; prog: string | null };
export type BadgeGridText = {
  badges: string; toEarn: string; show: string; hide: string; notEarned: string; howTo: string; earned: string; close: string;
  levelOf: string; maxLevel: string; levels: string;
};

// The colours Medal draws special (its SPECIAL): Race Ready, National Day 96, Run for Her's pink and
// Victory Lap's purple into black.
const special = (c: string) => c === "special" || c === "national" || c === "pink" || c === "vlap" || c === "defe" || c === "volunteer";
// A request waiting, on its tile and in its popup (the booking app's clock); a PDF proof in the dialog.
const Clock = ({ px = 12 }: { px?: number }) => (
  <svg viewBox="0 0 24 24" width={px} height={px} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M12 6.5v11M6.5 12h11" /></svg>
);
const Doc = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z" /><path d="M14 3.4V8h4.6M8.8 12.6h6.4M8.8 16h4.2" />
  </svg>
);
// A picture made small as a receipt is (the long side 1600 px, a JPEG under ~2.5 MB); a PDF as it is, 2 MB at most,
// once its first bytes say PDF (the booking app's _bdrFile).
function readProof(f: File): Promise<Proof | null> {
  const name = (f.name || "").slice(-120);
  return new Promise((ok) => {
    const rd = new FileReader();
    rd.onerror = () => ok(null);
    if (/^application\/pdf$/i.test(f.type) || (!/^image\//.test(f.type) && /\.pdf$/i.test(name))) {
      if (f.size > PDF_MAX) { ok(null); return; }
      rd.onload = () => { const s = String(rd.result || ""), b = s.slice(s.indexOf(",") + 1); ok(/^JVBER/.test(b) ? { url: `data:application/pdf;base64,${b}`, kind: "pdf", name: name || "proof.pdf" } : null); };
      rd.readAsDataURL(f);
      return;
    }
    if (!/^image\//.test(f.type)) { ok(null); return; }
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => ok(null);
      im.onload = () => {
        const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight, 1)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d"); if (!cx) { ok(null); return; }
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        let q = 0.82, u = cv.toDataURL("image/jpeg", q);
        while (u.length > 2_500_000 && q > 0.4) { q -= 0.12; u = cv.toDataURL("image/jpeg", q); }
        ok({ url: u, kind: "image", name: name || "proof.jpg" });
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  });
}
// A level not begun yet in a ladder's popup (the booking app's lock icon).
const Lock = () => (
  <svg className="badge-lvl-lock" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** Share on an earned badge: the page's language and the rider's first name ("" offers no switch); null: no Share. */
export type BadgeShareOn = { locale: string; first: string };

export default function BadgeGrid({ items, t, ask = null, share = null }: { items: BadgeView[]; t: BadgeGridText; ask?: BadgeAsk | null; share?: BadgeShareOn | null }) {
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<BadgeView | null>(null);
  const [reqs, setReqs] = useState<BadgeReq[]>(ask?.reqs ?? []);
  const [form, setForm] = useState<ReqForm | null>(null);
  const [said, setSaid] = useState("");
  const [shr, setShr] = useState<{ n: number; sub: ShareSubject; back: HTMLElement | null } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const rq = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const rqBack = useRef<HTMLElement | null>(null);
  const on = items.filter((x) => x.on), lk = items.filter((x) => !x.on);
  const w = ask ? badgeReqWords(ask.locale) : null, choices = ask?.choices ?? [];
  const waitN = reqs.filter((r) => r.status === "pending").length;
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat(ask?.locale === "en" ? "en-GB" : intlOf(ask?.locale || "en"), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d); }
    catch { return ""; }
  };
  const lastOf = (x: BadgeView) => (ask ? lastReq(reqs, x.askSlugs) : null);
  const waits = (x: BadgeView) => lastOf(x)?.status === "pending";
  const choiceLabel = (c: AskChoice) => (c.level ? `${c.name} · ${fill(t.levelOf, c.level[0], c.level[1])}` : c.name);
  const openReq = (slug: string, from: HTMLElement | null) => {
    rqBack.current = from;
    if (dlg.current?.open) { rqBack.current = back.current; back.current = null; dlg.current.close(); }
    setForm({ slug: choices.some((c) => c.slug === slug) ? slug : "", note: "", proof: null, busy: false, err: "" });
    requestAnimationFrame(() => rq.current?.showModal());
  };
  const pick = async (el: HTMLInputElement) => {
    const f = el.files?.[0];
    el.value = "";
    if (!f || !w) return;
    const p = await readProof(f);
    setForm((x) => x && (p ? { ...x, proof: p, err: "" } : { ...x, err: w.proofBad }));
  };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const f = form;
    if (!f || f.busy || !f.slug || !w) return;
    setForm({ ...f, busy: true, err: "" });
    let res: { ok?: boolean; id?: number; error?: string } = {};
    try {
      const r = await fetch("/api/account/badge-request", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: f.slug, comment: f.note.trim() || null, proof: f.proof?.url ?? null, proofName: f.proof?.name ?? null }),
      });
      res = await r.json().catch(() => ({}));
    } catch { /* no connection: said below */ }
    if (res.ok) {
      setReqs((l) => [{ id: Number(res.id) || 0, slug: f.slug, status: "pending" as const, at: new Date().toISOString(), decidedAt: null, reply: null }, ...l.filter((r) => !(r.slug === f.slug && r.status === "pending"))]);
      setSaid(w.sent);
      rq.current?.close();
      return;
    }
    const err = res.error === "held" ? w.errHeld : res.error === "limit" ? w.errLimit : res.error === "badge" || res.error === "absent" ? w.errBadge
      : res.error === "proof" || res.error === "invalid" ? w.proofBad : res.error === "signin" ? w.errSignin : w.errGeneric;
    setForm((x) => x && { ...x, busy: false, err });
  }
  const show = (x: BadgeView, el: HTMLElement) => {
    back.current = el;
    setOpen(x);
    requestAnimationFrame(() => dlg.current?.showModal());
  };
  const levelOf = (x: BadgeView) => fill(t.levelOf, x.lvN, x.levels?.length ?? 0);
  // the open popup's badge as a picture: it closes, and the picture's pop-up opens in its place
  const shareIt = (x: BadgeView) => {
    if (!share) return;
    const from = back.current;
    back.current = null;
    dlg.current?.close();
    setShr((o) => ({ n: (o?.n ?? 0) + 1, back: from, sub: badgeSubject(x, shareWords(share.locale).badge, t.levelOf) }));
  };
  // the open popup's request line, and the request dialog's picked badge
  const pr = w && open?.ask ? lastOf(open) : null, prWait = pr?.status === "pending", prNo = pr?.status === "declined";
  const prLv = pr && open?.levels ? open.levels.find((y) => y.slug === pr.slug) ?? null : null;
  const fc = form ? choices.find((x) => x.slug === form.slug) ?? null : null, fWas = fc ? reqs.find((r) => r.slug === fc.slug) ?? null : null;
  const tile = (x: BadgeView) => (
    <button key={x.slug} type="button" className={`mr-badge${x.on ? "" : " locked"}${x.given ? " given" : ""}${x.levels ? " ladder" : ""}${special(x.color) ? ` special sp-${x.color}` : ""}`}
      aria-label={`${x.name}${x.levels && x.lvN ? ` · ${levelOf(x)}` : ""}: ${x.how}${x.on ? "" : ` (${w && waits(x) ? w.asked : t.notEarned})`}`} onClick={(e) => show(x, e.currentTarget)}>
      {!x.on && x.prog ? <span className="mr-badge-p">{x.prog}</span> : !x.on && waits(x) ? <span className="mr-badge-p"><Clock px={10} /></span> : null}
      <Medal icon={x.icon} color={x.color} />
      <span className="mr-badge-nm">{x.name}</span>
      {x.levels && <span className="mr-badge-lv" aria-hidden="true">{x.levels.map((y, i) => <i key={y.slug} className={i < x.lvN ? "on" : undefined} />)}</span>}
    </button>
  );
  return (
    <div className="mr-bdg">
      <h3 className="mr-badges-h">{t.badges}<span className="mr-badges-n" dir="ltr">{on.length}/{items.length}</span></h3>
      {on.length > 0 && <div className="mr-badges">{on.map(tile)}</div>}
      {lk.length > 0 && (
        <>
          <button type="button" className="mr-badges-more" aria-expanded={more} aria-controls={more ? "mr-badges-lk" : undefined} onClick={() => setMore((m) => !m)}>
            {!more && <span className="mr-bm-peek">{lk.slice(0, 4).map((x) => <Medal key={x.slug} icon={x.icon} color={x.color} />)}</span>}
            <span className="mr-bm-t">{t.toEarn}<span className="mr-bm-n">{lk.length}</span></span>
            <span className="mr-bm-a">{more ? `${t.hide} ▴` : `${t.show} ▾`}</span>
          </button>
          {more && <div className="mr-badges" id="mr-badges-lk">{lk.map(tile)}</div>}
        </>
      )}
      {w && (choices.length > 0 || waitN > 0) && (
        <div className="mr-bdr">
          {choices.length > 0 && <button type="button" className="mr-bdr-btn" onClick={(e) => openReq("", e.currentTarget)}><Plus />{w.btn}</button>}
          <p className="mr-bdr-hint" aria-live="polite">{said || (waitN ? fill(w.wait, waitN) : w.hint)}</p>
        </div>
      )}
      <dialog ref={dlg} className={`badge-pop-box${open && special(open.color) ? ` special sp-${open.color}` : ""}`} aria-label={open?.name}
        onClose={() => { setOpen(null); back.current?.focus(); }}
        onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        {open && (
          <div className="badge-pop-in">
            <Medal icon={open.icon} color={open.color} className={`badge-pop-ic${open.on ? "" : " locked"}`} />
            <p className="badge-pop-nm">{open.name}</p>
            {open.levels && open.lvN > 0 && <p className="badge-pop-lvn">{levelOf(open)}</p>}
            {open.about && <p className="badge-pop-about">{open.about}</p>}
            {open.levels ? (
              <>
                <p className="badge-pop-how">{t.levels}</p>
                <ol className="badge-lvls">
                  {open.levels.map((y, i) => (
                    <li key={y.slug} className={`badge-lvl${y.on ? " on" : ""}${i === open.lvN - 1 ? " cur" : ""}`}>
                      <Medal icon={y.icon} color={y.color} className={y.on ? "" : "locked"} />
                      <span className="badge-lvl-t"><b>{y.name}</b>{y.how && <small>{y.how}</small>}</span>
                      <bdi className="badge-lvl-n">{y.on ? <TickIcon size={13} /> : y.prog && /^\d+\/\d+$/.test(y.prog) ? y.prog : <Lock />}</bdi>
                    </li>
                  ))}
                </ol>
              </>
            ) : open.how && <><p className="badge-pop-how">{t.howTo}</p><p className="badge-pop-d">{open.how}</p></>}
            {!open.on && open.season && <p className="badge-pop-how badge-pop-sn">{open.season}</p>}
            {open.given?.note && <p className="badge-pop-note"><bdi>{open.given.note}</bdi></p>}
            {open.given ? <p className="badge-pop-earned"><TickIcon size={15} /> {open.given.line}</p>
              : open.levels ? (open.lvN === open.levels.length ? <p className="badge-pop-earned"><TickIcon size={15} /> {t.maxLevel}</p> : null)
              : open.on ? <p className="badge-pop-earned"><TickIcon size={15} /> {t.earned}</p>
              : open.prog ? <p className="badge-pop-prog" dir="ltr">{open.prog}</p> : null}
            {w && open.ask && (
              <div className="badge-pop-req">
                {pr && (prWait || prNo) && <p className="badge-pop-reqst">{prWait && <Clock px={16} />}<span>{prLv && <><b>{prLv.name}</b> · </>}{prWait ? fill(w.pending, day(pr.at)) : w.declined}</span></p>}
                {prNo && pr?.reply && <p className="badge-pop-note"><bdi>{pr.reply}</bdi></p>}
                <button type="button" className={prWait ? "badge-pop-close" : "badge-pop-ask"} onClick={() => openReq((prWait || prNo) && pr ? pr.slug : open.ask || "", null)}>{prWait ? w.change : prNo ? w.again : w.this}</button>
              </div>
            )}
            {share && open.on && <button type="button" className="badge-pop-ask shr-btn" onClick={() => shareIt(open)}><ShareIc /><span>{shareWords(share.locale).share}</span></button>}
            <form method="dialog"><button type="submit" className="badge-pop-close">{t.close}</button></form>
          </div>
        )}
      </dialog>
      {w && (
        <dialog ref={rq} className="bdr-dlg" aria-labelledby="bdr-title"
          onClose={() => { setForm(null); rqBack.current?.focus(); }}
          onClick={(e) => { if (e.target === e.currentTarget && !form?.busy) rq.current?.close(); }}>
          {form && (
              <form className="bdr-in" onSubmit={send}>
                <p id="bdr-title" className="bdr-title">{w.title}</p>
                <label className="bdr-f">{w.badge}
                  <select value={form.slug} disabled={form.busy} onChange={(e) => { const v = e.target.value; setForm((x) => x && { ...x, slug: v, err: "" }); }}>
                    {!fc && <option value="">{w.pick}</option>}
                    {choices.map((x) => <option key={x.slug} value={x.slug}>{choiceLabel(x)}</option>)}
                  </select>
                </label>
                {fc && <div className="bdr-pick"><Medal icon={fc.icon} color={fc.color} /><span><b>{fc.name}</b>{fc.how && <small>{fc.how}</small>}</span></div>}
                {fWas?.status === "pending" && <p className="bdr-was">{fill(w.againNote, day(fWas.at))}</p>}
                <label className="bdr-f"><span>{w.comment} <span className="bdr-opt">({w.optional})</span></span>
                  <textarea rows={3} maxLength={500} placeholder={w.commentPh} value={form.note} disabled={form.busy}
                    onChange={(e) => { const v = e.target.value; setForm((x) => x && { ...x, note: v }); }} />
                </label>
                <div className="bdr-f">
                  <span id="bdr-proof-l">{w.proof} <span className="bdr-opt">({w.optional})</span></span>
                  <p className="bdr-hint" id="bdr-hint">{w.proofHint}</p>
                  {form.proof && (
                    <div className="bdr-file">
                      {form.proof.kind === "image" ? <img className="bdr-thumb" src={form.proof.url} alt="" /> : <span className="bdr-doc"><Doc /></span>}
                      <bdi className="bdr-fname">{form.proof.name}</bdi>
                      <button type="button" className="bdr-rm" disabled={form.busy} onClick={() => setForm((x) => x && { ...x, proof: null, err: "" })}>{w.proofRemove}</button>
                    </div>
                  )}
                  <label className="bdr-up">
                    <input type="file" accept="image/*,application/pdf,.pdf" className="bdr-file-in" aria-labelledby="bdr-proof-l" aria-describedby="bdr-hint" disabled={form.busy} onChange={(e) => pick(e.currentTarget)} />
                    <Plus />{form.proof ? w.proofChange : w.proofPick}
                  </label>
                </div>
                {form.err && <p className="bdr-err" role="alert">{form.err}</p>}
                <div className="bdr-act">
                  <button type="button" className="bdr-cancel" disabled={form.busy} onClick={() => rq.current?.close()}>{w.cancel}</button>
                  <button type="submit" className="bdr-send" disabled={form.busy || !fc}>{form.busy ? w.sending : w.send}</button>
                </div>
              </form>
          )}
        </dialog>
      )}
      {share && shr && <ShareImage key={shr.n} sub={shr.sub} first={share.first} locale={share.locale} onDone={() => { const b = shr.back; setShr(null); b?.focus(); }} />}
    </div>
  );
}
