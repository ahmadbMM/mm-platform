// The breakfast calendar: a month grid on wide screens, a list of dates on phones.

import { rpc } from "./api";
import { announce, app, button, errorNote, isRtl, t } from "./app";
import { openBooking } from "./book";
import { openFeedback } from "./feedback";
import { addDays, addMonths, arrowStep, hijriLabel, hijriMonthTitle, longDate, monthGrid, monthRange, monthStart, num, shortDate, type Iso } from "./dates";
import { clear, h } from "./dom";
import { icon, type IconName } from "./icons";
import { awaitsFeedback, dayStatus, reasonText, STATUS_KEY, type CalDay, type DayStatus } from "./model";

export const STATUS_ICON: Record<DayStatus, IconName> = {
  available: "open",
  requested: "clock",
  confirmed: "check",
  taken: "taken",
  closed: "closed",
  not_open: "dash",
  past: "dash",
  soon: "clock",
  far: "dash",
};

const state = {
  month: "" as Iso,
  days: new Map<Iso, CalDay>(),
  loadedFor: "" as Iso,
  focus: "" as Iso,
  error: "",
};

/** Opens the feedback dialog for a day's own booking; the calendar reloads after a save. */
function askFeedback(main: HTMLElement, entry: CalDay): void {
  openFeedback({ day: entry.day, mine: entry.mine!, riders: entry.riders }, () => { state.loadedFor = ""; void renderCalendar(main); });
}

/** Forget the loaded month (after a booking or a cancel). */
export function invalidateCalendar(): void {
  state.loadedFor = "";
}

function ridersText(n: number): string {
  return n === 1 ? t("oneRiderBooked") : t("ridersBooked", { n: num(n, app.lang) });
}

function statusWords(st: DayStatus, entry: CalDay | undefined): string {
  if (st === "closed" && entry?.reason) return t("closedReason", { reason: reasonText(app.lang, entry.reason) });
  if (st === "soon") return t("vTooSoon", { n: num(app.me!.tier.min_lead_days, app.lang) });
  return t(STATUS_KEY[st]);
}

export async function renderCalendar(main: HTMLElement): Promise<void> {
  const me = app.me!;
  if (!state.month) state.month = monthStart(me.today);
  if (!state.focus) state.focus = me.today;
  if (state.loadedFor !== state.month) {
    clear(main);
    main.append(h("p", { class: "loading", role: "status" }, t("loading")));
    const month = state.month;
    const { from, to } = monthRange(month);
    const r = await rpc<CalDay[]>("vendor_calendar", { p_from: from, p_to: to });
    // Moved to another month while this one loaded: that month's own call draws the page.
    if (month !== state.month) return;
    state.days = new Map();
    state.error = "";
    if (r.ok) {
      for (const d of r.data || []) state.days.set(d.day, d);
      state.loadedFor = month;
    } else {
      state.error = r.code;
    }
  }
  draw(main);
}

function go(main: HTMLElement, month: Iso, focus?: Iso): void {
  state.month = monthStart(month);
  state.focus = focus || (state.month === monthStart(app.me!.today) ? app.me!.today : state.month);
  void renderCalendar(main).then(() => {
    const btn = main.querySelector<HTMLButtonElement>(`.cal-grid button[data-day="${state.focus}"]`);
    if (btn && btn.offsetParent !== null && focus) btn.focus();
  });
}

function draw(main: HTMLElement): void {
  const me = app.me!;
  const today = me.today;
  clear(main);

  const head = h(
    "div",
    { class: "page-head" },
    h("div", {}, h("h1", {}, t("calendarTitle")), h("p", { class: "lede" }, t("calendarIntro"))),
    button(t("bookButton"), { kind: "primary", icon: "calendar", onclick: () => openBooking() }),
  );

  const title = h("div", { class: "cal-title" },
    h("h2", { id: "cal-month", "aria-live": "polite" }, monthTitleText()),
    h("p", { class: "hijri" }, hijriMonthTitle(state.month, app.lang)));
  const toolbar = h(
    "div",
    { class: "cal-toolbar" },
    h("button", { type: "button", class: "icon-btn", "aria-label": t("prevMonth"), onclick: () => go(main, addMonths(state.month, -1)) }, icon(isRtl() ? "next" : "prev")),
    title,
    h("button", { type: "button", class: "icon-btn", "aria-label": t("nextMonth"), onclick: () => go(main, addMonths(state.month, 1)) }, icon(isRtl() ? "prev" : "next")),
    button(t("today"), { small: true, onclick: () => go(main, today, today) }),
  );

  const legend = h(
    "ul",
    { class: "legend", "aria-label": t("legend") },
    ...(["available", "requested", "confirmed", "taken", "closed", "not_open"] as DayStatus[]).map((s) =>
      h("li", { class: `chip st-${s}` }, icon(STATUS_ICON[s]), h("span", {}, t(STATUS_KEY[s])))),
  );

  main.append(head, toolbar);
  if (state.error) {
    main.append(errorNote(state.error), button(t("retry"), { onclick: () => { state.loadedFor = ""; void renderCalendar(main); } }));
    return;
  }
  main.append(grid(main, today), list(main, today), legend);
}

