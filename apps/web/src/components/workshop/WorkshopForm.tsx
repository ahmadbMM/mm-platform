"use client";

import { useMemo, useState } from "react";
import { cleanName, normalizePhone, rpc } from "@/lib/rpc-client";
import { dayOptions, timesFor } from "@/lib/workshop-days";

// The Workshop request card (Workshop.dc.html, right column). The customer picks how the bike
// gets to us, a service (or describes the problem and gets one suggested), optional parts, a
// preferred day and time, and leaves a name and phone. It goes to the staff page through
// workshop_request(); the team confirms by phone. Nothing is charged online.
export type Service = { id: string; name: string; sub: string; price: number; mins: number; includes: string[] };
export type WorkshopFormProps = {
  locale: string;
  formTitle: string; formSub: string;
  services: Service[];
  symptoms: { label: string; service: number }[];
  parts: { id: string; label: string; price: number }[];
  wait: boolean; pickup: boolean; pickupFee: number;
  /** Riyadh wall clock when the page was made, "YYYY-MM-DDTHH:MM" (see lib/workshop-days). */
  now: string; days: number; times: string[]; fridayClosed: boolean; closeHour: number;
  doneTitle: string; doneText: string;
};

const T = {
  en: {
    lane: "How it's serviced", dropoff: "Drop off", dropoffSub: "You bring the bike in", wait: "While you wait", waitSub: "Quick fixes",
    pickup: "Pickup & delivery", pickupSub: "We come to you", pickupAddr: "Pickup address", notSure: "Not sure? Describe the problem",
    notSureHint: "Pick one and we'll suggest the right service.", suggested: "Suggested", included: "What's included", free: "Free",
    about: (m: number) => `~${m} min`, parts: "Add parts (optional)", day: "Preferred day", time: "Preferred time", name: "Your name",
    phone: "Mobile number", bike: "Your bike (e.g. ALVAS DA54 AL)", notes: "Anything we should know? (optional)", total: "Estimated total",
    send: "Send request", sending: "Sending…", ref: "Your reference", another: "Request another",
    code: "Have a code?", apply: "Apply", codeOn: (c: string, d: string) => `Code ${c}: ${d} off`, codeBad: "That code isn't valid.", codeRemove: "Remove",
    errors: { name: "Enter your name - letters and spaces only.", phone: "Check the mobile number, e.g. 05XXXXXXXX.", service: "Pick a service.",
      day: "Pick a day.", pickup_address: "Add the pickup address.", throttled: "Too many requests from this network - try again in a few minutes.",
      generic: "It could not be sent. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    lane: "طريقة الخدمة", dropoff: "إحضار للورشة", dropoffSub: "أنت تُحضر الدراجة", wait: "انتظار سريع", waitSub: "إصلاحات سريعة",
    pickup: "استلام وتوصيل", pickupSub: "نأتي إليك", pickupAddr: "عنوان الاستلام", notSure: "غير متأكد؟ صف المشكلة",
    notSureHint: "اختر عرضاً ونقترح الخدمة المناسبة.", suggested: "مقترح", included: "ماذا يشمل", free: "مجاناً",
    about: (m: number) => `~${m} دقيقة`, parts: "أضف قطعاً (اختياري)", day: "اليوم المفضل", time: "الوقت المفضل", name: "اسمك",
    phone: "رقم الجوال", bike: "دراجتك (مثال: ALVAS DA54 AL)", notes: "أي تفاصيل تهمنا؟ (اختياري)", total: "الإجمالي التقريبي",
    send: "أرسل الطلب", sending: "جارٍ الإرسال…", ref: "رقم طلبك", another: "طلب آخر",
    code: "لديك كود؟", apply: "تطبيق", codeOn: (c: string, d: string) => `الكود ${c}: خصم ${d}`, codeBad: "هذا الكود غير صالح.", codeRemove: "إزالة",
    errors: { name: "أدخل اسمك - حروف ومسافات فقط.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.", service: "اختر خدمة.",
      day: "اختر يوماً.", pickup_address: "أضف عنوان الاستلام.", throttled: "طلبات كثيرة من هذه الشبكة - حاول بعد دقائق.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};

type Lane = "dropoff" | "wait" | "pickup";

export default function WorkshopForm(p: WorkshopFormProps) {
  const ar = p.locale === "ar";
  const t = ar ? T.ar : T.en;
  const [lane, setLane] = useState<Lane>("dropoff");
  const [addr, setAddr] = useState("");
  const [svc, setSvc] = useState(0);
  const [symptom, setSymptom] = useState(-1);
  const [parts, setParts] = useState<Record<string, boolean>>({});
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bike, setBike] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [promo, setPromo] = useState<{ code: string; kind: string; value: number } | null>(null);
  const [codeErr, setCodeErr] = useState("");

  const money = (n: number) => (n === 0 ? t.free : ar ? `${n.toLocaleString("ar-SA-u-nu-latn")} ر.س` : `SAR ${n.toLocaleString("en-US")}`);
  const dayList = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    return dayOptions(p.now, p.days, p.fridayClosed, p.times, p.closeHour).map((iso) => ({ iso, label: fmt.format(new Date(`${iso}T00:00:00Z`)) }));
  }, [ar, p.now, p.days, p.fridayClosed, p.times, p.closeHour]);
  const timeList = day ? timesFor(day, p.now, p.times) : p.times;
  function pickDay(iso: string) {
    setDay(iso);
    if (time && !timesFor(iso, p.now, p.times).includes(time)) setTime("");
  }

  const service = p.services[svc];
  const partsTotal = p.parts.reduce((s, x) => s + (parts[x.id] ? x.price : 0), 0);
  const gross = (service ? service.price : 0) + partsTotal + (lane === "pickup" ? p.pickupFee : 0);
  // A code (an ambassador's, or any promo code the booking app takes) comes off the estimate;
  // the workshop confirms the final price.
  const off = !promo ? 0 : promo.kind === "flat" ? Math.min(promo.value, gross) : Math.round(gross * promo.value) / 100;
  const total = Math.max(0, Math.round(gross - off)); // an estimate: whole riyals
  async function applyCode() {
    setCodeErr("");
    const v = codeIn.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
    if (!v) return;
    try {
      const r = await rpc<{ ok: boolean; code?: string; kind?: string; value?: number }>("promo_lookup", { p_code: v });
      if (r.ok && r.code) setPromo({ code: r.code, kind: r.kind || "percent", value: Number(r.value) || 0 });
      else { setPromo(null); setCodeErr(t.codeBad); }
    } catch { setCodeErr(t.codeBad); }
  }
  const lanes: { id: Lane; label: string; sub: string }[] = [
    { id: "dropoff", label: t.dropoff, sub: t.dropoffSub },
    ...(p.wait ? [{ id: "wait" as Lane, label: t.wait, sub: t.waitSub }] : []),
    ...(p.pickup ? [{ id: "pickup" as Lane, label: t.pickup, sub: p.pickupFee ? `+${money(p.pickupFee)} · ${t.pickupSub}` : t.pickupSub }] : []),
  ];

  async function send() {
    setErr("");
    const nm = cleanName(name), ph = normalizePhone(phone);
    if (!nm || !/^[\p{L}\s]+$/u.test(nm)) return setErr(t.errors.name);
    if (!/^\+[1-9]\d{7,14}$/.test(ph) || (ph.startsWith("+966") && !/^\+9665\d{8}$/.test(ph))) return setErr(t.errors.phone);
    if (!service) return setErr(t.errors.service);
    if (!day) return setErr(t.errors.day);
    if (lane === "pickup" && !addr.trim()) return setErr(t.errors.pickup_address);
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; ref?: string; error?: string }>("workshop_request", {
        p: {
          name: nm, phone: ph, service: service.id, service_label: service.name, price: total, // the estimate the customer saw
          parts: p.parts.filter((x) => parts[x.id]).map((x) => ({ id: x.id, label: x.label, price: x.price })),
          lane, pickup_address: lane === "pickup" ? addr.trim() : "", preferred_date: day, preferred_time: time,
          bike: bike.trim(), notes: notes.trim(), lang: ar ? "ar" : "en", code: promo ? promo.code : "",
        },
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
      <div className="ws-card ws-done" role="status">
        <span className="ws-eyebrow">{p.doneTitle}</span>
        <p className="ws-ref-label">{t.ref}</p>
        <strong className="ws-ref mm-lat">{done}</strong>
        <p className="ws-done-text">{p.doneText}</p>
        <button type="button" className="ws-btn ws-btn-line" onClick={() => { setDone(""); setSymptom(-1); setParts({}); setNotes(""); }}>{t.another}</button>
      </div>
    );
  }

  return (
    <div className="ws-card">
      <h2>{p.formTitle}</h2>
      <p className="ws-sub">{p.formSub}</p>

      {lanes.length > 1 && (
        <>
          <span className="ws-label">{t.lane}</span>
          <div className="ws-lanes" role="radiogroup" aria-label={t.lane}>
            {lanes.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={lane === l.id} className="ws-lane" onClick={() => setLane(l.id)}>
                <strong>{l.label}</strong><span>{l.sub}</span>
              </button>
            ))}
          </div>
          {lane === "pickup" && <input className="ws-input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t.pickupAddr} aria-label={t.pickupAddr} maxLength={200} />}
        </>
      )}

      {p.symptoms.length > 0 && (
        <>
          <span className="ws-label">{t.notSure}</span>
          <p className="ws-hint">{t.notSureHint}</p>
          <div className="ws-chips">
            {p.symptoms.map((s, i) => (
              <button key={i} type="button" aria-pressed={symptom === i} onClick={() => { setSymptom(i); if (p.services[s.service - 1]) setSvc(s.service - 1); }}>{s.label}</button>
            ))}
          </div>
          {symptom >= 0 && p.services[p.symptoms[symptom].service - 1] && (
            <p className="ws-suggest">{t.suggested}: {p.services[p.symptoms[symptom].service - 1].name}</p>
          )}
        </>
      )}

      <div className="ws-services" role="radiogroup" aria-label={p.formTitle}>
        {p.services.map((s, i) => (
          <div key={s.id} className={`ws-svc${svc === i ? " on" : ""}`}>
            <button type="button" role="radio" aria-checked={svc === i} onClick={() => setSvc(i)}>
              <span><strong>{s.name}</strong><small>{s.sub}{s.mins ? ` · ${t.about(s.mins)}` : ""}</small></span>
              <span className="ws-price">{money(s.price)}</span>
            </button>
            {svc === i && s.includes.length > 0 && (
              <div className="ws-incl">
                <span>{t.included}</span>
                <ul>{s.includes.map((x, j) => <li key={j}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {p.parts.length > 0 && (
        <>
          <span className="ws-label">{t.parts}</span>
          <div className="ws-parts">
            {p.parts.map((x) => (
              <label key={x.id} className="ws-part">
                <input type="checkbox" checked={!!parts[x.id]} onChange={(e) => setParts({ ...parts, [x.id]: e.target.checked })} />
                <span>{x.label}</span><span className="ws-price">{money(x.price)}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <span className="ws-label">{t.day}</span>
      <div className="ws-days">
        {dayList.map((d) => <button key={d.iso} type="button" aria-pressed={day === d.iso} onClick={() => pickDay(d.iso)}>{d.label}</button>)}
      </div>
      {timeList.length > 0 && (
        <>
          <span className="ws-label">{t.time}</span>
          <div className="ws-days">
            {timeList.map((x) => <button key={x} type="button" className="mm-lat" aria-pressed={time === x} onClick={() => setTime(time === x ? "" : x)}>{x}</button>)}
          </div>
        </>
      )}

      <div className="ws-fields">
        <input className="ws-input" value={name} onChange={(e) => setName(e.target.value.replace(/[-‐-―]/g, " "))} placeholder={t.name} aria-label={t.name} autoComplete="name" maxLength={120} />
        <input className="ws-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} />
        <input className="ws-input" value={bike} onChange={(e) => setBike(e.target.value)} placeholder={t.bike} aria-label={t.bike} maxLength={80} />
        <textarea className="ws-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes} aria-label={t.notes} rows={3} maxLength={600} />
      </div>

      {promo ? (
        <p className="ws-code-on"><span>{t.codeOn(promo.code, promo.kind === "flat" ? money(promo.value) : `${promo.value}%`)}</span><button type="button" onClick={() => { setPromo(null); setCodeIn(""); }}>{t.codeRemove}</button></p>
      ) : (
        <div className="ws-code">
          <input className="ws-input" value={codeIn} onChange={(e) => { setCodeIn(e.target.value); setCodeErr(""); }} placeholder={t.code} aria-label={t.code} dir="ltr" maxLength={40} autoCapitalize="characters" />
          <button type="button" className="ws-btn ws-btn-line" onClick={applyCode} disabled={!codeIn.trim()}>{t.apply}</button>
        </div>
      )}
      {codeErr && <p className="ws-err" role="alert">{codeErr}</p>}
      <div className="ws-total"><span>{t.total}</span><strong>{money(total)}</strong></div>
      {err && <p className="ws-err" role="alert">{err}</p>}
      <button type="button" className="ws-btn ws-btn-green" onClick={send} disabled={busy}>{busy ? t.sending : t.send}</button>
    </div>
  );
}
