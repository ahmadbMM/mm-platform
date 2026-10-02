"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import {
  HEARD, RIDER_TYPES, SOCIAL_NETS, dobError, emailOk, heightOf, heightOk, initials, joinName3, nameError, nameTyped, normPhone,
  socRead, socialsOf, splitName3, splitPhone, aboutText, aboutTextOk, type ProfileChanges, type SocialKey,
} from "@/lib/account-profile";
import { T } from "./Account.text";
import { CitySelect, CountrySelect, DobPicker, PhoneInput, SignInMarks, postJson, uploadPhoto, useNatOptions } from "./fields";

// The account's details, as the booking app's My Account edits them (renderAccount / saveAccount):
// the photo, the name in three boxes, email (with the Google and Apple marks when the account
// signs in with them), mobile, height, birth date, country and city, nationality, then - once the
// server has answered customer_about - gender, profession, company and how they heard of us; the
// social handles and the bike type they ride. Only what the rider changed is sent
// (/api/account/profile), and the page is drawn again from the server once it is saved.
export type ProfileProps = {
  locale: string;
  profile: { name: string; email: string; phone: string; height: number | null; birth_date: string | null; country: string | null; city: string | null;
    nationality: string | null; type_preference: string | null; socials: unknown; gender: string | null; photo: string | null };
  about: { profession?: string | null; workplace?: string | null; heard_from?: string | null; sign_in?: string | null } | null;
  typeNames: Record<string, string>;
};

