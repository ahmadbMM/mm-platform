"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CalendarIcon, CloseIcon } from "./Icons";
import type { RemindWords } from "./Remind.words";
import "./remind.css";

// "Remind me when booking opens" (lib/open-remind.ts; the booking app's _ormBtn, _ormOpen, _ormCal, _ormSet and _ormMine,
// the customer features round of 2026-11-19, item 2): a small bell beside a date that is not open to this visitor yet,
// filled and saying "Reminder set" once the ask stands. It opens a centred pop-up (a native dialog, as the tickets' pop-ups:
// Escape and a tap outside close it) titled with when booking opens: "Add to my calendar" (/api/booking-opens, a plain
// link: an iPhone offers to add the event, any other browser saves the file) and, for a signed-in visitor, "Tell me in
// Updates" (/api/account/remind), after which the pop-up says "Reminder set" and offers "Remove reminder". The account's
// asks are read once a page, when the first bell is on screen, and shared by every bell on it; a read that failed is asked
// again at the next pop-up, and an ask set before the read lands is kept. A database without the functions leaves the
// calendar alone; a refusal is said in the pop-up in words (the date opened meanwhile: closing the pop-up draws the page
// again, so its Book shows; or a reminder cannot be set for it); no toast, no bar. The bell goes by itself when the
// opening comes.

type Mine = { st: "idle" | "busy" | "ok" | "off" | "out"; ids: readonly string[] };
const IDLE: Mine = { st: "idle", ids: [] };
let mine: Mine = IDLE;
const subs = new Set<() => void>();
const put = (m: Mine) => { mine = m; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
// what this page set before a read landed: the read's answer gives way to it
const local = new Map<string, boolean>();
const withLocal = (ids: readonly string[]) => [...ids.filter((x) => local.get(x) !== false), ...[...local].filter(([x, on]) => on && !ids.includes(x)).map(([x]) => x)];

async function readMine() {
  if (mine.st !== "idle") return;
  put({ st: "busy", ids: mine.ids });
  try {
    const r = await fetch("/api/account/remind", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "mine" }) });
    const b = (await r.json().catch(() => null)) as { ok?: boolean; ids?: unknown; error?: string } | null;
    if (b?.ok && Array.isArray(b.ids)) { put({ st: "ok", ids: withLocal(b.ids.filter((x): x is string => typeof x === "string")) }); return; }
    if (b?.error === "absent") { put({ st: "off", ids: [] }); return; }
    if (b?.error === "signin") { put({ st: "out", ids: [] }); return; }
  } catch { /* asked again at the next pop-up */ }
  put({ st: "idle", ids: mine.ids });
}

/** The booking app's bell (_CU bell): drawn, filled once the ask stands. */
const Bell = ({ on, size = 16 }: { on: boolean; size?: number }) => (
  <svg className="mm-ic orm-bell" viewBox="0 0 24 24" width={size} height={size} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.2 2.2 6.8 2.2 6.8H4s2.2-1.6 2.2-6.8M10 19.8a2.2 2.2 0 0 0 4 0" />
  </svg>
);

type Props = {
  /** The session, and when booking opens for this visitor (epoch ms, lib/open-remind.ts remindAt). */
  id: string; at: number;
  /** When it opens, as the pop-up's title says it (remindWhen), and the date as a screen reader hears the bell ("Saturday
   *  Social Ride · Saturday · 21 Nov"). */
  when: string; label: string;
  /** The calendar file's address (remindIcsHref). */
  href: string;
  /** The page was drawn for a signed-in account: "Tell me in Updates" is offered. */
  signedIn: boolean;
  words: RemindWords;
  className?: string;
};

export default function RemindBell({ id, at, when, label, href, signedIn, words, className = "" }: Props) {
  const m = useSyncExternalStore(subscribe, () => mine, () => IDLE);
  const dlg = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [reload, setReload] = useState(false); // the date opened meanwhile: closing the pop-up draws the page again
  const [shown, setShown] = useState(false); // the pop-up stays until it is closed, even once the opening comes
  const [past, setPast] = useState(false);
  // the account's asks, read once a page when a bell is first on screen
  useEffect(() => { if (signedIn) void readMine(); }, [signedIn]);
  // gone when the opening comes (looked at again within the hour, so a far time never overflows)
  useEffect(() => {
    let h = 0;
    const look = () => {
      const left = at - Date.now();
      if (left <= 0) { setPast(true); return; }
      h = window.setTimeout(look, Math.min(left, 3600e3) + 50);
    };
    look();
    return () => window.clearTimeout(h);
  }, [at]);

  const on = signedIn && m.ids.includes(id);
  const upd = signedIn && m.st !== "off" && m.st !== "out";
  function open() {
    setSaid(""); setReload(false);
    if (signedIn) void readMine();
    dlg.current?.showModal();
    setShown(true);
  }
  const close = () => dlg.current?.close();

  async function set(v: boolean) {
    if (busy) return;
    setBusy(true); setSaid("");
    try {
      const r = await fetch("/api/account/remind", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "set", session: id, on: v }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) {
        local.set(id, v);
        put({ st: mine.st, ids: v ? [...mine.ids.filter((x) => x !== id), id] : mine.ids.filter((x) => x !== id) });
        return;
      }
      if (b?.error === "absent") { put({ st: "off", ids: [] }); return; }
      if (b?.error === "signin") { close(); window.location.reload(); return; }
      if (b?.error === "open") { setSaid(words.isOpen); setReload(true); return; }
      setSaid(b?.error === "none" || b?.error === "booked" || b?.error === "limit" ? words.no : words.failed);
    } catch {
      setSaid(words.failed);
    } finally { setBusy(false); }
  }

  if (past && !shown) return null;
  const w = on ? words.set : words.btn;
  return (
    <>
      {!past && (
        <button type="button" className={`orm-btn${on ? " orm-on" : ""}${className ? ` ${className}` : ""}`} aria-haspopup="dialog" aria-label={`${w} · ${label}`} onClick={open}>
          <Bell on={on} /><span>{w}</span>
        </button>
      )}
      <dialog ref={dlg} className="orm-dlg" aria-labelledby={`${uid}-t`} onClose={() => { setShown(false); if (reload) window.location.reload(); }}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="orm-in">
          <h2 id={`${uid}-t`} className="orm-t">{words.opens.replace("{0}", () => when)}</h2>
          {on && <p className="orm-state"><Bell on size={16} /><span>{words.set}</span></p>}
          {said && <p className="orm-said" role="alert">{said}</p>}
          <div className="orm-acts">
            <a className="orm-a" href={href} rel="nofollow" onClick={() => window.setTimeout(close, 0)}><CalendarIcon size={18} /><span>{words.cal}</span></a>
            {upd && !reload && (
              <button type="button" className={`orm-a${on ? " orm-rm" : " orm-go"}`} disabled={busy} onClick={() => set(!on)}>
                <Bell on={false} size={18} /><span>{on ? words.rm : words.upd}</span>
              </button>
            )}
          </div>
          <button type="button" className="orm-x" aria-label={words.close} onClick={close}><CloseIcon size={20} /></button>
        </div>
      </dialog>
    </>
  );
}
