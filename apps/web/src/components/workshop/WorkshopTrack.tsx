"use client";

import { useState } from "react";
import { normalizePhone, rpc } from "@/lib/rpc-client";
import { fmtPattern, type DatePattern } from "@/lib/date-pattern";
import { fmtSar } from "@/lib/fill";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./WorkshopTrack.text";
import { T as PT } from "@/components/pay/Pay.text";
import { TickIcon } from "@/components/site/Icons";

// "Where's my bike?": the reference from the request plus the phone it was sent with
// (workshop_track). Shows the stage the staff page has set.
const STAGES = ["new", "confirmed", "in_workshop", "awaiting_parts", "ready", "completed"] as const;
type Res = { ok: boolean; error?: string; ref?: string; status?: string; service?: string | null; scheduled_for?: string | null; preferred_date?: string | null; preferred_time?: string | null; price?: number | null; paid?: boolean };

// whenFmt: how the page's language writes the booked day and time ("Mon 5 Oct, 17:00"), described
// by the server (lib/date-pattern), since a browser may not know the language.
export default function WorkshopTrack({ locale, whenFmt, payOpen = false }: { locale: string; whenFmt: DatePattern; payOpen?: boolean }) {
  const t = useLocalize(T);
  const pt = useLocalize(PT);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState("");
  // Paying the job online (2026-11-10): once staff set its final price and it is ready or done, while unpaid.
  async function pay() {
    if (!res?.ref || paying) return;
    setPaying(true); setPayErr("");
    try {
      const r = await fetch("/api/pay/workshop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: res.ref, phone: normalizePhone(phone), lang: locale }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (b?.ok && b.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.url)) { window.location.assign(b.url); return; }
      setPayErr(pt.ticket.failed);
    } catch { setPayErr(pt.ticket.failed); }
    setPaying(false);
  }
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [msg, setMsg] = useState("");
  async function check() {
    setMsg(""); setRes(null); setBusy(true);
    try {
      // The reference as the database reads it ("W-0042"): Arabic and Persian digits and the
      // direction marks a phone adds around a pasted reference would never match.
      const at = ref.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").trim()
        .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
      const r = await rpc<Res>("workshop_track", { p_ref: at, p_phone: normalizePhone(phone) });
      if (r.ok) setRes(r); else setMsg(r.error === "throttled" ? t.throttled : t.notFound);
    } catch { setMsg(t.error); }
    setBusy(false);
  }
  const idx = res?.status ? STAGES.indexOf(res.status as (typeof STAGES)[number]) : -1;
  const when = res?.scheduled_for ? fmtPattern(whenFmt, res.scheduled_for) : "";
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
                <li key={s} className={i < idx ? "done" : i === idx ? "now" : ""}><span aria-hidden="true">{i < idx ? <TickIcon size={14} /> : i + 1}</span>{t.stages[s]}</li>
              ))}
            </ol>
          )}
          {when && <p>{t.scheduled}: {when}</p>}
          {typeof res.price === "number" && <p>{t.price}: {fmtSar(res.price, locale)}</p>}
          {res.paid && <p className="tk-online">{pt.ticket.paidOnline}</p>}
          {payOpen && !res.paid && typeof res.price === "number" && res.price >= 1 && (res.status === "ready" || res.status === "completed") && (
            <button type="button" className="ws-btn ws-btn-dark" disabled={paying} aria-busy={paying} onClick={() => void pay()}>{pt.ticket.payNow}</button>
          )}
          {payErr && <p className="ws-err" role="alert">{payErr}</p>}
        </div>
      )}
    </div>
  );
}
