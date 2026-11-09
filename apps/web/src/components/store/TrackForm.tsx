"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { rpcResult } from "@/lib/rpc-client";
import { latinDigits } from "@/lib/store-form";
import { T } from "./Store.text";
import { Field } from "./CheckoutFields";

// Track order: the order number and the mobile it was placed with (store_order_track, metered per visitor in
// the database) open the order's page. A wrong number and a wrong mobile get the same answer, so the form
// never tells anyone whether an order exists.
export default function TrackForm({ start = "" }: { start?: string }) {
  const t = useLocalize(T);
  const router = useRouter();
  const [no, setNo] = useState(start);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!no.trim() || !phone.trim()) return setErr(t.notFound);
    setBusy(true);
    const r = await rpcResult<{ ok?: boolean; error?: string; key?: string; order?: { no?: number } }>("store_order_track", { p_no: latinDigits(no), p_phone: phone });
    if ("data" in r && r.data?.ok && r.data.key && r.data.order?.no) {
      router.push(`/store/order/${r.data.order.no}?k=${r.data.key}`);
      return; // the button stays busy while the order opens
    }
    setErr("error" in r && r.error.network ? t.errs.network : "data" in r && r.data?.error === "throttled" ? t.throttled : t.notFound);
    setBusy(false);
  }
  return (
    <form className="st-track bk-card" onSubmit={submit} noValidate>
      <Field id="st-tno" label={t.orderNo} value={no} onValue={setNo} placeholder={t.orderNoPh} dir="ltr" autoComplete="off" maxLength={16} />
      <Field id="st-tphone" label={t.phone} value={phone} onValue={setPhone} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05X XXX XXXX" maxLength={20} />
      {err && <p className="bk-err" role="alert">{err}</p>}
      <button type="submit" className="bk-btn wide" disabled={busy}>{busy ? <><span className="bk-spin" aria-hidden="true" />{t.finding}</> : t.find}</button>
    </form>
  );
}
