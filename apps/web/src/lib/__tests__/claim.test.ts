import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { claimToken, claimView, claimWhen, clockSkew, clockText, stateOfGet, stateOfSpot } from "../claim";
import { resetSiteContent } from "../site";
import proxy, { claimTarget } from "../../proxy";
import { GET, POST } from "../../app/api/claim/route";
import ClaimCard from "../../components/claim/ClaimCard";
import { CLAIM_WORDS } from "../../components/claim/ClaimCard.words";
import { LOCALE_CODES } from "../../i18n/locales";

// The waitlist claim page (/?claim=<token>), as the booking app's #wl-claim: the card's states, the
// countdown on the device's clock corrected by the server's, the answer, and a page that never breaks
// while the database has no claim functions yet.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOK = "0123456789abcdef0123456789abcdef";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const OPEN = {
  ok: true, status: "open", expires_at: "2026-10-10T18:05:00Z", now: "2026-10-10T18:00:00Z", first_name: "Sara", booking_status: "waitlist", queue_num: 7,
  session: { id: "s1", date: "2026-10-11", time: "06:30 - 09:00", title: "Saturday Social Ride", ride_kind: "saturday", event_kind: "community", location: null },
};

describe("the token", () => {
  it("is 32 hex characters, read in lower case", () => {
    expect(claimToken(TOK)).toBe(TOK);
    expect(claimToken(` ${TOK.toUpperCase()} `)).toBe(TOK);
    for (const bad of ["", "abc", `${TOK}0`, TOK.replace("a", "g"), null, 42]) expect(claimToken(bad)).toBeNull();
  });
});

describe("the card's state", () => {
  it("from the offer, as _wlcOpen reads it", () => {
    expect(stateOfGet(null)).toBe("net");
    expect(stateOfGet({ ok: false, reason: "NOT_FOUND" })).toBe("gone");
    expect(stateOfGet({ ok: true, status: "open" })).toBe("ask");
    expect(stateOfGet({ ok: true, status: "claimed" })).toBe("done");
    expect(stateOfGet({ ok: true, status: "expired" })).toBe("late");
    for (const s of ["declined", "cancelled", "closed"]) expect(stateOfGet({ ok: true, status: s })).toBe("gone");
  });
  it("after the answer, as _wlcGo reads it; no answer (or CHANGED) keeps the question", () => {
    expect(stateOfSpot({ ok: true, queue_num: 12 })).toBe("done");
    expect(stateOfSpot({ ok: true, already: true })).toBe("done");
    expect(stateOfSpot({ ok: true, declined: true })).toBe("no");
    expect(stateOfSpot({ ok: false, reason: "EXPIRED" })).toBe("late");
    expect(stateOfSpot({ ok: false, reason: "FULL" })).toBe("full");
    for (const r of ["CLOSED", "ENDED", "NOT_FOUND", "CANCELLED", "DECLINED"]) expect(stateOfSpot({ ok: false, reason: r })).toBe("gone");
    expect(stateOfSpot(null)).toBeNull();
  });
});

describe("the countdown", () => {
  it("runs on the device's clock corrected by the server's, as m:ss, and is empty at 0", () => {
    const device = Date.parse("2026-10-10T17:58:00Z"); // the phone is two minutes slow
    const skew = clockSkew(OPEN.now, device);
    expect(skew).toBe(120_000);
    expect(clockText(OPEN.expires_at, skew, device)).toBe("5:00");
    expect(clockText(OPEN.expires_at, skew, device + 61_500)).toBe("3:58");
    expect(clockText(OPEN.expires_at, skew, device + 299_500)).toBe("0:00");
    expect(clockText(OPEN.expires_at, skew, device + 300_000)).toBe("");
    expect(clockText(undefined, 0, device)).toBe("");
    expect(clockSkew(undefined, device)).toBe(0);
  });
});

describe("the ride, as the rider reads it", () => {
  it("weekday, day month · start time in the 12-hour clock", () => {
    expect(claimWhen(OPEN.session, "en")).toBe("Sunday 11 October · 6:30 AM");
    expect(claimWhen({ date: "2026-10-13", time: "21:00 - 23:00" }, "en")).toBe("Tuesday 13 October · 9:00 PM");
    expect(claimWhen({ date: "2026-10-13", time: "" }, "en")).toBe("Tuesday 13 October");
    expect(claimWhen(null, "en")).toBe("");
    expect(claimWhen({ date: "2026-10-13", time: "21:00 - 23:00" }, "ar")).toMatch(/·/);
  });
  it("the page is given the ride and the time, never the rider's name or number", () => {
    const v = claimView(OPEN, "en");
    expect(v).toEqual({ state: "ask", title: "Saturday Social Ride", when: "Sunday 11 October · 6:30 AM", expiresAt: OPEN.expires_at, now: OPEN.now });
    expect(JSON.stringify(v)).not.toMatch(/Sara|queue/);
    expect(claimView(null, "en")).toEqual({ state: "net", title: null, when: "", expiresAt: null, now: null });
  });
});

