// My bookings: the venue's own requests, upcoming and past, with cancelling. A confirmed breakfast
// still ahead carries its brief (the ride's times, the riders booked now, who to call, the offer); a
// pending one says when MicroMobility answers and how many other venues asked for the date.

import { rpc } from "./api";
import { announce, app, busy, button, dialog, errorNote, note, t, tn } from "./app";
import { aheadDays, calendarRange, invalidateCalendar, STATUS_ICON } from "./calendar";
import { MM_PHONE, MM_PHONE_TEXT, waLink } from "./contact";
import { openFeedback, starRow } from "./feedback";
import { addDays, hijriLabel, longDate, num, type Iso } from "./dates";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { arrivalWindow, awaitingFeedback, awaitsFeedback, barClasses, BOOKING_KEY, canCancelSeries, cancellable, canRequest, clockText, commentGroups, feedbackOf, feedbackOpen, KIND_KEY, lateCancel, ratingText, reasonText, rideTimes, scoreText, sharedByBooking, sharedScores, staffNoteText, within48h, type CalDay, type Mine, type SharedRatings } from "./model";

type Row = { day: Iso; mine: Mine; riders: number | null; ride_time?: string | null; decide_by?: Iso | null; others_pending?: number | null };

/** The riders' shared breakfast ratings by booking id, for the screen being drawn. */
let shared = new Map<number, SharedRatings>();

const BOOKING_ICON = { pending: STATUS_ICON.requested, confirmed: STATUS_ICON.confirmed, declined: STATUS_ICON.taken, cancelled: "dash" } as const;

export async function renderBookings(main: HTMLElement): Promise<void> {
  const today = app.me!.today;
  clear(main);
  main.append(h("h1", {}, t("bookingsTitle")), h("p", { class: "loading", role: "status" }, t("loading")));
  // The calendar call is the one place a venue's own requests come from: read up to the plan's
  // horizon, 400 days a call. The riders' shared ratings come alongside; if that call fails the
  // section is simply left out.
  const [up, past, said] = await Promise.all([
    calendarRange(today, addDays(today, aheadDays(app.me!.tier.horizon_days))),
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
  const rows = (days: CalDay[]): Row[] => days.filter((d) => d.mine).map((d) => ({ day: d.day, mine: d.mine!, riders: d.riders, ride_time: d.ride_time, decide_by: d.decide_by, others_pending: d.others_pending }));
  const upcoming = rows(up.data || []);
  const before = rows(past.data || []).reverse();
  // Today's breakfast sits under Upcoming, so both answers are counted.
  const waiting = canRequest(app.me!.user.role) ? awaitingFeedback([...(up.data || []), ...(past.data || [])], today).length : 0;
  if (waiting) main.append(note("info", tn("fbBanner", waiting)));
  if (!canRequest(app.me!.user.role)) main.append(note("info", t("readOnlyNote")));
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
  const role = app.me!.user.role;
  const staff = m.staff_note ? staffNoteText(app.lang, m.staff_note) : "";
  const cancelNote = m.status === "cancelled"
    ? [m.cancelled_by === "mm" ? t("cancelledByMm") : "", m.late_cancel ? t("lateMark") : ""].filter(Boolean).join(" · ")
    : "";
  return h(
    "li",
    { class: `booking bs-${m.status}` },
    h("div", { class: "b-head" },
      h("div", {}, h("h3", {}, longDate(r.day, app.lang)), h("p", { class: "hijri" }, hijriLabel(r.day, app.lang))),
      h("span", { class: `chip bs-${m.status}` }, icon(BOOKING_ICON[m.status]), h("span", {}, t(BOOKING_KEY[m.status])))),
    h("p", { class: "b-meta" }, icon(m.kind === "recurring" ? "repeat" : "calendar"), h("span", {}, t(KIND_KEY[m.kind]))),
    (m.status === "confirmed" || m.status === "pending") && r.riders != null && !(m.status === "confirmed" && r.day >= today)
      ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, tn("ridersBooked", r.riders)))
      : null,
    m.status === "pending" && r.day >= today ? pendingInfo(r) : null,
    m.status === "confirmed" && r.day >= today ? brief(r) : null,
    cancelNote ? h("p", { class: `b-meta${m.late_cancel ? " b-late" : ""}` }, icon("alert"), h("span", {}, cancelNote)) : null,
    m.status === "cancelled" && m.cancel_reason
      ? h("p", { class: "b-note" }, h("strong", {}, `${t("reasonShown")}: `), m.cancel_reason === "closed" ? t("stClosed") : reasonText(app.lang, m.cancel_reason))
      : null,
    staff ? h("p", { class: "b-note" }, h("strong", {}, `${t("mmNote")}: `), staff) : null,
    m.note ? h("p", { class: "b-note" }, h("strong", {}, `${t("yourNote")}: `), m.note) : null,
    canRequest(role) ? feedbackBlock(main, r) : feedbackGiven(r),
    ridersSaid(r),
    cancellable(r.day, m, today) && canRequest(role)
      ? h("div", { class: "actions" }, button(t("cancel"), { kind: "danger", small: true, onclick: () => cancelDialog(main, r) }))
      : null,
  );
}

