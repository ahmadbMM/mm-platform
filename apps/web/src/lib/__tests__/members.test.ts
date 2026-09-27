import { describe, expect, it } from "vitest";
import { announcementsOf, isBirthday, memberArea } from "../members";

// The members' area reads member_area's answer and shows a member their own membership only.
const full = {
  ok: true, member: true, first_name: "Sara", since: "2026-03-01T10:00:00+00:00", credits: 240, tier: 1, next: 500, rides: 12, group_rides: 4,
  last: [{ date: "2026-09-20", title: "", kind: "saturday", rated: true }, { date: "2026-09-13", title: "Founders ride", kind: "saturday", rated: false }, { date: "bad", title: "x" }],
  upcoming: [{ id: "2026-10-04", date: "2026-10-04", title: "", kind: "saturday", time: "05:45 - 06:15", booked: true }, { id: "no;pe", date: "2026-10-11" }, { id: "2026-10-18-ev", date: "2026-10-18", title: "Talk", kind: "event", time: null, booked: false }],
  birth_date: "1990-09-27",
  announcements: [{ text: { en: "Hello", ar: "أهلاً" }, cta: { en: "Store", ar: "المتجر" }, href: { href: "/store" } }],
};

describe("memberArea", () => {
  it("reads a member's area, dropping rows it cannot show", () => {
    const a = memberArea({ status: 200, data: full, message: "" });
    expect(a).toMatchObject({ ok: true, member: true, firstName: "Sara", credits: 240, tier: 1, next: 500, rides: 12, groupRides: 4, birthDate: "1990-09-27" });
    if (!a.ok || !a.member) throw new Error("not a member");
    expect(a.last).toEqual([{ date: "2026-09-20", title: "", kind: "saturday", rated: true }, { date: "2026-09-13", title: "Founders ride", kind: "saturday", rated: false }]);
    expect(a.upcoming.map((u) => u.id)).toEqual(["2026-10-04", "2026-10-18-ev"]);
    expect(a.upcoming[0]).toMatchObject({ time: "05:45 - 06:15", booked: true });
    expect(a.upcoming[1]).toMatchObject({ kind: "event", time: null, booked: false });
    expect(memberArea({ status: 200, data: { ...full, tier: 7, credits: "12", birth_date: null }, message: "" })).toMatchObject({ tier: 0, credits: 12, birthDate: null });
  });
  it("knows a signed-in visitor who is not a member, a session that is not accepted, and a database without the function", () => {
    expect(memberArea({ status: 200, data: { ok: true, member: false, first_name: "Omar" }, message: "" })).toEqual({ ok: true, member: false, firstName: "Omar" });
    expect(memberArea({ status: 200, data: { ok: false, error: "denied" }, message: "" })).toEqual({ ok: false, error: "signin" });
    expect(memberArea({ status: 404, data: null, message: "Could not find the function public.member_area" })).toEqual({ ok: false, error: "unavailable" });
    expect(memberArea({ status: 0, data: null, message: "" })).toEqual({ ok: false, error: "unavailable" });
    expect(memberArea({ status: 200, data: [], message: "" })).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("isBirthday", () => {
  it("matches the month and day, in Riyadh's today", () => {
    expect(isBirthday("1990-09-27", "2026-09-27")).toBe(true);
    expect(isBirthday("1990-09-27", "2026-09-28")).toBe(false);
    expect(isBirthday(null, "2026-09-27")).toBe(false);
    expect(isBirthday("1990-09-27", "")).toBe(false);
  });
});

describe("announcementsOf", () => {
  it("reads the announcement bar's list in the page's language", () => {
    expect(announcementsOf(full.announcements, "en")).toEqual([{ text: "Hello", cta: "Store", href: "/store" }]);
    expect(announcementsOf(full.announcements, "ar")).toEqual([{ text: "أهلاً", cta: "المتجر", href: "/store" }]);
    expect(announcementsOf(full.announcements, "fr")[0].text).toBe("Hello"); // no translation for a staff text: the English
    expect(announcementsOf([{ text: { en: " ", ar: "" } }, null, "x"], "en")).toEqual([]);
    expect(announcementsOf("nothing", "en")).toEqual([]);
    expect(announcementsOf([{ text: { en: "Bad link", ar: "" }, href: { href: "javascript:alert(1)" } }], "en")).toEqual([{ text: "Bad link", cta: "", href: "" }]);
  });
});
