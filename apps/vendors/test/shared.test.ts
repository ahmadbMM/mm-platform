import { describe, expect, it } from "vitest";
import { barClasses, commentGroups, scoreText, sharedByBooking, sharedScores, type SharedRatings } from "../src/client/model";
import { fmt, STRINGS } from "../src/client/strings";

const entry = (over: Partial<SharedRatings> = {}): SharedRatings => ({
  booking_id: 4, day: "2026-09-26", riders: 9, averages: {}, comments: [], shared_at: "2026-09-28T10:00:00Z", ...over,
});

describe("what riders said", () => {
  it("keys the shared entries by booking and ignores anything malformed", () => {
    const m = sharedByBooking([entry(), { booking_id: "x" }, null, entry({ booking_id: 6 })]);
    expect([...m.keys()]).toEqual([4, 6]);
    expect(sharedByBooking(null).size).toBe(0);
    expect(sharedByBooking({ booking_id: 4 }).size).toBe(0);
  });

  it("shows only the averages present, in question order, inside 1-10 with one decimal", () => {
    const s = entry({ averages: { bf_service: 7, bf_food: 8.44, breakfast: 9.25 } });
    expect(sharedScores(s)).toEqual([
      { key: "breakfast", label: "srBreakfast", value: 9.3 },
      { key: "bf_food", label: "srFood", value: 8.4 },
      { key: "bf_service", label: "srService", value: 7 },
    ]);
    expect(sharedScores(entry({ averages: { bf_food: 12, bf_service: 0.2, bf_restaurant: Number.NaN } })).map((x) => x.value)).toEqual([10, 1]);
    expect(sharedScores(entry({ averages: null as unknown as SharedRatings["averages"] }))).toEqual([]);
  });

  it("sizes the bar with two classes, never an inline style", () => {
    expect(barClasses(8.4)).toEqual(["bw-8", "bt-4"]);
    expect(barClasses(10)).toEqual(["bw-10", "bt-0"]);
    expect(barClasses(1)).toEqual(["bw-1", "bt-0"]);
    expect(barClasses(6.96)).toEqual(["bw-7", "bt-0"]);
  });

  it("writes the score with one decimal and Western digits", () => {
    expect(scoreText("en", 8)).toBe("8.0");
    expect(scoreText("en", 8.4)).toBe("8.4");
    expect(scoreText("ar", 8.4)).toMatch(/^8.4$/);
    expect(fmt("en", "srScore", { label: fmt("en", "srFood"), score: scoreText("en", 8.4) })).toBe("Food 8.4 / 10");
  });

  it("groups the comments by question, known questions first, and drops empty ones", () => {
    const s = entry({ comments: [
      { k: "bf_service", text: "Slow coffee" },
      { k: "zz_new", text: "Something new" },
      { k: "breakfast", text: "  " },
      { k: "bf_food", text: "Great eggs" },
      { k: "bf_service", text: " Friendly staff " },
    ] });
    expect(commentGroups(s)).toEqual([
      { k: "bf_food", label: "srFood", texts: ["Great eggs"] },
      { k: "bf_service", label: "srService", texts: ["Slow coffee", "Friendly staff"] },
      { k: "zz_new", label: "srOther", texts: ["Something new"] },
    ]);
    expect(commentGroups(entry({ comments: undefined as unknown as SharedRatings["comments"] }))).toEqual([]);
  });

  it("has every label in both languages", () => {
    for (const k of ["srTitle", "srRiders", "srRidersOne", "srBreakfast", "srRestaurant", "srAtmosphere", "srFood", "srService", "srOther", "srAnonymous"] as const) {
      expect(STRINGS.en[k]).toBeTruthy();
      expect(STRINGS.ar[k]).toBeTruthy();
    }
    expect(STRINGS.en.srBreakfast).toBe("Breakfast overall");
  });
});
