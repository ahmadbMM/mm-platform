import { describe, expect, it } from "vitest";
import { dayOptions, riyadhClock, timesFor } from "../workshop-days";

const TIMES = ["15:00", "17:00", "19:00", "21:00"];

describe("riyadhClock", () => {
  it("reads the wall clock in Riyadh (UTC+3), across midnight", () => {
    expect(riyadhClock(new Date("2026-09-24T12:05:00Z"))).toBe("2026-09-24T15:05");
    expect(riyadhClock(new Date("2026-09-24T22:30:00Z"))).toBe("2026-09-25T01:30");
  });
});

describe("timesFor", () => {
  it("offers every time on a later day", () => {
    expect(timesFor("2026-09-26", "2026-09-24T20:00", TIMES)).toEqual(TIMES);
  });
  it("offers only times at least an hour ahead today", () => {
    expect(timesFor("2026-09-24", "2026-09-24T16:10", TIMES)).toEqual(["19:00", "21:00"]);
    expect(timesFor("2026-09-24", "2026-09-24T16:00", TIMES)).toEqual(["17:00", "19:00", "21:00"]);
  });
});

describe("dayOptions", () => {
  it("starts today while a time is still ahead, and skips Fridays when closed", () => {
    // 2026-09-24 is a Thursday; the 25th is a Friday.
    expect(dayOptions("2026-09-24T10:00", 3, true, TIMES, 22)).toEqual(["2026-09-24", "2026-09-26", "2026-09-27"]);
    expect(dayOptions("2026-09-24T10:00", 3, false, TIMES, 22)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
  });
  it("starts tomorrow once today's last time has passed", () => {
    expect(dayOptions("2026-09-24T20:30", 2, true, TIMES, 22)[0]).toBe("2026-09-26");
    expect(dayOptions("2026-09-23T20:30", 2, true, TIMES, 22)[0]).toBe("2026-09-24");
  });
  it("with no times listed, uses an hour before closing", () => {
    expect(dayOptions("2026-09-24T20:59", 1, false, [], 22)).toEqual(["2026-09-24"]);
    expect(dayOptions("2026-09-24T21:01", 1, false, [], 22)).toEqual(["2026-09-25"]);
  });
  it("rolls over month ends", () => {
    expect(dayOptions("2026-09-30T23:00", 2, false, TIMES, 22)).toEqual(["2026-10-01", "2026-10-02"]);
  });
});
