import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/account/volunteer-portal/route";
import { volunteerCardShows } from "@/components/account/VolunteerCard";
import { VOLUNTEER_WORDS } from "@/components/account/Volunteer.words";
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
    }
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
});
