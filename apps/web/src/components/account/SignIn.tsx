"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./SignIn.text";

// Sign in with a Micromobility account: email or mobile, and the password. The page reloads
// signed in; the session stays in an HttpOnly cookie this script never sees.

export default function SignIn() {
  const t = useLocalize(T);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!identifier.trim() || !password) return setErr(t.errors.missing);
    setBusy(true);
    try {
      const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { window.location.reload(); return; }
      setErr(t.errors[b.error || ""] || t.errors.generic);
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }
  return (
    <form className="ac-form" onSubmit={submit} noValidate>
      <label>{t.id}<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" inputMode="email" dir="ltr" maxLength={254} /></label>
      <label>{t.pwd}
        <span className="ac-pwd">
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" maxLength={200} />
          <button type="button" onClick={() => setShow((s) => !s)}>{show ? t.hide : t.show}</button>
        </span>
      </label>
      {err && <p className="ac-err" role="alert">{err}</p>}
      <button type="submit" className="ac-go" disabled={busy}>{busy ? t.busy : t.go}</button>
    </form>
  );
}
