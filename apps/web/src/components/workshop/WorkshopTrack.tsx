"use client";

import { useState } from "react";
import { normalizePhone, rpc } from "@/lib/rpc-client";
import { intlOf } from "@/i18n/locales";
import { fmtSar } from "@/lib/fill";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./WorkshopTrack.text";

// "Where's my bike?": the reference from the request plus the phone it was sent with
// (workshop_track). Shows the stage the staff page has set.
const STAGES = ["new", "confirmed", "in_workshop", "awaiting_parts", "ready", "completed"] as const;
type Res = { ok: boolean; error?: string; ref?: string; status?: string; service?: string | null; scheduled_for?: string | null; preferred_date?: string | null; preferred_time?: string | null; price?: number | null };

export default function WorkshopTrack({ locale }: { locale: string }) {
  const t = useLocalize(T);
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [msg, setMsg] = useState("");
  async function check() {
    setMsg(""); setRes(null); setBusy(true);
    try {
      const r = await rpc<Res>("workshop_track", { p_ref: ref.trim(), p_phone: normalizePhone(phone) });
      if (r.ok) setRes(r); else setMsg(r.error === "throttled" ? t.throttled : t.notFound);
    } catch { setMsg(t.error); }
    setBusy(false);
  }
  const idx = res?.status ? STAGES.indexOf(res.status as (typeof STAGES)[number]) : -1;
  const when = res?.scheduled_for
    ? new Intl.DateTimeFormat(intlOf(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(res.scheduled_for))
    : "";
  return (
    <div className="ws-track">
      <strong className="ws-track-title">{t.title}</strong>
      <p className="ws-hint">{t.hint}</p>
      <div className="ws-track-row">
        <input className="ws-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t.ref} aria-label={t.ref} dir="ltr" maxLength={12} />
        <input className="ws-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} dir="ltr" inputMode="tel" maxLength={20} />
        <button type="button" className="ws-btn ws-btn-dark" onClick={check} disabled={busy || !ref.trim() || !phone.trim()}>{busy ? t.busy : t.go}</button>
      </div>
      {msg && <p className="ws-err" role="alert">{msg}</p>}
      {res && (
        <div className="ws-track-res" role="status">
          <div className="ws-track-head"><strong className="mm-lat">{res.ref}</strong>{res.service ? <span> · {res.service}</span> : null}</div>
          {res.status === "cancelled" ? <p>{t.cancelled}</p> : (
            <ol className="ws-stages">
              {STAGES.map((s, i) => (
                <li key={s} className={i < idx ? "done" : i === idx ? "now" : ""}><span aria-hidden="true">{i < idx ? "✓" : i + 1}</span>{t.stages[s]}</li>
              ))}
            </ol>
          )}
          {when && <p>{t.scheduled}: {when}</p>}
          {typeof res.price === "number" && <p>{t.price}: {fmtSar(res.price, locale)}</p>}
        </div>
      )}
    </div>
  );
}
