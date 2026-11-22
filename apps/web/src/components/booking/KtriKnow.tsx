"use client";

import { useState } from "react";
import type { KtriRaceOpt, TriRace } from "@/lib/ktri";

// The KAUST Triathlon's place on the ticket (2026-11-22; the booking app's _ktKnowHtml, _ktRaceEdit, _ktRaceSet): when to
// report and where, the member's race with its start and distances and Change, or "Pick your race" with the five races
// when none is picked yet (a write right after the booking that failed, or a place staff added), and the gate pass for
// anyone not living at KAUST. A pick saves at once through /api/account/tri-race (customer_set_tri_race) and shows at
// once; a save that fails puts the last race back and says so. A place that is done says the race and nothing to change.
// `race` undefined: the read did not carry the column, so no race is said or asked. Its words come ready in the page's
// language from the ticket (tickets.text.ts), each race's start and entry fee written there too.
export type KtriKnowText = {
  reportK: string; report: string; raceK: string; gateK: string; gateV: string; pick: string; saved: string; change: string; failed: string;
};

export default function KtriKnow({ entryId, race, done, races, t }: { entryId: string; race: TriRace | null | undefined; done: boolean; races: KtriRaceOpt[]; t: KtriKnowText }) {
  const [cur, setCur] = useState<TriRace | null>(race ?? null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<"" | "saved" | "failed">("");
  const known = race !== undefined;
  const sel = races.find((r) => r.key === cur) ?? null;
  const picking = known && !done && (editing || !sel);

  async function set(k: TriRace) {
    if (busy) return;
    const was = cur;
    setCur(k); setEditing(false); setNote(""); setBusy(true);
    try {
      const r = await fetch("/api/account/tri-race", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, race: k }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { if (was !== k) setNote("saved"); return; }
      // signed out, or the booking is no longer one the race is for: the page drawn again says so
      if (b?.error === "signin" || b?.error === "refused") { window.location.reload(); return; }
      setCur(was); setNote("failed");
    } catch {
      setCur(was); setNote("failed");
    } finally { setBusy(false); }
  }

  const id = `tk-kt-${entryId}`;
  return (
    <div className="tk-kt-know">
      <p><span className="tk-kt-k">{t.reportK}</span><span className="tk-kt-v">{t.report}</span></p>
      {known && sel && (
        <p className="tk-kt-race">
          <span className="tk-kt-k">{t.raceK}</span>
          <span className="tk-kt-v"><b>{sel.name}</b> · <bdi>{sel.start}</bdi><span className="tk-kt-d">{sel.dist}</span></span>
          {!done && <button type="button" className="tk-kt-chg" aria-expanded={picking} onClick={() => setEditing((x) => !x)} disabled={busy}>{t.change}</button>}
        </p>
      )}
      {picking && (
        <div className="tk-kt-pick">
          <p className="tk-kt-k" id={id}>{t.pick}</p>
          <div className="tk-kt-races" role="radiogroup" aria-labelledby={id}>
            {races.map((r) => (
              <button key={r.key} type="button" role="radio" aria-checked={cur === r.key} className={`tk-kt-opt${cur === r.key ? " on" : ""}`} disabled={busy} onClick={() => set(r.key)}>
                <span className="tk-kt-dot" aria-hidden="true" />
                <span className="tk-kt-copy">
                  <span className="tk-kt-name">{r.name}</span>
                  <span className="tk-kt-d">{r.dist}</span>
                  <span className="tk-kt-meta"><bdi>{r.start}</bdi><bdi>{r.fee}</bdi></span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {note === "saved" && <p className="tk-kt-ok" role="status">{t.saved}</p>}
      {note === "failed" && <p className="tk-rr-err" role="alert">{t.failed}</p>}
      {!done && <p><span className="tk-kt-k">{t.gateK}</span><span className="tk-kt-v">{t.gateV}</span></p>}
    </div>
  );
}
