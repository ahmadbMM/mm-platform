"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { fmtPattern, type DatePattern } from "@/lib/date-pattern";
import { MK_HOME, inboxHref, mkErrorKey, mkHasId, type MkError, type MkThreadRow } from "@/lib/market/core";
import { INBOX_POLL_MS, isToday, listingMark, otherName } from "@/lib/market/w3";
import { mkGet } from "@/lib/market/w3-client";
import MkPhoto from "../MkPhoto";
import { T as S, mkErrorText } from "../Market.text";
import { T } from "../w3.text";
import { refreshUnread } from "./unread";
import "../w3.css";

// The Marketplace inbox (/marketplace/inbox): one row per thread, as a buyer or as a seller, the newest first: the
// listing's photo and title, the name the other person chose (or "Buyer" / "Private seller", or a shop's trade name),
// the last message, when, and a dot while something is unread. A thread on a listing that is gone stays in the list
// and stays readable, with the listing's state said. The page draws it with the list it read on the server; it is
// read again every 45 seconds while the page is in view (/api/market/thread/list), and a reading that fails leaves
// what is shown as it was.
//   initial   the threads the page read, or null when it could not
//   error     why it could not
//   fmt       how the page's language writes an hour and a day (lib/date-pattern.ts, made on the server)
export type InboxFmt = { time: DatePattern; day: DatePattern };
type Fail = { error: MkError; detail: string };

export default function Inbox({ initial, error, fmt }: { initial: MkThreadRow[] | null; error: Fail | null; fmt: InboxFmt }) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const locale = useTxLocale();
  const [items, setItems] = useState<MkThreadRow[] | null>(initial);
  const [fail, setFail] = useState<Fail | null>(error);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<"all" | "buyer" | "seller">("all");

  const read = useCallback(async (quiet: boolean) => {
    const r = await mkGet<{ items: MkThreadRow[] }>("/api/market/thread/list");
    if (r.ok && Array.isArray(r.items)) { setItems(r.items.filter(mkHasId)); setFail(null); }
    else if (!quiet) setFail(r.ok ? { error: "generic", detail: "" } : { error: r.error, detail: r.detail });
  }, []);
  const again = async () => { setBusy(true); await read(false); setBusy(false); };

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => { if (timer) clearTimeout(timer); timer = null; };
    const wait = () => {
      stop();
      if (!live || document.visibilityState !== "visible") return;
      timer = setTimeout(() => { void read(true).then(wait); }, INBOX_POLL_MS);
    };
    const seen = () => { if (document.visibilityState === "visible") void read(true).then(wait); else stop(); };
    document.addEventListener("visibilitychange", seen);
    wait();
    refreshUnread();
    return () => { live = false; stop(); document.removeEventListener("visibilitychange", seen); };
  }, [read]);

  if (!items) {
    if (!fail) return <p className="mk-w3-wait" role="status" aria-busy="true">{w.loading}</p>;
    return (
      <div className="mk-empty">
        <p className="mk-err" role="alert">{fail.error === "generic" ? w.inboxFail : mkErrorText(s, mkErrorKey(fail.error, fail.detail))}</p>
        {fail.error !== "absent" && <button type="button" className="mk-btn2" onClick={() => void again()} disabled={busy} aria-busy={busy || undefined}>{s.retry}</button>}
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="mk-empty">
        <p>{w.empty}</p>
        <Link className="mk-btn2" href={MK_HOME}>{w.browse}</Link>
      </div>
    );
  }

  const both = items.some((r) => r.role === "buyer") && items.some((r) => r.role === "seller");
  const list = both && show !== "all" ? items.filter((r) => r.role === show) : items;
  return (
    <>
      {both && (
        <div className="mk-chips mk-w3-filter" role="group" aria-label={s.inbox}>
          {(["all", "buyer", "seller"] as const).map((k) => (
            <button key={k} type="button" className="mk-chip" aria-pressed={show === k} onClick={() => setShow(k)}>{k === "all" ? w.all : k === "buyer" ? w.buying : w.selling}</button>
          ))}
        </div>
      )}
      <ul className="mk-w3-rows">
        {list.map((r) => {
          const mark = listingMark(r.listing.status);
          return (
            <li key={r.id}>
              <Link className={`mk-w3-row${r.unread > 0 ? " is-unread" : ""}`} href={inboxHref(r.id)}>
                <MkPhoto name={r.listing.photo} alt="" small noPhoto={s.noPhoto} className="mk-w3-row-ph" />
                <span className="mk-w3-row-main">
                  <span className="mk-w3-row-top">
                    <span className="mk-w3-row-name mk-user" dir="auto">{otherName(r.other, locale, { buyer: w.buyer, seller: s.seller_private })}</span>
                    <time className="mk-w3-row-when" dateTime={r.last_at} suppressHydrationWarning>{fmtPattern(isToday(r.last_at) ? fmt.time : fmt.day, r.last_at)}</time>
                  </span>
                  <span className="mk-w3-row-title mk-user" dir="auto">{r.listing.title}</span>
                  <span className="mk-w3-row-last mk-user" dir="auto">{r.last_mine ? w.you(r.last_body) : r.last_body}</span>
                  {(both || mark || r.blocked_by_me) && (
                    <span className="mk-w3-row-tags">
                      {both && <span className="mk-tag">{r.role === "buyer" ? w.buying : w.selling}</span>}
                      {mark && <span className={`mk-status${mark === "offSale" ? "" : ` mk-${mark.replace("_", "-")}`}`}>{mark === "offSale" ? w.offSale : s[mark]}</span>}
                      {r.blocked_by_me && <span className="mk-tag">{w.blocked}</span>}
                    </span>
                  )}
                </span>
                {r.unread > 0 && <span className="mk-w3-dot"><span className="mm-sr">{w.unread(r.unread)}</span></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
