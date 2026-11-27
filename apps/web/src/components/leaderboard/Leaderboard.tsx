"use client";

import "./leaderboard.css";
import "@/components/account/account.css";
import { useRef, useState } from "react";
import Medal from "@/components/account/Medal";
import ShareImage, { ShareIc } from "@/components/account/ShareImage";
import { shareWords } from "@/components/account/BadgeShare.words";
import { boardWords } from "./Leaderboard.words";
import { fill } from "@/i18n/tx";
import { onBackdrop } from "@/lib/backdrop";
import { readProof, type Proof } from "@/lib/proof-file";
import { shareDay, type ShareSubject } from "@/lib/share-picture";
import { riyadhClock } from "@/lib/workshop-days";
import {
  BOARDS, BOARD_MEDAL, boardSubject, claimProblem, kmNum, ownCard, readBoard, readKm, readMine, refusalWord,
  type Board, type BoardAnswer, type BoardGender, type Claim, type MyDistances,
} from "@/lib/distance-board";

// The distance leaderboards' page (micromobility.sa/leaderboard; the booking app's distance-board.js, rentals migration
// 20261127180000): the four boards (Longest ride, This month, Lifetime, This year) behind one switch and men and women
// behind another, each board's rows with their place, the medal on Longest ride, the name a rider switched on (else
// "Member") and the distance. A signed-in rider also sees their own place, the "Show my name on the leaderboards" switch,
// Share (the picture is drawn in the browser, components/account/ShareImage.tsx) once they are ranked, Add a distance
// (one ride, or a total over dates, with a picture or a PDF as proof, for staff to approve) and Your distances, a waiting
// one with Take back. The first board comes drawn from the server; a switch asks /api/leaderboard and keeps each answer
// a minute. Nothing about anyone else but the place, the distance and an opted-in name; no count of riders.

type Hit = { at: number; board: BoardAnswer | null };
type Form = { kind: "ride" | "total"; km: string; d: string; from: string; note: string; proof: Proof | null; busy: boolean; err: string };
const key = (b: Board, g: BoardGender) => `${b}:${g}`;
const today = () => riyadhClock(new Date()).slice(0, 10);
// a board is asked again after a minute, as the booking app's (outside the component: read in a tap, never in a render)
const stale = (at: number) => Date.now() - at > 60_000;
const now = () => Date.now();

// The booking app's plus (Add a distance, Choose a file) and its document (a PDF proof).
const Plus = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M12 6.5v11M6.5 12h11" /></svg>
);
const Doc = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z" /><path d="M14 3.4V8h4.6M8.8 12.6h6.4M8.8 16h4.2" />
  </svg>
);

export type LeaderboardProps = {
  locale: string;
  /** The board the page opened on, as the server read it (null: it could not be read). */
  b: Board; g: BoardGender; board: BoardAnswer | null;
  /** Signed in: the account's own figures (null while they could not be read) and its first name for the picture. */
  signedIn: boolean; mine: MyDistances | null; first: string;
};

