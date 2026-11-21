"use client";

import { useEffect, useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { mkErrorKey, type MkMe, type MkShopMine } from "@/lib/market/core";
import {
  W4_BIRTH_HREF, W4_DRAFT_PREFIX, w4Cities, w4DraftKey, w4DraftRead, w4DraftStale, w4DraftWrite, w4EditFieldsOf, w4FieldsOf, w4FormOf, w4IsLocked,
  w4Issues, w4NeedAgree, w4Said, w4TypeMax, type W4Field, type W4Form, type W4IssueKey, type W4Key,
} from "@/lib/market/w4";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";
import { T as M, mkErrorText } from "../Market.text";
import { T } from "../w4.text";
import { w4Get, w4Post } from "./api";
import { w4LogoCopies, w4LogoUpload, type W4Copies } from "./logo-client";
import RulesLink from "./RulesLink";

// A shop's form (W4), drawn in the browser only because it opens from what this browser kept of it.
//   mode "apply"   the whole application: a new one, or one that is waiting or was not approved, sent (again). What is
//                  typed is kept in this browser as it goes, under the account's own name for it, and forgotten once
//                  the application is sent.
//   mode "edit"    an approved shop: only the details its owner may still change. The trade name, the registration,
//                  the VAT number and the city are not in the form at all.
// Nothing is judged until the first try at sending; then each field says what is wrong with it, beside it, and the
// first one is focused. A refusal from the database reads in the same words, beside the field it names.
// The logo is a photo of the Marketplace's own storage, and the database names it in the shop's own folder: so a new
// application is sent first, then the logo is stored, then the application is saved once more with it. When that
// second part fails the application is still sent, and the screen after says the logo was not added.

export type ShopFormProps = {
  locale: string;
  mode: "apply" | "edit";
  shop: MkShopMine | null;
  /** The rules' version the page read with the account (market_me): what the agreement records. */
  termsVersion: string;
  /** Names this account's unsent application in this browser. */
  tag: string;
  /** The saved shop; `note` "logo" when the application went and its logo did not. */
  onDone: (shop: MkShopMine, note: "logo" | null) => void;
  /** The session is no longer accepted: the page draws the sign-in. */
  onSignedOut: () => void;
  onCancel?: () => void;
};

type Refusal = { field: W4Field | null; text: string; birth?: boolean };
const MAP_EXAMPLE = "https://maps.app.goo.gl/…";

function kept(tag: string): string | null {
  try { return window.localStorage.getItem(w4DraftKey(tag)); } catch { return null; }
}
function keep(tag: string, f: W4Form) {
  try { window.localStorage.setItem(w4DraftKey(tag), w4DraftWrite(f)); } catch { /* no storage: the form still works */ }
}
function forget(tag: string) {
  try { window.localStorage.removeItem(w4DraftKey(tag)); } catch { /* nothing kept */ }
}
/** An application kept here over thirty days ago is taken out of this browser, whichever account left it: a phone
 *  can be used by several, and a shop's details do not stay on it for good. */
function prune() {
  try {
    const ls = window.localStorage, names: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(W4_DRAFT_PREFIX)) names.push(k);
    }
    for (const k of names) if (w4DraftStale(ls.getItem(k))) ls.removeItem(k);
  } catch { /* no storage: nothing is kept */ }
}

