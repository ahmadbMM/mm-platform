// One shift's pieces, shared by Home, the opportunity and the work page: the calendar, the briefing tick, "I can no longer
// help" with its reasons, "Still coming?", the plan prompt, what staff wrote for the day, the Today card and the close-out
// (the enhancements, rentals 20261111140000). Each new piece shows only when volunteer_me sends its field: a database
// without them draws the shift as before.

import { rpc } from "./api";
import { eventsWorked, getCert, shareCert } from "./certs";
import { h, uid } from "./dom";
import { currentLang, dayLabel, gathers, hoursN, ksaToday, sessionName, sessionNameEn, t, timeLabel, timesLabel, type Key } from "./i18n";
import { calEventOf, googleCalUrl, startOf } from "./ics";
import { icon } from "./icons";
import { BOOKING, load, myShift, noteErr, render, S, setQuiet, type Logistics, type Mine, type Opp, type Reward } from "./state";
import { button, chip, copyText, dateBlock, dialog, fact, iconButton, link, metaLine, pills, telLink } from "./ui";

export const mapsLink = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
const httpsOnly = (u: string | null | undefined) => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : null);

const day = (x: { date: string }) => String(x.date).slice(0, 10);
/** The day a week ago in Riyadh, YYYY-MM-DD. */
const weekAgo = () => new Date(Date.now() + 3 * 3600000 - 7 * 86400000).toISOString().slice(0, 10);

/** Worked: finished, or arrived on a day that is over. */
export const isDone = (x: Mine) => !x.cancelled && (x.status === "done" || (x.status === "accepted" && (!!x.clock_out || (!!x.clock_in && day(x) < ksaToday()))));
/** Accepted, not finished and not called off: still to come (or under way). */
export const isAhead = (x: Mine) => x.status === "accepted" && !x.cancelled && !x.clock_out && Date.parse(x.closes_at) > Date.now() && day(x) >= ksaToday();
export const isToday = (x: Mine) => isAhead(x) && day(x) === ksaToday();
/** Worked in the last seven days: its close-out still leads Home. */
export const recentDone = (): Mine[] => (S.me?.mine ?? []).filter((x) => isDone(x) && day(x) >= weekAgo() && day(x) <= ksaToday()).sort((a, b) => day(b).localeCompare(day(a)));

/** The next opportunity this volunteer could say yes to: open for sign-up, not yet theirs. */
export function nextOpp(): Opp | null {
  return (S.opps ?? []).filter((o) => o.signup_open && !myShift(o.id) && day(o) >= ksaToday()).sort((a, b) => day(a).localeCompare(day(b)))[0] ?? null;
}

// ── the briefing ──
/** "I have read the briefing" (20261107131000): staff see it on their list; a new briefing clears it. */
export function briefTick(id: string): HTMLElement | null {
  if (!S.prof) return null;
  if (S.prof.briefed[id]) return h("div", { class: "chips" }, chip(t("briefDone"), "on", "tick"));
  const tid = `brief-${id}`;
  return h("label", { class: "tick", for: tid },
    h("input", { type: "checkbox", id: tid, onchange: ((e: Event) => { (e.target as HTMLInputElement).disabled = true; void briefAck(id); }) as EventListener }), h("span", {}, t("briefRead")));
}
async function briefAck(id: string): Promise<void> {
  const r = await rpc<{ briefed_at: string }>("volunteer_brief_ack", { p_session: id });
  if (!r.ok) { noteErr(r); render(); return; }
  if (S.prof) S.prof.briefed[id] = r.data?.briefed_at || new Date().toISOString();
  render();
}
export const briefBox = (x: { id: string; briefing: string | null }) =>
  x.briefing ? h("div", { class: "brief" }, h("p", { class: "brief-h" }, t("vdBriefing")), h("p", { class: "brief-t" }, x.briefing), briefTick(x.id)) : null;

