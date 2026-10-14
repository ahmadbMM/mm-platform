import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { nidClean, nidOf, nidRefused, nidValid } from "../national-id";
import { GET, POST } from "../../app/api/account/national-id/route";
import NationalIdCard from "../../components/account/NationalIdCard";
import { NATIONAL_ID_WORDS } from "../../components/account/NationalId.words";
import { TxProvider } from "../../i18n/TxProvider";
import { LOCALES } from "../../i18n/locales";

describe("ID and Iqama numbers", () => {
  it("are 10 digits starting 1 or 2, Arabic-Indic digits and spaces taken as the database takes them", () => {
    expect(nidClean("١٠٢٣ ٤٥٦٧ ٨٩")).toBe("1023456789");
    expect(nidClean("۲۰۰۰ 000 000")).toBe("2000000000");
    for (const v of ["1023456789", "2999999999", ""]) expect(nidValid(v), v).toBe(true);
    for (const v of ["3023456789", "102345678", "10234567890", "1O23456789"]) expect(nidValid(v), v).toBe(false);
    expect([nidOf("1023456789"), nidOf(null), nidOf("x"), nidOf(5)]).toEqual(["1023456789", "", "", ""]);
    expect(nidRefused({ details: "national_id" })).toBe(true);
    expect(nidRefused({ details: "blood_type" })).toBe(false);
  });
});

describe("the words", () => {
  it("are complete in every language the site speaks, the booking app's own in English and Arabic, and never emoji", () => {
    expect(Object.keys(NATIONAL_ID_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const [loc, w] of Object.entries(NATIONAL_ID_WORDS)) {
      for (const [k, v] of Object.entries(w)) {
        expect(v.trim(), `${loc} ${k}`).not.toBe("");
        expect(v, `${loc} ${k}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    }
    expect(NATIONAL_ID_WORDS.en).toEqual({ title: "ID or Iqama number", sub: "Asked for blood donation events. Only you and our team can see it.", ph: "10 digits", err: "Enter your 10-digit ID or Iqama number.", save: "Save", saved: "Saved." });
    expect(NATIONAL_ID_WORDS.ar).toEqual({ title: "رقم الهوية أو الإقامة", sub: "يُطلب في فعاليات التبرع بالدم. لا يراه إلا أنت وفريقنا.", ph: "10 أرقام", err: "أدخل رقم الهوية أو الإقامة المكوّن من 10 أرقام.", save: "حفظ", saved: "تم الحفظ." });
  });
});

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

describe("the card", () => {
  it("is one numeric box, left to right, with the stored number, the placeholder and a square Save", () => {
    const html = renderToStaticMarkup(createElement(Tx, { locale: "ar", dict: null }, createElement(NationalIdCard, { initial: "2123456789" })));
    expect(html).toMatch(/<input[^>]*inputMode="numeric"/);
    expect(html).toMatch(/<input[^>]*dir="ltr"/);
    expect(html).toMatch(/<input[^>]*placeholder="10 أرقام"/);
    expect(html).toMatch(/<input[^>]*value="2123456789"/);
    expect(html).toContain('class="ac-go bt-save"');
    expect(html).toContain(">حفظ<");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("api/account/national-id", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const URL_ = "https://micromobility.sa/api/account/national-id";
  const get = (headers: Record<string, string> = HEADERS) => GET(new Request(URL_, { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => POST(new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answers: Record<string, Response>) => vi.fn(async (url: string) => {
    const a = answers[url.split("/rpc/")[1]];
    return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);

  it("reads the account's own, and says when the database has none of it yet", async () => {
    const fx = db({ customer_national_id: json("1023456789") });
    vi.stubGlobal("fetch", fx);
    expect(await (await get()).json()).toEqual({ signedIn: true, idNo: "1023456789" });
    expect(sent(fx)).toEqual([["customer_national_id", { p_id: "c1", p_token: TOKEN }]]);
    vi.stubGlobal("fetch", db({ customer_national_id: json(null) }));
    expect(await (await get()).json()).toEqual({ signedIn: true, idNo: "" });
    vi.stubGlobal("fetch", db({}));
    expect(await (await get()).json()).toEqual({ signedIn: true, absent: true });
    const fy = db({});
    vi.stubGlobal("fetch", fy);
    expect(await (await get({})).json()).toEqual({ signedIn: false });
    expect(fy).not.toHaveBeenCalled();
  });
  it("saves a number, cleaned, or a clear, with the account's id and token", async () => {
    const fx = db({ customer_set_national_id: json(true) });
    vi.stubGlobal("fetch", fx);
    for (const idNo of ["1023456789", "٢٠٢٣ ٤٥٦ ٧٨٩", ""]) expect(await (await post({ idNo })).json()).toEqual({ ok: true });
    expect(sent(fx).map((c) => c[1])).toEqual(["1023456789", "2023456789", ""].map((p_id_no) => ({ p_id: "c1", p_token: TOKEN, p_id_no })));
  });
  it("refuses a number the rule refuses before asking the database, and passes on the database's refusal", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    for (const idNo of ["3023456789", "12345", 1023456789, undefined]) {
      const r = await post({ idNo });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, error: "refused" });
    }
    expect(fx).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", db({ customer_set_national_id: json({ code: "22023", message: "BAD_INPUT", details: "national_id" }, 400) }));
    expect(await (await post({ idNo: "1023456789" })).json()).toEqual({ ok: false, error: "refused" });
  });
  it("says absent on a database without the function, signin for a spent session or none, and refuses another site", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await (await post({ idNo: "1023456789" })).json()).toEqual({ ok: false, error: "absent" });
    vi.stubGlobal("fetch", db({ customer_set_national_id: json(false) }));
    expect(await (await post({ idNo: "1023456789" })).json()).toEqual({ ok: false, error: "signin" });
    expect((await post({ idNo: "1023456789" }, { ...HEADERS, cookie: "" })).status).toBe(401);
    expect((await post({ idNo: "1023456789" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
  });
});