function monthTitleText(): string {
  return new Intl.DateTimeFormat(`${app.lang === "ar" ? "ar-SA" : "en-GB"}-u-ca-gregory-nu-latn`, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${state.month}T00:00:00Z`));
}

function grid(main: HTMLElement, today: Iso): HTMLElement {
  const names = t("weekdaysShort").split(",");
  const weeks = monthGrid(state.month);
  const inMonth = (d: Iso) => d.slice(0, 7) === state.month.slice(0, 7);
  if (!inMonth(state.focus)) state.focus = inMonth(today) ? today : state.month;

  const g = h("div", { class: "cal-grid", role: "grid", "aria-labelledby": "cal-month" });
  g.append(h("div", { role: "row", class: "cal-row cal-names" }, ...names.map((n, i) => h("div", { role: "columnheader", class: i === 6 ? "sat" : "" }, n))));
  for (const week of weeks) {
    const row = h("div", { role: "row", class: "cal-row" });
    for (const day of week) {
      if (!day) { row.append(h("div", { role: "gridcell", class: "cal-cell empty" })); continue; }
      const entry = state.days.get(day);
      const st = dayStatus(day, entry, today, app.me!.tier);
      const words = statusWords(st, entry);
      const riders = st === "confirmed" && entry?.riders != null ? ridersText(entry.riders) : "";
      const fb = !!entry && awaitsFeedback(day, entry.mine, today);
      const label = [longDate(day, app.lang), words, riders, fb ? `${t("fbMarker")}: ${t("fbWaiting")}` : "", day === today ? t("today") : ""].filter(Boolean).join(", ");
      const btn = h(
        "button",
        {
          type: "button",
          class: `cal-day st-${st}${day === today ? " is-today" : ""}`,
          "data-day": day,
          tabindex: day === state.focus ? 0 : -1,
          "aria-label": label,
          onclick: () => (fb ? askFeedback(main, entry!) : activate(day, st)),
        },
        h("span", { class: "d-num" }, num(Number(day.slice(8)), app.lang)),
        h("span", { class: "d-hijri" }, hijriLabel(day, app.lang)),
        st === "not_open" ? null : h("span", { class: "d-status" }, icon(STATUS_ICON[st]), h("span", {}, t(STATUS_KEY[st]))),
        riders ? h("span", { class: "d-riders" }, icon("users"), h("span", {}, num(entry!.riders!, app.lang))) : null,
        fb ? h("span", { class: "d-feedback" }, icon("star"), h("span", {}, t("fbMarker"))) : null,
      );
      row.append(h("div", { role: "gridcell", class: "cal-cell" }, btn));
    }
    g.append(row);
  }
  g.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const day = target.getAttribute?.("data-day");
    if (!day) return;
    let next: Iso | null = null;
    const step = arrowStep(e.key, isRtl());
    if (step) next = addDays(day, step);
    else if (e.key === "Home") next = addDays(day, -new Date(`${day}T00:00:00Z`).getUTCDay());
    else if (e.key === "End") next = addDays(day, 6 - new Date(`${day}T00:00:00Z`).getUTCDay());
    else if (e.key === "PageUp") next = addMonths(day, -1);
    else if (e.key === "PageDown") next = addMonths(day, 1);
    if (!next) return;
    e.preventDefault();
    if (!inMonth(next)) { go(main, next, next); return; }
    state.focus = next;
    g.querySelectorAll<HTMLButtonElement>("button[data-day]").forEach((b) => { b.tabIndex = b.dataset.day === next ? 0 : -1; });
    g.querySelector<HTMLButtonElement>(`button[data-day="${next}"]`)?.focus();
  });
  return g;
}

function activate(day: Iso, st: DayStatus): void {
  state.focus = day;
  if (st === "available") openBooking(day);
  else if (st === "requested" || st === "confirmed") location.hash = "#bookings";
  else announce(`${longDate(day, app.lang)}: ${t(STATUS_KEY[st])}`);
}

function list(main: HTMLElement, today: Iso): HTMLElement {
  const days = [...state.days.values()].filter((d) => d.day.slice(0, 7) === state.month.slice(0, 7)).sort((a, b) => a.day.localeCompare(b.day));
  const ol = h("ol", { class: "cal-list" });
  if (!days.length) {
    ol.append(h("li", { class: "empty-row" }, t("noDatesMonth")));
    return ol;
  }
  for (const entry of days) {
    const st = dayStatus(entry.day, entry, today, app.me!.tier);
    const riders = st === "confirmed" && entry.riders != null ? ridersText(entry.riders) : "";
    const fb = awaitsFeedback(entry.day, entry.mine, today);
    ol.append(
      h(
        "li",
        { class: `cal-item st-${st}${entry.day === today ? " is-today" : ""}` },
        h("div", { class: "ci-date" }, h("strong", {}, shortDate(entry.day, app.lang)), h("span", { class: "hijri" }, hijriLabel(entry.day, app.lang))),
        h("div", { class: "ci-status" },
          h("span", { class: `chip st-${st}` }, icon(STATUS_ICON[st]), h("span", {}, statusWords(st, entry))),
          riders ? h("span", { class: "ci-riders" }, icon("users"), h("span", {}, riders)) : null),
        fb
          ? h("button", { type: "button", class: "btn btn-primary btn-small fb-marker", "aria-label": `${t("fbMarker")}: ${shortDate(entry.day, app.lang)}`, onclick: () => askFeedback(main, entry) },
            icon("star"), h("span", {}, t("fbMarker")))
          : st === "available"
          ? button(t("requestThis"), { small: true, kind: "primary", onclick: () => openBooking(entry.day) })
          : st === "requested" || st === "confirmed"
            ? h("a", { class: "btn btn-ghost btn-small", href: "#bookings" }, h("span", {}, t("navBookings")))
            : null,
      ),
    );
  }
  return ol;
}

/** The available dates in a range (the booking dialog's pickers). */
export async function loadRange(from: Iso, to: Iso): Promise<{ ok: true; days: CalDay[] } | { ok: false; code: string }> {
  const r = await rpc<CalDay[]>("vendor_calendar", { p_from: from, p_to: to });
  return r.ok ? { ok: true, days: r.data || [] } : { ok: false, code: r.code };
}
