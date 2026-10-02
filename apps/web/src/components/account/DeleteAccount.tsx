"use client";

import { useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { T } from "./Account.text";
import { postJson } from "./fields";

// Delete my account (the booking app's _delSet): a REQUEST staff act on within 30 days, after
// checking for live bookings or money owed, which the rider can withdraw until then. Asking needs a
// confirmation (a centred pop-up); withdrawing does not.
export default function DeleteAccount({ locale, requestedAt: initial }: { locale: string; requestedAt: string | null }) {
  const t = useLocalize(T);
  const [at, setAt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const day = (iso: string) => {
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(iso)); }
    catch { return iso.slice(0, 10); }
  };
  async function send(request: boolean) {
    setBusy(true); setErr("");
    const b = await postJson<{ requestedAt?: string | null }>("/api/account/deletion", { request });
    setBusy(false);
    dlg.current?.close();
    if (b.ok) setAt(b.requestedAt ?? null); else setErr(b.error === "signin" ? t.errors.signin : t.connection);
  }
  return (
    <section className="ac-panel" aria-labelledby="ac-del-h">
      <h2 id="ac-del-h" className="ac-panel-h">{t.delTitle}</h2>
      {at ? (
        <>
          <p className="ac-state warn" role="status">{t.delRequested(day(at))}</p>
          <button type="button" className="ac-btn ac-btn-line" onClick={() => send(false)} disabled={busy}>{t.delWithdraw}</button>
        </>
      ) : (
        <>
          <p className="ac-sub">{t.delSub}</p>
          <button type="button" className="ac-btn ac-btn-line ac-btn-red" onClick={() => dlg.current?.showModal()} disabled={busy}>{t.delBtn}</button>
        </>
      )}
      {err && <p className="ac-err" role="alert">{err}</p>}
      <dialog ref={dlg} className="ac-dlg" aria-labelledby="ac-del-dh" onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        <h2 id="ac-del-dh">{t.delConfirmTitle}</h2>
        <p className="ac-sub">{t.delConfirmBody}</p>
        <div className="ac-dlg-btns">
          <button type="button" className="ac-btn ac-btn-red" onClick={() => send(true)} disabled={busy}>{t.delConfirmBtn}</button>
          <button type="button" className="ac-btn ac-btn-line" onClick={() => dlg.current?.close()}>{t.cancel}</button>
        </div>
      </dialog>
    </section>
  );
}