export default function ShopForm({ locale, mode, shop, termsVersion, tag, onDone, onSignedOut, onCancel }: ShopFormProps) {
  const t = useLocalize(M);
  const w = useLocalize(T);
  const uid = useId();
  const idOf = (f: W4Field) => `${uid}-${f}`;
  const edit = mode === "edit";
  const [form, setForm] = useState<W4Form>(() => (edit ? w4FormOf(shop) : w4DraftRead(kept(tag), w4FormOf(shop))));
  const [agree, setAgree] = useState(false);
  const [version, setVersion] = useState(termsVersion);
  const [tried, setTried] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ copies: W4Copies; url: string } | null>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  // the database asked for the agreement again (the rules changed while the form was open)
  const [asked, setAsked] = useState(false);
  useEffect(prune, []);
  // the chosen picture's preview address is let go when another is chosen, when it is dropped and when the form closes
  useEffect(() => {
    const url = pick?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [pick]);

  const needAgree = asked || w4NeedAgree(shop, version);
  const rules = { locked: edit, needAgree, agree };
  const issues = tried ? w4Issues(form, rules) : [];
  const issueText = (k: W4IssueKey): string => (k === "link" ? t.errors.link : k === "phone_text" ? t.errors.phone : k === "agree" ? t.errors.consent : w.need[k] ?? t.errors.input);
  const errOf = (f: W4Field): string | null => {
    const i = issues.find((x) => x.field === f);
    if (i) return issueText(i.key);
    if (f === "logo" && logoErr) return logoErr;
    return refusal && refusal.field === f ? refusal.text : null;
  };
  const focus = (f: W4Field) => { window.requestAnimationFrame(() => document.getElementById(idOf(f))?.focus()); };

  function set(k: W4Key, v: string) {
    const next = { ...form, [k]: v };
    setForm(next);
    if (!edit) keep(tag, next);
    if (refusal && (refusal.field === k || refusal.field === null)) setRefusal(null);
  }
  const dropPick = () => setPick(null);
  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoErr(null);
    const copies = await w4LogoCopies(file);
    if (!copies) { setLogoErr(w.logoBad); return; }
    setPick({ copies, url: URL.createObjectURL(copies.small) });
    if (refusal?.field === "logo") setRefusal(null);
  }
  function removeLogo() {
    dropPick();
    setLogoErr(null);
    set("logo", "");
  }

  async function refuse(error: string, detail: string, at?: W4Field) {
    const said = w4Said(error, detail, { edit, at });
    if (said.do === "signin") { onSignedOut(); return; }
    if (said.do === "terms") {
      // the rules changed while the form was open: the tick is asked for again, for the version now in force (and is
      // drawn from here on even when that version could not be read just now)
      const me = await w4Get<{ signedIn?: boolean; me?: MkMe }>("/api/market/me");
      if (me.ok && me.me) setVersion(me.me.terms_version);
      setAsked(true);
      setAgree(false);
      setRefusal({ field: "agreement", text: t.errors.terms });
      focus("agreement");
      return;
    }
    const text = said.own ? w[said.own] : said.issue ? issueText(said.issue) : mkErrorText(t, mkErrorKey(error, detail));
    setRefusal({ field: said.field, text, birth: said.birth });
    if (said.field) focus(said.field);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    setRefusal(null);
    const found = w4Issues(form, rules);
    if (found.length) { focus(found[0].field); return; }
    setBusy(true);
    const had = shop !== null;
    const fieldsOf = (f: W4Form) => (edit && shop ? w4EditFieldsOf(shop, f, version) : w4FieldsOf(f, version));
    let now = form;
    if (pick && had) {
      const up = await w4LogoUpload(pick.copies);
      if (!up.ok) { setBusy(false); await refuse(up.error, up.detail, "logo"); return; }
      // stored: it is the form's logo from here on, whatever the save answers, and is not sent a second time
      now = { ...form, logo: up.name };
      setForm(now);
      dropPick();
    }
    const r = await w4Post<{ shop: MkShopMine }>("/api/market/shop/apply", { fields: fieldsOf(now) });
    if (!r.ok) { setBusy(false); await refuse(r.error, r.detail); return; }
    let saved = r.shop, note: "logo" | null = null;
    if (pick && !had) {
      const up = await w4LogoUpload(pick.copies);
      const again = up.ok ? await w4Post<{ shop: MkShopMine }>("/api/market/shop/apply", { fields: w4FieldsOf({ ...now, logo: up.name }, version) }) : null;
      if (again && again.ok) saved = again.shop; else note = "logo";
    }
    forget(tag);
    dropPick();
    setBusy(false);
    onDone(saved, note);
  }

  /* ------------------------------------------------------------------ the fields */

  const shows = (k: W4Key) => !(edit && w4IsLocked(k));
  // while applying, the fields that may be left empty say so; an approved shop's form asks for nothing
  const opt = (optional: boolean) => optional && !edit && <span className="mk-w4-opt">{w.optional}</span>;
  const label = (k: W4Key, optional: boolean) => <label htmlFor={idOf(k)}>{w.field[k]}{opt(optional)}</label>;
  const wrap = (k: W4Key, optional: boolean, control: ReactNode, wide = false) => {
    const err = errOf(k);
    return (
      <div className={`mk-field${wide ? " mk-w4-wide" : ""}`} key={k}>
        {label(k, optional)}
        {control}
        {err && <p className="mk-err" id={`${idOf(k)}-err`}>{err}</p>}
      </div>
    );
  };
  const common = (k: W4Key) => ({
    id: idOf(k), name: k, value: form[k], disabled: busy,
    "aria-invalid": errOf(k) ? true : undefined, "aria-describedby": errOf(k) ? `${idOf(k)}-err` : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value),
  });
  type Kind = { dir?: "ltr" | "rtl" | "auto"; lang?: string; mode?: "numeric" | "tel" | "url"; auto?: string; placeholder?: string; required?: boolean };
  const line = (k: W4Key, o: Kind = {}, wide = false) => shows(k) && wrap(k, !o.required,
    <input type={o.mode === "tel" ? "tel" : o.mode === "url" ? "url" : "text"} inputMode={o.mode} dir={o.dir ?? "auto"} lang={o.lang} autoComplete={o.auto ?? "off"}
      placeholder={o.placeholder} maxLength={w4TypeMax(k)} aria-required={o.required || undefined} {...common(k)} />, wide);
  const para = (k: W4Key, o: Kind = {}) => shows(k) && wrap(k, !o.required,
    <textarea rows={4} dir={o.dir ?? "auto"} lang={o.lang} maxLength={w4TypeMax(k)} aria-required={o.required || undefined} {...common(k)} />, true);

  const logoErrText = errOf("logo");
  const hasLogo = !!pick || !!form.logo;
  // what is said about the whole form, and about anything that has no place on this screen (a field an approved
  // shop's form does not have, the tick when it is not asked for): never a refusal that is said nowhere
  const onScreen = (f: W4Field) => (f === "agreement" ? needAgree : shows(f));
  const general = refusal && (refusal.field === null || !onScreen(refusal.field)) ? refusal : null;
  const sendLabel = edit ? (busy ? w.saving : w.save) : busy ? w.sending : shop?.status === "rejected" ? w.sendAgain : w.send;
  const section = (id: string, title: string, body: ReactNode) => (
    <section className="mk-box mk-w4-sec" aria-labelledby={`${uid}-${id}`}>
      <h2 id={`${uid}-${id}`}>{title}</h2>
      <div className="mk-w4-grid">{body}</div>
    </section>
  );

  return (
    <form className="mk-w4-form" onSubmit={submit} noValidate aria-busy={busy}>
      {section("s-shop", w.secShop, <>
        {line("name_en", { dir: "ltr", lang: "en", auto: "organization", required: true })}
        {line("name_ar", { dir: "rtl", lang: "ar" })}
        {para("sells")}
        {para("about_en", { dir: "ltr", lang: "en" })}
        {para("about_ar", { dir: "rtl", lang: "ar" })}
        <div className="mk-field mk-w4-wide">
          <span className="mk-label">{w.field.logo}{opt(true)}</span>
          <div className="mk-w4-logo">
            {hasLogo && (
              <span className="mk-w4-logo-box">
                {pick ? <span className="mk-photo mk-photo-sq"><img src={pick.url} alt={w.logoAlt} /></span> : <MkPhoto name={form.logo} alt={w.logoAlt} small noPhoto={t.noPhoto} />}
              </span>
            )}
            <div className="mk-w4-logo-acts">
              <label className={`mk-btn2 mk-w4-file${busy ? " is-off" : ""}`}>
                <MkIcon name="photo" size={18} />{hasLogo ? w.logoChange : w.logoAdd}
                <input id={idOf("logo")} type="file" accept="image/*" onChange={choose} disabled={busy} aria-describedby={logoErrText ? `${idOf("logo")}-err` : undefined} />
              </label>
              {hasLogo && <button type="button" className="mk-link" onClick={removeLogo} disabled={busy}><MkIcon name="trash" size={16} />{w.logoRemove}</button>}
            </div>
          </div>
          {logoErrText && <p className="mk-err" id={`${idOf("logo")}-err`} role="alert">{logoErrText}</p>}
        </div>
      </>)}

      {!edit && section("s-reg", w.secReg, <>
        {line("cr_no", { dir: "ltr", mode: "numeric", required: true })}
        {line("vat_no", { dir: "ltr", mode: "numeric" })}
        {line("cr_activity", { required: true }, true)}
      </>)}

      {section("s-where", w.secWhere, <>
        {shows("city") && wrap("city", false,
          <select aria-required {...common("city")}>
            <option value="">{w.chooseCity}</option>
            {w4Cities(locale).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>)}
        {line("address", { auto: "street-address" }, edit)}
        {line("map_url", { dir: "ltr", mode: "url", placeholder: MAP_EXAMPLE }, true)}
      </>)}

      {section("s-contact", w.secContact, <>
        {line("phone", { dir: "ltr", mode: "tel", auto: "tel" })}
        {line("whatsapp", { dir: "ltr", mode: "tel", auto: "tel" })}
      </>)}

      {section("s-returns", w.secReturns, <>
        {para("returns_en", { dir: "ltr", lang: "en" })}
        {para("returns_ar", { dir: "rtl", lang: "ar" })}
      </>)}

      <div className="mk-box mk-w4-end">
        {needAgree && (
          <div className="mk-w4-agree">
            <label className="mk-check">
              <input id={idOf("agreement")} type="checkbox" checked={agree} disabled={busy} aria-invalid={errOf("agreement") ? true : undefined}
                aria-describedby={errOf("agreement") ? `${idOf("agreement")}-err` : undefined}
                onChange={(e) => { setAgree(e.target.checked); if (refusal?.field === "agreement") setRefusal(null); }} />
              <span>{w.agree}</span>
            </label>
            <p className="mk-w4-links">
              <RulesLink t={t} newTab />
              <RulesLink t={t} anchor="shops" label={w.agreement} newTab />
            </p>
            {errOf("agreement") && <p className="mk-err" id={`${idOf("agreement")}-err`}>{errOf("agreement")}</p>}
          </div>
        )}
        <div role="alert" className="mk-w4-alert">
          {general ? (
            <>
              <p className="mk-err">{general.text}</p>
              {general.birth && <Link className="mk-btn2" href={W4_BIRTH_HREF}>{w.addBirth}</Link>}
            </>
          ) : issues.length > 0 ? <p className="mk-err">{w.fixFirst}</p> : null}
        </div>
        <div className="mk-w4-acts">
          <button type="submit" className="mk-btn" disabled={busy} aria-busy={busy}>{sendLabel}</button>
          {onCancel && <button type="button" className="mk-btn2" onClick={onCancel} disabled={busy}>{t.cancel}</button>}
        </div>
      </div>
    </form>
  );
}
