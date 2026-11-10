"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { T } from "./Pay.text";

// Paying online on a ticket (2026-11-10): "Pay now" for the rider's unpaid places on a ride paid online (a place
// held while paying says until when), and Cancel for a booking paid online, which asks where the money goes back
// (the wallet at once, or the card) - or says plainly that it is not refunded this late - before cancelling
// (/api/pay/cancel; rentals pay_booking_cancel decides the same rule).

export function TicketPayNow({ ids, held, locale }: { ids: string[]; held: string | null; locale: string }) {
  const t = useLocalize(T).ticket;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const until = held ? new Date(held).toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }) : null;
  async function go() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pay/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, lang: locale }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; paid?: boolean } | null;
      if (b?.ok && b.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.url)) { window.location.assign(b.url); return; }
      if (b?.ok && b.paid) { window.location.reload(); return; }
      setErr(t.failed);
    } catch { setErr(t.failed); }
    setBusy(false);
  }
  return (
    <div className="tk-paynow">
      {until && <p className="tk-line">{fill(t.heldUntil, until)}</p>}
      <button type="button" className="tk-btn solid" disabled={busy} aria-busy={busy} onClick={() => void go()}>{held ? t.finish : t.payNow}</button>
      {err && <p className="tk-line" role="alert">{err}</p>}
    </div>
  );
}

export function TicketPayCancel({ ids, amount, refundable, refundDays, amountText, locale }: {
  ids: string[]; amount: number; refundable: boolean; refundDays: number; amountText: string; locale: string;
}) {
  const t = useLocalize(T).ticket;
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<"wallet" | "card">("wallet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const from = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("input, button")?.focus());
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); try { from?.focus(); } catch { /* gone */ } };
  }, [open]);
  async function go() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pay/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, dest, lang: locale }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean } | null;
      if (b?.ok) { window.location.reload(); return; }
      setErr(t.failed);
    } catch { setErr(t.failed); }
    setBusy(false);
  }
  return (
    <>
      <button type="button" className="tk-btn red" onClick={() => setOpen(true)} aria-haspopup="dialog">{t.cancel}</button>
      {open && (
        <div className="bk-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={box} className="bk-pop" role="dialog" aria-modal="true" aria-labelledby="tkp-h">
            <div className="bk-pop-body">
              <div className="bk-pop-head"><h2 id="tkp-h" className="bk-pop-title">{t.cancelTitle}</h2></div>
              {refundable && amount > 0 ? (
                <fieldset className="tk-refund">
                  <legend className="bk-pop-msg">{fill(t.back, amountText)}</legend>
                  <label className={`bk-agree${dest === "wallet" ? " on" : ""}`}><input type="radio" name="tkp-dest" checked={dest === "wallet"} onChange={() => setDest("wallet")} /><span>{t.toWallet}</span></label>
                  <label className={`bk-agree${dest === "card" ? " on" : ""}`}><input type="radio" name="tkp-dest" checked={dest === "card"} onChange={() => setDest("card")} /><span>{t.toCard}</span></label>
                </fieldset>
              ) : amount > 0 ? (
                <p className="bk-pop-msg">{refundDays > 1 ? fill(t.noRefundDays, refundDays) : refundDays === 0 ? t.noRefundAfter : t.noRefund}</p>
              ) : null}
              {err && <p className="bk-err" role="alert">{err}</p>}
              <div className="bk-pop-foot">
                <button type="button" className="bk-btn2" onClick={() => setOpen(false)}>{t.keep}</button>
                <button type="button" className="bk-btn" disabled={busy} aria-busy={busy} onClick={() => void go()}>{t.confirm}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