// ── the calendar: the Worker's file (with the two reminders) or Google Calendar ──
export function calAsk(x: Mine): void {
  const ev = calEventOf(x, sessionName(x), gathers(x));
  const file = `/cal/${encodeURIComponent(x.id)}.ics?name=${encodeURIComponent(ev.title)}`;
  const box: HTMLDialogElement = dialog(t("addToCal"), [h("div", { class: "menu" },
    link(t("calApp"), file, "secondary", "cal", { id: "cal-file" }),
    link(t("calGoogle"), googleCalUrl(ev), "secondary", "link", { id: "cal-google", target: "_blank", rel: "noopener" }))],
  [button(t("close"), () => box.close(), "quiet")], "ask-menu");
  for (const a of box.querySelectorAll(".menu a")) a.addEventListener("click", () => window.setTimeout(() => { if (box.open) box.close(); }, 300));
}
export const calButton = (x: Mine, attrs: Record<string, string> = {}) => button(t("addToCal"), () => calAsk(x), "secondary", attrs, "cal");

// ── I can no longer help: an accepted place is asked about first, with a reason the volunteer may give ──
const WD = ["sick", "clash", "travel", "transport", "other"] as const;
export function withdrawAsk(x: Mine): void {
  let reason: string | null = null;
  const box: HTMLDialogElement = dialog(t("wdQ", sessionName(x)),
    [pills("wd", t("wdWhy"), WD.map((v) => ({ value: v, label: t(`wd_${v}` as Key) })), null, (v) => { reason = v; }, "wd-why")],
    [button(t("wdKeep"), () => box.close(), "secondary", { id: "wd-keep" }),
      button(t("withdrawBtn"), async () => { await withdraw(x, reason); if (box.open) box.close(); }, "danger", { id: "wd-yes" })], "ask-wd");
}
async function withdraw(x: Mine, reason: string | null): Promise<void> {
  let r = await rpc<{ status: string }>("volunteer_coming", { p_session: x.id, p_yes: false, p_reason: reason });
  // a database from before 20261111140000: the old way out, without a reason
  if (!r.ok && r.code === "NOT_BUILT") r = await rpc<{ status: string }>("volunteer_interest", { p_session: x.id, p_on: false, p_role: null, p_message: null });
  if (!r.ok) { noteErr(r); await load(); render(); return; }
  setQuiet(t("withdrawn"));
  await load();
  render();
}

// ── Still coming? (from 48 hours before) ──
export async function comingYes(x: Mine): Promise<void> {
  const r = await rpc<{ coming_at: string }>("volunteer_coming", { p_session: x.id, p_yes: true });
  if (!r.ok) { noteErr(r); render(); return; }
  x.coming_at = r.data?.coming_at || new Date().toISOString();
  setQuiet(t("comingYes"));
  render();
}
export const needsComing = (x: Mine) => isAhead(x) && "coming_at" in x && !x.coming_at && startOf(x) - Date.now() <= 48 * 3600000;

// ── the plan: "What time will you leave?" (one optional question; skipped is remembered on this phone) ──
const SKIP_KEY = "mm_vol_plan_skip";
let skippedNow: string[] = [];
function skipped(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SKIP_KEY) || "[]") as unknown; return Array.isArray(v) ? v.map(String).concat(skippedNow) : skippedNow; } catch { return skippedNow; }
}
export function skipPlan(id: string): void {
  skippedNow = [...skippedNow, id];
  try { localStorage.setItem(SKIP_KEY, JSON.stringify(skipped().slice(-20))); } catch { /* blocked storage: this visit only */ }
  render();
}
export const needsPlan = (x: Mine) => isAhead(x) && "plan_leave" in x && !x.plan_leave && !skipped().includes(x.id);
async function savePlan(x: Mine, value: string): Promise<void> {
  const r = await rpc<{ plan_leave: string | null }>("volunteer_plan", { p_session: x.id, p_leave: value || null });
  if (!r.ok) { noteErr(r); render(); return; }
  x.plan_leave = r.data?.plan_leave ?? (value || null);
  setQuiet(t("applySaved"));
  render();
}
/** The question as a field: a time and Save; on Home also Skip. */
export function planForm(x: Mine, skip = false): HTMLFormElement {
  const id = uid("leave");
  const input = h("input", { id, type: "time", value: x.plan_leave ?? "", class: "plan-time" });
  const form = h("form", { class: "plan", onsubmit: ((e: Event) => { e.preventDefault(); const b = form.querySelector<HTMLButtonElement>(".plan-save"); if (b) b.click(); }) as EventListener },
    h("label", { for: id }, t("planQ")),
    h("div", { class: "plan-row" }, input,
      button(t("applySave"), () => savePlan(x, input.value), skip ? "primary" : "secondary", { class: `btn btn-${skip ? "primary" : "secondary"} plan-save` }),
      skip ? button(t("planSkip"), () => skipPlan(x.id), "quiet", { id: "plan-skip" }) : null));
  return form;
}

