import { afterEach, describe, expect, it, vi } from "vitest";
import { upcoming } from "../src/client/home";
import { canRate, isAhead, isDone, isToday } from "../src/client/shift";
import { S, type Me, type Mine } from "../src/client/state";

const shift = (o: Partial<Mine>): Mine => ({
  id: "s1", title: "Night", ride_kind: "event", date: "2026-11-20", time: null, location: null, status: "accepted", role: null,
  clock_in: null, clock_out: null, opens_at: null, closes_at: "2026-11-20T19:00:00Z", briefing: null, can_work: false, ...o,
} as Mine);

afterEach(() => { vi.useRealTimers(); S.me = null; });

describe("a shift that runs past midnight (21:00 to 01:00, cut-off 01:00 Riyadh)", () => {
  // 01:00 on the 21st in Riyadh is 22:00 UTC on the 20th
  const night = shift({ clock_in: "2026-11-20T18:00:00Z", can_work: true, closes_at: "2026-11-20T22:00:00Z" });

  it("is still today's and under way at 00:10, not worked yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T21:10:00Z")); // 00:10 on the 21st in Riyadh
    expect(isDone(night)).toBe(false);
    expect(isAhead(night)).toBe(true);
    expect(isToday(night)).toBe(true);
    expect(canRate(night)).toBe(false);
  });

  it("is worked once its cut-off has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T22:05:00Z")); // 01:05
    expect(isDone(night)).toBe(true);
    expect(isAhead(night)).toBe(false);
  });

  it("a day shift is worked from the next day, as before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T06:00:00Z"));
    const day = shift({ clock_in: "2026-11-20T06:00:00Z", closes_at: "2026-11-20T12:00:00Z" });
    expect(isDone(day)).toBe(true);
    expect(isAhead(day)).toBe(false);
  });
});

describe("two shifts on one day", () => {
  it("come in the order they start, whatever order volunteer_me sends them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T06:00:00Z"));
    const evening = shift({ id: "a", starts_at: "2026-11-20T14:00:00Z", closes_at: "2026-11-20T20:00:00Z" });
    const morning = shift({ id: "b", starts_at: "2026-11-20T03:00:00Z", closes_at: "2026-11-20T08:00:00Z" });
    const later = shift({ id: "c", date: "2026-11-21", starts_at: "2026-11-21T03:00:00Z", closes_at: "2026-11-21T08:00:00Z" });
    S.me = { id: "v1", name: "Sara", hours: 0, account: null, status: "active", agreed: true, mine: [later, evening, morning] } as unknown as Me;
    expect(upcoming().map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
