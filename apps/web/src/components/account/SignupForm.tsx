"use client";

import "./signup.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import { EM_EMPTY, EM_FIELD, dialOptions, emBlank, type EmError, type EmFields } from "@/lib/emergency";
import { SIGNIN_PATH, nameTyped, signupCheck, type SignupError, type SignupField, type SignupFields, type SignupProblem } from "@/lib/signup";
import type { Gender } from "@/lib/learn";
import EmergencyFields, { type EmLook, type EmProblem } from "./EmergencyFields";
import PasswordBox from "./PasswordBox";
import Turnstile, { TURNSTILE_SITE_KEY } from "./Turnstile";
import { T as SIGNIN } from "./SignIn.text";
import { forgetQuiet } from "./quiet";
import { signupWords, type SignupWords } from "./Signup.words";

// Create account on micromobility.sa, as the booking app's (its signup mode and doSignup): first and last name, gender
// (Male / Female), email, mobile under its dial code, password (with show/hide), height, the first emergency contact
// (required) and the second behind "Add a second contact", the Privacy Notice box (required) and ride news (optional,
// empty), Create account. The form checks what the booking app checks, in its order (lib/signup.ts signupCheck), and
// says the first problem under its box; the site's server checks it all again and makes the account
// (api/account/signup), the session going into the account cookie. Then the page goes on to `next` (a path on this
// site) or My Account, signed in. Its words are the booking app's (Signup.words.ts); the check's line is the sign-in's.
const LOOK: EmLook = { block: "su-em", head: "su-em-h", sub: "su-em-sub", field: "su-field", input: "su-input", select: "su-input su-select", ph: "su-ph", err: "su-ferr", add: "su-add", opt: "su-opt", req: "su-req" };

const never = () => () => {};
const SLOT = "\u0000";

/** A problem as the rider reads it (an emergency contact's are EmergencyFields' own). */
function signupMessage(w: SignupWords, e: SignupError, check: string): string {
  switch (e) {
    case "name_chars": return w.errNameChars;
    case "name_short": return w.errNameShort;
    case "enter_name": return w.errEnterName;
    case "gender": return w.errGender;
    case "email_required": return w.errEmailRequired;
    case "email_invalid": return w.errEmail;
    case "phone_required": return w.errPhoneRequired;
    case "phone_invalid": return w.errPhone;
    case "password_short": return w.errPasswordLen;
    case "password_common": return w.errPasswordCommon;
    case "password_old": return w.errPasswordOld;
    case "privacy": return w.errPrivacy;
    case "height": return w.errHeight;
    case "email_taken": return w.errEmailTaken;
    case "phone_taken": return w.errPhoneTaken;
    case "rate_limited": case "slow": return w.errTooMany;
    case "check": return check;
    default: return w.errConnection;
  }
}

type Shown = { error: SignupError; field?: SignupField } | null;