// ── what staff wrote for the day ──
const ar = () => currentLang() === "ar";
export function logistics(x: Logistics & { location?: string | null; partner?: string | null; partner_ar?: string | null; skills?: string | null; skills_ar?: string | null }): HTMLElement | null {
  const map = httpsOnly(x.meet_map);
  const rows = [
    x.meet_point ? fact("pin", t("lgMeet"), x.meet_point, map ? h("a", { class: "fact-link", href: map, target: "_blank", rel: "noopener" }, t("lgMap")) : null) : null,
    !x.meet_point && map ? fact("pin", t("lgMeet"), h("a", { class: "fact-link", href: map, target: "_blank", rel: "noopener" }, t("lgMap"))) : null,
    x.bring ? fact("bag", t("lgBring"), x.bring) : null,
    x.provided ? fact("cup", t("lgProvided"), x.provided) : null,
    x.shirt_pickup ? fact("shirt", t("lgShirt"), x.shirt_pickup) : null,
    x.demands ? fact("sun", t("lgDemands"), x.demands) : null,
    (ar() && x.partner_ar) || x.partner ? fact("people", t("lgPartner"), (ar() && x.partner_ar) || x.partner || "") : null,
    (ar() && x.skills_ar) || x.skills ? fact("spark", t("lgSkills"), (ar() && x.skills_ar) || x.skills || "") : null,
  ].filter(Boolean) as HTMLElement[];
  return rows.length ? h("div", { class: "facts-list" }, ...rows) : null;
}
/** The staff contact for the day (the owner's decision 7: staff, never another volunteer). */
export const contactFact = (x: Mine) => (x.contact_name || x.contact_phone
  ? fact("phone", t("lgContact"), x.contact_name ?? "", x.contact_phone ? telLink(x.contact_phone, t("vdCall", x.contact_name ?? "")) : null) : null);

// ── the Today card: everything for the day on one card ──
export function todayCard(x: Mine): HTMLElement {
  const map = httpsOnly(x.meet_map);
  const acts: HTMLElement[] = [];
  if (x.can_work) acts.push(link(t("startWork"), `#work/${encodeURIComponent(x.id)}`, "primary", "go", { id: "today-work" }));
  if (map || x.location) acts.push(link(t("directions"), map ?? mapsLink(x.location ?? ""), "secondary", "pin", { target: "_blank", rel: "noopener" }));
  return h("section", { class: "card next today", id: "next-step", "data-step": "today", "aria-labelledby": "today-h" },
    h("div", { class: "next-top" }, dateBlock(x.date, true),
      h("div", { class: "next-what" },
        h("p", { class: "kicker" }, t("todayKicker")),
        h("h2", { id: "today-h" }, sessionName(x)),
        h("div", { class: "chips" }, chip(t("stAccepted"), "on", "tick"), x.lead ? chip(t("leadMark"), "lead", "flag") : null))),
    h("div", { class: "metas" },
      x.time ? metaLine("clock", timesLabel(x.time, gathers(x))) : null,
      x.role ? metaLine("person", t("roleIs", x.role)) : null,
      !x.meet_point && x.location ? metaLine("pin", x.location) : null,
      x.clock_in ? metaLine("tick", t("vdArrivedAt", timeLabel(x.clock_in)), "meta-go") : null),
    h("div", { class: "facts-list" }, x.meet_point ? fact("pin", t("lgMeet"), x.meet_point, map ? h("a", { class: "fact-link", href: map, target: "_blank", rel: "noopener" }, t("lgMap")) : null) : null,
      contactFact(x)),
    briefBox(x),
    acts.length ? h("div", { class: "acts acts-pair" }, ...acts) : null);
}

