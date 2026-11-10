import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import SportCard from "../../components/account/SportCard";
import SportGate from "../../components/account/SportGate";
import SportFields from "../../components/account/SportFields";
import { TxProvider } from "../../i18n/TxProvider";
import { SPORT_CODES, SPORT_GROUPS, spClean, spName, spOf, spOptionsOf, spOtherClean, spProblem, spRefusal } from "../sport";
import { GET, POST } from "../../app/api/account/sport/route";
import { SPORT_WORDS } from "../../components/account/Sport.words";
import { LOCALES } from "../../i18n/locales";

// The database's list (_sport_feds() in the booking app's migration 20261110233000), in its order.
const DB_CODES = [
  "cycling", "triathlon", "athletics", "swimming", "rowing", "canoe_kayak", "sailing", "marine_diving", "surfing", "water_rescue",
  "football", "basketball", "volleyball", "handball", "rugby", "hockey", "cricket", "baseball_softball", "dodgeball", "lacrosse", "american_football",
  "tennis", "table_tennis", "badminton", "squash", "padel",
  "boxing", "judo", "karate", "taekwondo", "wrestling", "jiu_jitsu", "muay_thai", "mma", "kickboxing", "sambo", "wushu", "kurash", "kyokushin", "aikido",
  "weightlifting", "bodybuilding", "gymnastics", "climbing_hiking", "adventure", "powerlifting",
  "shooting", "archery", "fencing", "golf", "bowling", "billiards_snooker", "chess", "modern_pentathlon",
  "equestrian", "polo", "camel_racing", "auto_moto", "paragliding", "ballooning",
  "snow_sports", "ice_sports",
  "para_athletics", "para_swimming", "boccia", "wheelchair_seated", "blind_sports", "deaf_sports",
  "esports", "rc_robotics", "cyber_drones", "sports_for_all", "yoga", "masters",
];

