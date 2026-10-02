"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { APPLE_RELAY, fixItems, nameTyped, normPhone, splitPhone, type FixField } from "@/lib/account-profile";
import { T } from "./Account.text";
import { CitySelect, CountrySelect, DobPicker, PhoneInput, postJson, uploadPhoto, useNatOptions } from "./fields";

// What staff asked the rider to correct (customer_fix_fields), and what the server asks for itself
// - a password for an account that signs in with Google or Apple only, a real email for a hidden
// Apple one, a community member's birth date and nationality - as the booking app's check-up asks
// it (renderFixGate): one box per item, what is on the account above it, saved together through
// /api/account/fix. What the server took is gone from the list; what it refused is asked again.
type Was = { name: string; email: string; phone: string; birth_date: string | null; gender: string | null; nationality: string | null; country: string | null; city: string | null; height: number | null };

export default function FixRequest({ locale, fields: initial, was }: { locale: string; fields: FixField[]; was: Was }) {
  const t = useLocalize(T);
  const router = useRouter();
  const natOpts = useNatOptions(locale);
  const [fields, setFields] = useState(initial);
  const ph = splitPhone(was.phone || "");
  const [v, setV] = useState({ name: "", email: "", cc: ph.cc, num: "", birth_date: "", gender: "", nationality: "", country: "", city: "", height: "", photo: "", password: "", password2: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [net, setNet] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof v, x: string) => { setV((c) => ({ ...c, [k]: x })); setErrs((e) => { const n = { ...e }; delete n[k === "country" || k === "city" ? "residence" : k === "password2" ? "password" : k === "cc" || k === "num" ? "phone" : k]; return n; }); };
  if (done) return <div className="ac-sec"><p className="ac-panel ac-ok" role="status">{t.fixThanks}</p></div>;
  if (!fields.length) return null;

  const items = fixItems(fields);
  const own = fields.every((k) => k === "password" || (k === "email" && was.email.endsWith(APPLE_RELAY)) || ((k === "birth_date" || k === "nationality") && !was[k]));
  const day = (iso: string) => { try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)); } catch { return iso; } };
  const wasText = (k: string): string | null => {
    if (k === "photo" || k === "password") return null;
    const x = k === "name" ? was.name : k === "email" ? was.email : k === "phone" ? was.phone : k === "birth_date" ? (was.birth_date ? day(was.birth_date) : "")
      : k === "gender" ? (was.gender === "female" ? t.female : was.gender === "male" ? t.male : "") : k === "nationality" ? (natOpts?.find((o) => o.value === was.nationality)?.label ?? was.nationality ?? "")
      : k === "residence" ? [natOpts?.find((o) => o.value === was.country)?.label ?? was.country, was.city].filter(Boolean).join(" · ") : k === "height" ? (was.height ? `${was.height} cm` : "") : "";
    return x ? t.fixWas(x) : t.fixWasEmpty;
  };
  const msg = (code: string | undefined) => (code ? (code === "weak" ? t.errors.weak : code === "mismatch" ? t.pwErrors.mismatch : t.errors[code] || t.fixCheck) : "");

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    const r = await uploadPhoto(file);
    setPhotoBusy(false);
    if ("photo" in r) set("photo", r.photo); else setErrs((x) => ({ ...x, photo: r.error === "read" || r.error === "invalid" ? "photo_read" : "photo" }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNet("");
    if (items.includes("password") && v.password !== v.password2) { setErrs((x) => ({ ...x, password: "mismatch" })); return; }
    const values: Record<string, string> = {};
    for (const k of items) {
      if (k === "phone") values.phone = v.num.replace(/\D/g, "") ? normPhone(v.num, v.cc) : "";
      else if (k === "residence") { values.country = v.country; values.city = v.city; }
      else values[k] = v[k];
    }
    setBusy(true);
    const b = await postJson<{ left?: string[]; errors?: Record<string, string> }>("/api/account/fix", { values });
    setBusy(false);
    if (b.ok) {
      const left = (b.left ?? []) as FixField[];
      if (!left.length) { setDone(true); router.refresh(); return; }
      setFields(left);
      setErrs(Object.fromEntries(fixItems(left).map((k) => [k, "check"])));
      router.refresh();
      return;
    }
    if (b.errors) setErrs(b.errors); else setNet(b.error === "signin" ? t.errors.signin : t.connection);
  }

  return (
    <div className="ac-sec">
      <form className="ac-panel ac-fix" onSubmit={save} noValidate aria-labelledby="ac-fix-h">
        <p className="ac-fix-kicker">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4" /><path d="M5 4.5c2.4-1.4 4.7-1.4 7 0s4.6 1.4 7 0v8.5c-2.4 1.4-4.7 1.4-7 0s-4.6-1.4-7 0" /></svg>
          {t.fixKicker}
        </p>
        <h2 id="ac-fix-h" className="ac-panel-h">{own ? t.fixOwnTitle : t.fixTitle}</h2>
        <p className="ac-sub">{own ? t.fixOwnSub : t.fixSub}</p>
        <p className="ac-fix-head">{t.fixHead} <span>{items.length}</span></p>
        <div className="ac-fix-list">
          {items.map((k) => {
            const w = wasText(k), e = errs[k];
            return (
              <div key={k} className={`ac-fix-item${e ? " err" : ""}`}>
                <span className="ac-k" id={`ac-fx-${k}`}>{t.fixLabels[k]}</span>
                {w && <p className="ac-hint">{w}</p>}
                {k === "name" && <input aria-labelledby={`ac-fx-${k}`} value={v.name} onChange={(x) => set("name", nameTyped(x.target.value))} autoComplete="name" autoCapitalize="words" maxLength={120} />}
                {k === "email" && <input aria-labelledby={`ac-fx-${k}`} type="email" value={v.email} onChange={(x) => set("email", x.target.value)} autoComplete="email" inputMode="email" dir="ltr" maxLength={254} />}
                {k === "phone" && <PhoneInput cc={v.cc} num={v.num} onCc={(x) => set("cc", x)} onNum={(x) => set("num", x)} ccLabel={t.cc} />}
                {k === "birth_date" && <DobPicker idBase="ac-fx-birth" value={v.birth_date} locale={locale} labels={{ day: t.day, month: t.month, year: t.year }} onChange={(x) => set("birth_date", x)} />}
                {k === "gender" && (
                  <div className="ac-seg" role="group" aria-labelledby={`ac-fx-${k}`}>
                    {(["male", "female"] as const).map((g) => <button key={g} type="button" className={v.gender === g ? `on g-${g}` : ""} aria-pressed={v.gender === g} onClick={() => set("gender", g)}>{g === "male" ? t.male : t.female}</button>)}
                  </div>
                )}
                {k === "nationality" && <CountrySelect value={v.nationality} opts={natOpts} placeholder={t.natPick} label={t.nationality} onChange={(x) => set("nationality", x)} />}
                {k === "residence" && (
                  <div className="ac-grid">
                    <CountrySelect value={v.country} opts={natOpts} placeholder={t.countryPick} label={t.country} onChange={(x) => { set("country", x); setV((c) => ({ ...c, city: "" })); }} />
                    <CitySelect country={v.country} value={v.city} locale={locale} placeholder={t.cityPick} firstText={t.cityFirst} label={t.city} onChange={(x) => set("city", x)} />
                  </div>
                )}
                {k === "height" && <input aria-labelledby={`ac-fx-${k}`} type="text" inputMode="numeric" value={v.height} onChange={(x) => set("height", x.target.value)} placeholder="175" maxLength={3} dir="ltr" />}
                {k === "photo" && (
                  <div className="ac-photo-row">
                    {v.photo ? <img src={v.photo} alt="" className="ac-photo" width={56} height={56} /> : null}
                    <label className={`ac-btn ac-btn-line${photoBusy ? " dis" : ""}`}>
                      {photoBusy ? t.uploading : t.upload}
                      <input type="file" accept="image/*" className="ac-file" onChange={pickPhoto} disabled={photoBusy} />
                    </label>
                  </div>
                )}
                {k === "password" && (
                  <>
                    <input aria-labelledby={`ac-fx-${k}`} type="password" value={v.password} onChange={(x) => set("password", x.target.value)} autoComplete="new-password" dir="ltr" maxLength={200} placeholder={t.pwNew} />
                    <input aria-label={t.pwNew2} type="password" value={v.password2} onChange={(x) => set("password2", x.target.value)} autoComplete="new-password" dir="ltr" maxLength={200} placeholder={t.pwNew2} />
                    <p className="ac-hint">{t.pwRule}</p>
                  </>
                )}
                {e && <p className="ac-err" role="alert">{e === "photo_read" ? t.photoRead : msg(e)}</p>}
              </div>
            );
          })}
        </div>
        <p className="ac-hint">{t.fixNote}</p>
        {net && <p className="ac-err" role="alert">{net}</p>}
        <button type="submit" className="ac-go ac-go-auto" disabled={busy || photoBusy}>{busy ? t.saving : t.fixSave}</button>
      </form>
    </div>
  );
}
