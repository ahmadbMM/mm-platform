"use client";

import { useState } from "react";
import { cleanName, normalizePhone, rpc } from "@/lib/rpc-client";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./MessageForm.text";

// A message to the team (site_message_send): the business enquiry, the help centre's form and a
// job application (About). All land in the staff page's Messages. A name, the message and one
// way to answer (email or mobile) are required; the database checks everything again.
// `topics` lets the sender pick the topic (a job application's role); the first is preselected.
type Props = {
  locale: string;
  kind: "business" | "help" | "jobs";
  topic: string;
  topics?: { id: string; label: string }[];
  topicLabel?: string;
  placeholder?: string;
  withCompany?: boolean;
  sendLabel: string;
  doneTitle: string;
  doneText: string;
  className?: string;
};


export default function MessageForm(p: Props) {
  const t = useLocalize(T);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState(p.topics?.[0]?.id ?? p.topic);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function send() {
    setErr("");
    const nm = cleanName(name), em = email.trim().toLowerCase(), ph = phone.trim() ? normalizePhone(phone) : "";
    if (!nm || !/^[\p{L}\s]+$/u.test(nm)) return setErr(t.errors.name);
    if (em && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(em)) return setErr(t.errors.email);
    if (ph && (!/^\+[1-9]\d{7,14}$/.test(ph) || (ph.startsWith("+966") && !/^\+9665\d{8}$/.test(ph)))) return setErr(t.errors.phone);
    if (!em && !ph) return setErr(t.errors.contact);
    if (!message.trim()) return setErr(t.errors.message);
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; ref?: string; error?: string }>("site_message_send", {
        p: { kind: p.kind, topic: p.topics ? topic : p.topic, name: nm, company: p.withCompany ? company.trim() : "", email: em, phone: ph, message: message.trim(), lang: (p.locale === "ar" ? "ar" : "en") },
      });
      if (r.ok && r.ref) setDone(r.ref);
      else setErr(t.errors[r.error || ""] || t.errors.generic);
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className={`mf-done ${p.className || ""}`} role="status">
        <strong>{p.doneTitle}</strong>
        <span>{p.doneText}</span>
        <small>{t.ref}: <b className="mm-lat">{done}</b></small>
        <button type="button" className="mf-again" onClick={() => { setDone(""); setMessage(""); }}>{t.another}</button>
      </div>
    );
  }

  return (
    <div className={`mf-fields ${p.className || ""}`}>
      <input className={`mf-input${p.withCompany ? "" : " mf-wide"}`} value={name} onChange={(e) => setName(e.target.value.replace(/[-‐-―]/g, " "))} placeholder={t.name} aria-label={t.name} autoComplete="name" maxLength={120} />
      {p.withCompany && <input className="mf-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t.company} aria-label={t.company} autoComplete="organization" maxLength={120} />}
      <input className="mf-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} aria-label={t.email} type="email" autoComplete="email" dir="ltr" maxLength={254} />
      <input className="mf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} />
      {p.topics && p.topics.length > 1 && (
        <select className="mf-input mf-wide" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={p.topicLabel || t.message}>
          {p.topics.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}
      <textarea className="mf-input mf-wide" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={p.placeholder || (p.kind === "business" ? t.placeholderBiz : t.placeholderHelp)} aria-label={t.message} rows={p.kind === "jobs" ? 5 : 4} maxLength={2000} />
      {err && <p className="mf-err mf-wide" role="alert">{err}</p>}
      <button type="button" className="mf-send mf-wide" onClick={send} disabled={busy}>{busy ? t.sending : p.sendLabel}</button>
    </div>
  );
}