describe("the federations", () => {
  it("are the database's 74 codes in its order, in the user's ten groups, each with an English and an Arabic name", () => {
    expect([...SPORT_CODES]).toEqual(DB_CODES);
    expect(SPORT_GROUPS.map((g) => g[2].length)).toEqual([10, 11, 5, 14, 6, 8, 6, 2, 6, 6]);
    for (const g of SPORT_GROUPS) {
      expect(g[0]).toMatch(/^[A-Za-z ,&]+$/);
      expect(g[1]).toMatch(/\p{Script=Arabic}/u);
      for (const f of g[2]) {
        expect(f[1], f[0]).toMatch(/^Saudi /);
        expect(f[2], f[0]).toMatch(/^(الاتحاد|اللجنة) السعودي/);
      }
    }
    expect(spName("cycling", "en")).toBe("Saudi Cycling Federation");
    expect(spName("cycling", "ar")).toBe("الاتحاد السعودي للدراجات");
    expect(spName("padel", "fr")).toBe("Saudi Padel Committee");
  });
  it("keep a yes's codes once each, the user's list first, then the added ones, Other last, and drop anything else", () => {
    expect(spClean(["yoga", "cycling", "yoga", "nope", 3])).toEqual(["cycling", "yoga"]);
    expect(spClean(["other", "x_padel_tennis", "chess"])).toEqual(["chess", "x_padel_tennis", "other"]);
    const added = [{ code: "x_b", en: "B", ar: null }, { code: "x_a", en: "A", ar: "أ" }];
    expect(spClean(["x_a", "x_b", "x_c"], added)).toEqual(["x_b", "x_a"]);
    expect(spClean(null)).toEqual([]);
  });
  it("name an added sport in Arabic when it has an Arabic name, else in English", () => {
    const added = spOptionsOf([{ code: "x_a", name_en: "Spikeball", name_ar: "سبايك بول" }, { code: "x_b", name_en: "Pickleball", name_ar: null }, { code: "bad", name_en: "No" }, null]);
    expect(added).toEqual([{ code: "x_a", en: "Spikeball", ar: "سبايك بول" }, { code: "x_b", en: "Pickleball", ar: null }]);
    expect([spName("x_a", "ar", added), spName("x_b", "ar", added), spName("x_a", "de", added)]).toEqual(["سبايك بول", "Pickleball", "Spikeball"]);
  });
  it("take Other's words as the database does: spaces tidied, 2 to 60 characters, no markup", () => {
    expect(spOtherClean("  Padel   tennis ")).toBe("Padel tennis");
    for (const v of ["", "a", "x".repeat(61), "<b>", "a{b}", 5]) expect(spOtherClean(v), String(v)).toBeNull();
    expect(spOtherClean("x".repeat(60))).toBe("x".repeat(60));
  });
  it("say what an answer still lacks", () => {
    expect(spProblem({ competes: null, feds: [], other: "" })).toBe("pick");
    expect(spProblem({ competes: false, feds: [], other: "" })).toBeNull();
    expect(spProblem({ competes: true, feds: [], other: "" })).toBe("feds");
    expect(spProblem({ competes: true, feds: ["other"], other: "x" })).toBe("other");
    expect(spProblem({ competes: true, feds: ["judo", "other"], other: "Sumo" })).toBeNull();
  });
  it("read the database's row and its refusal", () => {
    expect(spOf({ competes: true, federations: ["chess", "boxing"], other: null, asked: false })).toEqual({ competes: true, feds: ["boxing", "chess"], other: "", asked: false });
    expect(spOf({ competes: true, federations: ["chess", "other"], other: "Sumo", asked: false })).toEqual({ competes: true, feds: ["chess", "other"], other: "Sumo", asked: false });
    expect(spOf({ competes: null, federations: null, asked: true })).toEqual({ competes: null, feds: [], other: "", asked: true });
    expect(spOf({ competes: false, federations: ["chess"], asked: false })).toEqual({ competes: false, feds: [], other: "", asked: false });
    expect(spOf(undefined)).toBeNull();
    expect(spRefusal({ details: "sport_feds", message: "BAD_INPUT" })).toBe("feds");
    expect(spRefusal({ details: "sport_other", message: "BAD_INPUT" })).toBe("other");
    expect(spRefusal({ details: "sport", message: "BAD_INPUT" })).toBe("pick");
    expect(spRefusal({ details: "blood_type", message: "BAD_INPUT" })).toBeNull();
  });
});

