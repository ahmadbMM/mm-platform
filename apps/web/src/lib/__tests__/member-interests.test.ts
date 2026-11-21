import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { INT_KEYS, intAnswer, intBody, intChips, intDraft, intKeys, intToggle, interestsOf, type Interests } from "../member-interests";
import { readInterests } from "../member-hub-server";
import { askList, askView } from "../ask";
import { memberArea } from "../members";
import { POST } from "../../app/api/account/interests/route";
import { InterestsBox, InterestsCard } from "../../components/club/Interests";
import { MEMBER_HUB_WORDS, interestWords } from "../../components/club/MemberHub.words";
import { LOCALES } from "../../i18n/locales";

// My interests on /club, as the booking app's member-hub.js has them (_intFetch, _intHtml, _intTog, _intSave; rentals
// 5fa8217f and migration 20261118210300, 2026-11-18), and the Ask audience 'interests' the site must take as it comes.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const ALL = [...INT_KEYS];
const MALE = ALL.filter((k) => k !== "women");

describe("reading and choosing", () => {
  it("reads member_interests_get, keeping only the keys it knows, in the list's order", () => {
    expect(interestsOf({ status: 200, data: { ok: true, saved: false, keys: [], suggested: ["road", "saturday", "zzz"], offered: MALE } }))
      .toEqual({ saved: false, keys: [], suggested: ["saturday", "road"], offered: MALE });
    expect(interestsOf({ status: 200, data: { ok: true, saved: true, keys: ["yoga", "yoga", "farm"], suggested: [], offered: ALL } })?.keys).toEqual(["yoga", "farm"]);
    for (const r of [{ status: 200, data: { ok: false, error: "member" } }, { status: 200, data: { ok: false, error: "denied" } }, { status: 404, data: null }, { status: 0, data: null }, { status: 200, data: null }])
      expect(interestsOf(r), JSON.stringify(r)).toBeNull();
  });
  it("starts a member who never saved from the sport answer's ticks they may pick, and a saved one from their picks", () => {
    const never: Interests = { saved: false, keys: [], suggested: ["saturday", "women", "swim"], offered: MALE };
    expect(intDraft(never)).toEqual(["saturday", "swim"]); // never 'women' for an account not offered it
    expect(intDraft({ saved: true, keys: ["runs"], suggested: [], offered: ALL })).toEqual(["runs"]);
    // the chips: every key offered, and one held that is no longer offered, so it can be taken off
    expect(intChips({ saved: true, keys: ["women"], suggested: [], offered: MALE }, ["women"])).toEqual(ALL);
    expect(intChips(never, [])).toEqual(MALE);
    expect(intToggle(["swim"], "saturday")).toEqual(["saturday", "swim"]);
    expect(intToggle(["saturday", "swim"], "saturday")).toEqual(["swim"]);
    expect(intKeys(["x", "charity", "circuit"])).toEqual(["circuit", "charity"]);
  });
  it("reads a save's answer and what a page posts", () => {
    expect(intAnswer({ ok: true, keys: ["farm", "yoga"] })).toEqual({ ok: true, keys: ["yoga", "farm"] });
    expect(intAnswer({ ok: false, error: "limit" })).toEqual({ ok: false, error: "limit" });
    expect(intAnswer(null)).toEqual({ ok: false, error: "generic" });
    expect(intBody({ keys: ["swim", "road"] })).toEqual(["road", "swim"]);
    expect(intBody({ keys: [] })).toEqual([]); // an empty list is a save too
    for (const b of [{ keys: ["nope"] }, { keys: "road" }, {}, null, { keys: Array(25).fill("road") }]) expect(intBody(b), JSON.stringify(b)).toBeNull();
  });
});

