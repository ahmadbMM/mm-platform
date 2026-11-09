"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { T } from "./Pay.text";

// The payment page's live part (micromobility.sa/pay/<id>): the hold's countdown and Moyasar's own form
// (moyasar-payment-form, pinned in lib/pay/config.ts). The form posts the card straight to Moyasar with the
// publishable key - the card never reaches this site - and carries our payment's id in its metadata and a
// fresh given_id per page load (Moyasar's idempotency key: a retried request never charges twice). The
// amount it shows is the database's; whatever it charges, the server checks it against ours before
// anything counts as paid (lib/pay/server.ts). After 3-D Secure (or at once for Apple Pay and STC Pay)
// Moyasar sends the rider to /api/pay/return, which settles it and brings them back here.

type MoyasarInit = (cfg: Record<string, unknown>) => void;
declare global { interface Window { Moyasar?: { init: MoyasarInit } } }

export type PayScreenProps = {
  locale: string;
  pay: { id: string; kind: string; ref: string; amount: number; description: string; hold: boolean; expiresAt: string };
  publishableKey: string;
  testMode: boolean;
  formJs: string;
  formCss: string;
  declined: string | null;
  tried: boolean;
};

const isUuid4 = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function uuid4(): string {
  try { const u = crypto.randomUUID(); if (isUuid4(u)) return u; } catch { /* old browser */ }
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function PayScreen({ locale, pay, publishableKey, testMode, formJs, formCss, declined, tried }: PayScreenProps) {
  const t = useLocalize(T);
  const el = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(() => Date.parse(pay.expiresAt) - Date.now());
  const [failed, setFailed] = useState(false);
  const over = pay.hold && left <= 0;

  // the hold's countdown
  useEffect(() => {
    if (!pay.hold) return;
    const tick = () => setLeft(Date.parse(pay.expiresAt) - Date.now());
    const h = window.setInterval(tick, 1000);
    return () => window.clearInterval(h);
  }, [pay.hold, pay.expiresAt]);

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

  if (over) {
    return (
      <div className="py-box" role="status">
        <p className="py-msg">{t.timeUp}</p>
        <a className="bk-btn wide" href={pay.kind === "order" ? "/store/cart" : pay.kind === "locker" ? "/lockers" : "/experiences"}>{t.startAgain}</a>
      </div>
    );
  }
  return (
    <div className="py-live">
      {pay.hold && <p className="py-hold" aria-live="off">{fill(t.holding, "")}<bdi className="py-clock">{mmss(left)}</bdi></p>}
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
    </div>
  );
}
