"use client";

import { useEffect, useId, useRef, useState } from "react";
import { intlOf } from "@/i18n/locales";
import { RSG_ERR, RSG_KINDS, rsgAnswer, type RsgAnswer, type RsgKind, type RsgRow } from "@/lib/ride-suggestions";
import type { MemberHubWords } from "./MemberHub.words";

// Suggest a ride in a member's area on /club (lib/ride-suggestions.ts; the booking app's _rsgCardHtml and its own page,
// _rsgPageHtml, _rsgSend, 2026-11-18), after the announcements, as the app's stands near the end of its tab, before the
// invitation. Its button opens the form in place (the app opens a page of its own, with Close): "What is it?" over four
// chips (Route, Breakfast spot, Ride idea, Something else, each with its drawn mark), the labelled text box, a line for
// what went wrong, and Send; under it the member's own suggestions, newest first, each with its kind, Sent, Planned or
// Done, the text, its day and the team's reply. Close folds it again. Send posts to /api/account/suggestions (ride_suggest):
// the row the database kept leads the list, the form empties, and nothing else is said; a refusal is said under the box in
// its own words (pick what it is, at least 3 characters, 3 a day, 10 still waiting, members only), never as a bar. The page
// reads the rows (ride_suggestions_mine) and hands them over; a database without the function draws no card.
type Words = Pick<MemberHubWords, "err" | "rsgTitle" | "rsgGo" | "rsgKindQ" | "rsgKRoute" | "rsgKBreakfast" | "rsgKIdea" | "rsgKOther" | "rsgText" | "rsgSend"
  | "rsgMine" | "rsgSent" | "rsgPlanned" | "rsgDone" | "rsgReply" | "rsgPickKind" | "rsgShort" | "rsgDay" | "rsgOpenMax" | "rsgMember" | "rsgClose">;

const KIND_WORD: Record<RsgKind, keyof Words> = { route: "rsgKRoute", breakfast: "rsgKBreakfast", idea: "rsgKIdea", other: "rsgKOther" };
const STATUS_WORD = { sent: "rsgSent", planned: "rsgPlanned", done: "rsgDone" } as const;

/** The kinds' marks (the app's pin, cup, bike and chat), drawn as the site's icons are: one line weight, round ends. */
function KindMark({ kind }: { kind: RsgKind }) {
  const d = kind === "route" ? "M12 21s-6.5-5.7-6.5-11.1a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21ZM12 7.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
    : kind === "breakfast" ? "M4.5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM15.5 11h1.3a2.5 2.5 0 0 1 0 5h-1.6M8 3.5c-.8 1 .8 1.9 0 3M11.5 3.5c-.8 1 .8 1.9 0 3"
    : kind === "idea" ? "M5.5 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18.5 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5.5 16l4-7h6l3 7M9.5 9l2.5 7h-6.5M15.5 9l.5-2.5h2"
    : "M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z";
  return (
    <svg className="mm-ic" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

export default function SuggestRide({ locale, rows: first, words: w }: { locale: string; rows: RsgRow[]; words: Words }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(first);
  const [kind, setKind] = useState<RsgKind | "">("");
  const [text, setText] = useState("");
  const [err, setErr] = useState<keyof Words | "">("");
  const [busy, setBusy] = useState(false);
  const want = useRef<"" | "kind" | "open">(""); // what takes the focus once drawn: the first chip on opening, the button on closing
  const box = useRef<HTMLTextAreaElement>(null);
  const kinds = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const f = want.current;
    if (!f) return;
    want.current = "";
    const el = f === "kind" ? kinds.current?.querySelector<HTMLButtonElement>("button") : head.current;
    el?.focus({ preventScroll: true });
  });
  const day = (d: string) => {
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)); }
    catch { return d; }
  };

  async function send() {
    if (busy) return;
    const t = text.trim();
    const bad = !kind ? "rsgPickKind" : t.length < 3 ? "rsgShort" : "";
    if (bad) { setErr(bad); (bad === "rsgPickKind" ? kinds.current?.querySelector<HTMLButtonElement>("button") : box.current)?.focus(); return; }
    setBusy(true); setErr("");
    let a: RsgAnswer = { ok: false, error: "generic" };
    try {
      const r = await fetch("/api/account/suggestions", {
        method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, body: t }),
      });
      a = rsgAnswer(await r.json().catch(() => null));
    } catch { /* said below */ }
    setBusy(false);
    if (!a.ok && a.error === "signin") { window.location.reload(); return; }
    if (!a.ok) { setErr(RSG_ERR[a.error] ?? "err"); return; }
    const row = a.row;
    setRows((l) => [row, ...l.filter((x) => x.id !== row.id)]);
    setKind(""); setText("");
  }

  return (
    <section className="club-rsg" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}><KindMark kind="other" /> {w.rsgTitle}</h3>
      {!open ? (
        <button ref={head} type="button" className="club-int-btn club-rsg-open" aria-expanded={false} onClick={() => { setOpen(true); want.current = "kind"; }}>{w.rsgGo}</button>
      ) : (
        <>
          <div className="club-rsg-form" role="group" aria-labelledby={`${id}-h`}>
            <span className="club-rsg-lbl" id={`${id}-k`}>{w.rsgKindQ}</span>
            <div ref={kinds} className="club-int-picks" role="group" aria-labelledby={`${id}-k`}>
              {RSG_KINDS.map((k) => (
                <button key={k} type="button" className={`club-int-chip club-rsg-kind${kind === k ? " on" : ""}`} aria-pressed={kind === k} data-k={k}
                  onClick={() => { setKind((x) => (x === k ? "" : k)); if (err === "rsgPickKind") setErr(""); }}>
                  <KindMark kind={k} /> {w[KIND_WORD[k]]}
                </button>
              ))}
            </div>
            <label className="club-rsg-lbl" htmlFor={`${id}-t`}>{w.rsgText}</label>
            <textarea ref={box} id={`${id}-t`} className="club-rsg-text" maxLength={500} rows={4} value={text} aria-invalid={err === "rsgShort" ? true : undefined}
              onChange={(e) => { setText(e.target.value); if (err) setErr(""); }} />
            <p className="club-rsg-msg" role="alert">{err ? w[err] : ""}</p>
            <div className="club-int-acts">
              <button type="button" className="club-int-btn" onClick={() => { setOpen(false); setErr(""); want.current = "open"; }}>{w.rsgClose}</button>
              <button type="button" className="club-int-btn club-int-save" disabled={busy} onClick={() => void send()}>{w.rsgSend}</button>
            </div>
          </div>
          {rows.length > 0 && (
            <>
              <h4 className="club-rsg-mine">{w.rsgMine}</h4>
              <ul className="club-rsg-list">
                {rows.map((x) => (
                  <li key={x.id} className="club-rsg-row">
                    <span className="club-rsg-row-h"><span className="club-rsg-k"><KindMark kind={x.kind} /> {w[KIND_WORD[x.kind]]}</span><span className={`club-rsg-st club-rsg-st-${x.status}`}>{w[STATUS_WORD[x.status]]}</span></span>
                    <p className="club-rsg-body" dir="auto">{x.body}</p>
                    {x.day && <span className="club-rsg-day"><bdi>{day(x.day)}</bdi></span>}
                    {x.reply && <div className="club-rsg-reply"><span>{w.rsgReply}</span><p dir="auto">{x.reply}</p></div>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
