import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { GET } from "@/app/api/account/volunteer-portal/route";
import VolunteerCard, { volunteerCardShows } from "@/components/account/VolunteerCard";
import { VOLUNTEER_WORDS, hoursText } from "@/components/account/Volunteer.words";
import { ACCOUNT_COOKIE, encodeSession } from "@/lib/account-core";
import { LOCALES } from "@/i18n/locales";

// My Account's volunteering card and its way to the portal (rentals 20261105120000, apps/volunteers).
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const req = (cookie?: string) => new Request("https://micromobility.sa/api/account/volunteer-portal", { headers: cookie ? { cookie } : {} });
const signedIn = `${ACCOUNT_COOKIE}=${encodeSession({ id: "c1", token: "tok-0123456789abcdef" })}`;

describe("the volunteering card", () => {
  it("shows for hours, for a volunteer, and when staff promote an open opportunity; not otherwise", () => {
    expect(volunteerCardShows(null)).toBe(false);
    expect(volunteerCardShows({ hours: 0, status: null })).toBe(false);
    expect(volunteerCardShows({ hours: 2 })).toBe(true);
    expect(volunteerCardShows({ status: "applied" })).toBe(true);
    expect(volunteerCardShows({ promote: true, open_count: 0 })).toBe(false);
    expect(volunteerCardShows({ promote: true, open_count: 1 })).toBe(true);
  });
  it("has its words in every language the site speaks, with the hours' place kept", () => {
    for (const l of LOCALES) {
      const w = VOLUNTEER_WORDS[l.code];
      expect(w, l.code).toBeTruthy();
      for (const v of Object.values(w)) expect(v, l.code).toBeTruthy();
      expect(w.hours, l.code).toContain("{0}");
      expect(w.hrs.other, l.code).toContain("{0}");
    }
  });
  // The owner, 2026-11-09: "6 · 5 Nov 2026 · Micromobility Blood Donation" read as anything but hours; the event, its
  // day, then the hours with their word, as the booking app's _accVolRecLi.
  it("says the hours with their word, by the language's plural", () => {
    expect([1, 6, 2.5, 2.555].map((n) => hoursText(n, "en"))).toEqual(["1 hour", "6 hours", "2.5 hours", "2.56 hours"]);
    expect([1, 2, 3, 10, 11, 100, 2.5].map((n) => hoursText(n, "ar"))).toEqual(["ساعة واحدة", "ساعتان", "3 ساعات", "10 ساعات", "11 ساعة", "100 ساعة", "2.5 ساعة"]);
    expect([1, 3, 5, 2.5].map((n) => hoursText(n, "ru"))).toEqual(["1 час", "3 часа", "5 часов", "2.5 часа"]);
    expect([1, 6].map((n) => hoursText(n, "de"))).toEqual(["1 Stunde", "6 Stunden"]);
    expect(hoursText(6, "ja")).toBe("6時間");
    expect(hoursText(6, "xx")).toBe("6 hours"); // a language the site does not speak reads English
  });
  it("lists a record as the event, its day, then the hours", () => {
    const render = (el: ReactElement) => renderUntyped(el) as string;
    const html = render(createElement(VolunteerCard, { locale: "en", me: { hours: 7, record: [
      { id: 1, hours: 6, on: "2026-11-05", title: "Micromobility Blood Donation" }, { id: 2, hours: 1, on: "2026-10-31", title: null }] } }));
    const rows = [...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    expect(rows).toEqual(["Micromobility Blood Donation · 5 Nov 20266 hours", "31 Oct 20261 hour"]); // the hours stand at the row's end
    expect(html).toContain("<strong>6 hours</strong>");
  });
});

describe("the way to the portal", () => {
  it("hands a signed-in rider over with a one-time code", async () => {
    const code = "c".repeat(48);
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { seen.push(url); return new Response(JSON.stringify(code), { status: 200 }); }));
    const r = await GET(req(signedIn));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`https://volunteer.micromobility.sa/?signin=${code}`);
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(seen[0]).toContain("customer_handoff_create");
  });
  it("signed out, or with no code, the portal still opens, with nothing in the address", async () => {
    const f = vi.fn(async () => new Response("null", { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect((await GET(req())).headers.get("location")).toBe("https://volunteer.micromobility.sa/");
    expect(f).not.toHaveBeenCalled();
    expect((await GET(req(signedIn))).headers.get("location")).toBe("https://volunteer.micromobility.sa/");
  });
  // A code is made in the database of the site that serves the request: staging's means nothing to the live portal.
  it("on staging, hands over to the portal it is given, and to the live one only without a code", async () => {
    const code = "d".repeat(48);
    const f = vi.fn(async () => new Response(JSON.stringify(code), { status: 200 }));
    vi.stubGlobal("fetch", f);
    vi.stubEnv("MM_ENV", "staging");
    expect((await GET(req(signedIn))).headers.get("location")).toBe("https://volunteer.micromobility.sa/");
    expect(f).not.toHaveBeenCalled();
    vi.stubEnv("VOLUNTEER_PORTAL_URL", "https://volunteers-staging.example.workers.dev");
    expect((await GET(req(signedIn))).headers.get("location")).toBe(`https://volunteers-staging.example.workers.dev/?signin=${code}`);
    expect((await GET(req())).headers.get("location")).toBe("https://volunteers-staging.example.workers.dev/");
    vi.stubEnv("VOLUNTEER_PORTAL_URL", "http://volunteers-staging.example.workers.dev/"); // https only
    expect((await GET(req(signedIn))).headers.get("location")).toBe("https://volunteer.micromobility.sa/");
  });
});