export default function ProfileForm({ locale, profile, about, typeNames }: ProfileProps) {
  const t = useLocalize(T);
  const router = useRouter();
  const natOpts = useNatOptions(locale);
  const [base, setBase] = useState(() => ({
    ...splitName3(profile.name), email: profile.email || "", ...splitPhone(profile.phone || ""), height: profile.height ? String(profile.height) : "",
    birth: profile.birth_date || "", country: profile.country || "", city: profile.city || "", nationality: profile.nationality || "",
    gender: profile.gender === "male" || profile.gender === "female" ? profile.gender : "",
    profession: about?.profession || "", workplace: about?.workplace || "", heard: about?.heard_from || "",
    socials: socialsOf(profile.socials), type: profile.type_preference || "",
  }));
  const [f, setF] = useState({ ...base, birthPartial: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((cur) => ({ ...cur, [k]: v })); setErr(""); setDone(false); };
  const [photo, setPhoto] = useState(profile.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const errBox = useRef<HTMLParagraphElement>(null);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true); setPhotoMsg("");
    const r = await uploadPhoto(file);
    setPhotoBusy(false);
    if ("photo" in r) { setPhoto(r.photo); setPhotoMsg(t.photoSaved); router.refresh(); }
    else setPhotoMsg(r.error === "read" || r.error === "invalid" ? t.photoRead : r.error === "signin" ? t.errors.signin : t.photoFail);
  }
  async function removePhoto() {
    setPhotoBusy(true); setPhotoMsg("");
    try {
      const r = await fetch("/api/account/photo", { method: "DELETE" });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { setPhoto(null); router.refresh(); } else setPhotoMsg(b.error === "signin" ? t.errors.signin : t.photoFail);
    } catch { setPhotoMsg(t.photoFail); }
    setPhotoBusy(false);
  }

  /** What changed, checked as saveAccount checks it: the changes, or the message to show. */
  function changes(): { ch: ProfileChanges } | { msg: string } {
    const ch: ProfileChanges = {};
    if (f.first !== base.first || f.middle !== base.middle || f.last !== base.last) {
      const e = nameError(f.first, f.middle, f.last);
      if (e) return { msg: t.errors[e] };
      ch.name = joinName3(f.first, f.middle, f.last);
    }
    const email = f.email.trim().toLowerCase();
    if (email !== base.email.trim().toLowerCase()) {
      if (email && !emailOk(email)) return { msg: t.errors.email };
      ch.email = email;
    }
    const digits = f.num.replace(/\D/g, "");
    if (f.num !== base.num || f.cc !== base.cc) {
      if (digits && digits.length < 8) return { msg: t.errors.phone };
      ch.phone = digits ? normPhone(f.num, f.cc) : "";
    }
    if (("email" in ch || "phone" in ch) && !(ch.email ?? base.email) && !(ch.phone ?? profile.phone)) return { msg: t.errors.contact };
    if (f.height !== base.height) {
      const h = heightOf(f.height);
      if (f.height.trim() && (h === null || !heightOk(h))) return { msg: t.errors.height };
      ch.height = f.height.trim() ? h : null;
    }
    if (f.birthPartial) return { msg: t.errors.birth_part };
    if (f.birth !== base.birth) {
      const e = f.birth ? dobError(f.birth) : null;
      if (e) return { msg: t.errors[e] };
      ch.birth_date = f.birth || null;
    }
    if (f.country !== base.country) ch.country = f.country || null;
    if (f.city !== base.city || f.country !== base.country) ch.city = f.city || null;
    if (f.nationality !== base.nationality) ch.nationality = f.nationality || null;
    if (f.type !== base.type && f.type) ch.type_preference = f.type;
    if (SOCIAL_NETS.some((n) => (f.socials[n.key] ?? "") !== (base.socials[n.key] ?? ""))) {
      const r = socRead(f.socials);
      if ("err" in r) return { msg: t.socialErr(SOCIAL_NETS.find((n) => n.key === r.err)?.label ?? r.err) };
      ch.socials = r.val;
    }
    if (about) {
      if (f.gender && f.gender !== base.gender) ch.gender = f.gender;
      const prof = aboutText(f.profession), wp = aboutText(f.workplace);
      if (prof !== aboutText(base.profession)) { if (!aboutTextOk(prof, 80)) return { msg: t.errors.profession }; ch.profession = prof; }
      if (wp !== aboutText(base.workplace)) { if (!aboutTextOk(wp, 120)) return { msg: t.errors.workplace }; ch.workplace = wp; }
      if (f.heard && f.heard !== base.heard) ch.heard_from = f.heard;
    }
    return { ch };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setDone(false);
    const c = changes();
    if ("msg" in c) { setErr(c.msg); requestAnimationFrame(() => errBox.current?.scrollIntoView({ block: "center" })); return; }
    if (!Object.keys(c.ch).length) { setDone(true); return; }
    setBusy(true);
    const b = await postJson("/api/account/profile", { changes: c.ch });
    setBusy(false);
    // What is on the form is what is on file now: the next save compares against it.
    if (b.ok) { setBase((cur) => ({ ...cur, ...f, socials: { ...f.socials } })); setDone(true); router.refresh(); return; }
    const code = b.error || "generic";
    const net = /^social_(.+)$/.exec(code);
    setErr(net ? t.socialErr(SOCIAL_NETS.find((n) => n.key === net[1])?.label ?? net[1]) : t.errors[code] || t.errors.generic);
  }

  const name = (k: "first" | "middle" | "last", label: string, ac: string) => (
    <label className="ac-f">
      <span>{label}{k === "middle" && <em> ({t.optional})</em>}</span>
      <input value={f[k]} onChange={(e) => set(k, nameTyped(e.target.value))} autoComplete={ac} autoCapitalize="words" maxLength={60} />
    </label>
  );

  return (
    <form className="ac-panel ac-profile" onSubmit={save} noValidate aria-labelledby="ac-details-h">
      <h2 id="ac-details-h" className="ac-panel-h">{t.details}</h2>

      <div className="ac-photo-row">
        {photo
          ? <img src={photo} alt="" className="ac-photo" width={72} height={72} decoding="async" />
          : <span className="ac-photo ac-initials" aria-hidden="true">{initials(profile.name)}</span>}
        <div className="ac-photo-col">
          <span className="ac-k">{t.photo}</span>
          <div className="ac-row-btns">
            <label className={`ac-btn ac-btn-line${photoBusy ? " dis" : ""}`}>
              {photoBusy ? t.uploading : t.upload}
              <input type="file" accept="image/*" className="ac-file" onChange={pickPhoto} disabled={photoBusy} />
            </label>
            {photo && <button type="button" className="ac-btn ac-btn-line" onClick={removePhoto} disabled={photoBusy}>{t.remove}</button>}
          </div>
          {photoMsg && <p className="ac-note" role="status">{photoMsg}</p>}
        </div>
      </div>

      <div className="ac-grid ac-grid-3">
        {name("first", t.first, "given-name")}
        {name("middle", t.middle, "additional-name")}
        {name("last", t.last, "family-name")}
      </div>
      <div className="ac-grid">
        <label className="ac-f">
          <span className="ac-f-si">{t.email}{about?.sign_in && <span className="ac-si-row" aria-label={t.signsInWith}><SignInMarks value={about.sign_in} labels={{ google: t.google, apple: t.apple }} /></span>}</span>
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" inputMode="email" dir="ltr" maxLength={254} />
        </label>
        <div className="ac-f">
          <label htmlFor="ac-phone">{t.phone}</label>
          <PhoneInput id="ac-phone" cc={f.cc} num={f.num} onCc={(v) => set("cc", v)} onNum={(v) => set("num", v)} ccLabel={t.cc} />
        </div>
        <label className="ac-f">
          <span>{t.height} <em>{t.heightHint}</em></span>
          <input type="text" inputMode="numeric" value={f.height} onChange={(e) => set("height", e.target.value)} placeholder="175" maxLength={3} dir="ltr" />
        </label>
        <div className="ac-f">
          <label htmlFor="ac-birth-d">{t.birth}</label>
          <DobPicker idBase="ac-birth" value={f.birth} locale={locale} labels={{ day: t.day, month: t.month, year: t.year }}
            onChange={(v, partial) => { setF((cur) => ({ ...cur, birth: v, birthPartial: partial })); setErr(""); setDone(false); }} />
        </div>
        <div className="ac-f">
          <label htmlFor="ac-country">{t.country}</label>
          <CountrySelect id="ac-country" value={f.country} opts={natOpts} placeholder={t.countryPick}
            onChange={(v) => { setF((cur) => ({ ...cur, country: v, city: "" })); setErr(""); setDone(false); }} />
        </div>
        <div className="ac-f">
          <label htmlFor="ac-city">{t.city}</label>
          <CitySelect id="ac-city" country={f.country} value={f.city} locale={locale} placeholder={t.cityPick} firstText={t.cityFirst} onChange={(v) => set("city", v)} />
        </div>
        <div className="ac-f">
          <label htmlFor="ac-nat">{t.nationality}</label>
          <CountrySelect id="ac-nat" value={f.nationality} opts={natOpts} placeholder={t.natPick} onChange={(v) => set("nationality", v)} />
        </div>
        {about && (
          <div className="ac-f">
            <span id="ac-gender-l">{t.gender}</span>
            <div className="ac-seg" role="group" aria-labelledby="ac-gender-l">
              {(["male", "female"] as const).map((g) => (
                <button key={g} type="button" className={f.gender === g ? `on g-${g}` : ""} aria-pressed={f.gender === g} onClick={() => set("gender", g)}>{g === "male" ? t.male : t.female}</button>
              ))}
            </div>
          </div>
        )}
        {about && (
          <label className="ac-f">
            <span>{t.profession}</span>
            <input value={f.profession} onChange={(e) => set("profession", e.target.value)} placeholder={t.professionPh} autoComplete="organization-title" maxLength={80} />
          </label>
        )}
        {about && (
          <label className="ac-f">
            <span>{t.workplace}</span>
            <input value={f.workplace} onChange={(e) => set("workplace", e.target.value)} placeholder={t.workplacePh} autoComplete="organization" maxLength={120} />
          </label>
        )}
      </div>

      <fieldset className="ac-fs">
        <legend>{t.socials}</legend>
        <div className="ac-grid">
          {SOCIAL_NETS.map((n) => (
            <label key={n.key} className="ac-f">
              <span>{n.label}</span>
              <input value={f.socials[n.key] ?? ""} placeholder={t.socialPh} dir="ltr" maxLength={140} autoCapitalize="none" spellCheck={false}
                onChange={(e) => set("socials", { ...f.socials, [n.key as SocialKey]: e.target.value })} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="ac-fs">
        <legend>{t.bikeType}</legend>
        <div className="ac-pills" role="group">
          {RIDER_TYPES.map((ty) => (
            <button key={ty} type="button" className={f.type === ty ? "on" : ""} aria-pressed={f.type === ty} onClick={() => set("type", ty)}>
              {ty === "Own" ? t.bikeOwner : typeNames[ty] ?? ty}
            </button>
          ))}
        </div>
        <p className="ac-hint">{t.typeHint}</p>
      </fieldset>

      {about && (
        <label className="ac-f ac-f-half">
          <span>{t.heard}</span>
          <select className={f.heard ? "" : "ph"} value={f.heard} onChange={(e) => set("heard", e.target.value)}>
            <option value="" disabled={!!base.heard}>{t.heardPick}</option>
            {HEARD.map((h) => <option key={h} value={h}>{t.heardOpts[h]}</option>)}
          </select>
        </label>
      )}

      {err && <p ref={errBox} className="ac-err" role="alert">{err}</p>}
      {done && !err && <p className="ac-ok" role="status">{t.saved}</p>}
      <button type="submit" className="ac-go ac-go-auto" disabled={busy}>{busy ? t.saving : t.save}</button>
    </form>
  );
}
