import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { makeL } from "@/i18n/tx";
import { announcementsOf, isBirthday, memberArea } from "../members";
import { genderBlock, genderChip, genderText, type SessionGender } from "../session-gender";

// The members' area reads member_area's answer and shows a member their own membership only.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
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
  it("greets someone born on 29 February on the 28th when the year has no 29th", () => {
    expect(isBirthday("2000-02-29", "2027-02-28")).toBe(true);
    expect(isBirthday("2000-02-29", "2027-03-01")).toBe(false);
    expect(isBirthday("2000-02-29", "2028-02-28")).toBe(false);
    expect(isBirthday("2000-02-29", "2028-02-29")).toBe(true);
    expect(isBirthday("1999-02-28", "2027-02-28")).toBe(true);
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

describe("the member area's counts", () => {
  it("say 1 ride, 1 community ride and 1 credit in English, and give translators the plural template", async () => {
    const { T } = await import("@/components/club/MembersArea.text");
    const { englishOf, localize } = await import("@/i18n/tx");
    expect([T.en.rides("1"), T.en.groupRides("1"), T.en.toNext("1", "Pro")]).toEqual(["1 ride", "1 community ride", "1 credit to reach Pro"]);
    expect([T.en.rides("12"), T.en.groupRides("3"), T.en.toNext("40", "Pro")]).toEqual(["12 rides", "3 community rides", "40 credits to reach Pro"]);
    expect(englishOf(T.en)).toEqual(expect.arrayContaining(["{0} rides", "{0} community rides", "{0} credits to reach {1}"]));
    // a translated language reads its dictionary's template, whatever the number (its own forms)
    expect(localize(T, "fr", { "{0} rides": "{0} sorties" }).rides("1")).toBe("1 sorties");
  });
});

describe("the members' rides for one gender (the owner, 2026-10-28: \"make all pool sessions visible to all genders but only male can book male sessions and female can book female sessions\")", () => {
  // member_area gives every members' ride, a men-only or women-only one too; the page reads each one's rule
  // (lib/rides.ts sessionGenders) and the account's gender, as app/[locale]/club/page.tsx does
  const render = async (viewer: { gender: SessionGender | null }, read = true) => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const a = memberArea({ status: 200, data: { ...full, upcoming: [
      { id: "2026-10-29-sw", date: "2026-10-29", title: "", kind: "swim", time: "18:00 - 19:30", booked: false },
      { id: "2026-10-30-sw", date: "2026-10-30", title: "", kind: "swim", time: "18:00 - 19:30", booked: false },
      { id: "2026-10-31-sw", date: "2026-10-31", title: "", kind: "swim", time: "18:00 - 19:30", booked: false },
      { id: "2026-11-01-sw", date: "2026-11-01", title: "", kind: "swim", time: "18:00 - 19:30", booked: true },
    ] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const rule = new Map<string, SessionGender | null>([["2026-10-29-sw", "female"], ["2026-10-30-sw", "male"], ["2026-10-31-sw", null], ["2026-11-01-sw", "female"]]);
    const area = read ? { ...a, upcoming: a.upcoming.map((r) => ({ ...r, gender: rule.get(r.id) ?? null })) } : a;
    const w = genderText(makeL("en", null));
    return renderToStaticMarkup(createElement(MembersArea, {
      locale: "en", L: "en", area, tierNames: ["Member", "Pro", "Legend"], nameOf: () => "Triathlon Pool Session",
      bookAt: (id: string) => `https://book.example.test/?session=${id}`, today: "2026-10-28", empty: "None",
      sgOf: (r) => (r.gender === undefined ? null : genderChip(r, w)), refusalOf: (r) => genderBlock(r, viewer, w),
    }));
  };
  // the upcoming rides' rows alone (not the last rides')
  const rows = (html: string) => (/<section class="club-up".*?<\/section>/.exec(html)?.[0] ?? "").match(/<li[^>]*>.*?<\/li>/g) ?? [];
  it("lists every one to a member of either gender, each with its chip", async () => {
    for (const g of ["male", "female", null] as const) {
      const html = await render({ gender: g });
      expect(rows(html)).toHaveLength(4);
      expect(html).toContain('<span class="sg-chip sg-female">Women only</span>');
      expect(html).toContain('<span class="sg-chip sg-male">Men only</span>');
      expect(html).toContain('<span class="sg-chip sg-mixed">Mixed</span>');
    }
  });
  it("gives Book on the member's own gender's and the mixed ones, and the refusal in its place on the other gender's", async () => {
    const man = rows(await render({ gender: "male" }));
    expect(man[0]).toContain("This session is for women only.");
    expect(man[0]).not.toContain("?session=2026-10-29-sw");
    expect(man[1]).toContain('href="https://book.example.test/?session=2026-10-30-sw"');
    expect(man[2]).toContain('href="https://book.example.test/?session=2026-10-31-sw"');
    expect(man[3]).toContain("Booked"); // a place already held stays marked
    const woman = rows(await render({ gender: "female" }));
    expect(woman[0]).toContain('href="https://book.example.test/?session=2026-10-29-sw"');
    expect(woman[1]).toContain("This session is for men only.");
    const none = rows(await render({ gender: null })); // no gender on file: the database refuses both
    expect(none[0]).toContain("This session is for women only.");
    expect(none[1]).toContain("This session is for men only.");
    expect(none[2]).toContain("?session=2026-10-31-sw");
  });
  it("keeps every Book and claims no rule when the rules could not be read", async () => {
    const html = await render({ gender: "male" }, false);
    expect(html).not.toContain("sg-chip");
    expect(html).not.toContain("This session is for");
    expect(rows(html).filter((x) => x.includes("?session="))).toHaveLength(3);
  });
});
