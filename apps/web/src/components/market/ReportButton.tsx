"use client";

import { useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import type { MkReportTarget } from "@/lib/market/core";
import { reportBackHref, signInHref } from "@/lib/market/w3";
import MkIcon from "./MkIcon";
import { T as S } from "./Market.text";
import { useFocusAfter } from "./w3/focus";
import ReportPop from "./w3/ReportPop";
import { T } from "./w3.text";
import "./w3.css";

// "Report" on a listing's page and inside a thread: it opens the centred pop-up with the reasons and an optional note
// (./w3/ReportPop.tsx, sent to /api/market/report). A visitor with no account is sent to sign in and comes back to
// the same page. One report per account per thing: once it is sent, or when the page already knows the reader
// reported it, the control reads "Reported" and does nothing more.
//   target     what is reported: "listing" or "thread"
//   refId      the listing's or the thread's number
//   signedIn   whether the page was drawn for a signed-in account (a visitor is sent to sign in)
//   reported   the reader already reported it (the listing's or the thread's `reported`)
export type ReportButtonProps = { target: MkReportTarget; refId: number; signedIn: boolean; reported?: boolean; className?: string };

export default function ReportButton({ target, refId, signedIn, reported = false, className = "" }: ReportButtonProps) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const mark = useRef<HTMLSpanElement>(null);
  // once a report is sent the button that opened the pop-up is gone: the keyboard goes to "Reported" in its place
  useFocusAfter(open, mark);
  const cls = `mk-link${className ? ` ${className}` : ""}`;
  if (!signedIn) {
    return <a className={cls} href={signInHref(reportBackHref(target, refId))}><MkIcon name="flag" size={16} />{s.report}</a>;
  }
  return (
    <>
      {reported || sent
        ? <span ref={mark} tabIndex={-1} className={`mk-w3-reported${className ? ` ${className}` : ""}`}><MkIcon name="tick" size={16} />{w.reported}</span>
        : <button type="button" className={cls} onClick={() => setOpen(true)} aria-haspopup="dialog"><MkIcon name="flag" size={16} />{s.report}</button>}
      {open && <ReportPop target={target} refId={refId} onClose={() => setOpen(false)} onSent={() => setSent(true)} />}
    </>
  );
}
