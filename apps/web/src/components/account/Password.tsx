"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { passwordProblem } from "@/lib/learn";
import { T } from "./Account.text";
import { postJson } from "./fields";
import { signOut } from "./quiet";

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
  /** true once saved; otherwise the refusal ("" for one found here, before anything was sent). */
  async function submit(): Promise<true | string> {
    setErr(""); setDone(false);
    if (mode === "change" && needCurrent === true && !cur) { setErr(t.pwErrors.current); return ""; }
    // the booking app's rule (2026-11-11): 8 or more characters, and not a common one
    const pp = passwordProblem(a);
    if (pp) { setErr(pp === "short" ? t.pwErrors.weak : t.pwErrors.common); return ""; }
    if (a !== b) { setErr(t.pwErrors.mismatch); return ""; }
    setBusy(true);
    const r = await postJson("/api/account/password", { mode, current: cur, next: a });
    setBusy(false);
    if (r.ok) { setCur(""); setA(""); setB(""); setDone(true); return true; }
    setErr(t.pwErrors[r.error || ""] || t.pwErrors.generic);
    return r.error || "generic";
  }
  return { t, cur, setCur, a, setA, b, setB, show, setShow, busy, err, done, submit };
}

/** needCurrent: true - the account has a password; false - it has none (Google or Apple only); null - not known. */
export function PasswordCard({ needCurrent: drawn }: { needCurrent: boolean | null }) {
  // a password set here is one the next change gives (bug hunt 2026-11-11): the box for it shows at once, and the page is
  // read again for the rest of what the first password changed
  const [set, setSet] = useState(false);
  const needCurrent = set ? true : drawn;
  const router = useRouter();
  const f = usePwForm("change", needCurrent);
  const { t } = f;
  return (
    <form className="ac-panel" aria-labelledby="ac-pw-h" noValidate onSubmit={async (e) => {
      e.preventDefault();
      if ((await f.submit()) === true && needCurrent !== true) { setSet(true); router.refresh(); }
    }}>
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
  const answered = useRef(false);
  useEffect(() => { const d = box.current; if (d && !d.open && typeof d.showModal === "function") d.showModal(); }, []);
  return (
    // Only a new password closes it. Escape's cancel is refused, but a browser may close a modal pop-up anyway (Chrome
    // honours the refusal only after a tap on the page, and once; Android's back gesture), so a close that is not the
    // answer opens it again.
    <dialog ref={box} className="ac-dlg" aria-labelledby="ac-fpw-h" onCancel={(e) => e.preventDefault()}
      onClose={(e) => { const d = e.currentTarget; if (!answered.current && d.isConnected && !d.open) { try { d.showModal(); } catch { /* gone */ } } }}>
      <form noValidate onSubmit={async (e) => {
        e.preventDefault();
        const r = await f.submit();
        // A change is no longer due (the password was replaced elsewhere, or staff cleared the mark), or this session has
        // ended (a change on another device signs this one out): the pop-up lets go rather than asking forever (bug hunt
        // 2026-11-11), to the page as it now stands or to signing in again.
        if (r === true || r === "notdue") { answered.current = true; box.current?.close(); router.refresh(); }
        else if (r === "signin") { answered.current = true; box.current?.close(); signOut(); }
      }}>
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
