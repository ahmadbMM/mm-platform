"use client";

import { useEffect, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { riyalNum } from "@/components/booking/Sar";
import type { Pack } from "@/lib/sx-b6";
import { T } from "./sx-B6.text";
import { T as BT } from "./Booking.text";
import "./sx-B6.css";

// Packs of sessions at one price (EF21; the user, 2026-11-18: "do all"): under an event's dates while staff sell a pack
// for its kind of ride, hidden otherwise. Buy opens the shared payment page (/api/xp/pack); once paid the pack is a code
// of the rider's own, and each booking draws one session from it at the review (PackUse).
export default function XpPacks({ packs, signedIn, onSignIn, locale }: { packs: Pack[]; signedIn: boolean; onSignIn: () => void; locale: string }) {
  const t = useLocalize(T);
  const word = useLocalize(BT).sarWord;
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (!packs.length) return null;
  async function buy(id: string) {
    if (!signedIn) { onSignIn(); return; }
    if (busy) return;
    setBusy(id); setErr("");
    try {
      const r = await fetch("/api/xp/pack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: id, lang: locale }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (b?.ok && b.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.url)) { window.location.assign(b.url); return; }
      setErr(t.giftErr);
    } catch { setErr(t.giftErr); }
    setBusy("");
  }
  return (
    <section className="sx6-packs" aria-labelledby="sx6-packs-h">
      <h3 id="sx6-packs-h">{t.packs}</h3>
      {packs.map((p) => (
        <div key={p.id} className="sx6-pack">
          <span className="sx6-pack-t">{p.title}<small>{t.packLessons(p.lessons)} · <bdi className="tk-amt" dir="ltr"><span aria-hidden="true">{"\u20C1"}</span><span className="mm-sr">{word}</span> {riyalNum(p.price)}</bdi></small></span>
          <button type="button" className="bk-btn2" disabled={!!busy} aria-busy={busy === p.id} onClick={() => void buy(p.id)}>{t.packBuy}</button>
        </div>
      ))}
      {err && <p className="bk-err" role="alert">{err}</p>}
    </section>
  );
}

/** "Use my pack · 3 left" at the review (EF21): the rider's own pack code for this kind of ride with sessions left, put in
 *  as the booking's code. Nothing while they have none (or the database has no packs). */
export function PackUse({ kind, onUse, busy }: { kind: string; onUse: (code: string) => void; busy: boolean }) {
  const t = useLocalize(T);
  const [code, setCode] = useState<{ code: string; left: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/xp/mine", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((b: { items?: { what: string; kind: string; code: string | null; left: number; status: string; expires_on: string | null }[] } | null) => {
      const today = new Date().toISOString().slice(0, 10);
      const x = (b?.items ?? []).find((y) => y.what === "pack" && y.status === "paid" && y.kind === kind && y.code && y.left > 0 && (!y.expires_on || y.expires_on >= today));
      if (live && x?.code) setCode({ code: x.code, left: x.left });
    }, () => { /* none */ });
    return () => { live = false; };
  }, [kind]);
  if (!code) return null;
  return (
    <p className="sx6-use"><button type="button" className="bk-btn2" disabled={busy} onClick={() => onUse(code.code)}>{t.packUse} · {t.packLeft(code.left)}</button></p>
  );
}
