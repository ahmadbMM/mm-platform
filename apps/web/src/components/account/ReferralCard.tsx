"use client";

import { useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { BOOKING_URL } from "@/lib/links";
import { referralLink, type Referral } from "@/lib/referral";
import { referralWords } from "./Referral.words";

// The Invite friends card on My Account (the booking app's #ref-mine, 2026-11-08): the rider's code, Share (the phone's
// share sheet, else WhatsApp; the site sends nothing itself) and Copy link, how many friends joined and rode and the free
// rides that earned, and while the account is new a box for a friend's code (POST /api/account/referrer). The free rides
// themselves are redeemed in the booking app, so a waiting one links there.
export default function ReferralCard({ r, locale }: { r: Referral; locale: string }) {
  const tx = useL();
  const w = referralWords(locale);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const link = referralLink(r.code, locale);
  const failed = () => tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.");

  async function share() {
    const text = w.msg.replace("{0}", link).replace("{1}", r.code);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNote(w.copied); } catch { setNote(link); }
  }
  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/account/referrer", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.trim() }),
      });
      const b = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) return setDone(true);
      if (b?.error === "signin") return window.location.reload();
      const why: Record<string, string> = { invalid: w.errInvalid, self: w.errSelf, already: w.errAlready, not_new: w.errNotNew, off: w.errOff };
      setErr(why[b?.error ?? ""] ?? (b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : failed()));
    } catch {
      setErr(failed());
    } finally { setBusy(false); }
  }

  return (
    <section className="ac-sec ac-ref" aria-labelledby="ac-ref-h">
      <h2 id="ac-ref-h">{w.title}</h2>
      <p className="ac-text">{w.how}</p>
      <div className="ac-ref-code"><span>{w.yourCode}</span><strong dir="ltr">{r.code}</strong></div>
      <div className="ac-ref-btns">
        <button type="button" className="ac-go" onClick={share}>{w.share}</button>
        <button type="button" className="ac-ref-copy" onClick={copy}>{w.copy}</button>
      </div>
      {note && <p className="ac-ref-note" role="status">{note}</p>}
      <dl className="ac-ref-stats">
        {([[r.joined, w.joined], [r.rode, w.rode], [r.earned, w.earned]] as const).map(([n, label]) => (
          <div key={label}><dt>{label}</dt><dd>{n}</dd></div>
        ))}
      </dl>
      {r.open > 0 && <p className="ac-ref-has">{w.hasFree.replace("{0}", String(r.open))} <a href={BOOKING_URL}>{w.book}</a></p>}
      {(r.referred || done) && <p className="ac-text ac-ref-was">{done ? w.enterOk : w.wasInvited}</p>}
      {r.canEnter && !done && (
        <form className="ac-ref-enter" onSubmit={enter} noValidate>
          <label htmlFor="ac-ref-in">{w.enterLabel}</label>
          <div className="ac-ref-row">
            <input id="ac-ref-in" type="text" dir="ltr" autoComplete="off" spellCheck={false} maxLength={60} value={code}
              aria-invalid={err ? true : undefined} aria-describedby={err ? "ac-ref-err" : undefined}
              onChange={(e) => { setCode(e.target.value); setErr(""); }} />
            <button type="submit" className="ac-ref-copy" disabled={busy}>{w.enterBtn}</button>
          </div>
          {err && <p id="ac-ref-err" className="ac-ref-err" role="alert">{err}</p>}
        </form>
      )}
    </section>
  );
}
