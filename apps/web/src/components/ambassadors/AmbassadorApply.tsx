"use client";

import { useState } from "react";
import { cleanName, normalizePhone, rpc } from "@/lib/rpc-client";

// The application (ambassador_apply): it lands in the staff page's Ambassadors section, where
// the team approves it and sends the code on WhatsApp.
type Props = { locale: string; title: string; text: string; button: string; note: string; doneTitle: string; doneText: string };
const T = {
  en: {
    name: "Full name", phone: "Mobile number", insta: "Instagram (optional)", why: "Why you? Tell us about your community and riding", sending: "Sending…",
    already: "You have already applied with this number - the team will be in touch.", active: "This number already has an ambassador code - open your card above.",
    errors: { name: "Enter your name - letters and spaces only.", phone: "Check the mobile number, e.g. 05XXXXXXXX.", instagram: "Check the Instagram handle.", throttled: "Too many tries from this network - wait a few minutes.", generic: "It could not be sent. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    name: "الاسم الكامل", phone: "رقم الجوال", insta: "حساب إنستغرام (اختياري)", why: "لماذا أنت؟ حدثنا عن مجتمعك وركوبك", sending: "جارٍ الإرسال…",
    already: "سبق أن قدّمت بهذا الرقم - سيتواصل معك الفريق.", active: "لهذا الرقم كود سفير بالفعل - افتح بطاقتك في الأعلى.",
    errors: { name: "أدخل اسمك - حروف ومسافات فقط.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.", instagram: "تحقق من حساب إنستغرام.", throttled: "محاولات كثيرة من هذه الشبكة - انتظر دقائق.", generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};

export default function AmbassadorApply(p: Props) {
  const ar = p.locale === "ar";
  const t = ar ? T.ar : T.en;
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
    if (!nm || !/^[\p{L}\s]+$/u.test(nm)) return setErr(t.errors.name);
    if (!/^\+[1-9]\d{7,14}$/.test(ph) || (ph.startsWith("+966") && !/^\+9665\d{8}$/.test(ph))) return setErr(t.errors.phone);
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; status?: string; repeat?: boolean; error?: string }>("ambassador_apply", {
        p: { name: nm, phone: ph, instagram: insta.trim(), why: why.trim(), lang: ar ? "ar" : "en" },
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
