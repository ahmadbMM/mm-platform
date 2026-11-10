// Home (#me): the greeting, where the volunteer stands with staff when there is something to do about it, the next
// shift (its date, place, directions, the calendar, the briefing, Start work on the day), the hours and the next hours
// badge, what each event worked gave (a free ride and its certificate), and the shifts behind them.

import { rpc } from "./api";
import { eventsWorked, getCert } from "./certs";
import { append, h } from "./dom";
import { dayLabel, gathers, hoursN, ksaToday, sessionName, t, timeLabel, timesLabel, type Key } from "./i18n";
import { downloadIcs } from "./ics";
import { icon } from "./icons";
import { render, S, say, setNote, standing, type Mine } from "./state";
import { button, card, chip, dateBlock, iconButton, link, metaLine, note, sec } from "./ui";

/** The hours badges (_vol_badges): 10, 25, 50 and 100 hours. */
export const LEVELS = [10, 25, 50, 100];

function greeting(name: string): string {
  const hr = (new Date().getUTCHours() + 3) % 24; // Riyadh
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const k: Key = hr >= 4 && hr < 12 ? "greetMorning" : hr >= 12 && hr < 17 ? "greetAfternoon" : "greetEvening";
  return first ? t(k, first) : t("navHome");
}

export const mapsLink = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

