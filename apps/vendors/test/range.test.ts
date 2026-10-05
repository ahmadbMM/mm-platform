import { afterEach, describe, expect, it, vi } from "vitest";
import { aheadDays, calendarRange, CAL_SPAN } from "../src/client/calendar";
import { addDays, spans } from "../src/client/dates";

// vendor_calendar answers BAD_RANGE when its two dates are more than 400 days apart, and plans allow a
// horizon of up to 730: bookings past 400 days were never read, so never seen or cancellable. The
// portal reads up to the plan's horizon in calls of 400 days at most.
const days = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

describe("spans", () => {
  it("cuts a range into consecutive pieces at most 400 days apart, covering it exactly", () => {
    const parts = spans("2026-10-05", addDays("2026-10-05", 730), CAL_SPAN);
    expect(parts).toEqual([["2026-10-05", "2027-11-09"], ["2027-11-10", "2028-10-04"]]);
    for (const [a, b] of parts) expect(days(a, b)).toBeLessThanOrEqual(400);
    for (let i = 1; i < parts.length; i++) expect(parts[i][0]).toBe(addDays(parts[i - 1][1], 1));
    expect(parts[0][0]).toBe("2026-10-05");
    expect(parts.at(-1)![1]).toBe(addDays("2026-10-05", 730));
  });

  it("keeps a short range whole, and gives nothing for a range that ends before it starts", () => {
    expect(spans("2026-10-05", "2026-10-05", 400)).toEqual([["2026-10-05", "2026-10-05"]]);
    expect(spans("2026-10-05", addDays("2026-10-05", 400), 400)).toEqual([["2026-10-05", "2027-11-09"]]);
    expect(spans("2026-10-05", addDays("2026-10-05", 401), 400)).toEqual([["2026-10-05", "2027-11-09"], ["2027-11-10", "2027-11-10"]]);
    expect(spans("2026-10-05", "2026-10-04", 400)).toEqual([]);
  });

  it("reads at least the 400 days one call covers, and the plan's horizon past them", () => {
    expect([aheadDays(60), aheadDays(365), aheadDays(400), aheadDays(730)]).toEqual([400, 400, 400, 730]);
  });
});

describe("calendarRange", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks once per piece and answers one list in order; one refusal is the answer", async () => {
    const asked: { p_from: string; p_to: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)) as { p_from: string; p_to: string };
      asked.push(b);
      if (days(b.p_from, b.p_to) > 400) return new Response(JSON.stringify({ error: "BAD_INPUT" }), { status: 400 });
      return new Response(JSON.stringify([{ day: b.p_from }, { day: b.p_to }]), { status: 200 });
    }));
    const r = await calendarRange("2026-10-05", addDays("2026-10-05", 730));
    expect(r).toEqual({ ok: true, data: [{ day: "2026-10-05" }, { day: "2027-11-09" }, { day: "2027-11-10" }, { day: "2028-10-04" }] });
    expect(asked).toHaveLength(2);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "SERVER" }), { status: 502 })));
    expect(await calendarRange("2026-10-05", addDays("2026-10-05", 730))).toEqual({ ok: false, code: "SERVER", status: 502 });
  });
});
