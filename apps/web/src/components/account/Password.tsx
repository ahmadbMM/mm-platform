"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { passwordOk } from "@/lib/account-profile";
import { T } from "./Account.text";
import { postJson } from "./fields";

// Passwords on My Account, through /api/account/password (the database mints a new session token,
// which signs every other device out; this one keeps going with it):
//   - PasswordCard: change it whenever the rider likes (the owner, 2026-10-03). An account that has
//     a password gives the current one; an account that signs in with Google or Apple only may set
//     one without it, so for those the box is optional and says so.
//   - ForcedPassword: the temporary password staff gave must be replaced first (customer_pwd_state),
//     in a pop-up that only a new password closes - as the booking app's own.

function PwInput({ id, value, onChange, label, auto, show }: { id: string; value: string; onChange: (v: string) => void; label: string; auto: string; show: boolean }) {
  return (
    <label className="ac-f" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={auto} dir="ltr" maxLength={200} />
    </label>
  );
}

function usePwForm(mode: "change" | "forced", needCurrent: boolean | null) {
  const t = useLocalize(T);
  const [cur, setCur] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  async function submit(): Promise<boolean> {
    setErr(""); setDone(false);
    if (mode === "change" && needCurrent === true && !cur) { setErr(t.pwErrors.current); return false; }
    if (!passwordOk(a)) { setErr(t.pwErrors.weak); return false; }
    if (a !== b) { setErr(t.pwErrors.mismatch); return false; }
    setBusy(true);
    const r = await postJson("/api/account/password", { mode, current: cur, next: a });
    setBusy(false);
    if (r.ok) { setCur(""); setA(""); setB(""); setDone(true); return true; }
    setErr(t.pwErrors[r.error || ""] || t.pwErrors.generic);
    return false;
  }
  return { t, cur, setCur, a, setA, b, setB, show, setShow, busy, err, done, submit };
}

/** needCurrent: true - the account has a password; false - it has none (Google or Apple only); null - not known. */
export function PasswordCard({ needCurrent }: { needCurrent: boolean | null }) {
  const f = usePwForm("change", needCurrent);
  const { t } = f;
  return (
    <form className="ac-panel" aria-labelledby="ac-pw-h" noValidate onSubmit={(e) => { e.preventDefault(); void f.submit(); }}>
      <h2 id="ac-pw-h" className="ac-panel-h">{t.pwTitle}</h2>
      <p className="ac-sub">{needCurrent === false ? t.pwSetSub : t.pwSub}</p>
      <div className="ac-grid">
        {needCurrent !== false && (
          <div>
            <PwInput id="ac-pw-cur" value={f.cur} onChange={f.setCur} label={needCurrent ? t.pwCurrent : `${t.pwCurrent} (${t.optional})`} auto="current-password" show={f.show} />
            {needCurrent === null && <p className="ac-hint">{t.pwCurrentHint}</p>}
          </div>
        )}
        <PwInput id="ac-pw-new" value={f.a} onChange={f.setA} label={t.pwNew} auto="new-password" show={f.show} />
        <PwInput id="ac-pw-new2" value={f.b} onChange={f.setB} label={t.pwNew2} auto="new-password" show={f.show} />
      </div>
      <p className="ac-hint">{t.pwRule}</p>
      {f.err && <p className="ac-err" role="alert">{f.err}</p>}
      {f.done && <p className="ac-ok" role="status">{t.pwDone}</p>}
      <div className="ac-row-btns">
        <button type="submit" className="ac-btn" disabled={f.busy}>{needCurrent === false ? t.pwSet : t.pwChange}</button>
        <button type="button" className="ac-btn ac-btn-line" onClick={() => f.setShow((s) => !s)}>{f.show ? t.hide : t.show}</button>
      </div>
    </form>
  );
}

export function ForcedPassword() {
  const f = usePwForm("forced", false);
  const { t } = f;
  const router = useRouter();
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = box.current; if (d && !d.open && typeof d.showModal === "function") d.showModal(); }, []);
  return (
    <dialog ref={box} className="ac-dlg" aria-labelledby="ac-fpw-h" onCancel={(e) => e.preventDefault()}>
      <form noValidate onSubmit={async (e) => { e.preventDefault(); if (await f.submit()) { box.current?.close(); router.refresh(); } }}>
        <h2 id="ac-fpw-h">{t.forcedTitle}</h2>
        <p className="ac-sub">{t.forcedSub}</p>
        <PwInput id="ac-fpw-a" value={f.a} onChange={f.setA} label={t.pwNew} auto="new-password" show={f.show} />
        <PwInput id="ac-fpw-b" value={f.b} onChange={f.setB} label={t.pwNew2} auto="new-password" show={f.show} />
        <p className="ac-hint">{t.pwRule}</p>
        {f.err && <p className="ac-err" role="alert">{f.err}</p>}
        <div className="ac-dlg-btns">
          <button type="submit" className="ac-btn" disabled={f.busy}>{t.pwSet}</button>
          <button type="button" className="ac-btn ac-btn-line" onClick={() => f.setShow((s) => !s)}>{f.show ? t.hide : t.show}</button>
        </div>
      </form>
    </dialog>
  );
}
