import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { DIAL_CODES } from "../../content/dial-codes";
import { EM_EMPTY, EM_RELS, dialOptions, emAbsent, emPhone, emRead, emReadBoth, emRefusal, emState, type EmFields } from "../emergency";
import { GET, POST } from "../../app/api/account/emergency/route";
import EmergencyGate from "../../components/account/EmergencyGate";
import { EMERGENCY_WORDS } from "../../components/account/Emergency.words";
import { TxProvider } from "../../i18n/TxProvider";
import { LOCALES } from "../../i18n/locales";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// The emergency contact (the owner, 2026-10-07: the first required and unskippable for every customer,
// a second optional): the rules the database applies (customer_set_emergency, customer_set_emergency2),
// the account's check-up route, and its pop-up.
const f = (o: Partial<EmFields> = {}): EmFields => ({ name: "Layla Mansour", cc: "+966", phone: "0551234567", rel: "spouse", ...o });
const OWN = "+966552468013";

describe("a contact", () => {
  it("is a name, a mobile number with its dial code, and a relation, as the database stores them", () => {
    expect(emRead(f(), OWN)).toEqual({ contact: { name: "Layla Mansour", phone: "+966551234567", rel: "spouse" } });
    expect(emRead(f({ name: "  layla   mansour ", phone: "55 123 4567" }), OWN)).toEqual({ contact: { name: "layla mansour", phone: "+966551234567", rel: "spouse" } });
    expect(emRead(f({ cc: "+971", phone: "050 123 4567" }), OWN)).toEqual({ contact: { name: "Layla Mansour", phone: "+971501234567", rel: "spouse" } });
    expect(emRead(f({ cc: "+966", phone: "+44 7700 900123" }), OWN)).toMatchObject({ contact: { phone: "+447700900123" } });
    expect(emRead(f({ phone: "00201001234567" }), OWN)).toMatchObject({ contact: { phone: "+201001234567" } });
    expect(emRead(f({ phone: "٠٥٥١٢٣٤٥٦٧" }), OWN)).toMatchObject({ contact: { phone: "+966551234567" } });
    expect(emRead(f({ phone: "966551234567" }), OWN)).toMatchObject({ contact: { phone: "+966551234567" } });
    expect(emRead(f({ name: "Md. Rahman" }), OWN)).toMatchObject({ contact: { name: "Md. Rahman" } });
  });
  it("turns a typed dash into a space, and takes only letters, spaces and periods, every part two letters or more", () => {
    expect(emRead(f({ name: "Layla-Mansour" }), OWN)).toMatchObject({ contact: { name: "Layla Mansour" } });
    expect(emRead(f({ name: "" }), OWN)).toEqual({ error: "em_name" });
    expect(emRead(f({ name: "L" }), OWN)).toEqual({ error: "em_name" });
    expect(emRead(f({ name: "x".repeat(81) }), OWN)).toEqual({ error: "em_name" });
    expect(emRead(f({ name: "Layla M4nsour" }), OWN)).toEqual({ error: "name_chars" });
    expect(emRead(f({ name: "Layla M" }), OWN)).toEqual({ error: "name_short" });
  });
  it("needs a number of 8 to 15 digits, never the rider's own, and a relation", () => {
    expect(emRead(f({ phone: "" }), OWN)).toEqual({ error: "em_phone" });
    expect(emRead(f({ phone: "123" }), OWN)).toEqual({ error: "em_phone" });
    expect(emRead(f({ phone: "0552468013" }), OWN)).toEqual({ error: "em_self" });
    expect(emRead(f({ phone: "+966 55 246 8013" }), OWN)).toEqual({ error: "em_self" });
    expect(emRead(f({ phone: "0552468013" }), "")).toMatchObject({ contact: {} }); // the rider's own number not known: the database checks it
    expect(emRead(f({ rel: "" }), OWN)).toEqual({ error: "em_relation" });
    expect(emRead(f({ rel: "boss" as never }), OWN)).toEqual({ error: "em_relation" });
  });
  it("keeps the dial code's number as typed when it carries its own code", () => {
    expect(emPhone("+966", "")).toBe("");
    expect(emPhone("+1", "(415) 555-0132")).toBe("+14155550132");
    expect(emPhone("+966", "+966 0551234567")).toBe("+966551234567");
  });
});

