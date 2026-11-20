"use client";

// PLACEHOLDER (the foundation's): the contact builder (W3) replaces this file and keeps its props. The number of
// Marketplace threads with something unread, beside the header's Marketplace link (the bar and the narrow screen's
// menu) and on My Account's "Marketplace inbox" row. It asks /api/market/unread, which answers a visitor who is not
// signed in from the cookie alone. The foundation has already put it in those three places, so nothing there needs
// editing. Until it is built it draws nothing.
//   where   "header" (the bar), "sheet" (the narrow screen's menu) or "account" (the menu row's value)
export type UnreadBadgeProps = { where: "header" | "sheet" | "account" };

export default function UnreadBadge(props: UnreadBadgeProps) {
  void props;
  return null;
}
