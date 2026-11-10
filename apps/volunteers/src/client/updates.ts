// Updates (#updates): what happened to the volunteer, newest first (volunteer_updates, rentals 20261109120000). The
// database writes one row per person, session and kind; the words are the portal's own, in the volunteer's language
// (the push text the database queues beside each one is English | Arabic, for a phone that has no language of ours).
// Opening the list marks everything read; what was new stays marked as such until the page is left.

import { rpc } from "./api";
import { append, h } from "./dom";
import { dayLabel, sessionName, t, whenLabel, type Key } from "./i18n";
import { icon } from "./icons";
import { render, route, S, say, type Update } from "./state";
import { button, note } from "./ui";

const KIND: Record<string, { k: Key; ic: string; href?: (u: Update) => string }> = {
  approved: { k: "updApproved", ic: "tick", href: () => "#" },
  accepted: { k: "updAccepted", ic: "tick", href: () => "#me" },
  declined: { k: "updDeclined", ic: "hand" },
  ended: { k: "updEnded", ic: "hand" },
  cancelled: { k: "updCancelled", ic: "close" }, // the session was called off
  briefing: { k: "updBriefing", ic: "doc", href: () => "#me" },
  reminder_day: { k: "updReminderDay", ic: "cal", href: () => "#me" },
  reminder_soon: { k: "updReminderSoon", ic: "clock", href: () => "#me" },
  lead: { k: "updLead", ic: "flag", href: () => "#me" },
  reward: { k: "updReward", ic: "gift", href: () => "#me" },
};

/** One update's sentence: the event's name and day where it has one. */
export function updateText(u: Update): string {
  const kind = Object.prototype.hasOwnProperty.call(KIND, u.kind) ? KIND[u.kind] : null;
  if (!kind) return "";
  const name = u.session_id ? sessionName(u) : "";
  return t(kind.k, name, dayLabel(u.date));
}

let busy = false;
async function loadUpdates(): Promise<void> {
  if (busy) return;
  busy = true;
  const r = await rpc<{ items: Update[]; unread: number }>("volunteer_updates");
  busy = false;
  // A list that could not be read says so (it said "No updates" under a lit dot), and is read again on Try again.
  if (!r.ok || !r.data) { S.updates = { items: [], fresh: new Set(), err: r.ok ? t("errConnection") : say(r) }; if (route().name === "updates") render(); return; }
  const items = Array.isArray(r.data.items) ? r.data.items : [];
  S.updates = { items, fresh: new Set(items.filter((x) => !x.read).map((x) => x.id)) };
  if (S.updates.fresh.size) {
    const seen = await rpc("volunteer_updates_seen");
    if (seen.ok && S.me) S.me.unread = 0;
  }
  if (route().name === "updates") render();
}

/** Called when the page is left, so the next visit reads the list again. */
export const forgetUpdates = () => { S.updates = null; };

export function viewUpdates(main: HTMLElement): void {
  main.appendChild(h("h1", {}, t("navUpdates")));
  if (!S.updates) { main.appendChild(note(t("loading"))); void loadUpdates(); return; }
  if (S.updates.err) { append(main, note(S.updates.err, "alert"), button(t("retry"), () => { S.updates = null; render(); })); return; }
  const items = S.updates.items.filter((u) => Object.prototype.hasOwnProperty.call(KIND, u.kind));
  if (!items.length) { main.appendChild(note(t("updNone"))); return; }
  main.appendChild(h("ul", { class: "list upd", id: "updates" }, ...items.map((u) => {
    const kind = KIND[u.kind], fresh = S.updates!.fresh.has(u.id);
    const body = [h("span", { class: `upd-ic upd-${u.kind}` }, icon(kind.ic, 20)),
      h("span", { class: "upd-t" }, h("span", { class: "upd-s" }, updateText(u)), h("span", { class: "upd-at" }, whenLabel(u.at))),
      fresh ? h("span", { class: "dot", "aria-hidden": "true" }) : null,
      fresh ? h("span", { class: "sr-only" }, t("updNew")) : null];
    const href = kind.href?.(u);
    const li = h("li", { class: `card upd-row${fresh ? " is-new" : ""}`, "data-kind": u.kind });
    if (href) append(li, h("a", { class: "upd-a", href }, ...body)); else append(li, h("div", { class: "upd-a" }, ...body));
    return li;
  })));
}
