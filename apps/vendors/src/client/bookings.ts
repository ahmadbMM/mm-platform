// My bookings: the venue's own requests, upcoming and past, with cancelling.

import { rpc } from "./api";
import { announce, app, busy, button, dialog, errorNote, note, t } from "./app";
import { invalidateCalendar, STATUS_ICON } from "./calendar";
import { openFeedback, starRow } from "./feedback";
import { addDays, hijriLabel, longDate, num, type Iso } from "./dates";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { awaitingFeedback, awaitsFeedback, barClasses, BOOKING_KEY, cancellable, commentGroups, feedbackOf, feedbackOpen, KIND_KEY, lateCancel, ratingText, scoreText, sharedByBooking, sharedScores, staffNoteText, type CalDay, type Mine, type SharedRatings } from "./model";

type Row = { day: Iso; mine: Mine; riders: number | null };

/** The riders' shared breakfast ratings by booking id, for the screen being drawn. */
let shared = new Map<number, SharedRatings>();

const BOOKING_ICON = { pending: STATUS_ICON.requested, confirmed: STATUS_ICON.confirmed, declined: STATUS_ICON.taken, cancelled: "dash" } as const;

export async function renderBookings(main: HTMLElement): Promise<void> {
  const today = app.me!.today;
  clear(main);
  main.append(h("h1", {}, t("bookingsTitle")), h("p", { class: "loading", role: "status" }, t("loading")));
  // The calendar call is the one place a venue's own requests come from; it takes 400 days at most.
  // The riders' shared ratings come alongside; if that call fails the section is simply left out.
  const [up, past, said] = await Promise.all([
    rpc<CalDay[]>("vendor_calendar", { p_from: today, p_to: addDays(today, 400) }),
    rpc<CalDay[]>("vendor_calendar", { p_from: addDays(today, -365), p_to: addDays(today, -1) }),
    rpc<SharedRatings[]>("vendor_shared_ratings_mine"),
  ]);
  shared = said.ok ? sharedByBooking(said.data) : new Map();
  clear(main);
  main.append(h("h1", {}, t("bookingsTitle")));
  if (!up.ok || !past.ok) {
    main.append(errorNote(!up.ok ? up.code : (past as { code: string }).code), button(t("retry"), { onclick: () => void renderBookings(main) }));
    return;
  }
  const rows = (days: CalDay[]) => days.filter((d) => d.mine).map((d) => ({ day: d.day, mine: d.mine!, riders: d.riders }));
  const upcoming = rows(up.data || []);
  const before = rows(past.data || []).reverse();
  // Today's breakfast sits under Upcoming, so both answers are counted.
  const waiting = awaitingFeedback([...(up.data || []), ...(past.data || [])], today).length;
  if (waiting) main.append(note("info", waiting === 1 ? t("fbBannerOne") : t("fbBanner", { n: num(waiting, app.lang) })));
  main.append(section(main, t("upcoming"), upcoming, t("noUpcoming")), section(main, t("past"), before, t("noPast")));
}

function section(main: HTMLElement, title: string, rows: Row[], empty: string): HTMLElement {
  const id = uid("sec");
  const ul = h("ul", { class: "bookings" });
  if (!rows.length) ul.append(h("li", { class: "empty-row" }, empty));
  for (const r of rows) ul.append(card(main, r));
  return h("section", { "aria-labelledby": id }, h("h2", { id }, title), ul);
}

function card(main: HTMLElement, r: Row): HTMLElement {
  const today = app.me!.today;
  const m = r.mine;
  const staff = m.staff_note ? staffNoteText(app.lang, m.staff_note) : "";
  return h(
    "li",
    { class: `booking bs-${m.status}` },
    h("div", { class: "b-head" },
      h("div", {}, h("h3", {}, longDate(r.day, app.lang)), h("p", { class: "hijri" }, hijriLabel(r.day, app.lang))),
      h("span", { class: `chip bs-${m.status}` }, icon(BOOKING_ICON[m.status]), h("span", {}, t(BOOKING_KEY[m.status])))),
    h("p", { class: "b-meta" }, icon(m.kind === "recurring" ? "repeat" : "calendar"), h("span", {}, t(KIND_KEY[m.kind]))),
    m.status === "confirmed" && r.riders != null
      ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, r.riders === 1 ? t("oneRiderBooked") : t("ridersBooked", { n: num(r.riders, app.lang) })))
      : null,
    staff ? h("p", { class: "b-note" }, h("strong", {}, `${t("mmNote")}: `), staff) : null,
    m.note ? h("p", { class: "b-note" }, h("strong", {}, `${t("yourNote")}: `), m.note) : null,
    feedbackBlock(main, r),
    ridersSaid(r),
    cancellable(r.day, m, today)
      ? h("div", { class: "actions" }, button(t("cancel"), { kind: "danger", small: true, onclick: () => cancelDialog(main, r) }))
      : null,
  );
}

