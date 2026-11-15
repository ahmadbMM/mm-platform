"use client";

import { useState, type FormEvent } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import type { StoreVariant } from "@/lib/store-core";
import { storePhone } from "@/lib/store-form";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import Modal from "./Modal";

// Back in stock (F34): a sold-out size, colour or product asks for a name and a mobile in a centred pop-up and keeps
// them for staff (POST /api/store/stock-request -> store_stock_request), who message the shopper on WhatsApp by hand
// when it is back: no email, no SMS. The name and mobile come filled in from this visit's checkout, or from a request
// made earlier in it.
const KEEP = "mm-notify";
const CHECKOUT = "mm-checkout";

function kept(): { name: string; phone: string } {
  const read = (k: string) => { try { return JSON.parse(window.sessionStorage.getItem(k) || "null") as Record<string, unknown> | null; } catch { return null; } };
  const mine = read(KEEP), c = (read(CHECKOUT)?.contact ?? null) as Record<string, unknown> | null;
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 60) : "");
  return { name: s(mine?.name) || s(c?.name), phone: s(mine?.phone) || s(c?.phone) };
}

export default function StockAsk({ variant, label, locale, onClose }: { variant: StoreVariant; label: string; locale: string; onClose: () => void }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const [f, setF] = useState(kept);
  const [errs, setErrs] = useState<{ name?: string; phone?: string }>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = f.name.trim().replace(/\s+/g, " ");
    const bad = { name: name.length < 2 ? t.errs.name : undefined, phone: storePhone(f.phone) ? undefined : t.errs.phone };
    setErrs(bad);
    setMsg("");
    if (bad.name || bad.phone) return;
    setBusy(true);
    try {
      const r = await fetch("/api/store/stock-request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ variant: variant.id, name, phone: f.phone, lang: locale.slice(0, 2) }), signal: AbortSignal.timeout(10000),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) {
        try { window.sessionStorage.setItem(KEEP, JSON.stringify({ name, phone: f.phone })); } catch { /* not kept */ }
        setDone(true);
      } else if (b?.error === "name") setErrs({ name: t.errs.name });
      else if (b?.error === "phone") setErrs({ phone: t.errs.phone });
      else setMsg(b?.error === "gone" ? w.goneChoice : b?.error === "busy" ? t.errs.busy : w.sendFailed);
    } catch { setMsg(t.errs.network); }
    setBusy(false);
  }

  return (
    <Modal title={label ? w.notifyOf(label) : w.notifyAny} onClose={onClose} closeLabel={t.close}>
      {done ? (
        <>
          <p className="bk-pop-msg" role="status">{w.notifyDone}</p>
          <div className="bk-pop-foot"><button type="button" className="bk-btn" onClick={onClose}>{t.close}</button></div>
        </>
      ) : (
        <form onSubmit={send} noValidate>
          <div className="bk-field st-field">
            <label htmlFor="st-nt-name">{t.name}</label>
            <input id="st-nt-name" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={60}
              aria-invalid={errs.name ? true : undefined} aria-describedby={errs.name ? "st-nt-name-e" : undefined} />
            {errs.name && <p id="st-nt-name-e" className="bk-ferr">{errs.name}</p>}
          </div>
          <div className="bk-field st-field">
            <label htmlFor="st-nt-phone">{t.phone}</label>
            <input id="st-nt-phone" type="tel" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" maxLength={20}
              placeholder="05X XXX XXXX" aria-invalid={errs.phone ? true : undefined} aria-describedby={errs.phone ? "st-nt-phone-e" : undefined} />
            {errs.phone && <p id="st-nt-phone-e" className="bk-ferr">{errs.phone}</p>}
          </div>
          {msg && <p className="bk-err st-nt-msg" role="alert">{msg}</p>}
          <div className="bk-pop-foot">
            <button type="submit" className="bk-btn" disabled={busy} aria-busy={busy}>{busy ? w.sending : w.send}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
