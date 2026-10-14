"use client";

import "./emergency.css";
import { useState } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { nidClean, nidValid } from "@/lib/national-id";
import { nationalIdWords } from "./NationalId.words";

// My Account's ID or Iqama number card (the booking app's own, 2026-10-14): one box, digits only and
// left to right in every language, and Save. The page reads the stored number server-side
// (customer_national_id) and leaves the card out while the database has no such function; Save posts
// to /api/account/national-id. An empty box saves as none (it clears the number), as in the booking app.
// Its box is emergency.css's (eg-input), its button the account's (ac-go), as the blood type card's.
export default function NationalIdCard({ initial }: { initial: string }) {
  const tx = useL();
  const w = nationalIdWords(useTxLocale());
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const failed = () => tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setOk(false);
    const idNo = nidClean(v);
    if (!nidValid(idNo)) return setErr(w.err);
    setBusy(true);
    try {
      const r = await fetch("/api/account/national-id", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ idNo }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { setV(idNo); return setOk(true); }
      // the account's session has ended: the page drawn again is signed out
      if (b?.error === "signin") return window.location.reload();
      setErr(b?.error === "refused" ? w.err : b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : failed());
    } catch {
      setErr(failed());
    } finally { setBusy(false); }
  }

  return (
    <form className="bt-card" onSubmit={save} noValidate>
      <input id="ac-nid-in" className="eg-input nid-input" type="text" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={20}
        placeholder={w.ph} value={v} aria-invalid={err === w.err ? true : undefined} aria-labelledby="ac-nid-h" aria-describedby="ac-nid-sub"
        onChange={(e) => { setV(e.target.value); setErr(""); setOk(false); }} />
      {err && <p className="eg-err" role="alert">{err}</p>}
      {ok && <p className="bt-ok" role="status">{w.saved}</p>}
      <button type="submit" className="ac-go bt-save" disabled={busy}>
        {busy ? tx("Saving…", "جارٍ الحفظ…") : w.save}
      </button>
    </form>
  );
}