/** After the breakfast: the button asking for feedback, or the rating given (editable while open). */
function feedbackBlock(main: HTMLElement, r: Row): HTMLElement | null {
  const today = app.me!.today;
  const after = () => { invalidateCalendar(); void renderBookings(main); };
  if (awaitsFeedback(r.day, r.mine, today)) {
    return h("div", { class: "actions fb-ask" }, button(t("fbHowDidItGo"), { kind: "primary", icon: "star", onclick: () => openFeedback(r, after) }));
  }
  const f = feedbackOf(r.mine);
  if (!f) return null;
  return h("div", { class: "fb-given" },
    h("p", { class: "fb-rating" }, starRow(f.rating), h("span", {}, t("fbYourRating", { rating: ratingText(app.lang, f.rating) }))),
    f.turnout != null ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, t("fbRidersCame", { n: num(f.turnout, app.lang) }))) : null,
    feedbackOpen(r.day, r.mine, today)
      ? h("div", { class: "actions" }, button(t("fbEdit"), { small: true, icon: "star", onclick: () => openFeedback(r, after) }))
      : null);
}

/** "What riders said": the averages out of 10 with a bar each, then the comments by question.
 *  Only on a past confirmed breakfast that MicroMobility shared. */
function ridersSaid(r: Row): HTMLElement | null {
  const s = shared.get(r.mine.id);
  if (!s || r.mine.status !== "confirmed" || r.day >= app.me!.today) return null;
  const scores = sharedScores(s);
  const groups = commentGroups(s);
  if (!scores.length && !groups.length) return null;
  const id = uid("said");
  const n = Number(s.riders) || 0;
  return h("section", { class: "said", "aria-labelledby": id },
    h("h4", { id }, t("srTitle")),
    n > 0 ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, n === 1 ? t("srRidersOne") : t("srRiders", { n: num(n, app.lang) }))) : null,
    scores.length
      ? h("ul", { class: "said-scores" }, ...scores.map((sc) => h("li", { class: "said-score" },
        h("span", { class: "said-label" }, t("srScore", { label: t(sc.label), score: scoreText(app.lang, sc.value) })),
        h("span", { class: "said-bar", "aria-hidden": "true" }, h("span", { class: `said-fill ${barClasses(sc.value).join(" ")}` })))))
      : null,
    ...groups.map((g) => h("div", { class: "said-group" },
      h("h5", {}, t(g.label)),
      h("ul", { class: "said-quotes" }, ...g.texts.map((text) => h("li", {}, h("blockquote", {}, text)))))),
    h("p", { class: "hint" }, t("srAnonymous")));
}

function cancelDialog(main: HTMLElement, r: Row): void {
  const me = app.me!;
  const m = r.mine;
  const dlg = dialog(t("cancelTitle"));
  let series = false;
  const body = dlg.body;
  body.append(h("p", { class: "lede" }, longDate(r.day, app.lang)));
  if (m.series_id) {
    const name = uid("scope");
    const fs = h("fieldset", { class: "modes" }, h("legend", { class: "sr-only" }, t("cancelTitle")));
    for (const [val, key] of [[false, "cancelOne"], [true, "cancelSeries"]] as const) {
      const id = uid("c");
      const input = h("input", { type: "radio", name, id, checked: series === val });
      input.addEventListener("change", () => { series = val; });
      fs.append(h("div", { class: "mode" }, input, h("label", { for: id }, h("span", {}, t(key)))));
    }
    body.append(fs);
  }
  if (lateCancel(r.day, m, me.today, me.tier)) body.append(note("warn", t("lateWarning", { n: me.tier.cancel_cutoff_days })));
  const rid = uid("reason");
  const reason = h("textarea", { id: rid, maxlength: 300, rows: 2 });
  body.append(h("div", { class: "field" }, h("label", { for: rid }, t("cancelReason")), reason));
  const msg = h("div", { class: "msg" });
  const go = button(t("confirmCancel"), { kind: "danger" });
  go.addEventListener("click", async () => {
    clear(msg);
    busy(go, true, t("sending"));
    const res = await rpc<number>("vendor_cancel", { p_booking: m.id, p_reason: reason.value.slice(0, 300), p_series: series });
    busy(go, false, t("confirmCancel"));
    if (!res.ok) { msg.append(errorNote(res.code)); return; }
    const n = Number(res.data) || 0;
    dlg.close();
    invalidateCalendar();
    announce(n === 1 ? t("cancelledOne") : t("cancelled", { n }));
    void renderBookings(main);
  });
  body.append(msg, h("div", { class: "actions" }, button(t("keepIt"), { kind: "ghost", onclick: dlg.close }), go));
}
