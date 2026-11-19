import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as signUp } from "../../app/api/account/signup/route";
import { PRIVACY_VERSION } from "@/content/privacy-notice";
import { EM_EMPTY, type EmFields } from "../emergency";
import {
  FORGOT_WA_SHOWN, forgotWaHref, herePath, joinName, nameTyped, newCustomerId, safeNext, signupCheck, signupFieldsOf, signupRefusal, siteAuthHref, withNext,
  type SignupFields,
} from "../signup";

// Create account on micromobility.sa (the user, 2026-11-19): the booking app's doSignup, checked in its order on the
// page and again on the server (lib/signup.ts), made by api/account/signup with the booking app's own functions - and
// the way to it and to Forgot password from the site's sign-in (siteAuthHref, safeNext).
const em: EmFields = { name: "Huda Ali", cc: "+966", phone: "0559876543", rel: "sibling" };
const ok: SignupFields = {
  first: "sara", last: "al harbi", gender: "female", email: " Sara@Example.com ", cc: "+966", phone: "055 123 4567", password: "ride the corniche",
  height: "165", em1: em, em2: null, privacy: true, news: false,
};
const check = (x: Partial<SignupFields>) => signupCheck({ ...ok, ...x });
const problem = (x: Partial<SignupFields>) => {
  const r = check(x);
  return "error" in r ? r : null;
};