describe("the addresses", () => {
  it("/claim/<token> goes to /?claim=<token>, the language kept", async () => {
    expect(claimTarget(`/claim/${TOK}`, new URLSearchParams())).toBe(`/?claim=${TOK}`);
    expect(claimTarget(`/ar/claim/${TOK.toUpperCase()}/`, new URLSearchParams("lang=ur"))).toBe(`/?claim=${TOK}&lang=ur`);
    expect(claimTarget("/claim/123", new URLSearchParams())).toBeNull();
    const res = await proxy(new NextRequest(`https://micromobility.sa/claim/${TOK}`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") || "").search).toBe(`?claim=${TOK}`);
  });
  it("/?claim= is the site's own page while it is Coming Soon (never sent elsewhere)", async () => {
    const res = await proxy(new NextRequest(`https://micromobility.sa/?claim=${TOK}`));
    expect(res.status).toBe(200);
  });
});

describe("/api/claim", () => {
  beforeEach(() => { resetSiteContent(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { resetSiteContent(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const get = (t: string) => GET(new Request(`https://micromobility.sa/api/claim?t=${t}&locale=en`));
  const post = (body: unknown, origin = "https://micromobility.sa") =>
    POST(new Request("https://micromobility.sa/api/claim", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
  const routed = (claim: (body: Record<string, unknown>) => Response) => vi.fn(async (url: string, init?: RequestInit) =>
    String(url).includes("/rpc/") ? claim(JSON.parse(String(init?.body ?? "{}"))) : json([]));

  it("reads the offer with the public key and gives the page its view", async () => {
    const f = routed(() => json(OPEN));
    vi.stubGlobal("fetch", f);
    const v = await (await get(TOK)).json();
    expect(v).toMatchObject({ state: "ask", title: "Saturday Social Ride", expiresAt: OPEN.expires_at });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/"))!;
    expect(String(call[0])).toBe("https://example.supabase.co/rest/v1/rpc/customer_claim_get");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ p_token: TOK });
  });
  it("names a circuit night by its fixed name, as every page does", async () => {
    vi.stubGlobal("fetch", routed(() => json({ ...OPEN, session: { ...OPEN.session, title: null, ride_kind: null, event_kind: "jcc" } })));
    expect((await (await get(TOK)).json()).title).toBe("Evening Circuit Session");
  });
  it("answers 'gone' for a bad token without asking, and before the database has the functions", async () => {
    const f = routed(() => json({ code: "PGRST202", message: "Could not find the function" }, 404));
    vi.stubGlobal("fetch", f);
    expect((await (await get("nope")).json()).state).toBe("gone");
    expect(f).not.toHaveBeenCalled();
    expect((await (await get(TOK)).json()).state).toBe("gone");
    expect((await (await post({ t: TOK })).json())).toEqual({ state: "gone" });
  });
  it("answers 'net' when the database does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await (await get(TOK)).json()).state).toBe("net");
    expect((await (await post({ t: TOK })).json())).toEqual({ retry: true });
  });
  it("claims or declines through customer_claim_spot, and asks again on CHANGED", async () => {
    const f = routed((b) => json(b.p_decline ? { ok: true, declined: true } : { ok: true, queue_num: 12 }));
    vi.stubGlobal("fetch", f);
    expect(await (await post({ t: TOK })).json()).toEqual({ state: "done" });
    expect(await (await post({ t: TOK, decline: true })).json()).toEqual({ state: "no" });
    expect(JSON.parse(String((f.mock.calls.at(-1)![1] as RequestInit).body))).toEqual({ p_token: TOK, p_decline: true });
    vi.stubGlobal("fetch", routed(() => json({ ok: false, reason: "FULL" })));
    expect(await (await post({ t: TOK })).json()).toEqual({ state: "full" });
    vi.stubGlobal("fetch", routed(() => json({ code: "P0001", message: "CHANGED" }, 400)));
    expect(await (await post({ t: TOK })).json()).toEqual({ retry: true });
  });
  it("takes an answer from this site's pages only", async () => {
    const f = routed(() => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ t: TOK }, "https://evil.example")).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("the card", () => {
  it("has every word in every language the site speaks, the booking app's own in its ten", () => {
    const keys = Object.keys(CLAIM_WORDS.en).sort();
    for (const code of LOCALE_CODES) {
      const w = CLAIM_WORDS[code];
      expect(Object.keys(w).sort(), code).toEqual(keys);
      for (const [k, v] of Object.entries(w)) expect(v.trim(), `${code}.${k}`).not.toBe("");
    }
    expect(CLAIM_WORDS.ar.claim).toBe("أكّد مكاني");
    expect(CLAIM_WORDS.ur.doneTitle).toBe("آپ کی جگہ بک ہو گئی");
    // the six languages the booking app does not speak are translated, not left in English
    for (const code of ["id", "ms", "de", "ru", "zh", "ja"] as const) expect(CLAIM_WORDS[code].title, code).not.toBe(CLAIM_WORDS.en.title);
  });
  it("starts as a loading skeleton, with no emoji anywhere", () => {
    const html = renderToStaticMarkup(createElement(ClaimCard, { token: TOK, locale: "en", mine: "https://book.example/?tab=bookings" }));
    expect(html).toContain("wlc-skel");
    expect(html).toContain('aria-busy="true"');
    const all = JSON.stringify(CLAIM_WORDS);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
