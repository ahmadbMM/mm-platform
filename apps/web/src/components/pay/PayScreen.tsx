"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { Link } from "@/i18n/navigation";
import { T } from "./Pay.text";

// The payment page's live part (micromobility.sa/pay/<id>): the hold's countdown and Moyasar's own form
// (moyasar-payment-form, pinned in lib/pay/config.ts). The form posts the card straight to Moyasar with the
// publishable key - the card never reaches this site - and carries our payment's id in its metadata and a
// fresh given_id per page load (Moyasar's idempotency key: a retried request never charges twice). The
// amount it shows is the database's; whatever it charges, the server checks it against ours before
// anything counts as paid (lib/pay/server.ts). After 3-D Secure (or at once for Apple Pay and STC Pay)
// Moyasar sends the rider to /api/pay/return, which settles it and brings them back here.
// A minute before a held payment lets go (WCAG 2.2.1 Timing Adjustable, 2026-11-11) a centred pop-up asks "Still
// paying?" with the time left running down, and Keep my place asks for more (/api/pay/extend, rentals pay_hold_extend):
// the hold starts again from then, up to twice its length from when the payment began, after which Keep my place goes
// and the countdown stays. Close leaves the hold as it is, and the warning comes back only for a hold kept again.

type MoyasarInit = (cfg: Record<string, unknown>) => void;
declare global { interface Window { Moyasar?: { init: MoyasarInit } } }

export type PayScreenProps = {
  locale: string;
  /** leftMs: the hold's time left when the server drew the page (its clock, not the phone's). */
  pay: { id: string; kind: string; ref: string; amount: number; description: string; hold: boolean; leftMs: number };
  publishableKey: string;
  testMode: boolean;
  formJs: string;
  formCss: string;
  declined: string | null;
  tried: boolean;
  /** Where Start again goes when the hold runs out, when the page knows better than the kind (a store order's own page). */
  againHref?: string | null;
};

/** How long before the hold lets go the warning opens: a minute, well over the 20 seconds WCAG 2.2.1 asks for. */
const WARN_MS = 60000;

