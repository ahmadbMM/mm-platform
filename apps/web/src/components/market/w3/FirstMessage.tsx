"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_HUB_CITY, MK_MESSAGE_MAX, inboxHref, listingHref, mkErrorKey, type MkError, type MkMe, type MkNameMode, type MkSellerKind } from "@/lib/market/core";
import { MK_CONTACT_HASH, bodyProblem, nameModes, quickReplies, signInHref, writeRefusal } from "@/lib/market/w3";
import { mkGet, mkPost } from "@/lib/market/w3-client";
import MkIcon from "../MkIcon";
import MkModal from "../MkModal";
import { T as S, mkErrorText } from "../Market.text";
import { T } from "../w3.text";
import { useFocusKept } from "./focus";
import "../w3.css";

// The first message about a listing: the centred pop-up the Contact button opens for a signed-in buyer. It asks how
// the buyer is named to the seller in this conversation (first name and last initial, or simply "Buyer": the choice is
// frozen when the thread opens, and "Buyer" is the one already picked), offers pre-written messages to tap (with "Can
// we meet at the MicroMobility hub?" on a Jeddah listing), and carries the one fixed safety sentence. Sending opens
// the thread (/api/market/thread/open) and goes to it in the inbox. What the account may do comes from
// /api/market/me: an account with no birth date, under 18 or paused is told so in place of the form. A link in the
// message is refused in words; a phone number turns the pop-up into the notice that points at "Share my WhatsApp".
type Load = { state: "loading" } | { state: "ready"; me: MkMe } | { state: "fail"; error: MkError; detail: string };

async function readMe(): Promise<Load> {
  const r = await mkGet<{ signedIn: boolean; me?: MkMe }>("/api/market/me");
  if (!r.ok) return { state: "fail", error: r.error, detail: r.detail };
  if (r.signedIn !== true || !r.me) return { state: "fail", error: "signin", detail: "" };
  return { state: "ready", me: r.me };
}

export default function FirstMessage({ listingId, title, kind, city, onClose }: { listingId: number; title: string; kind: MkSellerKind; city: string; onClose: () => void }) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [view, setView] = useState<"form" | "phone">("form");
  const [mode, setMode] = useState<MkNameMode>("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const about = useRef<HTMLParagraphElement>(null);
  const back = useRef(false); // the notice about phone numbers was just closed: the words are there to be changed
  // "Try again" gives way to the form it asked for: the keyboard stays in the pop-up (./focus.ts)
  useFocusKept(about, load.state);
  const nameId = useId();
  const msgId = useId();
  const errId = useId();

  useEffect(() => {
    let live = true;
    void readMe().then((l) => { if (live) setLoad(l); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (view === "form" && back.current) { back.current = false; box.current?.focus({ preventScroll: true }); }
  }, [view]);

  const again = () => { setLoad({ state: "loading" }); void readMe().then(setLoad); };
  const toForm = () => { back.current = true; setView("form"); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = bodyProblem(text);
    if (problem === "empty") { box.current?.focus(); return; }
    if (problem === "phone") { setErr(""); setView("phone"); return; }
    if (problem) { setErr(problem === "link" ? "link" : "input"); return; }
    setBusy(true);
    setErr("");
    const r = await mkPost<{ thread_id: number; created: boolean }>("/api/market/thread/open", { listing: listingId, body: text, nameMode: mode });
    if (r.ok && typeof r.thread_id === "number") { router.push(inboxHref(r.thread_id)); return; } // it stays busy while the thread opens
    setBusy(false);
    if (!r.ok && r.error === "phone") { setView("phone"); return; }
    setErr(r.ok ? "generic" : mkErrorKey(r.error, r.detail));
  }

  if (view === "phone") {
    return (
      <MkModal title={w.phoneTitle} onClose={toForm}>
        <p>{w.phoneBody}</p>
        <div className="mk-pop-acts">
          <button type="button" className="mk-btn" onClick={toForm} autoFocus>{w.ok}</button>
        </div>
      </MkModal>
    );
  }

  const heading = kind === "shop" ? s.contactShop : s.contactSeller;
  const refused = load.state === "ready" ? writeRefusal(load.me) : null;
  return (
    <MkModal title={heading} onClose={onClose} busy={busy} wide>
      <p ref={about} className="mk-w3-about mk-user" dir="auto">{title}</p>
      {load.state === "loading" && <p className="mk-w3-wait" role="status" aria-busy="true">{w.loading}</p>}
      {load.state === "fail" && (
        <>
          <p className="mk-err" role="alert">{mkErrorText(s, mkErrorKey(load.error, load.detail))}</p>
          <div className="mk-pop-acts">
            {load.error === "signin"
              ? <a className="mk-btn" href={signInHref(listingHref(listingId) + MK_CONTACT_HASH)}>{w.account}</a>
              : load.error !== "absent" && <button type="button" className="mk-btn" onClick={again}>{s.retry}</button>}
            <button type="button" className="mk-btn2" onClick={onClose}>{s.close}</button>
          </div>
        </>
      )}
      {load.state === "ready" && refused && (
        <>
          <p className="mk-err" role="alert">{mkErrorText(s, refused)}</p>
          <div className="mk-pop-acts">
            {refused === "birth" && <Link className="mk-btn" href="/account">{w.account}</Link>}
            <button type="button" className="mk-btn2" onClick={onClose}>{s.close}</button>
          </div>
        </>
      )}
      {load.state === "ready" && !refused && (
        <form className="mk-w3-first" onSubmit={submit} noValidate>
          {nameModes(load.me.names?.short).length > 1 && (
            <fieldset className="mk-set" aria-labelledby={nameId}>
              <legend id={nameId}>{w.nameLabel}</legend>
              <div className="mk-opts">
                <label className="mk-opt">
                  <input type="radio" name={nameId} checked={mode === "short"} onChange={() => setMode("short")} disabled={busy} />
                  <span className="mk-user" dir="auto">{load.me.names.short}</span>
                </label>
                <label className="mk-opt">
                  <input type="radio" name={nameId} checked={mode === "none"} onChange={() => setMode("none")} disabled={busy} />
                  <span>{w.buyer}</span>
                </label>
              </div>
            </fieldset>
          )}
          <div className="mk-chips mk-w3-quick" role="group" aria-label={w.quick}>
            {quickReplies("buyer", city === MK_HUB_CITY).map((k) => (
              <button key={k} type="button" className="mk-chip" disabled={busy} aria-pressed={text === w[k]} onClick={() => { setText(w[k]); setErr(""); }}>{w[k]}</button>
            ))}
          </div>
          <div className="mk-field">
            <label htmlFor={msgId}>{w.messageLabel}</label>
            <textarea ref={box} id={msgId} dir="auto" rows={3} maxLength={MK_MESSAGE_MAX} value={text} disabled={busy}
              aria-invalid={err ? true : undefined} aria-describedby={err ? errId : undefined}
              onChange={(e) => { setText(e.target.value); if (err) setErr(""); }} />
          </div>
          {err && <p id={errId} className="mk-err" role="alert">{mkErrorText(s, err)}</p>}
          <p className="mk-w3-safety"><MkIcon name="shield" size={18} /><span>{s.safety}</span></p>
          <div className="mk-pop-acts">
            <button type="submit" className="mk-btn" disabled={busy} aria-busy={busy || undefined}><MkIcon name="send" size={18} flip />{w.send}</button>
            <button type="button" className="mk-btn2" onClick={onClose} disabled={busy}>{s.cancel}</button>
          </div>
        </form>
      )}
    </MkModal>
  );
}