export default function Leaderboard({ locale, b: b0, g: g0, board, signedIn, mine: mine0, first }: LeaderboardProps) {
  const w = boardWords(locale), sw = shareWords(locale);
  const [b, setB] = useState<Board>(b0);
  const [g, setG] = useState<BoardGender>(g0);
  const [cache, setCache] = useState<Record<string, Hit>>(() => ({ [key(b0, g0)]: { at: now(), board } }));
  const [mine, setMine] = useState<MyDistances | null>(mine0);
  const [form, setForm] = useState<Form | null>(null);
  const [said, setSaid] = useState("");
  const [pubNow, setPubNow] = useState<boolean | null>(null); // the switch as last set here, until a board says it
  const [shr, setShr] = useState<{ n: number; sub: ShareSubject } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const shareBtn = useRef<HTMLButtonElement>(null);

  async function load(nb: Board, ng: BoardGender) {
    let a: BoardAnswer | null = null;
    try {
      const r = await fetch(`/api/leaderboard?b=${nb}&g=${ng}`, { credentials: "same-origin", cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; board?: unknown } | null;
      a = j?.ok ? readBoard({ ok: true, ...(j.board as object) }) : null;
    } catch { a = null; }
    setCache((c) => ({ ...c, [key(nb, ng)]: { at: now(), board: a } }));
  }
  async function loadMine() {
    if (!signedIn) return;
    try {
      const r = await fetch("/api/account/distances", { credentials: "same-origin", cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; mine?: unknown } | null;
      const m = j?.ok ? readMine({ ok: true, ...(j.mine as object) }) : null;
      if (m) setMine(m);
    } catch { /* the figures stay as they were */ }
  }
  const pick = (nb: Board, ng: BoardGender) => {
    setB(nb); setG(ng);
    const hit = cache[key(nb, ng)];
    if (!hit || !hit.board || stale(hit.at)) {
      if (hit && !hit.board) setCache((c) => { const x = { ...c }; delete x[key(nb, ng)]; return x; });
      void load(nb, ng);
    }
  };
  const retry = () => { setCache((c) => { const x = { ...c }; delete x[key(b, g)]; return x; }); void load(b, g); };

  const hit = cache[key(b, g)];
  const cur = hit?.board ?? null;
  const card = signedIn ? ownCard(b, cur?.me ?? null, mine) : null;
  const own = card && { ...card, pub: pubNow ?? card.pub };
  const km = (v: number) => fill(w.km, kmNum(v));
  const boardName = (x: Board) => w[x];
  const sub = b === "month" ? w.monthP : b === "lifetime" ? w.lifetimeP : b === "year" ? w.yearP : "";

  async function flip(on: boolean) {
    setPubNow(on);
    let ok = false;
    try {
      const r = await fetch("/api/account/distances", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "public", on }) });
      ok = !!((await r.json().catch(() => null)) as { ok?: boolean } | null)?.ok;
    } catch { ok = false; }
    if (!ok) { setPubNow(null); setSaid(w.eNet); return; }
    setMine((m) => m && { ...m, public: on });
    setSaid("");
    setCache({}); // every board names the rider now, or no longer
    void load(b, g);
  }
  async function withdraw(c: Claim) {
    try {
      const r = await fetch("/api/account/distances", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdraw", id: c.id }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!j?.ok && j?.error !== "generic") { setSaid(w.eNet); return; }
    } catch { setSaid(w.eNet); return; }
    setSaid("");
    void loadMine();
  }
  const share = () => {
    if (!own || own.r == null || cur?.me?.km == null) return;
    setShr((o) => ({ n: (o?.n ?? 0) + 1, sub: boardSubject(b, g, own.r as number, cur.me?.km as number, own.medal, w) }));
  };

  // ── Add a distance ──
  const openForm = () => {
    setForm({ kind: "ride", km: "", d: today(), from: "", note: "", proof: null, busy: false, err: "" });
    requestAnimationFrame(() => { dlg.current?.showModal(); document.getElementById("lb-c-km")?.focus(); });
  };
  const set = (p: Partial<Form>) => setForm((f) => f && !f.busy ? { ...f, ...p } : f);
  const file = async (el: HTMLInputElement) => {
    const f = el.files?.[0];
    el.value = "";
    if (!f) return;
    const p = await readProof(f);
    setForm((x) => x && (p ? { ...x, proof: p, err: "" } : { ...x, err: w.eProof }));
  };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const f = form;
    if (!f || f.busy) return;
    const bad = claimProblem({ kind: f.kind, km: f.km, d: f.d, from: f.from, proof: f.proof?.url ?? null }, today());
    if (bad) { setForm({ ...f, err: w[bad] }); return; }
    setForm({ ...f, busy: true, err: "" });
    let res: { ok?: boolean; error?: string } = {};
    try {
      const r = await fetch("/api/account/distances", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "claim", kind: f.kind, km: Math.round(readKm(f.km) * 10) / 10, date: f.d, from: f.kind === "total" ? f.from : null, note: f.note.trim() || null, proof: f.proof?.url, proofName: f.proof?.name ?? null }),
      });
      res = await r.json().catch(() => ({}));
    } catch { /* no connection: said below */ }
    if (res.ok) {
      dlg.current?.close();
      setSaid(w.cSent);
      void loadMine();
      return;
    }
    const err = w[refusalWord(res.error)];
    if (dlg.current?.open) setForm((x) => x && { ...x, busy: false, err });
    else setSaid(err); // the pop-up was closed while it sent: the refusal is said under the card
  }

  const status = (x: Claim) => (x.source === "staff" ? w.stStaff : x.status === "approved" ? w.stOk : x.status === "declined" ? w.stNo : w.stWait);
  const when = (x: Claim) => (x.kind === "total" && x.from ? `${shareDay(x.from, locale)} – ${shareDay(x.d, locale)}` : shareDay(x.d, locale));
  const swBtns = <T extends string>(list: [T, string][], on: T, go: (v: T) => void, label: string) => (
    <div className="lb-sw" role="group" aria-label={label}>
      {list.map(([v, t]) => <button key={v} type="button" className={`lb-sb${v === on ? " active" : ""}`} aria-pressed={v === on} onClick={() => go(v)}>{t}</button>)}
    </div>
  );

  return (
    <div className="lb">
      {swBtns(BOARDS.map((x) => [x, boardName(x)] as [Board, string]), b, (v) => pick(v, g), w.title)}
      {swBtns([["male", w.men], ["female", w.women]] as [BoardGender, string][], g, (v) => pick(b, v), `${w.men} / ${w.women}`)}
      {sub && <p className="lb-sub">{sub}</p>}

      {own && (
        <div className="lb-me">
          <div className="lb-me-top">
            <div className="lb-me-place">
              {own.r != null && <span className="lb-me-r" dir="ltr">#{own.r}</span>}
              {own.medal && <Medal icon={BOARD_MEDAL[own.medal][0]} color={BOARD_MEDAL[own.medal][1]} className="lb-medal" />}
            </div>
            <div className="lb-me-km" dir="ltr">{own.km ? km(own.km) : ""}</div>
          </div>
          {!own.member && <p className="lb-note">{w.onlyMembers}</p>}
          <label className="shr-sw lb-pub">
            <input type="checkbox" role="switch" checked={own.pub} onChange={(e) => void flip(e.target.checked)} />
            <span className="shr-sw-box" aria-hidden="true" />
            <span className="lb-pub-t"><b>{w.nameSw}</b><small>{w.nameSwSub}</small></span>
          </label>
          <div className="lb-acts">
            {own.r != null && <button type="button" ref={shareBtn} className="lb-go" onClick={share}><ShareIc /><span>{sw.share}</span></button>}
            <button type="button" ref={addBtn} className="lb-add" onClick={openForm}><Plus /><span>{w.add}</span></button>
          </div>
          <p className="lb-said" aria-live="polite">{said}</p>
        </div>
      )}

      {!hit ? <div className="lb-wait" role="status" aria-label={w.title} />
        : !cur ? (
          <div className="lb-err" role="alert"><span>{w.loadErr}</span><button type="button" className="lb-add" onClick={retry}>{w.retry}</button></div>
        ) : cur.rows.length > 0 && (
          <ol className="lb-list" aria-label={`${boardName(b)} · ${g === "female" ? w.women : w.men}`}>
            {cur.rows.map((r, i) => (
              <li key={`${r.r}-${i}`} className={`lb-row${r.mine ? " mine" : ""}`}>
                <span className="lb-r" dir="ltr">{r.r}</span>
                <span className="lb-md">{r.medal && <Medal icon={BOARD_MEDAL[r.medal][0]} color={BOARD_MEDAL[r.medal][1]} className="lb-medal" />}</span>
                <bdi className="lb-nm">{r.mine ? w.you : r.name || w.member}</bdi>
                <span className="lb-km" dir="ltr">{km(r.km)}</span>
              </li>
            ))}
          </ol>
        )}

      {signedIn && mine && mine.claims.length > 0 && (
        <section className="lb-mine" aria-labelledby="lb-mine-h">
          <h2 id="lb-mine-h" className="lb-h">{w.mine}</h2>
          <ul className="lb-cl">
            {mine.claims.map((x) => (
              <li key={x.id} className={`lb-ci st-${x.source === "staff" ? "staff" : x.status}`}>
                <div className="lb-ci-t"><b dir="ltr">{km(x.km)}</b> <span>{x.kind === "total" ? w.kTotal : w.kRide}</span></div>
                <div className="lb-ci-d">{when(x)}</div>
                <div className="lb-ci-s">
                  <span className="lb-pill">{status(x)}</span>
                  {x.reply && <bdi className="lb-reply">{x.reply}</bdi>}
                  {x.status === "pending" && x.source === "claim" && <button type="button" className="lb-tb" onClick={() => void withdraw(x)}>{w.withdraw}</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {signedIn && (
        <dialog ref={dlg} className="bdr-dlg" aria-labelledby="lb-c-title"
          onClose={() => { setForm(null); addBtn.current?.focus({ preventScroll: true }); }}
          onCancel={(e) => { if (form?.busy) e.preventDefault(); }}
          onClick={(e) => { if (onBackdrop(e) && !form?.busy) dlg.current?.close(); }}>
          {form && (
            <form className="bdr-in" onSubmit={send} noValidate>
              <p id="lb-c-title" className="bdr-title">{w.add}</p>
              <div className="lb-sw lb-kinds" role="group" aria-labelledby="lb-c-title">
                {([["ride", w.kRide], ["total", w.kTotal]] as const).map(([v, t]) => (
                  <button key={v} type="button" className={`lb-sb${form.kind === v ? " active" : ""}`} aria-pressed={form.kind === v} disabled={form.busy} onClick={() => set({ kind: v, err: "" })}>{t}</button>
                ))}
              </div>
              <label className="bdr-f">{w.cKm}
                <input id="lb-c-km" type="text" inputMode="decimal" maxLength={8} dir="ltr" value={form.km} disabled={form.busy} onChange={(e) => set({ km: e.target.value })} />
              </label>
              {form.kind === "total" ? (
                <div className="lb-dates">
                  <label className="bdr-f">{w.cFrom}<input type="date" max={today()} value={form.from} disabled={form.busy} onChange={(e) => set({ from: e.target.value })} /></label>
                  <label className="bdr-f">{w.cTo}<input type="date" max={today()} value={form.d} disabled={form.busy} onChange={(e) => set({ d: e.target.value })} /></label>
                </div>
              ) : (
                <label className="bdr-f">{w.cDay}<input type="date" max={today()} value={form.d} disabled={form.busy} onChange={(e) => set({ d: e.target.value })} /></label>
              )}
              <div className="bdr-f">
                <span id="lb-c-proof">{w.cProof}</span>
                {form.proof && (
                  <div className="bdr-file">
                    {form.proof.kind === "image" ? <img className="bdr-thumb" src={form.proof.url} alt="" /> : <span className="bdr-doc"><Doc /></span>}
                    <bdi className="bdr-fname">{form.proof.name}</bdi>
                  </div>
                )}
                <label className="bdr-up">
                  <input type="file" accept="image/*,application/pdf,.pdf" className="bdr-file-in" aria-labelledby="lb-c-proof" disabled={form.busy} onChange={(e) => void file(e.currentTarget)} />
                  <Plus />{form.proof ? w.cChange : w.cPick}
                </label>
              </div>
              <label className="bdr-f">{w.cNote}
                <textarea rows={2} maxLength={300} value={form.note} disabled={form.busy} onChange={(e) => set({ note: e.target.value })} />
              </label>
              {form.err && <p className="bdr-err" role="alert">{form.err}</p>}
              <div className="bdr-act">
                <button type="button" className="bdr-cancel" disabled={form.busy} onClick={() => dlg.current?.close()}>{w.cancel}</button>
                <button type="submit" className="bdr-send" disabled={form.busy}>{w.cSend}</button>
              </div>
            </form>
          )}
        </dialog>
      )}
      {shr && <ShareImage key={shr.n} sub={shr.sub} first={first} locale={locale} onDone={() => { setShr(null); shareBtn.current?.focus({ preventScroll: true }); }} />}
    </div>
  );
}

