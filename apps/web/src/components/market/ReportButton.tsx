"use client";

import { useLocalize } from "@/i18n/TxProvider";
import type { MkReportTarget } from "@/lib/market/core";
import MkIcon from "./MkIcon";
import { T } from "./Market.text";

// PLACEHOLDER (the foundation's): the contact builder (W3) replaces this file and keeps its props. "Report" on a
// listing's page and inside a thread: a centred pop-up with the reasons and an optional note, sent to
// /api/market/report. Until it is built it draws the control, switched off.
//   target     what is reported: "listing" or "thread"
//   refId      the listing's or the thread's number
//   signedIn   whether the page was drawn for a signed-in account (a visitor is sent to sign in)
//   reported   the reader already reported it (the listing's or the thread's `reported`)
export type ReportButtonProps = { target: MkReportTarget; refId: number; signedIn: boolean; reported?: boolean; className?: string };

export default function ReportButton({ className = "" }: ReportButtonProps) {
  const t = useLocalize(T);
  return (
    <button type="button" className={`mk-link${className ? ` ${className}` : ""}`} disabled data-mk-placeholder="report">
      <MkIcon name="flag" size={16} />{t.report}
    </button>
  );
}
