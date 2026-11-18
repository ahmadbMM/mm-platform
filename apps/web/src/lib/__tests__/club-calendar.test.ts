import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { calfAnswer, calfBody, calfClubAnswer, calfClubGot, calfGot } from "../calendar-feed";
import { POST } from "../../app/api/account/calendar/route";
import { CALENDAR_WORDS, calendarWords } from "../../components/account/Calendar.words";
import { LOCALE_CODES } from "../../i18n/locales";

// The club calendar (the user, 2026-11-18: "Club calendar: the Calendar row would also offer every upcoming Saturday ride and
// featured session, not just the rider's own bookings. It uses the existing calendar address."), as the booking app's
// calendar-feed.js has it (_calfAsk, _calfClub; rentals 2f0ad874 and migration 20261118211000): the "Club sessions too"
// switch in My Account's Calendar pop-up.
const KEY = "a".repeat(64);
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";

describe("the switch's state and its answers", () => {
  it("reads where the switch stands from the key's answer, and no switch from a database before the migration", () => {
    expect(calfAnswer({ ok: true, key: KEY, club: true })).toEqual({ ok: true, key: KEY, club: true });
    expect(calfAnswer({ ok: true, key: KEY, club: false })).toEqual({ ok: true, key: KEY, club: false });
    expect(calfAnswer({ ok: true, key: KEY, club: "yes" })).toEqual({ ok: true, key: KEY, club: null });
    expect(calfGot({ ok: true, key: KEY, club: false })).toEqual({ key: KEY, club: false });
    expect(calfGot({ ok: true, key: KEY })).toEqual({ key: KEY, club: null });
  });
  it("posts the switch as {op: 'club', on}, and nothing else", () => {
    expect(calfBody({ op: "club", on: true })).toEqual({ op: "club", on: true });
    expect(calfBody({ op: "club", on: false })).toEqual({ op: "club", on: false });
    for (const b of [{ op: "club" }, { op: "club", on: "yes" }, { op: "club", on: 1 }]) expect(calfBody(b), JSON.stringify(b)).toBeNull();
  });
  it("reads calendar_club_set's answer and the route's", () => {
    expect(calfClubAnswer({ ok: true, club: true })).toEqual({ ok: true, club: true });
    expect(calfClubAnswer({ ok: false, error: "denied" })).toEqual({ ok: false, error: "signin" });
    expect(calfClubAnswer({ ok: false, error: "none" })).toEqual({ ok: false, error: "generic" }); // no address yet
    expect(calfClubAnswer({ ok: true })).toEqual({ ok: false, error: "generic" });
    expect(calfClubGot({ ok: true, club: false })).toEqual({ club: false });
    expect(calfClubGot({ ok: false, error: "absent" })).toEqual({ error: "absent" });
    expect(calfClubGot({ ok: false, error: "busy" })).toEqual({ error: "generic" });
    expect(calfClubGot(null)).toEqual({ error: "generic" });
  });
});

describe("api/account/calendar, the switch", () => {
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/calendar", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("turns it through calendar_club_set with the cookie's id and token, and answers where it stands", async () => {
    const f = vi.fn(async () => json({ ok: true, club: true }));
    vi.stubGlobal("fetch", f);
    const r = await post({ op: "club", on: true });
    expect([r.status, r.headers.get("cache-control"), await r.json()]).toEqual([200, "no-store, private", { ok: true, club: true }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/calendar_club_set");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_on: true });
  });
  it("hands on where the switch stands with the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, key: KEY, club: true })));
    expect(await (await post({ op: "get", lang: "en" })).json()).toEqual({ ok: true, key: KEY, club: true });
  });
  it("says each refusal, and asks nothing for a switch without its state", async () => {
    const said = async (answer: Response) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post({ op: "club", on: false }); return [r.status, await r.json()]; };
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ ok: false, error: "none" }))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.calendar_club_set" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500))).toEqual([502, { ok: false, error: "generic" }]);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await post({ op: "club" })).status).toBe(400);
    expect((await post({ op: "club", on: true }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("the pop-up's switch", () => {
  it("shows under Add to my calendar only when the answer said where it stands, as a labelled switch", () => {
    const src = readFileSync(new URL("../../components/account/CalendarFeed.tsx", import.meta.url), "utf8");
    const add = src.indexOf("{w.add}</span></a>"), sw = src.indexOf('<label className="ac-calf-sw">'), acts = src.indexOf('<div className="tk-dlg-acts">');
    expect(add).toBeGreaterThan(0);
    expect(add).toBeLessThan(sw);
    expect(sw).toBeLessThan(acts);
    expect(src).toContain("{club !== null && (");
    expect(src).toContain('<input type="checkbox" role="switch" checked={club} disabled={clubBusy}');
  });
  it("has its words in every language, the booking app's own where it speaks them", () => {
    for (const l of LOCALE_CODES) expect(CALENDAR_WORDS[l].club, l).toMatch(/\S/);
    expect(calendarWords("ar").club).toBe("جلسات النادي أيضًا");
    expect(calendarWords("tl").club).toBe("Pati ang mga session ng club");
    expect(calendarWords("bn").club).toBe("ক্লাবের সেশনও");
  });
});
