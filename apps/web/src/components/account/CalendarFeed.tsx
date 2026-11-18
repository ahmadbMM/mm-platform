"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ArrowIcon, CalendarIcon, CloseIcon } from "@/components/site/Icons";
import { calfAddress, calfClubGot, calfGot, type CalfOp } from "@/lib/calendar-feed";
import type { CalendarWords } from "./Calendar.words";

// My Account's Calendar section (lib/calendar-feed.ts; the booking app's Account row "Calendar" and calendar-feed.js,
// 2026-11-13, new features F27). The page draws it only once calendar_link's peek has answered. Its one button opens a
// centred pop-up (a native dialog, as the ticket's): Close, the kicker Calendar and the title, then, once the key has
// come (POST /api/account/calendar 'get', asked at every opening), Add to my calendar (a webcal link the phone's calendar
// subscribes to), Copy the address and Replace the address. Copy puts the https address on the clipboard and says
// nothing; a clipboard that refuses shows the address under the buttons to copy by hand. Replace asks first, in a centred
// question of its own over the pop-up; yes writes a new key ('new') and the link takes it, with nothing said. A key that
// did not come is said with Try again; a replace that failed is said and the old key stays. The key is held only while
// the pop-up is open (closed, it is dropped) and is never logged or stored. A signed-out session draws the page again; a
// database without the function takes the section away. Its words come ready in the page's language (Calendar.words.ts).
// The club calendar (2026-11-18; the booking app's _calfClub): under Add to my calendar, the "Club sessions too" switch, shown
// only when the key's answer said where it stands (a database before rentals 20261118211000 says nothing, and there is no
// switch). A flip shows at once and posts {op: "club", on} (calendar_club_set); a refusal puts it back and says so in the
// pop-up's error line, and nothing is said when it worked. The same address then lists the club's Saturday rides (to a
// member) and featured sessions too; the booking app's /api/ics serves them.
type Focus = "" | "add" | "retry" | "new";