describe("readInterests", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("asks member_interests_get with the account's own id and token, and draws nothing without the function", async () => {
    const f = vi.fn(async () => json({ ok: true, saved: true, keys: ["road"], suggested: [], offered: ALL }));
    vi.stubGlobal("fetch", f);
    expect((await readInterests({ id: "c1", token: TOKEN }))?.keys).toEqual(["road"]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/member_interests_get");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN });
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: "PGRST202", message: "Could not find the function" }, 404)));
    expect(await readInterests({ id: "c1", token: TOKEN })).toBeNull();
  });
});

describe("api/account/interests", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/interests", { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answer: Response) => vi.fn(async () => answer.clone());
  it("saves through member_interests_set with the account's id and token, and answers what the database kept", async () => {
    const f = db(json({ ok: true, keys: ["road", "swim"] }));
    vi.stubGlobal("fetch", f);
    const r = await post({ keys: ["swim", "road"] });
    expect([r.status, await r.json()]).toEqual([200, { ok: true, keys: ["road", "swim"] }]);
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/member_interests_set");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_keys: ["road", "swim"] });
  });
  it("takes only this site's pages, a signed-in account and a list of known keys, asking the database nothing otherwise", async () => {
    const f = db(json({ ok: true, keys: [] }));
    vi.stubGlobal("fetch", f);
    expect((await post({ keys: [] }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ keys: [] }, { ...HEADERS, cookie: "" })).status).toBe(401);
    for (const b of [{ keys: ["nope"] }, { keys: "road" }, {}, null]) {
      const r = await post(b);
      expect([r.status, await r.json()], JSON.stringify(b)).toEqual([400, { ok: false, error: "refused" }]);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("says each refusal of the database as its own", async () => {
    const at = async (answer: Response) => { vi.stubGlobal("fetch", db(answer)); const r = await post({ keys: ["women"] }); return [r.status, (await r.json()).error]; };
    expect(await at(json({ ok: false, error: "limit" }))).toEqual([429, "limit"]);
    expect(await at(json({ ok: false, error: "women" }))).toEqual([400, "women"]);
    expect(await at(json({ ok: false, error: "keys" }))).toEqual([400, "keys"]);
    expect(await at(json({ ok: false, error: "member" }))).toEqual([403, "member"]);
    expect(await at(json({ ok: false, error: "denied" }))).toEqual([401, "signin"]);
    expect(await at(json({ ok: false, error: "what" }))).toEqual([502, "generic"]);
    expect(await at(json({ message: "boom" }, 500))).toEqual([502, "generic"]);
    expect(await at(json({ code: "PGRST202", message: "Could not find the function" }, 404))).toEqual([404, "absent"]);
  });
});

describe("the card", () => {
  const card = (locale: string, x: Interests | null) => renderToStaticMarkup(createElement(InterestsBox, { initial: x, words: interestWords(locale) },
    createElement("div", null, createElement(InterestsCard, { at: "first" }), createElement("hr"), createElement(InterestsCard, { at: "end" }))));
  it("before a first save stands first, its chips ticked from the sport answer, with Save and no Cancel", () => {
    const html = card("en", { saved: false, keys: [], suggested: ["saturday", "road"], offered: MALE });
    expect(html.indexOf("club-int")).toBeLessThan(html.indexOf("<hr/>"));
    expect(html).toContain("Your interests</h3>");
    expect(html).toContain('<div class="club-int-picks" role="group" aria-labelledby="club-int-h">');
    expect(html).toContain('<button type="button" class="club-int-chip on" aria-pressed="true" data-k="saturday">Saturday Social Rides</button>');
    expect(html).toContain('<button type="button" class="club-int-chip" aria-pressed="false" data-k="circuit">Circuit nights</button>');
    expect(html).not.toContain('data-k="women"');
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain(">Cancel</button>");
  });
  it("once saved stands at the end, the picks and Change, or Choose with none", () => {
    const html = card("en", { saved: true, keys: ["women", "yoga"], suggested: [], offered: ALL });
    expect(html.indexOf("club-int")).toBeGreaterThan(html.indexOf("<hr/>"));
    expect(html).toContain('<ul class="club-int-mine"><li>Women’s sessions</li><li>Yoga</li></ul>');
    expect(html).toContain('<button type="button" class="club-int-btn">Change</button>');
    expect(card("en", { saved: true, keys: [], suggested: [], offered: ALL })).toContain('<button type="button" class="club-int-btn">Choose</button>');
    expect(card("ar", { saved: true, keys: ["farm"], suggested: [], offered: ALL })).toContain("<li>ليالي المزرعة</li>");
    expect(card("en", null)).toBe("<div><hr/></div>"); // no read, no card
  });
  it("sits in the members' area after the Build-up plan until saved, then at its end", async () => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const a = memberArea({ status: 200, data: { ok: true, member: true, first_name: "Sara", credits: 0, tier: 0, next: 100, rides: 1, group_rides: 1, last: [], upcoming: [], announcements: [{ text: "Hello" }] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const props = { locale: "en", L: "en" as const, area: a, tierNames: ["Rider", "Pro", "Legend"] as [string, string, string], nameOf: () => "", bookAt: () => "", today: "2026-11-18", empty: "None" };
    const first = renderToStaticMarkup(createElement(MembersArea, { ...props, interests: { saved: false, keys: [], suggested: [], offered: ALL } }));
    expect(first.indexOf('class="club-int"')).toBeLessThan(first.indexOf('class="club-att"'));
    const end = renderToStaticMarkup(createElement(MembersArea, { ...props, interests: { saved: true, keys: ["road"], suggested: [], offered: ALL } }));
    expect(end.indexOf('class="club-int"')).toBeGreaterThan(end.indexOf('class="club-up"'));
    expect(end).toMatch(/<\/section><\/div><\/div>$/); // the end of the Sessions part, the only part here (2026-11-20)
  });
  it("has its words in all 16 languages, the booking app's own where it speaks them", () => {
    for (const l of LOCALES) {
      const w = interestWords(l.code);
      for (const k of INT_KEYS) expect(w[`int_${k}`].trim(), `${l.code} ${k}`).not.toBe("");
      expect(Object.values(w).join(" "), l.code).not.toMatch(/\p{Extended_Pictographic}|[०-९০-৯٠-٩۰-۹]/u);
    }
    expect(MEMBER_HUB_WORDS.fr.intTitle).toBe("Vos centres d’intérêt");
    expect(MEMBER_HUB_WORDS.ne.int_swim).toBe("पौडी");
    expect(MEMBER_HUB_WORDS.ur.intLimit).toBe("بہت زیادہ تبدیلیاں۔ ایک گھنٹے بعد دوبارہ کوشش کریں۔");
  });
});

describe("Ask by interest", () => {
  // staff may aim an Ask page at members by interest (ask_pages.audience 'interests', interest_keys); the database's _ask_sees
  // decides who sees it, and the site lists and draws such a page as it does any other, never filtering on the audience
  it("lists and draws a page whose audience is 'interests'", () => {
    const page = { id: 1, slug: "road-ideas", title_en: "Road rides", title_ar: "", intro_en: "", intro_ar: "", audience: "interests", interest_keys: ["road"], pace: "self", current_q: null, opens_at: null, closes_at: null, round: 1, open: true, look: {} };
    expect(askList({ signed: true, pages: [{ ...page, questions: 1, answered: 0 }] }).pages.map((p) => p.slug)).toEqual(["road-ideas"]);
    const v = askView({ state: "ok", signed: true, can_answer: true, rk: "rk1", page, questions: [{ id: 1, pos: 1, kind: "open", title_en: "Where?", config: {} }], mine: {}, voted: [], reacted: {}, me: null, live: null });
    expect(v.state).toBe("ok");
    expect(v.full?.page.slug).toBe("road-ideas");
    expect(askView({ state: "audience" }).state).toBe("audience"); // a member who picked none of its interests
  });
});