/** A request still waiting: when MicroMobility answers, and how many other venues want the date. */
function pendingInfo(r: Row): HTMLElement {
  const n = Number(r.others_pending) || 0;
  return h("div", { class: "b-pending" },
    r.decide_by ? h("p", { class: "b-meta" }, icon("clock"), h("span", {}, t("decideBy", { date: longDate(r.decide_by, app.lang) }))) : null,
    n > 0 ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, tn("otherVenues", n))) : null);
}

/** The breakfast brief on a confirmed date still ahead: the ride's times and when riders arrive, the
 *  riders booked now, MicroMobility's number for the day, and the offer riders were promised. */
function brief(r: Row): HTMLElement {
  const v = app.me!.venue;
  const L = app.lang;
  const times = rideTimes(r.ride_time);
  const arrive = times ? arrivalWindow(times.start) : null;
  const offer = ((L === "ar" ? v.offer_ar || v.offer_en : v.offer_en || v.offer_ar) || "").trim();
  const id = uid("brief");
  const waText = `${longDate(r.day, L)} - ${L === "ar" && v.name_ar ? v.name_ar : v.name}`;
  return h("section", { class: "brief", "aria-labelledby": id },
    h("h4", { id }, t("briefTitle")),
    h("ul", { class: "brief-list" },
      h("li", {}, icon("clock"), times
        ? h("span", {}, t("briefTimes", { gather: clockText(L, times.gather), start: clockText(L, times.start) }),
          arrive ? h("span", { class: "brief-arrive" }, ` ${t("briefArrive", { from: clockText(L, arrive[0]), to: clockText(L, arrive[1]) })}`) : null)
        : h("span", {}, t("briefNoTime"))),
      r.riders != null ? h("li", {}, icon("users"), h("span", {}, tn("ridersBooked", r.riders))) : null,
      h("li", {}, icon("phone"), h("span", {}, `${t("briefContact")} `),
        h("a", { href: `tel:${MM_PHONE}`, dir: "ltr" }, MM_PHONE_TEXT), " · ",
        h("a", { href: waLink(waText), target: "_blank", rel: "noopener" }, t("forgotWhatsApp"))),
      h("li", {}, icon("star"), offer
        ? h("span", {}, h("strong", {}, `${t("briefOffer")} `), h("bdi", {}, offer))
        : h("span", { class: "hint" }, t("briefNoOffer")))));
}

/** The feedback given, read only (a viewer's login). */
function feedbackGiven(r: Row): HTMLElement | null {
  const f = feedbackOf(r.mine);
  if (!f) return null;
  return h("div", { class: "fb-given" },
    h("p", { class: "fb-rating" }, starRow(f.rating), h("span", {}, t("fbYourRating", { rating: ratingText(app.lang, f.rating) }))),
    f.turnout != null ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, t("fbRidersCame", { n: num(f.turnout, app.lang) }))) : null);
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
    n > 0 ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, tn("srRiders", n))) : null,
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
  if (m.series_id && canCancelSeries(app.me!.user.role)) {
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
  // Inside 48 hours a reason is required and the cancel counts as late (the policy says so here).
  const late48 = within48h(r.day, m);
  if (late48) body.append(note("warn", t("late48")));
  else if (lateCancel(r.day, m, me.today, me.tier)) body.append(note("warn", t("lateWarning", { days: tn("days", me.tier.cancel_cutoff_days) })));
  if (m.status === "confirmed") body.append(h("p", { class: "hint policy" }, t("cancelPolicy")));
  const rid = uid("reason");
  const errId = `${rid}-err`;
  const reason = h("textarea", { id: rid, maxlength: 300, rows: 2, required: late48, "aria-describedby": errId });
  const reasonErr = h("p", { class: "field-error", id: errId });
  body.append(h("div", { class: "field" }, h("label", { for: rid }, late48 ? t("cancelReasonRequired") : t("cancelReason")), reason, reasonErr));
  const msg = h("div", { class: "msg" });
  const go = button(t("confirmCancel"), { kind: "danger" });
  go.addEventListener("click", async () => {
    clear(msg);
    reasonErr.textContent = "";
    reason.removeAttribute("aria-invalid");
    if (late48 && !reason.value.trim()) {
      reasonErr.textContent = t("errLateReason");
      reason.setAttribute("aria-invalid", "true");
      reason.focus();
      return;
    }
    busy(go, true, t("sending"));
    const res = await rpc<number>("vendor_cancel", { p_booking: m.id, p_reason: reason.value.slice(0, 300), p_series: series });
    busy(go, false, t("confirmCancel"));
    if (!res.ok) { msg.append(errorNote(res.code)); return; }
    const n = Number(res.data) || 0;
    dlg.close();
    invalidateCalendar();
    announce(tn("datesCancelled", n));
    void renderBookings(main);
  });
  body.append(msg, h("div", { class: "actions" }, button(t("keepIt"), { kind: "ghost", onclick: dlg.close }), go));
}