const isUuid4 = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function uuid4(): string {
  try { const u = crypto.randomUUID(); if (isUuid4(u)) return u; } catch { /* old browser */ }
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function PayScreen({ locale, pay, publishableKey, testMode, formJs, formCss, declined, tried, againHref = null }: PayScreenProps) {
  const t = useLocalize(T);
  const el = useRef<HTMLDivElement>(null);
  // The time left starts as the server counted it, so the first drawing in the browser says what the server's did
  // (no hydration mismatch), and runs down by the time that passes here (a difference of two readings of the phone's
  // clock, which counts a phone asleep too): a phone clock set wrong changes nothing.
  // `hold` is the time left as the server last counted it (the page's, then each Keep my place's answer) and which hold
  // that is (n: 0 the page's, then one more for each one kept).
  const [hold, setHold] = useState({ ms: pay.leftMs, n: 0 });
  const [left, setLeft] = useState(pay.leftMs);
  const [failed, setFailed] = useState(false);
  const over = pay.hold && left <= 0;
  // the warning: the hold it was closed for, whether the hold can be kept no longer (PAY_HOLD_MAX), the request, its error
  const [shut, setShut] = useState(-1);
  const [maxed, setMaxed] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [keepErr, setKeepErr] = useState("");
  const warn = pay.hold && !over && left <= WARN_MS && shut !== hold.n;
  const box = useRef<HTMLDivElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useDialogFocus(box, warn, { first: keepBtn });

  // the hold's countdown
  useEffect(() => {
    if (!pay.hold) return;
    const t0 = Date.now();
    const tick = () => setLeft(hold.ms - (Date.now() - t0));
    const h = window.setInterval(tick, 1000);
    return () => window.clearInterval(h);
  }, [pay.hold, hold]);

  // Escape closes the warning; once the hold can be kept no longer, the focus goes to Close (Keep my place is gone)
  useEffect(() => {
    if (!warn) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setShut(hold.n); setKeepErr(""); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [warn, hold.n]);
  useEffect(() => { if (maxed) closeBtn.current?.focus({ preventScroll: true }); }, [maxed]);

  async function keep() {
    if (keeping) return;
    setKeeping(true); setKeepErr("");
    try {
      const r = await fetch("/api/pay/extend", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: pay.id }), signal: AbortSignal.timeout(10000),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; leftMs?: unknown; error?: string } | null;
      if (b?.ok && typeof b.leftMs === "number" && Number.isFinite(b.leftMs)) {
        const ms = b.leftMs;
        setHold((x) => ({ ms, n: x.n + 1 }));
        setLeft(ms);
      } else if (b?.error === "hold_max") setMaxed(true);
      else setKeepErr(t.ticket.failed); // the route or the database function not there yet too
    } catch { setKeepErr(t.ticket.failed); }
    setKeeping(false);
  }

  // Moyasar's form, once
  useEffect(() => {
    if (over) return;
    let gone = false;
    if (!document.querySelector(`link[href="${formCss}"]`)) {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = formCss; document.head.appendChild(l);
    }
    const start = () => {
      if (gone || !el.current || !window.Moyasar) return;
      el.current.innerHTML = "";
      try {
        window.Moyasar.init({
          element: el.current,
          amount: Math.round(pay.amount * 100),
          currency: "SAR",
          description: pay.description,
          publishable_api_key: publishableKey,
          callback_url: `${window.location.origin}/api/pay/return?pay=${pay.id}`,
          methods: ["applepay", "creditcard", "stcpay"],
          supported_networks: ["mada", "visa", "mastercard"],
          language: locale === "ar" ? "ar" : "en",
          metadata: { pay_id: pay.id, kind: pay.kind, ref: pay.ref.slice(0, 80) },
          given_id: uuid4(),
          apply_coupon: false,
          fixed_width: false,
          apple_pay: { country: "SA", label: "MicroMobility", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate" },
          on_completed: async (p: { id?: string }) => {
            if (!p?.id) return;
            try {
              await fetch("/api/pay/attach", {
                method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
                body: JSON.stringify({ pay: pay.id, id: p.id }), signal: AbortSignal.timeout(4000),
              });
            } catch { /* the return page and the webhook settle it anyway */ }
          },
        });
      } catch { setFailed(true); }
    };
    if (window.Moyasar) start();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${formJs}"]`);
      if (!s) { s = document.createElement("script"); s.src = formJs; s.async = true; document.head.appendChild(s); }
      s.addEventListener("load", start);
      s.addEventListener("error", () => setFailed(true));
      const late = window.setTimeout(() => { if (!window.Moyasar) setFailed(true); }, 15000);
      return () => { gone = true; window.clearTimeout(late); s?.removeEventListener("load", start); };
    }
    return () => { gone = true; };
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps -- drawn once per page; the props never change

  const mmss = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  // "We're holding this for you for 0:42": the clock stands where the language puts {0} in the sentence
  const holding = () => {
    const [before, after = ""] = t.holding.split("{0}");
    return <span>{before}<bdi className="py-clock">{mmss(left)}</bdi>{after}</span>;
  };

  if (over) {
    return (
      <div className="py-box" role="status">
        <p className="py-msg">{t.timeUp}</p>
        <Link className="bk-btn wide" href={againHref ?? (pay.kind === "order" ? "/store/cart" : pay.kind === "locker" ? "/lockers" : "/experiences")}>{t.startAgain}</Link>
      </div>
    );
  }
  return (
    <div className="py-live">
      {pay.hold && <p className="py-hold" aria-live="off">{holding()}</p>}
      {(declined || tried) && <p className="py-err" role="alert">{declined ? fill(t.declined, declined) : t.declinedPlain}</p>}
      {testMode && <p className="py-test">{t.testMode}</p>}
      <p className="py-note">{t.payNote}</p>
      <div ref={el} className="py-form" dir={locale === "ar" ? "rtl" : "ltr"} />
      {failed && (
        <div className="py-box" role="alert">
          <p className="py-msg">{t.loadError}</p>
          <button type="button" className="bk-btn2" onClick={() => window.location.reload()}>{t.reload}</button>
        </div>
      )}
      <p className="py-secure">{t.secure}</p>
      {warn && (
        // centred, as every pop-up on the site; an alert dialog, so it is read out when it opens and keeps the keyboard
        <div className="bk-backdrop">
          <div ref={box} className="bk-pop" role="alertdialog" aria-modal="true" aria-labelledby="py-warn-h" aria-describedby="py-warn-d">
            <div className="bk-pop-body">
              <div className="bk-pop-head"><h2 id="py-warn-h" className="bk-pop-title">{t.stillPaying}</h2></div>
              <p id="py-warn-d" className="py-hold" aria-live="off">{holding()}</p>
              {keepErr && <p className="bk-err" role="alert">{keepErr}</p>}
              <div className="bk-pop-foot">
                <button ref={closeBtn} type="button" className="bk-btn2" onClick={() => { setShut(hold.n); setKeepErr(""); }}>{t.close}</button>
                {!maxed && <button ref={keepBtn} type="button" className="bk-btn" disabled={keeping} aria-busy={keeping} onClick={() => void keep()}>{t.keepPlace}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