describe("the two contacts", () => {
  it("need the first; a second left empty is none", () => {
    expect(emReadBoth(EM_EMPTY, null, OWN)).toEqual({ error: "em_name", which: 1 });
    expect(emReadBoth(f(), EM_EMPTY, OWN)).toEqual({ first: { name: "Layla Mansour", phone: "+966551234567", rel: "spouse" }, second: null });
    expect(emReadBoth(f(), null, OWN)).toMatchObject({ second: null });
  });
  it("take a second with all three boxes, and never the first one's number", () => {
    expect(emReadBoth(f(), { ...EM_EMPTY, name: "Omar Mansour" }, OWN)).toEqual({ error: "em_phone", which: 2 });
    expect(emReadBoth(f(), f({ name: "Omar Mansour", rel: "" , phone: "0559876541" }), OWN)).toEqual({ error: "em_relation", which: 2 });
    expect(emReadBoth(f(), f({ name: "Omar Mansour", phone: "+966551234567" }), OWN)).toEqual({ error: "em_same", which: 2 });
    expect(emReadBoth(f(), f({ name: "Omar Mansour", phone: "0552468013" }), OWN)).toEqual({ error: "em_self", which: 2 });
    expect(emReadBoth(f(), f({ name: "Omar Mansour", phone: "0559876541", rel: "sibling" }), OWN))
      .toEqual({ first: { name: "Layla Mansour", phone: "+966551234567", rel: "spouse" }, second: { name: "Omar Mansour", phone: "+966559876541", rel: "sibling" } });
  });
});

