"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { unreadText } from "@/lib/market/w3-unread";
import { T } from "./w3/badge.text";
import { useUnread } from "./w3/unread";
import "./w3/badge.css";

// The number of Marketplace threads with something unread, beside the header's Marketplace link (the bar and the
// narrow screen's menu) and on My Account's "Marketplace inbox" row (the foundation put it in those three places).
// The number is asked for once for the whole page (./w3/unread.ts, /api/market/unread): the route answers a visitor
// with no account from the cookie alone, so the database is asked for signed-in accounts only, and nothing is kept by
// a browser or at the edge. It draws nothing until the number is known and nothing for none; a screen reader hears
// "3 unread" where the eye sees 3.
//   where   "header" (the bar), "sheet" (the narrow screen's menu) or "account" (the menu row's value)
export type UnreadBadgeProps = { where: "header" | "sheet" | "account" };

export default function UnreadBadge({ where }: UnreadBadgeProps) {
  const w = useLocalize(T);
  const n = useUnread();
  const text = unreadText(n);
  if (!text) return null;
  return (
    <span className={`mk-w3-badge mk-w3-badge-${where}`}>
      <span aria-hidden="true">{text}</span>
      <span className="mm-sr">{w.unread(n)}</span>
    </span>
  );
}
