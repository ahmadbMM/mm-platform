"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { riyalNum } from "@/components/booking/Sar";
import { giftName } from "@/lib/sx-b6";
import SxPop from "./SxPop";
import { T } from "./sx-B6.text";
import { T as BT } from "./Booking.text";

// Gift a ride (EF20; the user, 2026-11-18: "do all"): a circuit ride on one bike type for one rider, paid now on the
// shared payment page (/api/xp/gift, rentals xp_gift_start, payment kind 'xp'). Once paid, the payment page hands over the
// gift's link to send on WhatsApp or copy (R5: no email, no text message); the friend opens it on Experiences, where it
// fills in as a code at the review and pays for their place. The fare is the database's; the amount here is today's.
export default function GiftRide({ locale, prices, typeNames, onClose }: { locale: string; prices: Record<string, number>; typeNames: Record<string, string>; onClose: () => void }) {
  const t = useLocalize(T);
  const word = useLocalize(BT).sarWord;
  const types = Object.entries(prices).filter(([ty, p]) => p >= 1 && ty !== "Own" && ty !== "Any").map(([ty]) => ty);
  const [type, setType] = useState(types[0] ?? "");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const amount = prices[type] ?? 0;

  async function pay() {
    if (busy || !type) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/xp/gift", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "jcc", type, forName: giftName(name), note: note.trim().slice(0, 200), lang: locale }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (b?.ok && b.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.url)) { window.location.assign(b.url); return; }
      setErr(t.giftErr);
    } catch { setErr(t.giftErr); }
    setBusy(false);
  }

  const amt = <bdi className="tk-amt" dir="ltr"><span aria-hidden="true">{"\u20C1"}</span><span className="mm-sr">{word}</span> {riyalNum(amount)}</bdi>;
  const [a, b = ""] = t.giftPay.split("{0}");
  return (
    <SxPop title={t.giftTitle} close={t.close} onClose={onClose}>
      <div className="bk-field">
        <span className="bk-label" id="sx6-gt-l">{t.giftBike}</span>
        <div className="bk-types" role="radiogroup" aria-labelledby="sx6-gt-l">
          {types.map((ty) => (
            <span key={ty} className={`bk-pick solo${type === ty ? " on" : ""}`}>
              <button type="button" role="radio" aria-checked={type === ty} className={`bk-pill${type === ty ? " on" : ""}`} onClick={() => setType(ty)}>
                <span className="bk-pill-n">{typeNames[ty] ?? ty}</span>
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="bk-field">
        <label htmlFor="sx6-gf-n">{t.giftFor}</label>
        <input id="sx6-gf-n" type="text" dir="auto" autoComplete="off" maxLength={40} value={name} onChange={(e) => setName(e.target.value.replace(/[-‐-―]/g, " "))} />
      </div>
      <div className="bk-field">
        <label htmlFor="sx6-gf-m">{t.giftNote}</label>
        <textarea id="sx6-gf-m" className="sx6-ta" dir="auto" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {err && <p className="bk-err" role="alert">{err}</p>}
      <div className="bk-pop-foot">
        <button type="button" className="bk-btn" disabled={busy || !type} aria-busy={busy} onClick={() => void pay()}>{a}{amt}{b}</button>
      </div>
    </SxPop>
  );
}