describe("the database's answers", () => {
  it("read a refusal's detail, a missing function, and the row customer_emergency answers", () => {
    expect(emRefusal({ details: "em_self", message: "BAD_INPUT" })).toBe("em_self");
    expect(emRefusal({ message: "BAD_INPUT em_same" })).toBe("em_same");
    expect(emRefusal({ details: "em_required" })).toBe("em_name");
    expect(emRefusal({ message: "boom" })).toBeNull();
    expect(emAbsent({ code: "PGRST202", message: "" })).toBe(true);
    expect(emAbsent({ code: "42883", message: "Could not find the function public.customer_emergency" })).toBe(true);
    expect(emAbsent({ code: "22023", message: "BAD_INPUT" })).toBe(false);
    const six = { emergency_name: "Layla", emergency_phone: "+966551234567", emergency_relation: "spouse", emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
    expect(emState(six)).toEqual({ has: true, two: true });
    expect(emState({ ...six, emergency_relation: null })).toEqual({ has: false, two: true });
    expect(emState({ emergency_name: null, emergency_phone: null, emergency_relation: null })).toEqual({ has: false, two: false });
    expect(emState(null)).toEqual({ has: false, two: true });
  });
});

describe("the dial codes", () => {
  it("are the booking app's list: Saudi Arabia first and again in its place, the Gulf next, never Israel", () => {
    expect(DIAL_CODES[0]).toEqual(["+966", "SA", "Saudi Arabia"]);
    expect(DIAL_CODES.some(([, iso, name]) => iso === "IL" || /israel/i.test(name))).toBe(false);
    for (const loc of ["en", "ar", "fr"]) {
      const o = dialOptions(loc);
      expect(o[0].value).toBe("+966");
      expect(o.slice(1, 6).map((x) => x.value)).toEqual(["+971", "+974", "+965", "+973", "+968"]);
      expect(o.filter((x) => x.value === "+966")).toHaveLength(2);
      expect(o.some((x) => /israel|إسرائيل/i.test(x.label))).toBe(false);
      expect(o).toHaveLength(DIAL_CODES.length + 1);
    }
    expect(dialOptions("en")[0].label).toBe("+966 Saudi Arabia");
    expect(dialOptions("ar")[0].label).toBe("+966 السعودية");
  });
});

describe("the words", () => {
  it("are complete in every language the site speaks, the booking app's own in English and Arabic, and never emoji", () => {
    expect(Object.keys(EMERGENCY_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const [loc, w] of Object.entries(EMERGENCY_WORDS)) {
      for (const [k, v] of Object.entries(w)) {
        if (k === "rel") expect(Object.keys(v).sort(), loc).toEqual([...EM_RELS].sort());
        for (const s of typeof v === "string" ? [v] : Object.values(v as Record<string, string>)) {
          expect(s.trim(), `${loc} ${k}`).not.toBe("");
          expect(s, `${loc} ${k}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
        }
      }
    }
    const en = EMERGENCY_WORDS.en, ar = EMERGENCY_WORDS.ar;
    expect([en.title, en.name, en.phone, en.relation, en.title2, en.add2, en.errSelf, en.errSame, en.reqTitle]).toEqual([
      "Emergency contact", "Contact’s name", "Contact’s mobile number", "Relationship to you", "Second emergency contact", "Add a second contact",
      "Your contact’s number can’t be your own.", "The two emergency contacts can’t have the same number.", "Add your emergency contact",
    ]);
    expect(en.reqSub).toBe("We now ask every rider for someone we can call if you need help at a ride or event. Add them once and you can book.");
    expect([ar.reqTitle, ar.reqSub]).toEqual(["أضف جهة اتصال للطوارئ", "نطلب الآن من كل راكب شخصًا نتصل به إن احتجت إلى مساعدة في رحلة أو فعالية. أضفه مرة واحدة وتستطيع الحجز."]);
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const ROW = { emergency_name: "Layla Mansour", emergency_phone: "+966551234567", emergency_relation: "spouse", emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const NONE = { ...ROW, emergency_name: null, emergency_phone: null, emergency_relation: null };

describe("api/account/emergency", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const get = (headers: Record<string, string> = HEADERS) => GET(new Request("https://micromobility.sa/api/account/emergency", { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/emergency", { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answers: Record<string, Response | (() => Response)>) => vi.fn(async (url: string) => {
    const fn = url.split("/rpc/")[1];
    const a = answers[fn];
    return typeof a === "function" ? a() : a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);

  it("answers a signed-out visitor from the cookie alone", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    expect(await (await get({})).json()).toEqual({ signedIn: false });
    expect(fx).not.toHaveBeenCalled();
  });
  it("asks for the contact of an account without one, and says whether a second is taken", async () => {
    vi.stubGlobal("fetch", db({ customer_emergency: json([NONE]) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: true, two: true });
    vi.stubGlobal("fetch", db({ customer_emergency: json([{ emergency_name: null, emergency_phone: null, emergency_relation: null }]) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: true, two: false });
    vi.stubGlobal("fetch", db({ customer_emergency: json([ROW]) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: false, two: true });
  });
  it("holds nobody when the database cannot answer, and reads a session that ended as signed out", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: false, absent: true });
    vi.stubGlobal("fetch", db({ customer_emergency: json({ message: "boom" }, 503) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, need: false });
    vi.stubGlobal("fetch", db({ customer_emergency: json([]) }));
    expect(await (await get()).json()).toEqual({ signedIn: false });
  });
  it("saves the first contact, then the second when it is filled, with the account's id and token", async () => {
    const fx = db({ customer_set_emergency: json(true), customer_set_emergency2: json(true) });
    vi.stubGlobal("fetch", fx);
    const r = await post({ one: f(), two: f({ name: "Omar Mansour", phone: "0559876541", rel: "friend" }) });
    expect(await r.json()).toEqual({ ok: true });
    expect(sent(fx)).toEqual([
      ["customer_set_emergency", { p_id: "c1", p_token: TOKEN, p_name: "Layla Mansour", p_phone: "+966551234567", p_relation: "spouse" }],
      ["customer_set_emergency2", { p_id: "c1", p_token: TOKEN, p_name: "Omar Mansour", p_phone: "+966559876541", p_relation: "friend" }],
    ]);
    const fy = db({ customer_set_emergency: json(true) });
    vi.stubGlobal("fetch", fy);
    expect(await (await post({ one: f(), two: EM_EMPTY })).json()).toEqual({ ok: true });
    expect(sent(fy).map((c) => c[0])).toEqual(["customer_set_emergency"]);
  });
  it("refuses a contact the rules refuse before asking the database, and passes on the database's own refusal", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    const r = await post({ one: f({ rel: "" }) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "refused", problem: { error: "em_relation", which: 1 } });
    expect(await (await post({ one: f(), two: f({ name: "Omar Mansour" }) })).json()).toEqual({ ok: false, error: "refused", problem: { error: "em_same", which: 2 } });
    expect(fx).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", db({ customer_set_emergency: json({ code: "22023", message: "BAD_INPUT", details: "em_self" }, 400) }));
    expect(await (await post({ one: f() })).json()).toEqual({ ok: false, error: "refused", problem: { error: "em_self", which: 1 } });
    vi.stubGlobal("fetch", db({ customer_set_emergency: json(true), customer_set_emergency2: json({ code: "22023", message: "BAD_INPUT", details: "em_same" }, 400) }));
    expect(await (await post({ one: f(), two: f({ name: "Omar Mansour", phone: "0559876541" }) })).json()).toEqual({ ok: false, error: "refused", problem: { error: "em_same", which: 2 } });
  });
  it("lets the rider through on a database without the functions, skips a second it cannot store, and reads a spent session", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await post({ one: f() })).json()).toEqual({ ok: true, absent: true });
    vi.stubGlobal("fetch", db({ customer_set_emergency: json(true) }));
    expect(await (await post({ one: f(), two: f({ name: "Omar Mansour", phone: "0559876541" }) })).json()).toEqual({ ok: true });
    vi.stubGlobal("fetch", db({ customer_set_emergency: json(false) }));
    const r = await post({ one: f() });
    expect([r.status, await r.json()]).toEqual([401, { ok: false, error: "signin" }]);
    vi.stubGlobal("fetch", db({ customer_set_emergency: json({ message: "boom" }, 503) }));
    expect((await post({ one: f() })).status).toBe(502);
  });
  it("is this site's own: another origin or no account is turned away", async () => {
    vi.stubGlobal("fetch", db({}));
    expect((await post({ one: f() }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ one: f() }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post({})).status).toBe(400);
  });
});

describe("the pop-up", () => {
  const draw = (locale = "en", two = true) => renderToStaticMarkup(createElement(Tx, { locale, dict: null }, createElement(EmergencyGate, { two, onDone: () => {} })));
  it("asks the contact with no way off but signing out, the second behind its button", () => {
    const html = draw();
    for (const s of ["Add your emergency contact", "We now ask every rider for someone we can call if you need help at a ride or event. Add them once and you can book.",
      "Contact’s name", "Contact’s mobile number", "Relationship to you", "Choose", "Son or daughter", "Add a second contact", "Save", "Sign out"]) expect(html).toContain(s);
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/<button/g)).toHaveLength(3); // add a second, save, sign out: no close
    expect(html).not.toContain("Second emergency contact");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(draw("en", false)).not.toContain("Add a second contact"); // a database that takes one contact
  });
  it("speaks the page's language", () => {
    const ar = draw("ar");
    for (const s of ["أضف جهة اتصال للطوارئ", "اسم جهة الاتصال", "رقم جوال جهة الاتصال", "صلة القرابة بك", "إضافة جهة اتصال ثانية", "حفظ", "تسجيل الخروج"]) expect(ar).toContain(s);
    expect(draw("de")).toContain("Füge deinen Notfallkontakt hinzu");
  });
});
