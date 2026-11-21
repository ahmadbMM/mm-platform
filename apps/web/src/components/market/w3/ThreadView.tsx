"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { fmtPattern } from "@/lib/date-pattern";
import {
  MK_INBOX, MK_MESSAGE_MAX, mkCityName, mkClean, mkErrorKey, mkHasId, mkWaHref, type MkMessage, type MkThread, type MkThreadGet,
} from "@/lib/market/core";
import {
  bodyProblem, dayStarts, isToday, lastId, lastTheirs, listingMark, mergeMessages, otherName, pollDelay, quickReplies, sendOutcome, threadListingHref,
  type MkPending,
} from "@/lib/market/w3";
import { mkGet, mkPost } from "@/lib/market/w3-client";
import MkAmt from "../MkAmt";
import MkIcon from "../MkIcon";
import MkModal from "../MkModal";
import MkPhoto from "../MkPhoto";
import ReportButton from "../ReportButton";
import SellerTag from "../SellerTag";
import { T as S, mkErrorText } from "../Market.text";
import { T } from "../w3.text";
import { useFocusAfter } from "./focus";
import type { InboxFmt } from "./Inbox";
import { refreshUnread } from "./unread";
import "../w3.css";

// One thread of the Marketplace inbox (/marketplace/inbox/<id>): who it is with (the name they chose, never more), the
// listing's card on top (it stays once the listing is gone, with its state said), the messages, and the box to write
// in with its quick replies. The page draws it with what it read on the server; while it is in view it asks again at a
// gentle interval (/api/market/thread/get: 15 seconds while the talk is going, slower when it is quiet, never while
// the page is hidden), which also brings the other person's WhatsApp button the moment they share it.
//   A message is shown at once as "Sending", then as sent, or "Not sent" with Try again. Words the database refuses
//   (a link) go back in the box with the reason; a phone number opens the centred notice that points at "Share my
//   WhatsApp"; a cap is said in words.
//   "Share my WhatsApp" is offered only when the thread says it may be (the other person has replied and the account
//   is allowed to) and is confirmed in a centred pop-up with the one safety sentence; once shared, the number stays on
//   the thread (the contract's market_share_whatsapp has no way back), which the sharer is told in one line.
//   Block is confirmed in a centred pop-up; only the one who blocked is told there is a block, and may lift it.
//   Report opens the report pop-up for this conversation.
export default function ThreadView({ initial, fmt }: { initial: MkThreadGet; fmt: InboxFmt }) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const locale = useTxLocale();
  const id = initial.thread.id;
  const [thread, setThread] = useState<MkThread>(initial.thread);
  const [messages, setMessages] = useState<MkMessage[]>(() => mergeMessages([], initial.messages.filter(mkHasId)));
  const [more, setMore] = useState(initial.more === true);
  const [pending, setPending] = useState<MkPending[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pop, setPop] = useState<"" | "share" | "block" | "phone">("");
  const [popErr, setPopErr] = useState("");
  const [busy, setBusy] = useState<"" | "older" | "share" | "block">("");
  const chat = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);              // the list is at its end: a new message keeps it there
  const keep = useRef<number | null>(null); // the list's height before earlier messages were put above
  const seq = useRef(0);
  const active = useRef(0);                // when something last happened here (a message came or went)
  const asking = useRef(false);
  const errId = useId();

  /* ---- reading it again ---- */
  const refresh = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const r = await mkGet<MkThreadGet>(`/api/market/thread/get?id=${id}`);
    asking.current = false;
    if (!r.ok || !mkHasId(r.thread) || !Array.isArray(r.messages)) return; // a reading that fails leaves the page as it is
    setThread(r.thread);
    setMessages((have) => mergeMessages(have, r.messages.filter(mkHasId)));
  }, [id]);

  const newest = lastId(messages);
  const arrived = lastTheirs(messages);
  // something came or went: the asking stays quick
  useEffect(() => { active.current = Date.now(); }, [newest]);
  // the page opened, or the other person wrote: the header's unread number is asked for again (this page's readings
  // mark the thread read). The reader's own messages do not change that number, so sending one asks nothing more.
  useEffect(() => { refreshUnread(); }, [arrived]);
  // a pop-up that closed gives the keyboard back to what opened it; "Share my WhatsApp" is gone once the number is
  // shared, and the keyboard then goes to the messages (./focus.ts)
  useFocusAfter(pop !== "", log);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => { if (timer) clearTimeout(timer); timer = null; };
    const wait = () => {
      stop();
      if (!live || document.visibilityState !== "visible") return;
      timer = setTimeout(() => { void refresh().then(wait); }, pollDelay(Date.now() - active.current));
    };
    const seen = () => { if (document.visibilityState === "visible") void refresh().then(wait); else stop(); };
    document.addEventListener("visibilitychange", seen);
    wait();
    return () => { live = false; stop(); document.removeEventListener("visibilitychange", seen); };
  }, [refresh]);

  /* ---- where the list is scrolled ---- */
  // The page opens on the conversation: when the box to write in would be below the screen, the page is moved so the
  // messages and the box are both in view (nothing is pinned; the listing's card stays above, a scroll away).
  useEffect(() => {
    const el = chat.current;
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ block: "end" });
  }, []);
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    if (keep.current !== null) { el.scrollTop += el.scrollHeight - keep.current; keep.current = null; }
    else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  async function older() {
    if (busy || !messages.length) return;
    setBusy("older");
    const r = await mkGet<MkThreadGet>(`/api/market/thread/get?id=${id}&before=${messages[0].id}`);
    setBusy("");
    if (!r.ok || !Array.isArray(r.messages)) { setErr(r.ok ? "generic" : mkErrorKey(r.error, r.detail)); return; }
    keep.current = log.current?.scrollHeight ?? null;
    setMore(r.more === true);
    setMessages((have) => mergeMessages(have, r.messages.filter(mkHasId)));
  }

  /* ---- sending ---- */
  async function deliver(p: MkPending) {
    const r = await mkPost<{ message: MkMessage }>("/api/market/thread/send", { thread: id, body: p.body });
    if (r.ok && mkHasId(r.message)) {
      const sent = r.message;
      setPending((list) => list.filter((x) => x.key !== p.key));
      setMessages((have) => mergeMessages(have, [sent]));
      return;
    }
    const error = r.ok ? "generic" : r.error;
    const detail = r.ok ? "" : r.detail;
    const out = sendOutcome(error);
    if (out === "edit") {
      setPending((list) => list.filter((x) => x.key !== p.key));
      setText((now) => now || p.body); // back in the box, unless something else was typed meanwhile
      if (error === "phone") setPop("phone"); else setErr(mkErrorKey(error, detail));
      return;
    }
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, state: "failed", error, detail, retry: out === "retry" } : x)));
    setErr(mkErrorKey(error, detail));
    if (out === "closed") void refresh(); // the thread says for itself whether anything can still be sent
  }
  function send() {
    const problem = bodyProblem(text);
    if (problem === "empty") { box.current?.focus(); return; }
    if (problem === "phone") { setErr(""); setPop("phone"); return; }
    if (problem) { setErr(problem === "link" ? "link" : "input"); return; }
    const item: MkPending = { key: `p${++seq.current}`, body: mkClean(text), state: "sending" };
    setErr("");
    setText("");
    stick.current = true;
    active.current = Date.now();
    setPending((list) => [...list, item]);
    void deliver(item);
  }
  function retry(p: MkPending) {
    const item: MkPending = { key: p.key, body: p.body, state: "sending" };
    setErr("");
    setPending((list) => list.map((x) => (x.key === p.key ? item : x)));
    void deliver(item);
  }

  /* ---- Share my WhatsApp ---- */
  async function share() {
    setBusy("share");
    setPopErr("");
    const r = await mkPost<{ shared: boolean }>("/api/market/thread/whatsapp", { thread: id });
    setBusy("");
    if (!r.ok) { setPopErr(mkErrorKey(r.error, r.detail)); return; }
    setThread((t) => ({ ...t, my_wa_shared: true, can_share_wa: false }));
    setPop("");
    void refresh();
  }

  /* ---- block ---- */
  async function block(on: boolean) {
    setBusy("block");
    setPopErr("");
    setErr("");
    const r = await mkPost<{ blocked: boolean }>("/api/market/block", { thread: id, on });
    setBusy("");
    if (!r.ok) { const key = mkErrorKey(r.error, r.detail); if (on) setPopErr(key); else setErr(key); return; }
    const blocked = r.blocked === true;
    setThread((t) => ({ ...t, blocked_by_me: blocked, can_send: blocked ? false : t.can_send }));
    setPop("");
    void refresh();
    refreshUnread();
  }

  const l = thread.listing;
  const name = otherName(thread.other, locale, { buyer: w.buyer, seller: s.seller_private });
  const href = threadListingHref(l, thread.role);
  const mark = listingMark(l.status);
  const waHref = thread.other_wa ? mkWaHref(thread.other_wa, w.waHello(l.title)) : null;
  const days = dayStarts(messages);
  const canShare = thread.can_share_wa && !thread.my_wa_shared;
  const item = (
    <>
      <MkPhoto name={l.photo} alt="" small noPhoto={s.noPhoto} className="mk-w3-item-ph" />
      <span className="mk-w3-item-main">
        <span className="mk-w3-item-title mk-user" dir="auto">{l.title}</span>
        <span className="mk-w3-item-sub"><MkAmt n={l.price} word={s.sar} /><span aria-hidden="true">·</span><span>{mkCityName(l.city, locale)}</span></span>
        {mark && <span className={`mk-status${mark === "offSale" ? "" : ` mk-${mark.replace("_", "-")}`}`}>{mark === "offSale" ? w.offSale : s[mark]}</span>}
      </span>
      {href && <MkIcon name="next" size={18} flip className="mk-w3-item-go" />}
    </>
  );

  return (
    <div className="mk-w3-thread">
      <Link className="mk-link mk-w3-back" href={MK_INBOX}><MkIcon name="back" size={16} flip />{s.inbox}</Link>
      <div className="mk-w3-who">
        <h1 className="mk-w3-h mk-user" dir="auto">{name}</h1>
        {(thread.other.kind === "shop" || (thread.other.kind === "private" && !!thread.other.name?.trim())) && <SellerTag kind={thread.other.kind} t={s} />}
      </div>
      {href ? <Link className="mk-card mk-w3-item" href={href}>{item}</Link> : <div className="mk-card mk-w3-item">{item}</div>}

      {waHref && <a className="mk-btn mk-btn-wide" href={waHref} target="_blank" rel="noopener noreferrer"><MkIcon name="whatsapp" size={18} />{w.waOpen}</a>}

      <section ref={chat} className="mk-w3-chat" aria-label={w.messages}>
        <div ref={log} className="mk-w3-log" role="log" aria-label={w.messages} aria-live="polite" tabIndex={0}
          onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {more && (
            <button type="button" className="mk-link mk-w3-older" onClick={() => void older()} disabled={busy === "older"} aria-busy={busy === "older" || undefined}>
              <MkIcon name="clock" size={16} />{w.earlier}
            </button>
          )}
          {messages.map((m) => (
            <div key={m.id} className="mk-w3-turn">
              {days.has(m.id) && <p className="mk-w3-day" suppressHydrationWarning>{isToday(m.at) ? w.today : fmtPattern(fmt.day, m.at)}</p>}
              <div className={`mk-w3-msg${m.mine ? " is-mine" : ""}`}>
                <p className="mk-w3-bubble"><span className="mk-user" dir="auto">{m.body}</span></p>
                <time className="mk-w3-when" dateTime={m.at}>{fmtPattern(fmt.time, m.at)}</time>
              </div>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.key} className={`mk-w3-msg is-mine ${p.state === "failed" ? "is-failed" : "is-pending"}`}>
              <p className="mk-w3-bubble"><span className="mk-user" dir="auto">{p.body}</span></p>
              {p.state === "sending"
                ? <span className="mk-w3-when" role="status">{w.sending}</span>
                : (
                  <span className="mk-w3-when mk-w3-fail">
                    <MkIcon name="alert" size={14} />{w.notSent}
                    {p.retry && <button type="button" className="mk-link" onClick={() => retry(p)}>{s.retry}</button>}
                  </span>
                )}
            </div>
          ))}
        </div>

        {thread.can_send ? (
          <form className="mk-w3-send" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <div className="mk-chips mk-w3-quick" role="group" aria-label={w.quick}>
              {canShare && (
                <button type="button" className="mk-chip mk-w3-wa-chip" onClick={() => { setPopErr(""); setPop("share"); }} aria-haspopup="dialog"><MkIcon name="whatsapp" size={16} />{w.shareWa}</button>
              )}
              {quickReplies(thread.role, thread.hub).map((k) => (
                <button key={k} type="button" className="mk-chip" onClick={() => { setText(w[k]); setErr(""); box.current?.focus(); }}>{w[k]}</button>
              ))}
            </div>
            {err && <p id={errId} className="mk-err" role="alert">{mkErrorText(s, err)}</p>}
            <div className="mk-w3-box">
              <textarea ref={box} dir="auto" rows={1} maxLength={MK_MESSAGE_MAX} value={text} aria-label={w.write} placeholder={w.write} enterKeyHint="send"
                aria-invalid={err ? true : undefined} aria-describedby={err ? errId : undefined}
                onChange={(e) => { setText(e.target.value); if (err) setErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
              <button type="submit" className="mk-btn mk-w3-go" aria-label={w.send}><MkIcon name="send" size={20} flip /></button>
            </div>
          </form>
        ) : (
          <div className="mk-w3-closed">
            {err && <p className="mk-err" role="alert">{mkErrorText(s, err)}</p>}
            <p>{thread.blocked_by_me ? w.blockedByMe : w.closed}</p>
            {canShare && (
              <button type="button" className="mk-btn2" onClick={() => { setPopErr(""); setPop("share"); }} aria-haspopup="dialog"><MkIcon name="whatsapp" size={18} />{w.shareWa}</button>
            )}
          </div>
        )}
      </section>

      {thread.my_wa_shared && (
        <p className="mk-w3-shared">
          <span><MkIcon name="whatsapp" size={16} />{w.waShared}</span>
        </p>
      )}
      <div className="mk-w3-acts">
        {thread.blocked_by_me
          ? <button type="button" className="mk-link" onClick={() => void block(false)} disabled={busy === "block"}><MkIcon name="block" size={16} />{w.unblock}</button>
          : <button type="button" className="mk-link" onClick={() => { setPopErr(""); setPop("block"); }} aria-haspopup="dialog"><MkIcon name="block" size={16} />{w.block}</button>}
        <ReportButton target="thread" refId={id} signedIn reported={thread.reported} />
      </div>

      {pop === "phone" && (
        <MkModal title={w.phoneTitle} onClose={() => setPop("")}>
          <p>{w.phoneBody}</p>
          <div className="mk-pop-acts">
            {canShare && <button type="button" className="mk-btn" onClick={() => { setPopErr(""); setPop("share"); }}>{w.shareWa}</button>}
            <button type="button" className={canShare ? "mk-btn2" : "mk-btn"} onClick={() => setPop("")}>{w.ok}</button>
          </div>
        </MkModal>
      )}
      {pop === "share" && (
        <MkModal title={w.shareWa} onClose={() => setPop("")} busy={busy === "share"}>
          <p>{w.shareWaBody}</p>
          <p className="mk-w3-safety"><MkIcon name="shield" size={18} /><span>{s.safety}</span></p>
          {popErr && <p className="mk-err mk-w3-err" role="alert">{mkErrorText(s, popErr)}</p>}
          <div className="mk-pop-acts">
            <button type="button" className="mk-btn" onClick={() => void share()} disabled={busy === "share"} aria-busy={busy === "share" || undefined}><MkIcon name="whatsapp" size={18} />{w.share}</button>
            <button type="button" className="mk-btn2" onClick={() => setPop("")} disabled={busy === "share"}>{s.cancel}</button>
          </div>
        </MkModal>
      )}
      {pop === "block" && (
        <MkModal title={w.blockTitle} onClose={() => setPop("")} busy={busy === "block"}>
          <p>{w.blockBody}</p>
          {popErr && <p className="mk-err mk-w3-err" role="alert">{mkErrorText(s, popErr)}</p>}
          <div className="mk-pop-acts">
            <button type="button" className="mk-btn2 mk-btn-red" onClick={() => void block(true)} disabled={busy === "block"} aria-busy={busy === "block" || undefined}><MkIcon name="block" size={18} />{w.block}</button>
            <button type="button" className="mk-btn2" onClick={() => setPop("")} disabled={busy === "block"}>{s.cancel}</button>
          </div>
        </MkModal>
      )}
    </div>
  );
}
