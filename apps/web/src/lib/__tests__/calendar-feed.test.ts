import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { CALF_KEY, CALF_LANGS, calfAddress, calfAnswer, calfBody, calfGot, calfHost, calfLang, calfPeekOn } from "../calendar-feed";
import { POST } from "../../app/api/account/calendar/route";
import CalendarFeed from "@/components/account/CalendarFeed";
import { CALENDAR_WORDS, calendarWords, type CalendarWords } from "@/components/account/Calendar.words";
import { LOCALE_CODES } from "@/i18n/locales";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// A calendar address of the rider's own on My Account (the booking app's new features F27, 2026-11-13: calendar-feed.js,
// _calfPeek; rentals migration 20261114082700). Made-up keys of the database's shape: no real key is written here.
const KEYS = ["a1", "b2", "c3"].map((x) => x.repeat(32));

describe("the helpers", () => {
  it("speaks the booking app's ten languages to calendar_link, and keeps the stored one for the site's six others", () => {
    expect(CALF_LANGS).toEqual(["en", "ar", "fr", "es", "pt", "ur", "hi", "tl", "ne", "bn"]);
    for (const l of CALF_LANGS) expect(calfLang(l)).toBe(l);
    for (const l of ["id", "ms", "de", "ru", "zh", "ja", "xx", "", null, undefined, 5]) expect(calfLang(l), String(l)).toBeNull();
  });
  it("shows the section only once peek answered ok", () => {
    expect(calfPeekOn({ status: 200, data: { ok: true, has: false } })).toBe(true);
    expect(calfPeekOn({ status: 200, data: { ok: true, has: true } })).toBe(true);
    expect(calfPeekOn({ status: 200, data: { ok: false, error: "denied" } })).toBe(false);
    expect(calfPeekOn({ status: 404, data: null })).toBe(false); // no such function
    expect(calfPeekOn({ status: 500, data: null })).toBe(false);
    expect(calfPeekOn({ status: 0, data: null })).toBe(false); // no answer
    expect(calfPeekOn({ status: 200, data: null })).toBe(false);
    expect(calfPeekOn({ status: 200, data: "ok" })).toBe(false);
  });
  it("reads what the pop-up posts", () => {
    expect(calfBody({ op: "get", lang: "ar" })).toEqual({ op: "get", lang: "ar" });
    expect(calfBody({ op: "new", lang: "de" })).toEqual({ op: "new", lang: null });
    expect(calfBody({ op: "get" })).toEqual({ op: "get", lang: null });
    for (const b of [{ op: "peek" }, { op: "GET" }, {}, null, "get", { op: 1 }]) expect(calfBody(b), JSON.stringify(b)).toBeNull();
  });
  it("takes a key of the database's shape only", () => {
    expect(CALF_KEY.test(KEYS[0])).toBe(true);
    expect(calfAnswer({ ok: true, key: KEYS[0] })).toEqual({ ok: true, key: KEYS[0] });
    expect(calfAnswer({ ok: true, key: KEYS[0].toUpperCase() })).toEqual({ ok: false, error: "generic" });
    expect(calfAnswer({ ok: true, key: KEYS[0].slice(1) })).toEqual({ ok: false, error: "generic" });
    expect(calfAnswer({ ok: true, has: true })).toEqual({ ok: false, error: "generic" }); // a peek's answer has no key
    expect(calfAnswer({ ok: false, error: "denied" })).toEqual({ ok: false, error: "signin" });
    expect(calfAnswer(null)).toEqual({ ok: false, error: "generic" });
    expect(calfGot({ ok: true, key: KEYS[1] })).toEqual({ key: KEYS[1] });
    expect(calfGot({ ok: false, error: "signin" })).toEqual({ error: "signin" });
    expect(calfGot({ ok: false, error: "absent" })).toEqual({ error: "absent" });
    expect(calfGot({ ok: false, error: "busy" })).toEqual({ error: "generic" });
    expect(calfGot({ ok: true, key: "x" })).toEqual({ error: "generic" });
    expect(calfGot(null)).toEqual({ error: "generic" });
  });
  it("puts the address on the booking app's host, never this site's", () => {
    expect(calfHost("https://experiences.micromobility.sa/")).toBe("experiences.micromobility.sa");
    expect(calfHost("https://staging-rides.example.pages.dev/?lang=ar")).toBe("staging-rides.example.pages.dev");
    expect(calfHost("http://localhost:8788/x")).toBe("localhost:8788");
    for (const a of ["https://micromobility.sa/experiences", "https://www.micromobility.sa", "/experiences", "", "javascript:alert(1)", "webcal://x.example"]) {
      expect(calfHost(a), a).toBe("experiences.micromobility.sa");
    }
    expect(calfAddress("experiences.micromobility.sa", KEYS[0], "webcal")).toBe(`webcal://experiences.micromobility.sa/api/ics?k=${KEYS[0]}`);
    expect(calfAddress("experiences.micromobility.sa", KEYS[0], "https")).toBe(`https://experiences.micromobility.sa/api/ics?k=${KEYS[0]}`);
  });
});

