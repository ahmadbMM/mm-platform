import { describe, expect, it } from "vitest";
import { awaitingFeedback, awaitsFeedback, errorKey, feedbackOf, feedbackOpen, ratingText, turnoutValue, type CalDay, type Feedback, type Mine } from "../src/client/model";
import { STRINGS } from "../src/client/strings";

const today = "2026-10-03";
const base: Mine = { id: 1, status: "confirmed", kind: "single", series_id: null, note: "", staff_note: "" };
const given: Feedback = { booking_id: 1, venue_id: 3, day: "2026-09-26", rating: 4, turnout: 9, went_well: "", improve: "", created_at: "", updated_at: "" };
const day = (d: string, mine: Mine | null): CalDay => ({ day: d, state: "open", reason: "", mine, taken: false, riders: 12 });

describe("feedback window", () => {
  it("is open only for a confirmed breakfast the database says is open, from the day itself", () => {
    expect(feedbackOpen("2026-09-26", { ...base, feedback_open: true }, today)).toBe(true);
    expect(feedbackOpen(today, { ...base, feedback_open: true }, today)).toBe(true);
    expect(feedbackOpen("2026-10-10", { ...base, feedback_open: true }, today)).toBe(false); // not yet
    expect(feedbackOpen("2026-09-26", { ...base, feedback_open: false }, today)).toBe(false); // closed
    expect(feedbackOpen("2026-09-26", { ...base, status: "pending", feedback_open: true }, today)).toBe(false);
    expect(feedbackOpen("2026-09-26", { ...base, status: "cancelled", feedback_open: true }, today)).toBe(false);
    expect(feedbackOpen("2026-09-26", null, today)).toBe(false);
  });

  it("tolerates an older database that sends neither field", () => {
    expect(feedbackOf(base)).toBeNull();
    expect(feedbackOpen("2026-09-26", base, today)).toBe(false);
    expect(awaitsFeedback("2026-09-26", base, today)).toBe(false);
    expect(feedbackOf({ ...base, feedback: null })).toBeNull();
    expect(feedbackOf({ ...base, feedback: given })).toEqual(given);
    expect(feedbackOf(undefined)).toBeNull();
  });

  it("knows which breakfasts are waiting for feedback", () => {
    const open = { ...base, feedback_open: true };
    const days = [
      day("2026-09-12", { ...base, id: 2, feedback_open: false }), // window closed
      day("2026-09-19", { ...open, id: 3, feedback: given }), // already given
      day("2026-09-26", { ...open, id: 4 }), // waiting
      day(today, { ...open, id: 5, feedback: null }), // the day itself: waiting
      day("2026-10-10", { ...base, id: 6, status: "pending" }),
      day("2026-10-17", null),
      day("2026-09-05", { ...base, id: 7 }), // older database
    ];
    expect(awaitingFeedback(days, today).map((d) => d.mine!.id)).toEqual([4, 5]);
    expect(awaitsFeedback("2026-09-19", { ...open, feedback: given }, today)).toBe(false);
    expect(feedbackOpen("2026-09-19", { ...open, feedback: given }, today)).toBe(true); // still editable
  });
});

describe("feedback words", () => {
  it("names each rating, in both languages with Western digits", () => {
    expect(ratingText("en", 1)).toBe("1 – Poor");
    expect(ratingText("en", 5)).toBe("5 – Excellent");
    expect(ratingText("ar", 4)).toBe(STRINGS.ar.fbRate4);
    expect(ratingText("ar", 4)).toMatch(/^4 /);
    expect(ratingText("en", 9)).toBe("9");
  });

  it("reads the turnout box: empty or a whole number from 0 to 1000", () => {
    expect(turnoutValue("")).toEqual({ ok: true, value: null });
    expect(turnoutValue("  ")).toEqual({ ok: true, value: null });
    expect(turnoutValue("0")).toEqual({ ok: true, value: 0 });
    expect(turnoutValue(" 18 ")).toEqual({ ok: true, value: 18 });
    expect(turnoutValue("1000")).toEqual({ ok: true, value: 1000 });
    for (const bad of ["1001", "-1", "2.5", "1e3", "ten"]) expect(turnoutValue(bad).ok, bad).toBe(false);
  });

  it("words the database's refusals", () => {
    expect(STRINGS.en[errorKey("TOO_LATE")]).toBe("Feedback for this breakfast has closed.");
    expect(errorKey("TOO_EARLY")).toBe("errTooEarly");
    expect(errorKey("NOT_CONFIRMED")).toBe("errNotConfirmed");
    expect(errorKey("BAD_RATING")).toBe("errRating");
    expect(errorKey("NOT_FOUND")).toBe("errNotFound");
  });
});
