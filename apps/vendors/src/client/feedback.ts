// The venue's feedback after a breakfast: a 1-5 rating, how many riders came, and two short
// answers. Opened from My bookings and from the calendar; saving again within the window edits it.

import { rpc } from "./api";
import { announce, app, busy, button, dialog, errorNote, field, isRtl, note, t } from "./app";
import { hijriLabel, longDate, num, type Iso } from "./dates";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { feedbackOf, RATINGS, ratingText, turnoutValue, type Feedback, type Mine } from "./model";

export type FeedbackTarget = { day: Iso; mine: Mine; riders: number | null };

const TEXT_MAX = 1000;

/** Five small stars, the first n filled (decorative; the words say the rating). */
export function starRow(n: number): HTMLElement {
  return h("span", { class: "stars", "aria-hidden": "true" }, ...RATINGS.map((i) => icon("star", `icon star${i <= n ? " on" : ""}`)));
}

/** The rating as a radiogroup of five star buttons: one tab stop, arrows move and choose. */
function ratingPicker(initial: number, labelId: string): { el: HTMLElement; value: () => number; setError: (msg: string) => void; focus: () => void } {
  let value = initial;
  const errId = uid("rating-err");
  const err = h("p", { class: "field-error", id: errId });
  const words = h("p", { class: "rating-words", "aria-hidden": "true" });
  const group = h("div", { class: "rating", role: "radiogroup", "aria-labelledby": labelId, "aria-required": "true", "aria-describedby": errId });
  const stars = RATINGS.map((n) =>
    h("button", { type: "button", role: "radio", class: "star-btn", "aria-label": ratingText(app.lang, n), "data-n": n, onclick: () => choose(n, false) }, icon("star", "icon star")));
  group.append(...stars);

  function draw(): void {
    stars.forEach((b, i) => {
      const n = i + 1;
      b.setAttribute("aria-checked", String(n === value));
      b.tabIndex = n === (value || 1) ? 0 : -1;
      b.classList.toggle("on", n <= value);
    });
    words.textContent = value ? ratingText(app.lang, value) : t("fbNoRating");
  }
  function choose(n: number, focus: boolean): void {
    value = n;
    err.textContent = "";
    group.removeAttribute("aria-invalid");
    draw();
    if (focus) stars[n - 1].focus();
  }
  group.addEventListener("keydown", (e) => {
    const cur = value || 1;
    const fwd = isRtl() ? "ArrowLeft" : "ArrowRight";
    const back = isRtl() ? "ArrowRight" : "ArrowLeft";
    let next = 0;
    if (e.key === fwd || e.key === "ArrowDown") next = cur >= 5 ? 1 : cur + 1;
    else if (e.key === back || e.key === "ArrowUp") next = cur <= 1 ? 5 : cur - 1;
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else if (e.key === " " || e.key === "Enter") {
      const n = Number((e.target as HTMLElement).getAttribute?.("data-n") || 0);
      if (n) { e.preventDefault(); choose(n, true); }
      return;
    }
    if (!next) return;
    e.preventDefault();
    choose(next, true);
  });
  draw();
  return {
    el: h("div", { class: "rating-wrap" }, group, words, err),
    value: () => value,
    setError(msg: string) {
      err.textContent = msg;
      if (msg) group.setAttribute("aria-invalid", "true");
      else group.removeAttribute("aria-invalid");
    },
    focus: () => stars[(value || 1) - 1].focus(),
  };
}

/** Opens the feedback dialog for one breakfast; onSaved runs once the dialog closes after a save. */
export function openFeedback(target: FeedbackTarget, onSaved: () => void): void {
  const before: Feedback | null = feedbackOf(target.mine);
  const dlg = dialog(t("fbTitle"));
  const body = dlg.body;
  let saved = false;
  dlg.el.addEventListener("close", () => { if (saved) onSaved(); }, { once: true });

  const context = h("div", { class: "fb-context" },
    h("p", { class: "fb-date" }, h("strong", {}, longDate(target.day, app.lang)), " ", h("span", { class: "hijri" }, hijriLabel(target.day, app.lang))),
    target.riders != null
      ? h("p", { class: "b-meta" }, icon("users"), h("span", {}, target.riders === 1 ? t("oneRiderBooked") : t("ridersBooked", { n: num(target.riders, app.lang) })))
      : null);

  const ratingLabel = uid("rating");
  const rating = ratingPicker(before?.rating ?? 0, ratingLabel);
  const ratingField = h("div", { class: "field" }, h("p", { class: "label", id: ratingLabel }, t("fbRatingLabel")), rating.el);

  const turnout = field({ label: t("fbTurnout"), name: "turnout", type: "number", inputmode: "numeric", min: "0", max: "1000", hint: t("fbOptional"), value: before?.turnout != null ? String(before.turnout) : "" });
  turnout.input.setAttribute("step", "1");
  const well = field({ label: t("fbWentWell"), name: "went_well", multiline: true, maxlength: TEXT_MAX, hint: t("fbOptional"), value: before?.went_well || "" });
  const better = field({ label: t("fbImprove"), name: "improve", multiline: true, maxlength: TEXT_MAX, hint: t("fbOptional"), value: before?.improve || "" });

  const msg = h("div", { class: "msg" });
  const sendLabel = before ? t("fbSaveChanges") : t("fbSend");
  const send = button(sendLabel, { kind: "primary", type: "submit" });
  const form = h("form", { class: "fb-form", novalidate: true },
    ratingField, turnout.wrap, well.wrap, better.wrap,
    h("p", { class: "hint" }, t("fbEditWindow")),
    msg,
    h("div", { class: "actions" }, button(t("close"), { kind: "ghost", onclick: dlg.close }), send));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(msg);
    let bad = false;
    const r = rating.value();
    rating.setError("");
    turnout.setError("");
    if (!r) { rating.setError(t("errRating")); bad = true; }
    // A number box holding something that is not a number reads as "" with badInput set.
    const tv = (turnout.input as HTMLInputElement).validity?.badInput ? ({ ok: false } as const) : turnoutValue(turnout.input.value);
    if (!tv.ok) { turnout.setError(t("errTurnout")); bad = true; }
    if (bad) {
      if (!r) rating.focus();
      else turnout.input.focus();
      return;
    }
    busy(send, true, t("sending"));
    const res = await rpc<Feedback>("vendor_feedback_save", {
      p_booking: target.mine.id,
      p_rating: r,
      p_turnout: tv.ok ? tv.value : null,
      p_went_well: well.input.value.slice(0, TEXT_MAX),
      p_improve: better.input.value.slice(0, TEXT_MAX),
    });
    busy(send, false, sendLabel);
    if (!res.ok) { msg.append(errorNote(res.code)); return; }
    saved = true;
    clear(body);
    const done = button(t("done"), { kind: "primary", onclick: dlg.close });
    body.append(note("ok", t("fbThanks")), h("div", { class: "actions" }, done));
    done.focus();
    announce(t("fbThanks"));
  });

  body.append(context, form);
  rating.focus();
}
