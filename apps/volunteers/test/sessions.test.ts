import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gathers, ksaDay, sessionName, sessionNameEn, setLang, timesLabel } from "../src/client/i18n";

const lang = (code: string) => readFileSync(join(__dirname, "..", "src", "lang", `${code}.json`), "utf8");
beforeEach(() => { vi.stubGlobal("document", { documentElement: {} }); });
afterEach(async () => { await setLang("en"); vi.unstubAllGlobals(); });

describe("the Riyadh day of a moment the database wrote", () => {
  it("is the next day for anything between midnight and 3 a.m. in Riyadh (the database writes UTC)", () => {
    expect(ksaDay("2026-11-09T22:30:00+00:00")).toBe("2026-11-10");
    expect(ksaDay("2026-11-09T22:30:00.123456+00:00")).toBe("2026-11-10");
    expect(ksaDay("2026-12-31T21:00:00+00:00")).toBe("2027-01-01");
    expect(ksaDay("2026-11-10T08:00:00+00:00")).toBe("2026-11-10");
    expect(ksaDay("2026-11-10T01:30:00+03:00")).toBe("2026-11-10");
    expect(ksaDay(null)).toBe("");
  });
});

describe("a session that gathers (the booking app's _gathersTime)", () => {
  it("is the Saturday ride, the National Day ride, Run for Her, Victory Lap and the Farm House Night", () => {
    // the Farm House Night (2026-11-13): its arrival, then dinner, as the booking app's KIND_TRAITS farm gathers
    for (const k of ["saturday", "runher", "vlap", "farm", null]) expect(gathers({ ride_kind: k, event_kind: "community" }), String(k)).toBe(true);
    expect(gathers({ ride_kind: "snd96", event_kind: null })).toBe(true);
    for (const k of ["petromin", "swim", "workshop", "event", "arena", "defe5k", "blood", "yoga"]) expect(gathers({ ride_kind: k, event_kind: "community" }), k).toBe(false);
    expect(gathers({ ride_kind: null, event_kind: null })).toBe(false); // the circuit's own nights
  });
  it("names its two times as the gathering and the start, not a range", async () => {
    await setLang("en");
    expect(timesLabel("05:30 - 06:00", true)).toMatch(/^Gathering 5:30\sAM · Start 6:00\sAM$/u);
    expect(timesLabel("17:00 - 23:00")).toMatch(/^5:00\sPM – 11:00\sPM$/u);
  });
});

describe("the name a certificate is issued with", () => {
  it("is English whatever the page's language, and staff's own title as it is", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(lang("ar"), { status: 200 })));
    await setLang("ar");
    expect(sessionName({ title: null, ride_kind: "saturday" })).not.toBe("Saturday Social Ride");
    expect(sessionNameEn({ title: null, ride_kind: "saturday" })).toBe("Saturday Social Ride");
    expect(sessionNameEn({ title: "Founders Ride", ride_kind: "saturday" })).toBe("Founders Ride");
    expect(sessionNameEn({ title: null, ride_kind: null })).toBe("Jeddah Corniche Circuit");
    // yoga (2026-11-12), named as the booking app's _vol_sess_name names it
    expect(sessionNameEn({ title: null, ride_kind: "yoga" })).toBe("Hatha Yoga for Cyclists");
    expect(sessionName({ title: null, ride_kind: "yoga" })).toBe("هاثا يوغا لراكبي الدراجات");
    // the Farm House Night (2026-11-13), named as the booking app's _vol_sess_name names it (20261114130000), and staff's
    // own title as it is
    expect(sessionNameEn({ title: null, ride_kind: "farm" })).toBe("Farm House Night");
    expect(sessionName({ title: null, ride_kind: "farm" })).toBe("ليلة المزرعة");
    expect(sessionNameEn({ title: "Nawar Farm House Night", ride_kind: "farm" })).toBe("Nawar Farm House Night");
  });
});