// ── the close-out: thanks, what the evening did, the hours, the certificate, the badge, the free ride, the team's note,
// how it was, and what is next ──
export function impactLine(x: Mine): string {
  const i = x.impact;
  if (!i) return "";
  if (x.ride_kind === "blood" && i.donated != null && i.donated > 0) return t("impactBlood", i.donated);
  return i.checked_in > 0 ? t("impactIn", i.checked_in) : "";
}
export function rewardBox(r: Reward): HTMLElement {
  let copy: HTMLButtonElement | null = null;
  if (!r.used) { const b: HTMLButtonElement = iconButton("copy", t("copyCode"), () => copyText(r.code, b, t("copied")), { class: "btn btn-icon code-copy" }); copy = b; }
  return h("div", { class: `code-box${r.used ? " is-used" : ""}` }, h("span", { class: "code-ic" }, icon("gift", 20)),
    h("div", { class: "code-t" }, h("span", { class: "code-k" }, t("freeRide")), h("span", { class: "code", dir: "ltr" }, r.code),
      h("span", { class: "code-sub" }, r.used ? t("codeUsed") : t("codeUseBy", dayLabel(r.expires_at))),
      !r.used ? h("a", { class: "code-book", href: `${BOOKING}/`, rel: "noopener" }, t("bookRide"), icon("go", 14, true)) : null),
    copy);
}
const hoursOf = (x: Mine) => eventsWorked().find((e) => e.id === x.id)?.hours || Number(x.cert?.hours) || 0;
export function closeoutParts(x: Mine, withNext: boolean): HTMLElement[] {
  const impact = impactLine(x), hours = hoursOf(x), worked = hours > 0 || !!x.reward || !!x.cert;
  const next = withNext ? nextOpp() : null;
  const certActs = worked ? h("div", { class: "acts acts-pair" },
    button(t("certGet"), () => getCert(x.id, sessionNameEn(x)), "secondary", { class: "btn btn-secondary co-cert" }, "doc"),
    button(t("certShare"), () => shareCert(x.id, sessionNameEn(x)), "secondary", { class: "btn btn-secondary co-share" }, "share")) : null;
  return [
    impact ? h("p", { class: "impact" }, icon("heart", 18), h("span", {}, impact)) : null,
    hours > 0 ? h("p", { class: "big-n co-hours" }, h("b", {}, hoursN(hours)), h("span", {}, t("coGave"))) : null,
    x.thanks?.note ? h("figure", { class: "thanks-note" }, h("figcaption", {}, t("coFromTeam")), h("blockquote", {}, x.thanks.note)) : null,
    x.reward ? rewardBox(x.reward) : null,
    worked ? h("div", { class: "badge-line" }, icon("medal", 20), h("span", {}, t("coBadge")),
      h("a", { href: `${BOOKING}/account/badges`, rel: "noopener" }, t("coBadges"), icon("go", 14, true))) : null,
    certActs,
    ratingBox(x),
    next ? h("a", { class: "co-next", href: `#o/${encodeURIComponent(next.id)}`, id: "co-next" }, icon("hand", 18),
      h("span", {}, t("coNext", sessionName(next), dayLabel(next.date))), icon("go", 16, true)) : null,
  ].filter(Boolean) as HTMLElement[];
}