describe("the words", () => {
  it("are complete in every language the site speaks, the booking app's own in English and Arabic, and never emoji", () => {
    expect(Object.keys(SPORT_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const [loc, w] of Object.entries(SPORT_WORDS)) {
      for (const [k, v] of Object.entries(w)) {
        expect(v.trim(), `${loc} ${k}`).not.toBe("");
        expect(v, `${loc} ${k}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
      expect(w.remove, `${loc} remove`).toContain("{0}");
    }
    expect(SPORT_WORDS.en.ask).toBe("Do you compete in a sport, professionally or as an amateur?");
    expect(SPORT_WORDS.ar.ask).toBe("هل تنافس في رياضة ما، بشكل احترافي أو كهاوٍ؟");
    expect(SPORT_WORDS.en.fedsLabel).toBe("Which federations do you compete under?");
    expect([SPORT_WORDS.en.other, SPORT_WORDS.en.otherLabel, SPORT_WORDS.en.errOther, SPORT_WORDS.en.added]).toEqual(["Other", "Your sport", "Write your sport in 2 to 60 characters.", "More sports"]);
    expect([SPORT_WORDS.ar.other, SPORT_WORDS.ar.otherLabel, SPORT_WORDS.ar.errOther, SPORT_WORDS.ar.added]).toEqual(["أخرى", "رياضتك", "اكتب رياضتك في 2 إلى 60 حرفًا.", "رياضات أخرى"]);
  });
});

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;
const SportFieldsT = SportFields as FC<Parameters<typeof SportFields>[0]>;

describe("the card", () => {
  it("reads an answer as one line with Change", () => {
    const html = renderToStaticMarkup(createElement(Tx, { locale: "ar", dict: null }, createElement(SportCard, { initial: { competes: true, feds: ["cycling", "triathlon", "x_a", "other"], other: "Sumo" }, added: [{ code: "x_a", en: "Spikeball", ar: "سبايك بول" }] })));
    expect(html).toContain(">نعم<");
    expect(html).toContain("الاتحاد السعودي للدراجات · الاتحاد السعودي للترايثلون · سبايك بول · Sumo");
    expect(html).toContain(">تغيير<");
    expect(html).not.toContain("<select");
  });
  it("asks the question, with Yes and No and Save, when there is no answer", () => {
    const html = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(SportCard, { initial: { competes: null, feds: [], other: "" }, added: [] })));
    expect(html).toContain("Do you compete in a sport, professionally or as an amateur?");
    expect(html).toMatch(/aria-pressed="false"[^>]*>Yes</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>No</);
    expect(html).toContain('class="ac-go bt-save"');
    expect(html).not.toContain(">Cancel<");
  });
  it("after a yes, offers the user's ten groups, then the added sports, then Other, and opens Other's box once it is picked", () => {
    const added = [{ code: "x_a", en: "Spikeball", ar: null }];
    const html = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(SportCard, { initial: { competes: true, feds: ["judo"], other: "" }, added })));
    // a held yes reads as one line: open it with Change in the browser; drawn here through its form instead
    expect(html).toContain("Saudi Judo Federation");
    const form = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(SportFieldsT, { value: { competes: true, feds: ["judo", "other"], other: "Sumo" }, onChange: () => {}, w: SPORT_WORDS.en, locale: "en", id: "t", labelledBy: "q", added })));
    const groups = [...form.matchAll(/<optgroup label="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(groups).toEqual([...SPORT_GROUPS.map((g) => g[0]), "More sports"]);
    expect(form).toMatch(/<option value="x_a">Spikeball<\/option><\/optgroup><\/select>/);
    expect(form).not.toContain('value="other"'); // picked: not offered again
    expect(form).not.toContain('<option value="judo"');
    expect(form).toContain('<label for="t-other">Your sport</label>');
    expect(form).toMatch(/id="t-other"[^>]*maxlength="60"/i);
    expect(form).toContain('value="Sumo"');
    expect(form).toMatch(/<span>Other<\/span><button[^>]*aria-label="Remove Other"/);
    const fresh = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(SportFieldsT, { value: { competes: true, feds: [], other: "" }, onChange: () => {}, w: SPORT_WORDS.en, locale: "en", id: "t", labelledBy: "q", added: [] })));
    expect(fresh).toMatch(/<\/optgroup><option value="other">Other<\/option><\/select>/);
    expect(fresh).not.toContain("More sports");
    expect(fresh).not.toContain("t-other");
  });
});

describe("the pop-up", () => {
  it("is the question, Yes and No, and Sign out, with no Save before a yes", () => {
    const html = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(SportGate, { added: [], onDone: () => {} })));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('<h2 id="spg-title" class="rg-title">Do you compete in a sport, professionally or as an amateur?</h2>');
    expect(html).toContain(">Yes<");
    expect(html).toContain(">No<");
    expect(html).toContain(">Sign out<");
    expect(html).not.toContain("spg-save");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("api/account/sport", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const URL_ = "https://micromobility.sa/api/account/sport";
  const get = (headers: Record<string, string> = HEADERS) => GET(new Request(URL_, { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => POST(new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answers: Record<string, Response>) => vi.fn(async (url: string) => {
    const a = answers[url.split("/rpc/")[1]];
    return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);

  it("says whether a member still has to answer, from the database's own ask", async () => {
    const fx = db({ customer_sport: json([{ competes: null, federations: null, other: null, asked: true }]), sport_option_list: json([{ code: "x_a", name_en: "Spikeball", name_ar: null }]) });
    vi.stubGlobal("fetch", fx);
    expect(await (await get()).json()).toEqual({ signedIn: true, need: true, competes: null, federations: [], other: "", options: [{ code: "x_a", en: "Spikeball", ar: null }] });
    expect(sent(fx)).toEqual([["customer_sport", { p_id: "c1", p_token: TOKEN }], ["sport_option_list", {}]]);
    // not asked: the added list is not read
    const fy = db({ customer_sport: json([{ competes: true, federations: ["judo", "other"], other: "Sumo", asked: false }]) });
    vi.stubGlobal("fetch", fy);
    expect(await (await get()).json()).toEqual({ signedIn: true, need: false, competes: true, federations: ["judo", "other"], other: "Sumo" });
    expect(sent(fy).map((c) => c[0])).toEqual(["customer_sport"]);
  });
  it("holds nobody on a database without the function, is signed out for a spent token, and asks nothing signed out", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: false, absent: true });
    vi.stubGlobal("fetch", db({ customer_sport: json([]) }));
    expect(await (await get()).json()).toEqual({ signedIn: false });
    const fy = db({});
    vi.stubGlobal("fetch", fy);
    expect(await (await get({})).json()).toEqual({ signedIn: false });
    expect(fy).not.toHaveBeenCalled();
  });
  it("saves a no, or a yes with its federations in the list's order, with the account's id and token", async () => {
    const fx = db({ customer_set_sport: json(true) });
    vi.stubGlobal("fetch", fx);
    expect(await (await post({ competes: false })).json()).toEqual({ ok: true });
    expect(await (await post({ competes: true, federations: ["yoga", "cycling"], other: "ignored" })).json()).toEqual({ ok: true });
    expect(await (await post({ competes: true, federations: ["other", "x_a", "judo"], other: "  Sumo  wrestling " })).json()).toEqual({ ok: true });
    expect(sent(fx).map((c) => c[1])).toEqual([
      { p_id: "c1", p_token: TOKEN, p_competes: false, p_federations: null, p_other: null },
      { p_id: "c1", p_token: TOKEN, p_competes: true, p_federations: ["cycling", "yoga"], p_other: null },
      { p_id: "c1", p_token: TOKEN, p_competes: true, p_federations: ["judo", "x_a", "other"], p_other: "Sumo wrestling" },
    ]);
  });
  it("refuses no answer, a yes with no federation or one outside the list before asking the database, and passes on its refusal", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    const cases: [unknown, string][] = [
      [{}, "pick"], [{ competes: "yes" }, "pick"], [{ competes: true }, "feds"], [{ competes: true, federations: [] }, "feds"],
      [{ competes: true, federations: ["cycling", "curling"] }, "feds"], [{ competes: true, federations: ["cycling", 5] }, "feds"],
      [{ competes: true, federations: ["other"] }, "other"], [{ competes: true, federations: ["other"], other: "x" }, "other"],
      [{ competes: true, federations: ["judo", "other"], other: "<b>hi</b>" }, "other"],
    ];
    for (const [body, problem] of cases) {
      const r = await post(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json(), JSON.stringify(body)).toEqual({ ok: false, error: "refused", problem });
    }
    expect(fx).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", db({ customer_set_sport: json({ code: "22023", message: "BAD_INPUT", details: "sport_feds" }, 400) }));
    expect(await (await post({ competes: true, federations: ["x_gone"] })).json()).toEqual({ ok: false, error: "refused", problem: "feds" });
    vi.stubGlobal("fetch", db({ customer_set_sport: json({ code: "22023", message: "BAD_INPUT", details: "sport_other" }, 400) }));
    expect(await (await post({ competes: true, federations: ["other"], other: "Sumo" })).json()).toEqual({ ok: false, error: "refused", problem: "other" });
  });
  it("says absent on a database without the function, signin for a spent session or none, and refuses another site", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await post({ competes: false })).json()).toEqual({ ok: false, error: "absent" });
    vi.stubGlobal("fetch", db({ customer_set_sport: json(false) }));
    expect(await (await post({ competes: false })).json()).toEqual({ ok: false, error: "signin" });
    expect((await post({ competes: false }, { ...HEADERS, cookie: "" })).status).toBe(401);
    expect((await post({ competes: false }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
  });
});
