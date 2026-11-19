"use client";

import "./signup.css";
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { SIGNUP_PATH, herePath, safeNext, withNext } from "@/lib/signup";
import { T } from "./SignIn.text";
import { signupWords } from "./Signup.words";
import ChangePassword from "./ChangePassword";
import ForgotPanel from "./ForgotPanel";
import { forgetQuiet } from "./quiet";
import Turnstile, { TURNSTILE_SITE_KEY } from "./Turnstile";

// Sign in with a Micromobility account: email or mobile, and the password. The page reloads
// signed in; the session stays in an HttpOnly cookie this script never sees. A password staff
// issued (a temporary one) is replaced first: the sign-in answers must_change, and the form gives
// way to ChangePassword until the rider has chosen their own.
//
// As the booking app's sign-in (2026-11-19): "New to MicroMobility? Create account" right above the form, to the site's
// own sign-up (/signup) coming back to this page, and "Forgot password?" beside Password, which shows the booking app's
// forgotten-password panel (ForgotPanel.tsx) in place of the form. A sign-in on a page that was given ?next= (a path on
// this site: /account?next=/ask/x, from the sign-up's "Already have an account? Sign in") goes there once signed in.

const never = () => () => {};
/** Where the sign-up comes back to (lib/signup.ts herePath). */
const here = () => herePath(window.location.pathname, window.location.search);

export default function SignIn({ locale }: { locale: string }) {
  const t = useLocalize(T);
  const w = signupWords(useTxLocale());
  const pid = useId();
  const [forgot, setForgot] = useState(false);
  // This page's address, for the way back from the sign-up: known once the page is up (none while it is drawn on the server).
  const page = useSyncExternalStore(never, here, () => "");
  const [check, setCheck] = useState("");
  const [again, setAgain] = useState(0); // a new Turnstile check after a failed try
  const onToken = useCallback((tok: string) => setCheck(tok), []);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [held, setHeld] = useState(false); // signed in with a temporary password: choose one first
  // Only a visitor who is signed out sees this form: the pop-ups' quiet minutes were another
  // account's (./quiet.ts).
  useEffect(() => forgetQuiet(), []);
  const signedIn = () => {
    forgetQuiet();
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    if (next) window.location.assign(next);
    else window.location.reload();
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!identifier.trim() || !password) return setErr(t.errors.missing);
    if (TURNSTILE_SITE_KEY && !check) return setErr(t.errors.check);
    setBusy(true);
    try {
      const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password, check }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { signedIn(); return; }
      if (b.error === "must_change") {
        setPassword("");
        setCheck(""); // the check went with this try; the form draws a new one when it is back
        setHeld(true);
        setBusy(false);
        return;
      }
      setErr(t.errors[b.error || ""] || t.errors.generic);
      if (TURNSTILE_SITE_KEY) { setCheck(""); setAgain((n) => n + 1); } // a token is good for one try
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }
  if (held) return <ChangePassword onDone={signedIn} onBack={() => setHeld(false)} />;
  // (the check is drawn again with the form, so the one it had goes)
  if (forgot) return <ForgotPanel onBack={() => { setCheck(""); setForgot(false); }} />;
  return (
    <form className="ac-form" onSubmit={submit} noValidate>
      <p className="su-switch">{w.newTo} <a href={withNext(SIGNUP_PATH, page)}>{w.create}</a></p>
      <label>{t.id}<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" inputMode="email" dir="ltr" maxLength={254} /></label>
      <div className="su-pwd-field">
        <div className="su-pwd-lbl">
          <label htmlFor={`${pid}pwd`}>{t.pwd}</label>
          <button type="button" className="su-forgot" onClick={() => { setErr(""); setForgot(true); }}>{w.forgotLink}</button>
        </div>
        <span className="ac-pwd">
          <input id={`${pid}pwd`} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" maxLength={200} />
          <button type="button" onClick={() => setShow((s) => !s)}>{show ? t.hide : t.show}</button>
        </span>
      </div>
      <Turnstile locale={locale} onToken={onToken} resetKey={again} />
      {err && <p className="ac-err" role="alert">{err}</p>}
      <button type="submit" className="ac-go" disabled={busy}>{busy ? t.busy : t.go}</button>
    </form>
  );
}