/** Upcoming: accepted, not finished, its window not closed, not called off; the soonest first. */
export function upcoming(): Mine[] {
  const now = Date.now(), today = ksaToday();
  return (S.me?.mine ?? [])
    .filter((x) => x.status === "accepted" && !x.cancelled && !x.clock_out && Date.parse(x.closes_at) > now && String(x.date).slice(0, 10) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** "I have read the briefing" (20261107131000): staff see it on their list; a new briefing clears it. */
export function briefTick(id: string): HTMLElement | null {
  if (!S.prof) return null;
  if (S.prof.briefed[id]) return h("div", { class: "chips" }, chip(t("briefDone"), "on", "tick"));
  const tid = `brief-${id}`;
  return h("label", { class: "tick", for: tid },
    h("input", { type: "checkbox", id: tid, onchange: (() => void briefAck(id)) as EventListener }), h("span", {}, t("briefRead")));
}
async function briefAck(id: string): Promise<void> {
  const r = await rpc<{ briefed_at: string }>("volunteer_brief_ack", { p_session: id });
  if (!r.ok) { setNote(say(r)); render(); return; }
  if (S.prof) S.prof.briefed[id] = r.data?.briefed_at || new Date().toISOString();
  render();
}

function nextCard(x: Mine): HTMLElement {
  const acts: HTMLElement[] = [];
  if (x.can_work) acts.push(link(t("startWork"), `#work/${encodeURIComponent(x.id)}`, "primary", "go"));
  if (x.location) acts.push(link(t("directions"), mapsLink(x.location), "secondary", "pin", { target: "_blank", rel: "noopener" }));
  acts.push(button(t("addToCal"), () => downloadIcs({ id: x.id, title: sessionName(x), date: x.date, time: x.time, starts_at: x.starts_at, location: x.location, note: x.role ?? undefined, gathers: gathers(x) }), "secondary", { id: "next-cal" }, "cal"));
  return h("section", { class: "card next", id: "next-shift", "aria-labelledby": "next-h" },
    h("div", { class: "next-top" }, dateBlock(x.date, true),
      h("div", { class: "next-what" },
        h("p", { class: "kicker" }, t("homeNext")),
        h("h2", { id: "next-h" }, sessionName(x)),
        h("div", { class: "chips" }, chip(t("stAccepted"), "on", "tick"), x.lead ? chip(t("leadMark"), "lead", "flag") : null))),
    h("div", { class: "metas" },
      metaLine("cal", dayLabel(x.date)),
      x.time ? metaLine("clock", timesLabel(x.time, gathers(x))) : null,
      x.location ? metaLine("pin", x.location) : null,
      x.role ? metaLine("person", x.role) : null,
      x.clock_in ? metaLine("tick", t("vdArrivedAt", timeLabel(x.clock_in)), "meta-go") : null),
    x.briefing ? h("div", { class: "brief" }, h("p", { class: "brief-h" }, t("vdBriefing")), h("p", { class: "brief-t" }, x.briefing), briefTick(x.id)) : null,
    h("div", { class: "acts" }, ...acts));
}

function shiftRow(x: Mine, past: boolean): HTMLElement {
  const words: Record<string, Key> = { interested: "stInterested", accepted: "stAccepted", declined: "stDeclined", withdrawn: "stWithdrawn", done: "stThanks", no_show: "stNoShow", ended: "stEnded",
    cancelled: "stCancelled" };
  const st = x.cancelled ? "cancelled" : x.status === "accepted" && past ? (x.clock_in ? "done" : "accepted") : x.status;
  const tone = st === "accepted" || st === "done" ? "on" : st === "interested" ? "wait" : "";
  return h("a", { class: "card shift", href: `#o/${encodeURIComponent(x.id)}` },
    dateBlock(x.date),
    h("div", { class: "shift-what" }, h("p", { class: "ev-name" }, sessionName(x)),
      h("div", { class: "chips" }, chip(t(words[st] ?? "stDone"), tone), x.role ? chip(x.role) : null, x.lead ? chip(t("leadMark"), "lead", "flag") : null)),
    icon("go", 18, true));
}

function rewardRow(x: ReturnType<typeof eventsWorked>[number]): HTMLElement {
  const r = x.reward;
  const copy = r && !r.used ? iconButton("copy", t("copyCode"), () => {
    void navigator.clipboard?.writeText(r.code).then(() => { setNote(t("copied")); render(); }, () => undefined);
  }) : null;
  return h("div", { class: "card reward", "data-session": x.id },
    h("div", { class: "ev-main" },
      h("p", { class: "ev-name" }, x.label),
      h("p", { class: "meta" }, `${dayLabel(x.on)} · ${hoursN(x.hours)}`)),
    // the free ride the event gave (VL-, the blood donors' rules), used or not
    r ? h("div", { class: `code-box${r.used ? " is-used" : ""}` }, h("span", { class: "code-ic" }, icon("gift", 20)),
      h("div", { class: "code-t" }, h("span", { class: "code-k" }, t("freeRide")), h("span", { class: "code", dir: "ltr" }, r.code),
        h("span", { class: "code-sub" }, r.used ? t("codeUsed") : t("codeUseBy", dayLabel(r.expires_at)))),
      copy) : null,
    button(t("certGet"), () => void getCert(x.id, x.initiative), "secondary", {}, "doc"));
}

export function viewHome(main: HTMLElement): void {
  const m = S.me!;
  main.appendChild(h("h1", { class: "greet" }, greeting(m.name)));
  // Where they stand, only when there is something to do or wait for.
  const st = standing();
  if (st === "profile") main.appendChild(card("cta", h("p", { class: "cta-t" }, t("profNeeded")), link(t("profSetUp"), "#profile", "primary", "go")));
  else if (st === "waiting") main.appendChild(note(t("profWaiting"), "status", "wait"));
  else if (st === "paused") main.appendChild(note(t("vdPaused")));
  else if (st === "ended") main.appendChild(note(t("vdExpired")));
  else if (st === "account") main.appendChild(note(t(m.account === "pwd" ? "vdAccountPwd" : "vdAccountDel")));

  const up = upcoming();
  if (up.length) {
    main.appendChild(nextCard(up[0]));
    if (up.length > 1) append(main, sec(t("homeLater")), h("div", { class: "list" }, ...up.slice(1).map((x) => shiftRow(x, false))));
  } else if (st === "active") main.appendChild(card("cta", h("p", { class: "cta-t" }, t("homeNoShift")), link(t("meSeeOpps"), "#", "primary", "go")));

  const offers = (m.mine ?? []).filter((x) => x.status === "interested" && !x.cancelled && Date.parse(x.closes_at) > Date.now());
  if (offers.length) append(main, sec(t("homeOffers")), h("div", { class: "list" }, ...offers.map((x) => shiftRow(x, false))));

  // The hours, the events and the next hours badge.
  const hours = Math.round((+m.hours || 0) * 100) / 100;
  const next = LEVELS.find((l) => hours < l) ?? null;
  const prev = [...LEVELS].reverse().find((l) => hours >= l) ?? 0;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((hours - prev) / (next - prev)) * 100))) : 100;
  const bar = h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct, "aria-label": t("homeBadgeBar") }, h("i", { class: `w${Math.round(pct / 5) * 5}` }));
  main.appendChild(h("section", { class: "card stats", id: "stats", "aria-labelledby": "stats-h" },
    h("h2", { class: "sr-only", id: "stats-h" }, t("homeStats")),
    h("div", { class: "stat-grid" },
      h("p", { class: "big-n", id: "home-hours" }, h("b", {}, String(hours)), h("span", {}, t("homeHours"))),
      h("p", { class: "big-n" }, h("b", {}, String(+m.sessions || 0)), h("span", {}, t("homeEvents")))),
    h("div", { class: "badge-next" }, icon("medal", 22),
      h("div", { class: "badge-next-t" }, h("p", {}, next ? t("homeToBadge", String(Math.round((next - hours) * 100) / 100), String(next)) : t("homeAllBadges")), bar))));

  const worked = eventsWorked();
  if (worked.length) append(main, sec(t("homeRewards")), h("div", { class: "list", id: "rewards" }, ...worked.map(rewardRow)));

  const past = (m.mine ?? []).filter((x) => !up.includes(x) && !offers.includes(x));
  if (past.length) append(main, sec(t("homePast")), h("div", { class: "list" }, ...past.map((x) => shiftRow(x, true))));
  if (!up.length && !offers.length && !past.length && st !== "active" && st !== "profile") main.appendChild(link(t("meSeeOpps"), "#", "secondary", "go"));
}
