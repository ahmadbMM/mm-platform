// Home (#me, and the bare address): the greeting, then ONE next-step card naming the single thing to do next (the
// report's Tier 1, 2026-11-11), in this order: details the account owes, the profile, waiting for staff, the event-day
// Today card, "Still coming?" from 48 hours before, "What time will you leave?", the close-out of an event worked in the
// last seven days, the next opportunity. Then the next shift (its place, directions and calendar, the briefing, Start
// work), the shifts coming up, the offers waiting for an answer, the hours, the team's year, the certificates (the
// reward the volunteer said matters most comes first), what each event gave, and the shifts behind them.

import { eventsWorked, extraHours, getCert } from "./certs";
import { append, h } from "./dom";
import { dayLabel, gathers, hoursN, sessionName, t, timeLabel, timesLabel, type Key } from "./i18n";
import { icon } from "./icons";
import { ACCOUNT, owed, S, standing, type Mine } from "./state";
import { briefBox, calAsk, calButton, closeoutCard, comingYes, impactLine, isAhead, isToday, mapsLink, needsComing, needsPlan, nextOpp, planForm,
  recentDone, rewardBox, todayCard, withdrawAsk } from "./shift";
import { button, chip, dateBlock, iconButton, link, metaLine, note, sec } from "./ui";

/** The hours badges (_vol_badges): 10, 25, 50 and 100 hours. */
export const LEVELS = [10, 25, 50, 100];

function greeting(name: string): string {
  const hr = (new Date().getUTCHours() + 3) % 24; // Riyadh
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const k: Key = hr >= 4 && hr < 12 ? "greetMorning" : hr >= 12 && hr < 17 ? "greetAfternoon" : "greetEvening";
  return first ? t(k, first) : t("navHome");
}

export { mapsLink } from "./shift";