export default function SignupForm({ locale, next, notice }: { locale: string; next: string | null; notice: string }) {
  const w = signupWords(useTxLocale());
  const signin = useLocalize(SIGNIN);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("+966");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [height, setHeight] = useState("");
  const [em1, setEm1] = useState<EmFields>(EM_EMPTY);
  const [em2, setEm2] = useState<EmFields>(EM_EMPTY);
  const [privacy, setPrivacy] = useState(false);
  const [news, setNews] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  const [emErr, setEmErr] = useState<EmProblem>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState("");
  const [again, setAgain] = useState(0);
  const onToken = useCallback((tok: string) => setCheck(tok), []);
  // A new problem's box, brought into view with the keyboard on it.
  const target = useRef("");
  const [focusAt, setFocusAt] = useState(0);
  // The dial codes carry the browser's own country names (lib/emergency.ts dialOptions): drawn once the page is up.
  const onClient = useSyncExternalStore(never, () => true, () => false);
  const dials = useMemo(() => (onClient ? dialOptions(locale) : [{ value: "+966", label: "+966" }]), [onClient, locale]);

  useEffect(() => {
    const el = focusAt ? form.current?.querySelector<HTMLElement>(target.current) : null;
    if (!el) return;
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* an older browser */ }
    el.focus({ preventScroll: true });
  }, [focusAt]);

  const show = (p: SignupProblem) => {
    if ("which" in p) {
      setShown(null);
      setEmErr({ error: p.error, which: p.which });
      target.current = `[data-em="${p.which}-${EM_FIELD[p.error]}"]`;
    } else {
      setEmErr(null);
      setShown(p);
      target.current = p.field ? `[data-su="${p.field}"]` : "[data-su=err]";
    }
    setFocusAt((n) => n + 1);
  };
  /** An edit clears the problem shown under that box (the booking app's _fieldOk). */
  const edited = (f: SignupField) => { if (shown?.field === f) setShown(null); };
  const nameBox = (f: "first" | "last", set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, dropped } = nameTyped(e.target.value);
    set(value);
    if (dropped) setShown({ error: "name_chars", field: f });
    else edited(f);
  };

  const fields = (): SignupFields => ({ first, last, gender, email, cc, phone, password, height, em1, em2: emBlank(em2) ? null : em2, privacy, news });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const f = fields();
    const r = signupCheck(f);
    if ("error" in r) return show(r);
    setShown(null); setEmErr(null);
    if (TURNSTILE_SITE_KEY && !check) return show({ error: "check" });
    setBusy(true);
    try {
      const res = await fetch("/api/account/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, check }) });
      const b = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: SignupError | EmError; field?: SignupField; which?: 1 | 2 };
      if (b.ok) {
        // Signed in: the pop-ups' quiet minutes were another account's (./quiet.ts). The button stays held while the page goes.
        forgetQuiet();
        window.location.assign(next || SIGNIN_PATH);
        return;
      }
      if (b.which === 1 || b.which === 2) show({ error: b.error as EmError, which: b.which });
      else show({ error: (b.error as SignupError) || "connection", field: b.field });
      if (TURNSTILE_SITE_KEY) { setCheck(""); setAgain((n) => n + 1); } // a token is good for one try
    } catch {
      show({ error: "connection" });
    }
    setBusy(false);
  }

  const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
  const text = (e: SignupError) => (e === "connection" && offline() ? w.errOffline : signupMessage(w, e, signin.errors.check));
  const errId = (f: SignupField) => `${id}${f}-err`;
  const bad = (f: SignupField) => (shown?.field === f ? { "aria-invalid": true as const, "aria-describedby": errId(f) } : {});
  const under = (f: SignupField) => (shown?.field === f ? <p className="su-ferr" id={errId(f)} role="alert">{text(shown.error)}</p> : null);
  const star = <> <span className="su-req" aria-hidden="true">*</span></>;
  const [before, after] = w.privacyAck.replace("{0}", SLOT).split(SLOT);

  return (
    <form ref={form} className="su-form" onSubmit={submit} noValidate>
      <div className="su-row">
        <label className="su-field">
          <span>{w.first}</span>
          <input className="su-input" data-su="first" value={first} onChange={nameBox("first", setFirst)} autoComplete="given-name" autoCapitalize="words" maxLength={60} placeholder={w.phFirst} {...bad("first")} />
          {under("first")}
        </label>
        <label className="su-field">
          <span>{w.last}</span>
          <input className="su-input" data-su="last" value={last} onChange={nameBox("last", setLast)} autoComplete="family-name" autoCapitalize="words" maxLength={60} placeholder={w.phLast} {...bad("last")} />
          {under("last")}
        </label>
      </div>
      <div className="su-field" role="group" aria-labelledby={`${id}g`}>
        <span id={`${id}g`}>{w.gender}{star}</span>
        <div className="su-pills">
          {(["male", "female"] as Gender[]).map((g, i) => (
            <button key={g} type="button" className="su-pill" aria-pressed={gender === g} data-su={i === 0 ? "gender" : undefined}
              aria-describedby={shown?.field === "gender" ? errId("gender") : undefined}
              onClick={() => { setGender(g); edited("gender"); }}>{g === "male" ? w.male : w.female}</button>
          ))}
        </div>
        {under("gender")}
      </div>
      <label className="su-field">
        <span>{w.email}{star}</span>
        <input className="su-input" data-su="email" value={email} onChange={(e) => { setEmail(e.target.value); edited("email"); }} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} dir="ltr" maxLength={254} placeholder={w.phEmail} {...bad("email")} />
        {under("email")}
      </label>
      <div className="su-field">
        <label htmlFor={`${id}phone`}>{w.phone}{star}</label>
        <div className="em-phone" dir="ltr">
          <select className="su-input su-select em-cc" aria-label={w.dialCode} value={cc} onChange={(e) => { setCc(e.target.value); edited("phone"); }}>
            {dials.map((o, i) => <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          <input id={`${id}phone`} className="su-input" data-su="phone" value={phone} onChange={(e) => { setPhone(e.target.value); edited("phone"); }} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={20} placeholder={w.phPhone} {...bad("phone")} />
        </div>
        {under("phone")}
      </div>
      <div className="su-field">
        <label htmlFor={`${id}pwd`}>{w.password}{star}</label>
        <PasswordBox id={`${id}pwd`} className="su-input" data-su="password" value={password} onChange={(e) => { setPassword(e.target.value); edited("password"); }} autoComplete="new-password" dir="ltr" maxLength={200} placeholder={w.phPassword} {...bad("password")} />
        {under("password")}
      </div>
      <label className="su-field">
        <span>{w.height}{star}</span>
        <input className="su-input" data-su="height" value={height} onChange={(e) => { setHeight(e.target.value); edited("height"); }} inputMode="numeric" maxLength={3} placeholder={w.phHeight} {...bad("height")} />
        {under("height")}
      </label>
      <EmergencyFields one={em1} two={em2} onChange={(a, b) => { setEm1(a); setEm2(b); setEmErr(null); }} offerTwo problem={emErr} look={LOOK} />
      <label className="su-tick">
        <input type="checkbox" data-su="privacy" checked={privacy} onChange={(e) => { setPrivacy(e.target.checked); edited("privacy"); }} aria-required="true" {...bad("privacy")} />
        <span>{before}<NoticeLink dialog={notice}>{w.privacyNotice}</NoticeLink>{after}{star}</span>
      </label>
      {under("privacy")}
      <label className="su-tick">
        <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} />
        <span>{w.rideNews}</span>
      </label>
      <Turnstile locale={locale} onToken={onToken} resetKey={again} />
      {shown && !shown.field && <p className="ac-err" role="alert" data-su="err" tabIndex={-1}>{text(shown.error)}</p>}
      <button type="submit" className="ac-go su-go" disabled={busy}>{w.submit}</button>
    </form>
  );
}
