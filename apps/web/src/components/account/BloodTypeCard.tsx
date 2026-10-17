"use client";

import "./emergency.css";
import { useState } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { BLOOD_TYPES, btShow, btValid, type BloodType } from "@/lib/blood-type";
import { bloodTypeWords } from "./BloodType.words";

// My Account's blood type card (the booking app's own, 2026-10-14): a list of the eight types and
// "I don't know my blood type", and Save. The page reads the stored one server-side (customer_blood_type)
// and leaves the card out while the database has no such function; Save posts to
// /api/account/blood-type. The choose line saves as none (it clears the type), as in the booking app.
// Its list is emergency.css's (eg-input), its button the account's (ac-go).
export default function BloodTypeCard({ initial }: { initial: BloodType | "" }) {
  const tx = useL();
  const w = bloodTypeWords(useTxLocale());
  const [v, setV] = useState<string>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const failed = () => tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setOk(false);
    if (!btValid(v)) return setErr(w.err);
    setBusy(true);
    try {
      const r = await fetch("/api/account/blood-type", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: v }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) return setOk(true);
      // the account's session has ended: the page drawn again is signed out
      if (b?.error === "signin") return window.location.reload();
      setErr(b?.error === "refused" ? w.err : b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : failed());
    } catch {
      setErr(failed());
    } finally { setBusy(false); }
  }

  return (
    <form className="bt-card" onSubmit={save} noValidate>
      <select id="ac-bt-sel" className={`eg-input${v ? "" : " eg-ph"}`} value={v} aria-invalid={err === w.err ? true : undefined} aria-labelledby="ac-bt-h" aria-describedby="ac-bt-sub"
        onChange={(e) => { setV(e.target.value); setErr(""); setOk(false); }}>
        <option value="">{w.pick}</option>
        {BLOOD_TYPES.map((x) => <option key={x} value={x} dir="ltr">{btShow(x)}</option>)}
        <option value="unknown">{w.unknown}</option>
      </select>
      {err && <p className="eg-err" role="alert">{err}</p>}
      {ok && <p className="bt-ok" role="status">{w.saved}</p>}
      <button type="submit" className="ac-go bt-save" disabled={busy}>
        {busy ? tx("Saving…", "جارٍ الحفظ…") : w.save}
      </button>
    </form>
  );
}
