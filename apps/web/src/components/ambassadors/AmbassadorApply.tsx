"use client";

import { useState } from "react";
import { cleanName, nameOk, normalizePhone, rpc } from "@/lib/rpc-client";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./AmbassadorApply.text";

// The application (ambassador_apply): it lands in the staff page's Ambassadors section, where
// the team approves it and sends the code on WhatsApp.
type Props = { locale: string; title: string; text: string; button: string; note: string; doneTitle: string; doneText: string };

export default function AmbassadorApply(p: Props) {
  const t = useLocalize(T);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [insta, setInsta] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<"" | "new" | "pending" | "active">("");

  async function send() {
    setErr("");
    const nm = cleanName(name), ph = normalizePhone(phone);
    if (!nameOk(nm)) return setErr(t.errors.name);
    if (!/^\+[1-9]\d{7,14}$/.test(ph) || (ph.startsWith("+966") && !/^\+9665\d{8}$/.test(ph))) return setErr(t.errors.phone);
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; status?: string; repeat?: boolean; error?: string }>("ambassador_apply", {
        p: { name: nm, phone: ph, instagram: insta.trim(), why: why.trim(), lang: (p.locale === "ar" ? "ar" : "en") },
      });
      if (r.ok) setDone(r.repeat ? (r.status === "pending" ? "pending" : "active") : "new");
      else setErr(t.errors[r.error || ""] || t.errors.generic);
    } catch { setErr(t.errors.generic); }
    setBusy(false);
  }

  return (
    <div className="amb-apply">
      <h2>{p.title}</h2>
      <p className="amb-apply-text">{p.text}</p>
      {done ? (
        <div className="amb-done" role="status">
          {done === "new" ? <><strong>{p.doneTitle}</strong><span>{p.doneText}</span></> : <span>{done === "pending" ? t.already : t.active}</span>}
        </div>
      ) : (
        <>
          <div className="amb-fields">
            <input className="amb-input" value={name} onChange={(e) => setName(e.target.value.replace(/[-‐-―]/g, " "))} placeholder={t.name} aria-label={t.name} autoComplete="name" maxLength={120} />
            <input className="amb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} />
            <input className="amb-input amb-wide" value={insta} onChange={(e) => setInsta(e.target.value)} placeholder={t.insta} aria-label={t.insta} dir="ltr" maxLength={60} />
            <textarea className="amb-input amb-wide" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t.why} aria-label={t.why} rows={3} maxLength={1000} />
          </div>
          {err && <p className="amb-err" role="alert">{err}</p>}
          <button type="button" className="amb-btn amb-btn-green amb-full" onClick={send} disabled={busy}>{busy ? t.sending : p.button}</button>
          <p className="amb-apply-note">{p.note}</p>
        </>
      )}
    </div>
  );
}
