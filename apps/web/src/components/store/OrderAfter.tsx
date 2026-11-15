"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { returnBody, type ReturnLine, type ReturnPick } from "@/lib/store-after";
import { RETURN_REASONS, type ReturnReason } from "@/lib/store-order";
import { T as STORE } from "./Store.text";
import { T as W5 } from "./w5.text";
import { Ic, NoPhoto } from "./bits";
import { StIcon } from "./icons";
import Modal from "./Modal";

// An order's page, the parts that need the browser (the store build, chain w5): a return or an exchange asked for in a
// centred pop-up (F93; staff approve it in the staff page and the refund goes the existing way), a verified buyer's
// review of each product once it is delivered (F94; staff show it), and printing one gift card alone (F57). Nothing is
// sent by email or SMS: the order's page is where the customer sees what happened.

async function post(url: string, body: unknown): Promise<{ ok?: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "generic" }))) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "network" };
  }
}

// ── Return or exchange (F93) ─────────────────────────────────────────────────────────────────────

export function ReturnStart({ no, k, lines, ret, exchange }: { no: number; k: string; lines: ReturnLine[]; ret: boolean; exchange: boolean }) {
  const t = useLocalize(STORE);
  const w = useLocalize(W5);
  const router = useRouter();
  const kinds = [ret ? "return" : null, exchange ? "exchange" : null].filter((x): x is "return" | "exchange" => !!x);
  const fresh = (): ReturnPick => ({ kind: kinds.length === 1 ? kinds[0] : null, items: lines.length === 1 ? { [lines[0].id]: 1 } : {}, reason: null, note: "" });
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<ReturnPick>(fresh);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  if (!kinds.length || !lines.length) return null;
  if (sent) return <p className="st-ok" role="status">{w.requestSent}</p>;

  const body = returnBody({ no, key: k, lines }, pick);
  const setQty = (id: number, q: number) => setPick((p) => ({ ...p, items: { ...p.items, [id]: q } }));
  async function send() {
    if (!body || busy) return;
    setBusy(true); setErr("");
    const r = await post("/api/store/return", body);
    setBusy(false);
    if (r.ok) { setOpen(false); setSent(true); router.refresh(); return; }
    setErr(w.errs[r.error ?? ""] ?? w.errs.generic);
  }
  const close = () => { if (!busy) { setOpen(false); setErr(""); setPick(fresh()); } };

  return (
    <>
      <button type="button" className="bk-btn2 st-ret-btn" onClick={() => setOpen(true)}><Ic name="back" size={18} />{w.returnBtn}</button>
      {open && (
        <Modal title={w.returnTitle} onClose={close} closeLabel={t.close}>
          <div className="st-ret">
            {kinds.length > 1 && (
              <fieldset className="st-ways-pick st-ret-kind">
                <legend>{w.kindLabel}</legend>
                {kinds.map((kd) => (
                  <label key={kd} className={pick.kind === kd ? "on" : undefined}>
                    <input type="radio" name="st-ret-kind" checked={pick.kind === kd} onChange={() => setPick((p) => ({ ...p, kind: kd }))} />
                    <span><b>{kd === "return" ? w.kindReturn : w.kindExchange}</b></span>
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset className="st-ways-pick st-ret-items">
              <legend>{w.whichItems}</legend>
              {lines.map((l) => {
                const q = pick.items[l.id] ?? 0;
                return (
                  <div key={l.id} className={`st-ret-line${q > 0 ? " on" : ""}`}>
                    <label>
                      <input type="checkbox" checked={q > 0} onChange={(e) => setQty(l.id, e.target.checked ? 1 : 0)} />
                      <span className="st-mini-img">{l.image ? <img src={sized(l.image, 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
                      <span><b>{l.name}</b>{l.variant && <small>{l.variant}</small>}</span>
                    </label>
                    {q > 0 && l.max > 1 && (
                      <div className="st-qty sm" role="group" aria-label={`${t.qty}: ${l.name}`}>
                        <button type="button" onClick={() => setQty(l.id, Math.max(1, q - 1))} disabled={q <= 1} aria-label={t.less}><Ic name="minus" size={16} /></button>
                        <output aria-live="polite">{q}</output>
                        <button type="button" onClick={() => setQty(l.id, Math.min(l.max, q + 1))} disabled={q >= l.max} aria-label={t.more}><Ic name="plus" size={16} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <fieldset className="st-ways-pick st-ret-why">
              <legend>{w.why}</legend>
              {RETURN_REASONS.map((r: ReturnReason) => (
                <label key={r} className={pick.reason === r ? "on" : undefined}>
                  <input type="radio" name="st-ret-why" checked={pick.reason === r} onChange={() => setPick((p) => ({ ...p, reason: r }))} />
                  <span>{w.reasons[r]}</span>
                </label>
              ))}
            </fieldset>
            <div className="bk-field st-field">
              <label htmlFor="st-ret-note">{t.noteLabel}<span className="bk-hint"> {t.optional}</span></label>
              <textarea id="st-ret-note" value={pick.note} maxLength={300} onChange={(e) => setPick((p) => ({ ...p, note: e.target.value }))} />
            </div>
            {err && <p className="bk-err" role="alert">{err}</p>}
            <button type="button" className="bk-btn wide" onClick={send} disabled={!body || busy}>
              {busy ? <><span className="bk-spin" aria-hidden="true" />{w.sending}</> : w.sendRequest}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── A review of each product (F94) ───────────────────────────────────────────────────────────────

export function ReviewAsk({ no, k, lang, items }: { no: number; k: string; lang: string; items: { product: string; name: string; image: string | null }[] }) {
  const w = useLocalize(W5);
  if (!items.length) return null;
  return (
    <section className="st-rv" aria-labelledby="st-rv-h">
      <h2 id="st-rv-h" className="st-info-h"><StIcon name="star" size={18} />{w.reviewH}</h2>
      <ul>{items.map((i) => <ReviewRow key={i.product} no={no} k={k} lang={lang} item={i} />)}</ul>
    </section>
  );
}

function ReviewRow({ no, k, lang, item }: { no: number; k: string; lang: string; item: { product: string; name: string; image: string | null } }) {
  const t = useLocalize(STORE);
  const w = useLocalize(W5);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const id = `st-rv-${item.product.slice(0, 8)}`;
  async function send() {
    if (!rating || busy) return;
    setBusy(true); setErr("");
    const r = await post("/api/store/review", { no, key: k, product: item.product, rating, body: body.trim().slice(0, 1000), lang });
    setBusy(false);
    // one review per product of an order: one already there is the same thanks
    if (r.ok || r.error === "review_done") { setDone(true); return; }
    setErr(r.error === "busy" || r.error === "network" ? w.errs[r.error] : w.errs.generic);
  }
  return (
    <li className="st-rv-row">
      <div className="st-rv-what">
        <span className="st-mini-img">{item.image ? <img src={sized(item.image, 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
        <b>{item.name}</b>
      </div>
      {done ? <p className="st-ok" role="status"><Ic name="tick" size={16} /> {w.reviewThanks}</p> : (
        <>
          <fieldset className="st-stars">
            <legend className="st-sr">{item.name}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={n <= rating ? "on" : undefined}>
                <input type="radio" className="st-sr" name={id} value={n} checked={rating === n} onChange={() => setRating(n)} />
                <StIcon name="star" size={30} filled={n <= rating} />
                <span className="st-sr">{w.stars(n)}</span>
              </label>
            ))}
          </fieldset>
          <div className="bk-field st-field">
            <label htmlFor={`${id}-b`}>{w.reviewBox}<span className="bk-hint"> {t.optional}</span></label>
            <textarea id={`${id}-b`} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
          </div>
          {err && <p className="bk-err" role="alert">{err}</p>}
          <button type="button" className="bk-btn" onClick={send} disabled={!rating || busy}>
            {busy ? <><span className="bk-spin" aria-hidden="true" />{w.sending}</> : w.reviewSend}
          </button>
        </>
      )}
    </li>
  );
}

// ── Print one gift card (F57) ────────────────────────────────────────────────────────────────────

/** Prints the gift card whose box has this id, and nothing else of the page (store.css: html[data-st-print="gc"]). */
export function GiftPrint({ target }: { target: string }) {
  const w = useLocalize(W5);
  const print = () => {
    const root = document.documentElement, box = document.getElementById(target);
    if (!box) return window.print();
    const done = () => { root.removeAttribute("data-st-print"); box.classList.remove("st-gc-on"); window.removeEventListener("afterprint", done); };
    root.setAttribute("data-st-print", "gc");
    box.classList.add("st-gc-on");
    window.addEventListener("afterprint", done);
    window.print();
  };
  return <button type="button" className="bk-btn2" onClick={print}><Ic name="print" size={18} />{w.printGift}</button>;
}