describe("api/account/calendar", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/calendar", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("asks calendar_link for the key with the cookie's id and token, in the page's language when the app speaks it", async () => {
    const f = vi.fn(async () => json({ ok: true, key: KEYS[0] }));
    vi.stubGlobal("fetch", f);
    const res = await post({ op: "get", lang: "ar" });
    expect([res.status, res.headers.get("cache-control"), await res.json()]).toEqual([200, "no-store, private", { ok: true, key: KEYS[0] }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/calendar_link");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_lang: "ar", p_op: "get" });
    expect(init.cache).toBe("no-store");
  });
  it("replaces it with 'new'; a language the app does not speak keeps the stored one", async () => {
    const f = vi.fn(async () => json({ ok: true, key: KEYS[1] }));
    vi.stubGlobal("fetch", f);
    expect(await (await post({ op: "new", lang: "de" })).json()).toEqual({ ok: true, key: KEYS[1] });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_lang: null, p_op: "new" });
  });
  it("refuses another site, a missing cookie, a peek (the page asks that itself) and a body it cannot read without touching the database", async () => {
    const f = vi.fn(async () => json({ ok: true, key: KEYS[0] }));
    vi.stubGlobal("fetch", f);
    expect((await post({ op: "get" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    const out = await post({ op: "get" }, { origin: HEADERS.origin });
    expect([out.status, await out.json()]).toEqual([401, { ok: false, error: "signin" }]);
    for (const b of [{ op: "peek" }, {}, { op: "delete" }, null]) expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered, and never hands on a key of the wrong shape", async () => {
    const said = async (answer: Response) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post({ op: "get", lang: "en" }); return [r.status, await r.json()]; };
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.calendar_link" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json({ message: "bad" }, 400))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json({ ok: true, key: "not-a-key" }))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json({ ok: true, has: true }))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json(null))).toEqual([502, { ok: false, error: "generic" }]);
  });
  it("answers generic when the database cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const r = await post({ op: "get" });
    expect([r.status, await r.json()]).toEqual([502, { ok: false, error: "generic" }]);
  });
});

describe("the section and its pop-up", () => {
  const draw = (locale: string, host = "experiences.micromobility.sa") =>
    renderToStaticMarkup(createElement(CalendarFeed, { host, lang: calfLang(locale), words: calendarWords(locale) }));

  it("is a Calendar section with one button, a centred pop-up and the question, closed, with no key in the page", () => {
    const html = draw("en");
    expect(html).toMatch(/<section class="ac-sec ac-calf" aria-labelledby="[^"]+"><div class="ac-sec-head"><h2 id="[^"]+">Calendar<\/h2><button type="button" class="ac-calf-go">Add to my calendar <svg/);
    expect(html.match(/<dialog /g)).toHaveLength(2);
    expect(html).not.toMatch(/<dialog[^>]* open/);
    expect(html).toContain('class="tk-dlg ac-calf-dlg"');
    expect(html).toContain(">Your bookings in your calendar</h2>");
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<p class="ac-calf-wait" role="status">Loading…</p>');
    // the question before a replace: its title, its line, Replace the address and Cancel
    expect(html).toContain(">Replace the address?</h2>");
    expect(html).toContain(">The old address stops working. A calendar that uses it will no longer update.</p>");
    expect(html).toMatch(/<button type="button" class="ac-calf-main">Replace the address<\/button><button type="button" class="ac-calf-btn">Cancel<\/button>/);
    // nothing is asked or shown before the pop-up opens: no address, no key
    expect(html).not.toMatch(/webcal|api\/ics|[0-9a-f]{64}/);
  });
  it("speaks the page's language", () => {
    const ar = draw("ar");
    expect(ar).toContain(">تقويم</h2>");
    expect(ar).toContain(">أضف إلى تقويمي <svg");
    expect(ar).toContain(">حجوزاتك في تقويمك</h2>");
    expect(ar).toContain(">استبدال العنوان؟</h2>");
    expect(draw("de")).toContain(">Zu meinem Kalender hinzufügen <svg");
  });
});

describe("its words", () => {
  const keys: (keyof CalendarWords)[] = ["row", "title", "add", "copy", "replace", "askTitle", "askBody", "err", "close", "retry", "loading", "cancel"];
  it("exist in every language the site speaks, with Latin digits", () => {
    expect(Object.keys(CALENDAR_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) for (const k of keys) {
      expect(CALENDAR_WORDS[l][k], `${l}.${k}`).toMatch(/\S/);
      expect(CALENDAR_WORDS[l][k], `${l}.${k}`).not.toMatch(/[٠-٩۰-۹०-९০-৯]/);
    }
  });
  it("are the booking app's own where it speaks the language", () => {
    expect(calendarWords("en")).toEqual({
      row: "Calendar", title: "Your bookings in your calendar", add: "Add to my calendar", copy: "Copy the address", replace: "Replace the address",
      askTitle: "Replace the address?", askBody: "The old address stops working. A calendar that uses it will no longer update.",
      err: "We could not do that. Please try again.", close: "Close", retry: "Try again", loading: "Loading…", cancel: "Cancel",
    });
    expect(calendarWords("ar").row).toBe("تقويم");
    expect(calendarWords("fr").copy).toBe("Copier l’adresse");
    expect(calendarWords("ne").row).toBe("पात्रो");
    expect(calendarWords("bn").askTitle).toBe("ঠিকানা বদলাবেন?");
    expect(calendarWords("xx")).toBe(CALENDAR_WORDS.en);
  });
});

describe("the key stays out of logs and storage", () => {
  it("no file of the feature writes to the console or to the browser's storage", () => {
    const files = ["../calendar-feed.ts", "../../app/api/account/calendar/route.ts", "../../components/account/CalendarFeed.tsx"];
    for (const f of files) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src, f).not.toMatch(/console\.|localStorage|sessionStorage|indexedDB/);
    }
  });
});
