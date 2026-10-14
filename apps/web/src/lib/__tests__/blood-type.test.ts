import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import BloodTypeCard from "../../components/account/BloodTypeCard";
import { TxProvider } from "../../i18n/TxProvider";
import { BLOOD_TYPES, btOf, btRefused, btShow, btValid } from "../blood-type";
import { GET, POST } from "../../app/api/account/blood-type/route";
import { BLOOD_TYPE_WORDS } from "../../components/account/BloodType.words";
import { LOCALES } from "../../i18n/locales";

describe("blood types", () => {
  it("are the database's nine codes, '' clearing it", () => {
    expect([...BLOOD_TYPES]).toEqual(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
    for (const v of [...BLOOD_TYPES, "unknown", ""]) expect(btValid(v), v).toBe(true);
    for (const v of ["a+", "AB", "O", "UNKNOWN", "A−", " A+"]) expect(btValid(v), v).toBe(false);
    expect([btOf("O-"), btOf("unknown"), btOf(null), btOf("Z"), btOf(3)]).toEqual(["O-", "unknown", "", "", ""]);
  });
  it("show their minus as a minus sign", () => {
    expect(btShow("AB-")).toBe("AB−");
    expect(btShow("O+")).toBe("O+");
  });
  it("read the database's refusal", () => {
    expect(btRefused({ details: "blood_type", message: "BAD_INPUT" })).toBe(true);
    expect(btRefused({ details: "em_name", message: "BAD_INPUT" })).toBe(false);
  });
});

describe("the words", () => {
  it("are complete in every language the site speaks, the booking app's own in English and Arabic, and never emoji", () => {
    expect(Object.keys(BLOOD_TYPE_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const [loc, w] of Object.entries(BLOOD_TYPE_WORDS)) {
      for (const [k, v] of Object.entries(w)) {
        expect(v.trim(), `${loc} ${k}`).not.toBe("");
        expect(v, `${loc} ${k}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    }
    expect(BLOOD_TYPE_WORDS.en).toEqual({
      title: "Blood type", sub: "Helps us at blood donation events. Only you and our team can see it.", pick: "Choose your blood type",
      unknown: "I don't know my blood type", err: "Choose a blood type from the list.", save: "Save", saved: "Saved.",
    });
    expect(BLOOD_TYPE_WORDS.ar).toEqual({
      title: "فصيلة الدم", sub: "تساعدنا في فعاليات التبرع بالدم. لا يراها إلا أنت وفريقنا.", pick: "اختر فصيلة دمك",
      unknown: "لا أعرف فصيلة دمي", err: "اختر فصيلة دم من القائمة.", save: "حفظ", saved: "تم الحفظ.",
    });
  });
});

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

describe("the card", () => {
  it("lists the choose line, the eight types with a minus sign, and I don't know, with the stored one chosen and a square Save", () => {
    const html = renderToStaticMarkup(createElement(Tx, { locale: "ar", dict: null }, createElement(BloodTypeCard, { initial: "AB-" })));
    const opts = [...html.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]]);
    expect(opts).toEqual([["", "اختر فصيلة دمك"], ...BLOOD_TYPES.map((t) => [t, btShow(t)]), ["unknown", "لا أعرف فصيلة دمي"]]);
    expect(html).toMatch(/<option[^>]*value="AB-"[^>]*selected/);
    expect(html).toContain('class="ac-go bt-save"');
    expect(html).toContain(">حفظ<");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("api/account/blood-type", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const URL_ = "https://micromobility.sa/api/account/blood-type";
  const get = (headers: Record<string, string> = HEADERS) => GET(new Request(URL_, { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => POST(new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answers: Record<string, Response>) => vi.fn(async (url: string) => {
    const a = answers[url.split("/rpc/")[1]];
    return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);

  it("reads the account's own, and says when the database has none of it yet", async () => {
    const fx = db({ customer_blood_type: json("AB-") });
    vi.stubGlobal("fetch", fx);
    expect(await (await get()).json()).toEqual({ signedIn: true, type: "AB-" });
    expect(sent(fx)).toEqual([["customer_blood_type", { p_id: "c1", p_token: TOKEN }]]);
    vi.stubGlobal("fetch", db({ customer_blood_type: json(null) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, type: "" });
    vi.stubGlobal("fetch", db({}));
    expect(await (await get()).json()).toEqual({ signedIn: true, absent: true });
    const fy = db({});
    vi.stubGlobal("fetch", fy);
    expect(await (await get({})).json()).toEqual({ signedIn: false });
    expect(fy).not.toHaveBeenCalled();
  });
  it("saves a type, 'unknown' or a clear with the account's id and token", async () => {
    const fx = db({ customer_set_blood_type: json(true) });
    vi.stubGlobal("fetch", fx);
    for (const type of ["O+", "unknown", ""]) expect(await (await post({ type })).json()).toEqual({ ok: true });
    expect(sent(fx).map((c) => c[1])).toEqual(["O+", "unknown", ""].map((p_type) => ({ p_id: "c1", p_token: TOKEN, p_type })));
  });
  it("refuses a value outside the list before asking the database, and passes on the database's refusal", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    for (const type of ["Z+", "o-", 5, undefined]) {
      const r = await post({ type });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, error: "refused" });
    }
    expect(fx).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", db({ customer_set_blood_type: json({ code: "22023", message: "BAD_INPUT", details: "blood_type" }, 400) }));
    expect(await (await post({ type: "A+" })).json()).toEqual({ ok: false, error: "refused" });
  });
  it("says absent on a database without the function, signin for a spent session or none, and refuses another site", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await post({ type: "A+" })).json()).toEqual({ ok: false, error: "absent" });
    vi.stubGlobal("fetch", db({ customer_set_blood_type: json(false) }));
    expect(await (await post({ type: "A+" })).json()).toEqual({ ok: false, error: "signin" });
    expect((await post({ type: "A+" }, { ...HEADERS, cookie: "" })).status).toBe(401);
    expect((await post({ type: "A+" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
  });
});
