"use client";

import { useState } from "react";
import { TickIcon } from "@/components/site/Icons";
import type { ComingWords } from "./Coming.words";

// "Still coming?" on My Account's ticket (lib/still-coming.ts; the booking app's _stcHtml and _stcYes, 2026-11-13): "I'm
// coming" saves the answer through /api/account/coming and turns into one quiet "Coming" chip, with no line and no toast
// (the owner: no bar after an action); "Can't come" opens the booking app's My Bookings at this ticket, where Cancel is.
// A session called off, not yet asked or already started, or a booking no longer seated, draws the page again (what the
// server knows wins); a database without the function takes the buttons away; a failure says so under them. Its words
// come ready in the page's language from the ticket (Coming.words.ts; failed is the ticket's rrFailed).
export default function TicketComing({ sessionId, cancel, ok = false, words, failed }: { sessionId: string; cancel: string; ok?: boolean; words: ComingWords; failed: string }) {
  const [state, setState] = useState<"ask" | "ok" | "gone">(ok ? "ok" : "ask");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function yes() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/coming", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: sessionId }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { setState("ok"); return; }
      if (b?.error === "absent") { setState("gone"); return; }
      if (b?.error === "closed" || b?.error === "none" || b?.error === "signin") { window.location.reload(); return; }
      setErr(failed);
    } catch {
      setErr(failed);
    } finally { setBusy(false); }
  }

  if (state === "gone") return null;
  if (state === "ok") return <div className="tk-stc"><span className="tk-stc-ok"><TickIcon size={16} />{words.ok}</span></div>;
  return (
    <div className="tk-stc" role="group" aria-label={words.ask}>
      <button type="button" className="tk-btn solid" disabled={busy} onClick={yes}>{words.yes}</button>
      <a className="tk-btn" href={cancel}>{words.no}</a>
      {err && <p className="tk-stc-err" role="alert">{err}</p>}
    </div>
  );
}