describe("signupCheck", () => {
  it("sends what customer_signup takes, the contacts and the ride-news answer", () => {
    expect(check({})).toEqual({
      args: { p_name: "Sara Al Harbi", p_email: "sara@example.com", p_phone: "+966551234567", p_pwd: "ride the corniche", p_height: 165, p_type_preference: "Any", p_gender: "female" },
      em1: { name: "Huda Ali", phone: "+966559876543", rel: "sibling" }, em2: null, news: false,
    });
    const r = check({ news: true, em2: { name: "Omar Saleh", cc: "+20", phone: "1012345678", rel: "friend" }, height: "١٧٠" });
    expect("args" in r && [r.news, r.em2, r.args.p_height]).toEqual([true, { name: "Omar Saleh", phone: "+201012345678", rel: "friend" }, 170]);
  });
  it("asks in the booking app's order: names, gender, email, mobile, password, contacts, the notice, then the height", () => {
    const all: Partial<SignupFields> = { first: "", last: "", gender: "", email: "", phone: "", password: "", em1: EM_EMPTY, privacy: false, height: "" };
    const order: string[] = [];
    let f = { ...all };
    const fix: [keyof SignupFields, unknown][] = [["first", "Sara"], ["last", "Ali"], ["gender", "male"], ["email", "s@x.co"], ["phone", "0551234567"], ["password", "long enough pw"], ["em1", em], ["privacy", true], ["height", "180"]];
    for (const [k, v] of fix) {
      const p = problem(f);
      order.push(p ? `${p.error}${"field" in p && p.field ? `@${p.field}` : ""}${"which" in p ? `#${p.which}` : ""}` : "none");
      f = { ...f, [k]: v };
    }
    expect(order).toEqual(["enter_name@first", "enter_name@last", "gender@gender", "email_required@email", "phone_required@phone", "password_short@password", "em_name#1", "privacy@privacy", "height@height"]);
    expect(problem(f)).toBeNull();
  });
  it("keeps the booking app's name rule: letters, marks, spaces and periods, two letters a word, two words", () => {
    expect(problem({ first: "Sara1" })).toEqual({ error: "name_chars", field: "first" });
    expect(problem({ last: "Al-Harbi" })).toEqual({ error: "name_chars", field: "last" }); // the box turns a typed dash into a space first
    expect(problem({ first: "S", last: "Ali" })).toEqual({ error: "name_short", field: "first" });
    expect(problem({ last: "A. Khan" })).toEqual({ error: "name_short", field: "last" });
    expect(problem({ first: ".Sara" })).toEqual({ error: "name_chars", field: "first" });
    expect(problem({ first: "Md.", last: "Rahman" })).toBeNull();
    expect(problem({ first: "محمد", last: "العتيبي" })).toBeNull();
    expect(problem({ first: "अनिता", last: "शर्मा" })).toBeNull(); // vowel signs are marks
    const r = check({ first: "  ahmed ", last: "ALI  bin   saeed" });
    expect("args" in r && r.args.p_name).toBe("Ahmed ALI Bin Saeed");
  });
  it("refuses an email the booking app or the database would", () => {
    for (const e of ["sara", "sara@x", "sara @x.com", "sara@x.c", "a@privaterelay.appleid.com"]) expect(problem({ email: e })?.error).toBe("email_invalid");
    // invisible marks an Arabic keyboard brings are taken out, not kept in the address
    const r = check({ email: "‏sara@example.com‎" });
    expect("args" in r && r.args.p_email).toBe("sara@example.com");
  });
  it("reads the mobile under its dial code, as the booking app stores it", () => {
    expect(problem({ phone: "0551234" })).toEqual({ error: "phone_invalid", field: "phone" });
    expect(problem({ phone: "0451234567" })).toEqual({ error: "phone_invalid", field: "phone" }); // a Saudi number must be a mobile
    expect(problem({ cc: "+1", phone: "4155550123456789" })).toEqual({ error: "phone_invalid", field: "phone" }); // 15 digits at most with the code
    const at = (cc: string, phone: string) => { const r = check({ cc, phone }); return "args" in r ? r.args.p_phone : null; };
    expect(at("+966", "٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567");
    expect(at("+966", "+20 101 234 5678")).toBe("+201012345678"); // typed with its own code
    expect(at("+20", "01012345678")).toBe("+201012345678"); // the trunk 0 goes
    expect(at("+91", "9198765432")).toBe("+919198765432"); // an Indian mobile that starts 91 is not the code twice
  });
  it("keeps the password rule: 8 characters or more, not one too easy to guess", () => {
    expect(problem({ password: "short1A" })).toEqual({ error: "password_short", field: "password" });
    expect(problem({ password: "Password123" })).toEqual({ error: "password_common", field: "password" });
    expect(problem({ password: "aaaaaaaaaa" })).toEqual({ error: "password_common", field: "password" });
    expect(problem({ password: " spaced out " })).toBeNull(); // never trimmed
  });
  it("asks the first emergency contact, and the second only when any of its boxes is filled", () => {
    expect(problem({ em1: EM_EMPTY })).toEqual({ error: "em_name", which: 1 });
    expect(problem({ em1: { ...em, phone: "055 123 4567" } })).toEqual({ error: "em_self", which: 1 });
    expect(problem({ em2: { ...EM_EMPTY } })).toBeNull();
    expect(problem({ em2: { ...EM_EMPTY, name: "Omar Saleh" } })).toEqual({ error: "em_phone", which: 2 });
    expect(problem({ em2: { ...em } })).toEqual({ error: "em_same", which: 2 });
    expect(problem({ em2: { name: "Omar Saleh", cc: "+966", phone: "0501112222", rel: "" } })).toEqual({ error: "em_relation", which: 2 });
  });
  it("needs the Privacy Notice box; ride news may stay empty", () => {
    expect(problem({ privacy: false })).toEqual({ error: "privacy", field: "privacy" });
    expect(problem({ news: false })).toBeNull();
  });
  it("takes a height of 100 to 250 cm", () => {
    for (const h of ["99", "251", "1.65", "abc", ""]) expect(problem({ height: h })).toEqual({ error: "height", field: "height" });
    expect(problem({ height: "100" })).toBeNull();
    expect(problem({ height: "250" })).toBeNull();
  });
});

describe("the name boxes as typed", () => {
  it("turn a dash into a space and drop what the rule refuses, saying so", () => {
    expect(nameTyped("Al-Harbi")).toEqual({ value: "Al Harbi", dropped: false });
    expect(nameTyped("Sara2")).toEqual({ value: "Sara", dropped: true });
    expect(nameTyped("Md..")).toEqual({ value: "Md.", dropped: false });
    expect(nameTyped("محمد")).toEqual({ value: "محمد", dropped: false });
  });
  it("are joined with every word capitalised", () => {
    expect(joinName("o'brien", "mc.donald")).toBe("O'Brien Mc.Donald");
  });
});

describe("signupFieldsOf", () => {
  it("reads only what the form sends, each to a sane length", () => {
    expect(signupFieldsOf(null)).toEqual({ first: "", last: "", gender: "", email: "", cc: "+966", phone: "", password: "", height: "", em1: EM_EMPTY, em2: null, privacy: false, news: false });
    const f = signupFieldsOf({ first: "x".repeat(500), gender: "other", privacy: "true", news: true, em1: { name: "A", rel: "boss", cc: 5 }, em2: { name: "B", cc: "+20", phone: "1", rel: "friend" } });
    expect([f.first.length, f.gender, f.privacy, f.news, f.em1, f.em2]).toEqual([80, "", false, true, { name: "A", cc: "+966", phone: "", rel: "" }, { name: "B", cc: "+20", phone: "1", rel: "friend" }]);
  });
});

describe("signupRefusal", () => {
  it("words customer_signup's refusals as the booking app does", () => {
    expect(signupRefusal({ status: 400, message: "BAD_INPUT", details: "name_chars" }, "x")).toEqual({ error: "name_chars" });
    expect(signupRefusal({ status: 400, message: "name_short" }, "x")).toEqual({ error: "name_short" });
    expect(signupRefusal({ status: 400, message: "RATE_LIMITED" }, "x")).toEqual({ error: "rate_limited" });
    expect(signupRefusal({ status: 409, code: "23505", message: "duplicate key" }, "x")).toEqual({ error: "email_taken", field: "email" });
    expect(signupRefusal({ status: 400, message: "DUPLICATE" }, "x")).toEqual({ error: "email_taken", field: "email" });
    expect(signupRefusal({ status: 400, code: "22023", message: "BAD_INPUT", details: "phone" }, "x")).toEqual({ error: "phone_invalid", field: "phone" });
    expect(signupRefusal({ status: 500, message: "boom" }, "x")).toEqual({ error: "connection" });
    expect(signupRefusal({ status: 0 }, "x")).toEqual({ error: "connection" });
  });
  it("tells a database that still asks the old password rule from a password too easy to guess", () => {
    const weak = { status: 400, message: "WEAK_PASSWORD" };
    expect(signupRefusal(weak, "ride the corniche")).toEqual({ error: "password_old", field: "password" });
    expect(signupRefusal(weak, "Corniche2026")).toEqual({ error: "password_common", field: "password" });
    expect(signupRefusal(weak, "short")).toEqual({ error: "password_short", field: "password" });
  });
});

describe("newCustomerId", () => {
  it("is the booking app's uid(): seven random letters and digits, then the time in base 36", () => {
    const now = Date.UTC(2026, 10, 19, 9);
    expect(newCustomerId(now, new Uint8Array([0, 1, 35, 36, 71, 200, 255]))).toBe(`01z0z${(200 % 36).toString(36)}${(255 % 36).toString(36)}${now.toString(36)}`);
    const a = newCustomerId(), b = newCustomerId();
    expect(a).toMatch(/^[0-9a-z]{7}[0-9a-z]{8,9}$/);
    expect(a).not.toBe(b);
  });
});

describe("where the sign-in and the sign-up go", () => {
  it("only to a path on this site", () => {
    expect(safeNext("/ask/club-survey?x=1#q")).toBe("/ask/club-survey?x=1#q");
    expect(safeNext("/account")).toBe("/account");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/x\nLocation: y", "javascript:alert(1)", "", "ask", "/api/account", "/API/x", null, 5]) expect(safeNext(bad)).toBeNull();
  });
  it("carry ?next= (not when it is My Account) and the language", () => {
    expect(withNext("/signup", "/live")).toBe("/signup?next=%2Flive");
    expect(withNext("/signup", "/account")).toBe("/signup");
    expect(withNext("/account", "/ask/x?y=1", "ar")).toBe("/account?next=%2Fask%2Fx%3Fy%3D1&lang=ar");
    expect(withNext("/signup", "https://evil.example", "x1")).toBe("/signup");
  });
  it("come back to the page the sign-in is on, or where it was itself to go", () => {
    expect(herePath("/live", "?lang=ar")).toBe("/live");
    expect(herePath("/account", "?handoff=expired&lang=en")).toBe("/account");
    expect(herePath("/ask/club", "?q=2")).toBe("/ask/club?q=2");
    expect(herePath("/account", "?next=%2Fask%2Fclub&lang=en")).toBe("/ask/club");
    expect(herePath("/account", "?next=https%3A%2F%2Fevil.example")).toBe("/account");
  });
  it("turn the booking app's Create account and Forgot password hand-overs into the site's own pages", () => {
    const app = (auth: string) => `https://experiences.micromobility.sa/?handoff=site&auth=${auth}&lang=ar`;
    expect(siteAuthHref(app("signup"), "/live")).toBe("/signup?next=%2Flive&lang=ar");
    expect(siteAuthHref(app("forgot"), "/account")).toBe("/forgot-password?lang=ar");
    expect(siteAuthHref(app("forgot"), "")).toBe("/forgot-password?lang=ar"); // drawn on the server: no page yet
    expect(siteAuthHref("https://experiences.micromobility.sa/?handoff=site", "/live")).toBeNull(); // any other hand-over stays
    expect(siteAuthHref("https://experiences.micromobility.sa/?auth=signup", "/live")).toBeNull();
    expect(siteAuthHref("/account", "/live")).toBeNull();
  });
  it("send a forgotten password to the booking app's WhatsApp number, the message filled in", () => {
    expect(forgotWaHref("Hi MicroMobility, I forgot my password.")).toBe("https://wa.me/966579543997?text=Hi%20MicroMobility%2C%20I%20forgot%20my%20password.");
    expect(FORGOT_WA_SHOWN).toBe("+966 57 954 3997");
  });
});

// The route, with the database answered here: what it calls, in what order, and the cookie it sets.
const ORIGIN = "https://micromobility.sa";
const TOK = "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0a1b2c3d4";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  signUp(new Request(`${ORIGIN}/api/account/signup`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
type Db = { exists?: (a: { p_email: string; p_phone: string }) => Response; signup?: Response; em?: Response };
function db(o: Db = {}) {
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const fn = String(url).split("/rpc/")[1];
    const a = JSON.parse(String(init?.body ?? "{}"));
    if (fn === "customer_exists") return o.exists ? o.exists(a) : json(false);
    if (fn === "customer_signup") return o.signup ?? json([{ id: a.p_id, session_token: TOK }]);
    if (fn === "customer_consents") return json({ privacy_version: a.p_privacy, ride_news: a.p_ride_news });
    if (fn === "customer_set_emergency") return o.em ?? json(true);
    if (fn === "customer_set_emergency2") return json(true);
    return json(null, 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}
const calls = (f: ReturnType<typeof db>) => f.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))] as [string, Record<string, unknown>]);
const BODY = { ...ok, em2: { name: "Omar Saleh", cc: "+20", phone: "1012345678", rel: "friend" }, news: true, check: "" };

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("api/account/signup", () => {
  it("makes the account as the booking app does and signs the site in", async () => {
    const f = db();
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: "Sara Al Harbi" });
    const c = calls(f);
    expect(c.map(([fn]) => fn)).toEqual(["customer_exists", "customer_exists", "customer_signup", "customer_consents", "customer_set_emergency", "customer_set_emergency2"]);
    expect(c[0][1]).toEqual({ p_email: "sara@example.com", p_phone: "" });
    expect(c[1][1]).toEqual({ p_email: "", p_phone: "+966551234567" });
    const id = c[2][1].p_id as string;
    expect(id).toMatch(/^[0-9a-z]{15,16}$/);
    expect(c[2][1]).toEqual({ p_id: id, p_name: "Sara Al Harbi", p_email: "sara@example.com", p_phone: "+966551234567", p_pwd: "ride the corniche", p_height: 165, p_type_preference: "Any", p_gender: "female" });
    expect(c[3][1]).toEqual({ p_id: id, p_token: TOK, p_privacy: PRIVACY_VERSION, p_ride_news: true });
    expect(c[4][1]).toEqual({ p_id: id, p_token: TOK, p_name: "Huda Ali", p_phone: "+966559876543", p_relation: "sibling" });
    expect(c[5][1]).toEqual({ p_id: id, p_token: TOK, p_name: "Omar Saleh", p_phone: "+201012345678", p_relation: "friend" });
    expect(res.headers.getSetCookie()).toEqual([`mm_acct=${id}~${TOK}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`, "mm_acct_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
  });
  it("says which of the email and the mobile is taken, before making anything", async () => {
    let f = db({ exists: (a) => json(a.p_email !== "") });
    let res = await post(BODY);
    expect([res.status, await res.json()]).toEqual([409, { ok: false, error: "email_taken", field: "email" }]);
    expect(calls(f).map(([fn]) => fn)).toEqual(["customer_exists"]);
    f = db({ exists: (a) => json(a.p_phone !== "") });
    res = await post(BODY);
    expect([res.status, await res.json()]).toEqual([409, { ok: false, error: "phone_taken", field: "phone" }]);
    expect(calls(f).map(([fn]) => fn)).toEqual(["customer_exists", "customer_exists"]);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
  it("checks everything again whatever the page said, and asks the database nothing then", async () => {
    const f = db();
    const res = await post({ ...BODY, privacy: false });
    expect([res.status, await res.json()]).toEqual([400, { ok: false, error: "privacy", field: "privacy" }]);
    expect(await (await post({ ...BODY, em1: { ...EM_EMPTY } })).json()).toEqual({ ok: false, error: "em_name", which: 1 });
    expect(f).not.toHaveBeenCalled();
  });
  it("words customer_signup's refusals and sets no cookie", async () => {
    db({ signup: json({ message: "RATE_LIMITED" }, 400) });
    let res = await post(BODY);
    expect([res.status, await res.json()]).toEqual([429, { ok: false, error: "rate_limited" }]);
    db({ signup: json({ code: "P0001", message: "WEAK_PASSWORD" }, 400) });
    res = await post(BODY);
    expect(await res.json()).toEqual({ ok: false, error: "password_old", field: "password" });
    db({ signup: json({ message: "down" }, 503) });
    res = await post(BODY);
    expect([res.status, await res.json()]).toEqual([502, { ok: false, error: "connection" }]);
    db({ signup: json([{ id: "x" }]) }); // no session came back
    res = await post(BODY);
    expect([res.status, await res.json(), res.headers.getSetCookie()]).toEqual([502, { ok: false, error: "connection" }, []]);
  });
  it("keeps the account made and signed in when a contact does not save, and saves no second one then", async () => {
    const f = db({ em: json({ message: "BAD_INPUT", details: "em_phone" }, 400) });
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(calls(f).map(([fn]) => fn)).not.toContain("customer_set_emergency2");
  });
  it("answers only this site's own pages", async () => {
    const f = db();
    const res = await post(BODY, { origin: "https://evil.example" });
    expect([res.status, await res.json()]).toEqual([403, { ok: false, error: "origin" }]);
    expect(f).not.toHaveBeenCalled();
  });
});