/** Upcoming: accepted, not finished, its window not closed, not called off; the soonest first. */
export function upcoming(): Mine[] {
  return (S.me?.mine ?? []).filter(isAhead).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// ── the next-step card: one card, one action ──
const step = (kind: string, ic: string, text: string, ...rest: (HTMLElement | null)[]) =>
  h("section", { class: "card step", id: "next-step", "data-step": kind },
    h("div", { class: "step-top" }, h("span", { class: "step-ic", "aria-hidden": "true" }, icon(ic, 22)), h("p", { class: "step-t" }, text)), ...rest);

/** The card, and the shift it is about (the next-shift card below leaves that one out when the card already is it). */
function nextStep(): { el: HTMLElement; covers: string | null } | null {
  const st = standing();
  if (st === "paused" || st === "ended" || st === "account") return null;
  const miss = owed();
  if (miss.length) {
    return { covers: null, el: step("details", "person", t("stepDetails"),
      h("div", { class: "chips" }, ...miss.map((k) => chip(t(k === "dob" ? "profDob" : "profEmergency"), "warn"))),
      link(t("addDetails"), ACCOUNT, "primary", "go", { rel: "noopener", id: "step-details" })) };
  }
  if (st === "profile") return { covers: null, el: step("profile", "hand", t("profNeeded"), link(t("profSetUp"), "#profile", "primary", "go")) };
  if (st === "waiting") return { covers: null, el: step("waiting", "clock", t("profWaiting"), link(t("meSeeOpps"), "#opps", "secondary", "go")) };
  const ahead = upcoming();
  const today = ahead.find(isToday);
  if (today) return { covers: today.id, el: todayCard(today) };
  const coming = ahead.find(needsComing);
  if (coming) {
    return { covers: null, el: step("coming", "cal", t("comingQ", sessionName(coming), dayLabel(coming.date)),
      h("div", { class: "acts acts-pair" },
        button(t("comingYesBtn"), () => comingYes(coming), "primary", { id: "coming-yes" }, "tick"),
        button(t("comingNoBtn"), () => withdrawAsk(coming), "secondary", { id: "coming-no" }))) };
  }
  const plan = ahead.find(needsPlan);
  if (plan) return { covers: null, el: step("plan", "clock", t("planFor", sessionName(plan), dayLabel(plan.date)), planForm(plan, true)) };
  const done = recentDone()[0];
  if (done) return { covers: done.id, el: closeoutCard(done) };
  const o = nextOpp();
  if (o) {
    return { covers: null, el: step("opp", "hand", t("stepOpp", sessionName(o), dayLabel(o.date)),
      link(t("stepOppBtn"), `#o/${encodeURIComponent(o.id)}`, "primary", "go", { id: "step-opp" })) };
  }
  // a shift coming up is the next thing: its card says it
  if (ahead.length) return null;
  return { covers: null, el: step("none", "cal", t("homeNoShift"), link(t("meSeeOpps"), "#opps", "secondary", "go")) };
}

function nextCard(x: Mine): HTMLElement {
  const acts: HTMLElement[] = [];
  const side: HTMLElement[] = [];
  if (x.can_work) acts.push(link(t("startWork"), `#work/${encodeURIComponent(x.id)}`, "primary", "go"));
  const map = x.meet_map && /^https:\/\//i.test(x.meet_map) ? x.meet_map : null;
  if (map || x.location) side.push(link(t("directions"), map ?? mapsLink(x.location ?? ""), "secondary", "pin", { target: "_blank", rel: "noopener" }));
  side.push(calButton(x, { id: "next-cal" }));
  return h("section", { class: "card next", id: "next-shift", "aria-labelledby": "next-h" },
    h("div", { class: "next-top" }, dateBlock(x.date, true),
      h("div", { class: "next-what" },
        h("p", { class: "kicker" }, t("homeNext")),
        h("h2", { id: "next-h" }, sessionName(x)),
        h("div", { class: "chips" }, chip(t("stAccepted"), "on", "tick"), x.coming_at ? chip(t("comingChip"), "on") : null, x.lead ? chip(t("leadMark"), "lead", "flag") : null))),
    h("div", { class: "metas" },
      x.time ? metaLine("clock", timesLabel(x.time, gathers(x))) : null,
      x.meet_point ? metaLine("pin", x.meet_point) : x.location ? metaLine("pin", x.location) : null,
      x.role ? metaLine("person", t("roleIs", x.role)) : null,
      x.plan_leave ? metaLine("go", t("planLeave", x.plan_leave)) : null,
      x.clock_in ? metaLine("tick", t("vdArrivedAt", timeLabel(x.clock_in)), "meta-go") : null),
    briefBox(x),
    acts.length ? h("div", { class: "acts" }, ...acts) : null,
    h("div", { class: "acts acts-pair" }, ...side));
}

const WORDS: Record<string, Key> = { interested: "chipInterest", accepted: "stAccepted", declined: "stDeclined", withdrawn: "stWithdrawn", done: "stThanks", no_show: "stNoShow",
  ended: "stEnded", cancelled: "stCancelled" };
function shiftRow(x: Mine, past: boolean): HTMLElement {
  const st = x.cancelled ? "cancelled" : x.status === "accepted" && past ? (x.clock_in ? "done" : "accepted") : x.status;
  const tone = st === "accepted" || st === "done" ? "on" : st === "interested" ? "wait" : "";
  const href = `#o/${encodeURIComponent(x.id)}`;
  // a row still to come carries its own Add to calendar beside the link (a link may not hold a button)
  const ahead = !past && x.status === "accepted";
  return h("div", { class: "card shift", "data-id": x.id },
    dateBlock(x.date),
    h("a", { class: "shift-link", href },
      h("span", { class: "shift-what" }, h("span", { class: "ev-name" }, sessionName(x)),
        x.role ? h("span", { class: "meta" }, icon("person", 16), h("span", {}, t("roleIs", x.role))) : null,
        h("span", { class: "chips" }, chip(t(WORDS[st] ?? "stDone"), tone), x.lead ? chip(t("leadMark"), "lead", "flag") : null)),
      ahead ? null : icon("go", 18, true)),
    ahead ? iconButton("cal", t("addToCal"), () => calAsk(x), { class: "btn btn-icon shift-cal" }) : null);
}

function rewardRow(x: ReturnType<typeof eventsWorked>[number]): HTMLElement {
  return h("div", { class: "card reward", "data-session": x.id },
    h("div", { class: "ev-main" },
      h("p", { class: "ev-name" }, x.label),
      h("p", { class: "meta" }, `${dayLabel(x.on)} · ${hoursN(x.hours)}`)),
    // the free ride the event gave (VL-, the blood donors' rules), used or not: a thank-you, never pay (decision 2)
    x.reward ? rewardBox(x.reward) : null,
    button(t("certGet"), () => getCert(x.id, x.initiative), "secondary", {}, "doc"));
}

// ── the rewards, in the order the volunteer's motive puts them (the report's Tier 2: the matching reward first) ──
function statsCard(): HTMLElement | null {
  const m = S.me!;
  const hours = Math.round((+m.hours || 0) * 100) / 100;
  // A new volunteer sees no "0 / 0" (fix 11): the card comes with the first hours.
  if (hours <= 0 && !(+m.sessions > 0)) return null;
  const next = LEVELS.find((l) => hours < l) ?? null;
  const prev = [...LEVELS].reverse().find((l) => hours >= l) ?? 0;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((hours - prev) / (next - prev)) * 100))) : 100;
  const bar = h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct, "aria-label": t("homeBadgeBar") }, h("i", { class: `w${Math.round(pct / 5) * 5}` }));
  return h("section", { class: "card stats", id: "stats", "data-reward": "hours", "aria-labelledby": "stats-h" },
    h("h2", { class: "sr-only", id: "stats-h" }, t("homeStats")),
    h("div", { class: "stat-grid" },
      h("p", { class: "big-n", id: "home-hours" }, h("b", {}, String(hours)), h("span", {}, t("homeHours"))),
      h("p", { class: "big-n" }, h("b", {}, String(+m.sessions || 0)), h("span", {}, t("homeEvents")))),
    // what was done, then the next badge (fix 11: no "N more hours to")
    h("div", { class: "badge-next" }, icon("medal", 22),
      h("div", { class: "badge-next-t" }, h("p", {}, next ? t("homeBadgeNext", hoursN(hours), String(next)) : t("homeAllBadges")), bar)));
}
function impactCard(): HTMLElement | null {
  const x = (S.me?.mine ?? []).filter((m) => impactLine(m)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!x) return null;
  return h("section", { class: "card hl", "data-reward": "impact" }, icon("heart", 20), h("div", { class: "hl-t" }, h("p", { class: "hl-k" }, sessionName(x)), h("p", {}, impactLine(x))));
}
function teamCard(): HTMLElement | null {
  const tm = S.me?.team;
  if (!tm || !(Number(tm.hours) > 0)) return null;
  return h("section", { class: "card hl", id: "team-total", "data-reward": "team" }, icon("people", 20), h("div", { class: "hl-t" }, h("p", {}, t("teamYear", hoursN(tm.hours)))));
}
function skillsCard(): HTMLElement | null {
  const ar = document.documentElement.lang === "ar";
  for (const x of upcoming()) {
    const o = S.opps?.find((y) => y.id === x.id);
    const s = o ? (ar && o.skills_ar) || o.skills : null;
    if (s) return h("section", { class: "card hl", "data-reward": "skills" }, icon("spark", 20), h("div", { class: "hl-t" }, h("p", { class: "hl-k" }, t("lgSkills")), h("p", {}, s)));
  }
  return null;
}
const certCard = () => h("a", { class: "card hl hl-link", href: "#cert", id: "home-certs", "data-reward": "cert" }, icon("doc", 20),
  h("div", { class: "hl-t" }, h("p", { class: "hl-k" }, t("certTitle"))), icon("go", 18, true));