export default function CalendarFeed({ host, lang, words: w }: { host: string; lang: string | null; words: CalendarWords }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const ask = useRef<HTMLDialogElement>(null);
  const addRef = useRef<HTMLAnchorElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const turn = useRef(0); // each opening and closing: an answer for an earlier one is dropped
  const want = useRef<Focus>(""); // the control that takes the focus once drawn
  const id = useId();
  const [gone, setGone] = useState(false);
  const [key, setKey] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [club, setClub] = useState<boolean | null>(null);
  const [clubBusy, setClubBusy] = useState(false);

  useEffect(() => {
    const f = want.current;
    if (!f) return;
    want.current = "";
    (f === "add" ? addRef : f === "retry" ? retryRef : newRef).current?.focus({ preventScroll: true });
  });

  async function post(op: CalfOp) {
    try {
      const r = await fetch("/api/account/calendar", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, lang }),
      });
      return calfGot(await r.json().catch(() => null));
    } catch {
      return calfGot(null);
    }
  }
  const reset = () => { setKey(""); setFailed(false); setBusy(false); setNote(""); setErr(""); setClub(null); setClubBusy(false); };

  async function load() {
    const t = ++turn.current;
    reset();
    const g = await post("get");
    if (turn.current !== t) return; // closed meanwhile, or opened again
    if ("key" in g) { want.current = "add"; setKey(g.key); setClub(g.club); return; }
    if (g.error === "signin") { window.location.reload(); return; }
    if (g.error === "absent") { dlg.current?.close(); setGone(true); return; }
    want.current = "retry";
    setFailed(true);
  }
  function open() {
    const d = dlg.current;
    if (!d) return;
    if (!d.open) d.showModal();
    void load();
  }
  const close = () => dlg.current?.close();
  // closed by Close, Escape or a tap outside: the key goes with it
  const closed = () => { turn.current++; ask.current?.close(); reset(); };
  const outside = (e: MouseEvent<HTMLDialogElement>) => { if (e.target === e.currentTarget) e.currentTarget.close(); };

  async function copy() {
    if (!key) return;
    const url = calfAddress(host, key, "https"), t = turn.current;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* refused: shown below to copy by hand */ }
    if (turn.current !== t) return;
    setErr("");
    setNote(ok ? "" : url);
  }

  // the club switch: the rider's choice shows at once; the database's answer is what stays
  async function flip(on: boolean) {
    if (!key || club === null || clubBusy) return;
    const t = turn.current, was = club;
    setClub(on); setClubBusy(true); setErr("");
    let g: ReturnType<typeof calfClubGot>;
    try {
      const r = await fetch("/api/account/calendar", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "club", on }),
      });
      g = calfClubGot(await r.json().catch(() => null));
    } catch {
      g = calfClubGot(null);
    }
    if (turn.current !== t) return;
    setClubBusy(false);
    if ("club" in g) { setClub(g.club); return; }
    if (g.error === "signin") { window.location.reload(); return; }
    setClub(was);
    setErr(w.err);
  }

  async function replace() {
    ask.current?.close();
    if (!key || busy) return;
    const t = turn.current;
    setBusy(true); setErr(""); setNote("");
    const g = await post("new");
    if (turn.current !== t) return;
    setBusy(false);
    want.current = "new";
    if ("key" in g) { setKey(g.key); return; }
    if (g.error === "signin") { window.location.reload(); return; }
    setErr(w.err);
  }

  if (gone) return null;
  return (
    <>
      <section className="ac-sec ac-calf" aria-labelledby={`${id}-h`}>
        <div className="ac-sec-head">
          <h2 id={`${id}-h`}>{w.row}</h2>
          <button type="button" className="ac-calf-go" onClick={open}>{w.add} <ArrowIcon size={15} /></button>
        </div>
      </section>
      <dialog ref={dlg} className="tk-dlg ac-calf-dlg" aria-labelledby={`${id}-t`} onClose={closed} onClick={outside}>
        <div className="tk-dlg-in" aria-busy={key || failed ? undefined : true}>
          <button type="button" className="tk-dlg-x" aria-label={w.close} onClick={close}><CloseIcon size={20} /></button>
          <p className="ac-calf-k">{w.row}</p>
          <h2 id={`${id}-t`} className="tk-dlg-t">{w.title}</h2>
          {key ? (
            <>
              <a ref={addRef} className="ac-calf-main" href={calfAddress(host, key, "webcal")}><CalendarIcon size={18} /><span>{w.add}</span></a>
              {club !== null && (
                <label className="ac-calf-sw">
                  <input type="checkbox" role="switch" checked={club} disabled={clubBusy} onChange={(e) => void flip(e.target.checked)} />
                  <span className="ac-calf-sw-box" aria-hidden="true" />
                  <span className="ac-calf-sw-txt">{w.club}</span>
                </label>
              )}
              <div className="tk-dlg-acts">
                <button type="button" className="ac-calf-btn" disabled={busy} onClick={copy}>{w.copy}</button>
                <button ref={newRef} type="button" className="ac-calf-btn" disabled={busy} onClick={() => ask.current?.showModal()}>{w.replace}</button>
              </div>
              <p className="ac-calf-note" role="status" dir={note ? "ltr" : undefined}>{note}</p>
              <p className="ac-calf-err" role="alert">{err}</p>
            </>
          ) : failed ? (
            <>
              <p className="ac-calf-err" role="alert">{w.err}</p>
              <button ref={retryRef} type="button" className="ac-calf-main" onClick={() => void load()}>{w.retry}</button>
            </>
          ) : (
            <p className="ac-calf-wait" role="status">{w.loading}</p>
          )}
        </div>
      </dialog>
      <dialog ref={ask} className="tk-dlg ac-calf-ask" aria-labelledby={`${id}-q`} aria-describedby={`${id}-qb`} onClick={outside}>
        <div className="tk-dlg-in">
          <h2 id={`${id}-q`} className="tk-dlg-t">{w.askTitle}</h2>
          <p id={`${id}-qb`} className="ac-calf-body">{w.askBody}</p>
          <div className="tk-dlg-acts">
            <button type="button" className="ac-calf-main" onClick={() => void replace()}>{w.replace}</button>
            <button type="button" className="ac-calf-btn" onClick={() => ask.current?.close()}>{w.cancel}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