export function closeoutCard(x: Mine): HTMLElement {
  return h("section", { class: "card next closeout", id: "next-step", "data-step": "closeout", "aria-labelledby": "co-h" },
    h("div", { class: "next-top" }, dateBlock(x.date, true),
      h("div", { class: "next-what" }, h("p", { class: "kicker" }, t("coKicker")), h("h2", { id: "co-h" }, t("coThanks", sessionName(x))))),
    ...closeoutParts(x, true));
}

// ── How was it? Optional, never in the way of the certificate (the owner's decision 6) ──
export const canRate = (x: Mine) => "feedback" in x && !x.cancelled && (x.status === "done" || (x.status === "accepted" && !!x.clock_in && day(x) < ksaToday()));
const SCALE = [1, 2, 3, 4, 5];
/** One step of the five, drawn: a bar a little taller than the one before. */
function stepMark(n: number): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "28");
  svg.setAttribute("height", "28");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ic step-mark");
  const hgt = 4 + n * 3.2;
  svg.innerHTML = `<rect x="7" y="${(21 - hgt).toFixed(1)}" width="10" height="${hgt.toFixed(1)}" rx="3"/>`; // numbers of our own, never text
  return svg;
}
export function ratingBox(x: Mine): HTMLElement | null {
  if (!canRate(x)) return null;
  if (x.feedback) {
    return h("div", { class: "rate rate-done", id: `rate-${x.id}` }, icon("heart", 18),
      h("p", {}, t("rateThanks")), h("span", { class: "chip chip-on" }, t(`rate${x.feedback.rating}` as Key)));
  }
  let rating = 0, again: string | null = null;
  const marks: HTMLLabelElement[] = [];
  const scale = h("fieldset", { class: "scale" }, h("legend", {}, t("rateQ")),
    h("div", { class: "scale-row" }, ...SCALE.map((n) => {
      const id = uid(`rate${n}`);
      const lab = h("label", { for: id, class: "scale-step", title: t(`rate${n}` as Key) }, stepMark(n), h("span", { class: "sr-only" }, t(`rate${n}` as Key)));
      marks.push(lab);
      return h("span", { class: "scale-one" },
        h("input", { type: "radio", name: `rate-${x.id}`, id, value: n, onchange: (() => {
          rating = n;
          marks.forEach((m, i) => m.classList.toggle("on", i < n));
          send.disabled = false;
          picked.textContent = t(`rate${n}` as Key);
        }) as EventListener }), lab);
    })),
    h("div", { class: "scale-ends", "aria-hidden": "true" }, h("span", {}, t("rate1")), h("span", {}, t("rate5"))));
  const picked = h("p", { class: "scale-picked", "aria-live": "polite" });
  const cid = uid("say");
  const comment = h("textarea", { id: cid, rows: 2, maxlength: 500 });
  const send = button(t("rateSend"), async () => {
    if (!rating) return;
    const r = await rpc("volunteer_feedback", { p_session: x.id, p_rating: rating, p_again: again, p_comment: comment.value.trim() || null });
    if (!r.ok) { noteErr(r); render(); return; }
    x.feedback = { rating, again };
    setQuiet(t("rateThanks"));
    render();
  }, "secondary", { id: `rate-send-${x.id}`, class: "btn btn-secondary rate-send", disabled: "" });
  return h("div", { class: "rate", id: `rate-${x.id}` }, scale, picked,
    pills(`again-${x.id}`, t("againQ"), [{ value: "yes", label: t("againYes") }, { value: "maybe", label: t("againMaybe") }, { value: "no", label: t("againNo") }], null, (v) => { again = v; }),
    h("div", { class: "field" }, h("label", { for: cid }, t("rateSay")), comment), send);
}

/** A decline's reason, as the volunteer reads it (the owner's decision 9: staff may give one from a fixed list). */
export function reasonWord(code: unknown): string {
  const k: Record<string, Key> = { full: "reasonFull", age: "reasonAge", timing: "reasonTiming", profile: "reasonProfile", other: "reasonOther" };
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(k, code) ? t("reasonIs", t(k[code])) : "";
}