const MOTIVE: Record<string, string> = { cv: "cert", community: "impact", people: "team", learn: "skills", active: "hours" };

export function viewHome(main: HTMLElement): void {
  const m = S.me!;
  main.appendChild(h("h1", { class: "greet" }, greeting(m.name)));
  // Where they stand, when the next step cannot say it.
  const st = standing();
  if (st === "paused") main.appendChild(note(t("vdPaused")));
  else if (st === "ended") main.appendChild(note(t("vdExpired")));
  else if (st === "account") main.appendChild(note(t(m.account === "pwd" ? "vdAccountPwd" : "vdAccountDel")));

  const ns = nextStep();
  if (ns) main.appendChild(ns.el);

  const up = upcoming().filter((x) => x.id !== ns?.covers);
  if (up.length) {
    main.appendChild(nextCard(up[0]));
    if (up.length > 1) append(main, sec(t("homeLater")), h("div", { class: "list" }, ...up.slice(1).map((x) => shiftRow(x, false))));
  }

  const offers = (m.mine ?? []).filter((x) => x.status === "interested" && !x.cancelled && Date.parse(x.closes_at) > Date.now());
  if (offers.length) append(main, sec(t("homeOffers")), h("div", { class: "list" }, ...offers.map((x) => shiftRow(x, false))));

  const blocks: Record<string, HTMLElement | null> = { hours: statsCard(), impact: impactCard(), team: teamCard(), skills: skillsCard(), cert: certCard() };
  const order = ["hours", "impact", "team", "skills", "cert"];
  const first = MOTIVE[S.prof?.motive ?? ""];
  if (first) order.sort((a, b) => Number(b === first) - Number(a === first));
  const shown = order.map((k) => blocks[k]).filter(Boolean) as HTMLElement[];
  if (shown.length) main.appendChild(h("div", { class: "rewards-hl", id: "highlights" }, ...shown));

  const worked = eventsWorked(), extra = extraHours();
  if (worked.length || extra.length) {
    append(main, sec(t("homeRewards")), h("div", { class: "list", id: "rewards" }, ...worked.map(rewardRow),
      // hours staff added with no session: their own rows, so the cards add up to the total (fix 12)
      ...extra.map((x) => h("div", { class: "card reward extra", "data-extra": x.id },
        h("div", { class: "ev-main" }, h("p", { class: "ev-name" }, t("extraHours")), h("p", { class: "meta" }, `${dayLabel(x.on)} · ${hoursN(x.hours)}`))))));
  }

  const ahead = upcoming();
  const past = (m.mine ?? []).filter((x) => !ahead.includes(x) && !offers.includes(x) && x.id !== ns?.covers)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (past.length) append(main, sec(t("homePast")), h("div", { class: "list" }, ...past.map((x) => shiftRow(x, true))));
}
