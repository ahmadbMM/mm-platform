"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { passwordOk } from "@/lib/learn";
import { T } from "./ChangePassword.text";

// A password staff issued (a temporary one: an account made from an application, or one staff gave
// a new password) is replaced before the account is used, as the booking app asks (_pwdMustShow):
// a sign-in that answered must_change (api/account) shows this in place of its form. The two boxes
// follow the booking app's password rule; api/account/password changes it with the sign-in it holds
// and signs the rider in - or, for the Learn to ride form (`page`), hands the form its session
// (onDone). Back goes back to the sign-in. It looks like the sign-in card it replaces (account.css),
// unless the host gives its own classes (`look`, the Learn form's).
export type PwdLook = { h: "h2" | "h3"; form: string; title: string; sub: string; field?: string; input?: string; hint: string; err: string; btn: string; back: string };
const AC: PwdLook = { h: "h2", form: "ac-form", title: "ac-pc-title", sub: "ac-pc-sub", hint: "ac-hint", err: "ac-err", btn: "ac-go", back: "ac-back" };

type Props = {
  page?: boolean;
  look?: PwdLook;
  /** The password is the rider's own now: signed in (the site's cookie), or the form's session (`page`). */
  onDone: (session: { id: string; token: string } | null) => void;
  onBack: () => void;
};

export default function ChangePassword({ page = false, look = AC, onDone, onBack }: Props) {
  const t = useLocalize(T);
  const box = useRef<HTMLInputElement>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { box.current?.focus(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!passwordOk(a)) return setErr(t.errors.weak);
    if (b !== a) return setErr(t.errors.match);
    setBusy(true);
    try {
      const r = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: a, page }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: unknown; token?: unknown };
      const session = typeof j.id === "string" && typeof j.token === "string" ? { id: j.id, token: j.token } : null;
      if (j.ok && (!page || session)) return onDone(session);
      setErr(t.errors[j.error || ""] || t.errors.generic);
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }

  const H = look.h;
  return (
    <form className={look.form} onSubmit={save} noValidate>
      <H className={look.title}>{t.title}</H>
      <p className={look.sub}>{t.sub}</p>
      <label className={look.field}>
        <span>{t.pwd}</span>
        <input ref={box} className={look.input} type="password" value={a} onChange={(e) => { setA(e.target.value); setErr(""); }} autoComplete="new-password" dir="ltr" maxLength={72} />
        <small className={look.hint}>{t.hint}</small>
      </label>
      <label className={look.field}>
        <span>{t.pwd2}</span>
        <input className={look.input} type="password" value={b} onChange={(e) => { setB(e.target.value); setErr(""); }} autoComplete="new-password" dir="ltr" maxLength={72} />
      </label>
      {err && <p className={look.err} role="alert">{err}</p>}
      <button type="submit" className={look.btn} disabled={busy}>{busy ? t.saving : t.save}</button>
      <button type="button" className={look.back} onClick={onBack} disabled={busy}>{t.back}</button>
    </form>
  );
}
