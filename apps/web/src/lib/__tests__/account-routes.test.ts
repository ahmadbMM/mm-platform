import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as profile } from "../../app/api/account/profile/route";
import { DELETE as photoDelete, POST as photo } from "../../app/api/account/photo/route";
import { POST as consents } from "../../app/api/account/consents/route";
import { POST as deletion } from "../../app/api/account/deletion/route";
import { POST as password } from "../../app/api/account/password/route";
import { POST as fix } from "../../app/api/account/fix/route";
import { PRIVACY_VERSION } from "@/content/privacy-notice";

// My Account's write routes: only this site's pages, the account always the cookie's (never an id
// the browser sends), the booking app's own functions with their own refusals, and a password
// change that keeps this device signed in with the new token.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const NEW_TOKEN = "f".repeat(48);
const ORIGIN = "https://micromobility.sa";
const HEADERS = { origin: ORIGIN, cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
type Fn = (r: Request) => Promise<Response>;
const post = (fn: Fn, path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  fn(new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
const reply = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const rpcOf = (f: ReturnType<typeof vi.fn>) => (f.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => ({ fn: url.split("/rpc/")[1] ?? url, body: init?.body && typeof init.body === "string" ? JSON.parse(init.body) : init?.body }));
/** A database that answers each function by name. */
const db = (answers: Record<string, unknown | ((body: Record<string, unknown>) => Response)>) => vi.fn(async (url: string, init?: RequestInit) => {
  const fn = url.split("/rpc/")[1];
  const a = fn ? answers[fn] : answers.storage;
  if (typeof a === "function") return (a as (b: Record<string, unknown>) => Response)(typeof init?.body === "string" ? JSON.parse(init.body) : {});
  return a instanceof Response ? a : reply(a ?? null);
});
const CUR = { id: "c1", name: "Malik Najjar", email: "m@x.sa", phone: "+966551234567", height: 175, type_preference: "Road", birth_date: "1999-01-01",
  country: "Saudi Arabia", city: "Jeddah", photo: null, gender: "male", nationality: "Jordan", socials: { instagram: "mm" } };
const ABOUT = { profession: "Engineer", workplace: "Sela", heard_from: "friend", sign_in: null };

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("every account write route", () => {
  const routes: [Fn, string, unknown][] = [[profile, "/api/account/profile", { changes: {} }], [consents, "/api/account/consents", { rideNews: true }],
    [deletion, "/api/account/deletion", { request: true }], [password, "/api/account/password", { mode: "change", next: "Secret123" }], [fix, "/api/account/fix", { values: {} }],
    [photo, "/api/account/photo", "x"]];
  it("refuses another site and a request without the account cookie, without touching the database", async () => {
    const f = vi.fn(async () => reply(true));
    vi.stubGlobal("fetch", f);
    for (const [fn, path, body] of routes) {
      expect((await post(fn, path, body, { ...HEADERS, origin: "https://evil.example" })).status, path).toBe(403);
      expect((await post(fn, path, body, { origin: ORIGIN, "content-type": "application/json" })).status, path).toBe(401);
    }
    expect((await photoDelete(new Request(`${ORIGIN}/api/account/photo`, { method: "DELETE", headers: { origin: "https://evil.example", cookie: HEADERS.cookie } }))).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("api/account/profile", () => {
  it("writes only what changed, over the account as it is now, with the cookie's id and token", async () => {
    const f = db({ customer_profile: [CUR], customer_about: [ABOUT], customer_update_profile: true, customer_set_socials: true, customer_set_about: true });
    vi.stubGlobal("fetch", f);
    const res = await post(profile, "/api/account/profile", { changes: { city: "Mecca", socials: { instagram: "https://instagram.com/new.one", x: "" }, workplace: "MicroMobility" }, p_id: "someone-else" });
    expect(await res.json()).toEqual({ ok: true });
    const calls = rpcOf(f);
    expect(calls.map((c) => c.fn)).toEqual(["customer_profile", "customer_about", "customer_update_profile", "customer_set_socials", "customer_set_about"]);
    expect(calls[2].body).toEqual({ p_id: "c1", p_token: TOKEN, p_name: "Malik Najjar", p_email: "m@x.sa", p_phone: "+966551234567", p_height: 175, p_type_preference: "Road",
      p_birth_date: "1999-01-01", p_country: "Saudi Arabia", p_city: "Mecca", p_nationality: "Jordan" });
    expect(calls[3].body).toEqual({ p_id: "c1", p_token: TOKEN, p_socials: { instagram: "new.one" } });
    expect(calls[4].body).toEqual({ p_id: "c1", p_token: TOKEN, p_profession: "Engineer", p_workplace: "MicroMobility", p_heard_from: null, p_gender: null });
  });
  it("calls nothing that did not change", async () => {
    const f = db({ customer_profile: [CUR], customer_about: [ABOUT] });
    vi.stubGlobal("fetch", f);
    expect(await (await post(profile, "/api/account/profile", { changes: { city: "Jeddah", socials: { instagram: "@mm" } } })).json()).toEqual({ ok: true });
    expect(rpcOf(f).map((c) => c.fn)).toEqual(["customer_profile", "customer_about"]);
  });
  it("checks before writing, and passes on the database's refusals", async () => {
    vi.stubGlobal("fetch", db({ customer_profile: [CUR], customer_about: [ABOUT] }));
    expect(await (await post(profile, "/api/account/profile", { changes: { name: "Ali K" } })).json()).toEqual({ ok: false, error: "name_short" });
    expect(await (await post(profile, "/api/account/profile", { changes: { nationality: "Israel" } })).json()).toEqual({ ok: false, error: "nationality" });
    for (const [answer, error, status] of [[{ code: "23505", message: "phone_taken" }, "phone_taken", 409], [{ code: "P0001", message: "RATE_LIMITED" }, "rate", 429],
      [{ code: "22023", message: "name_short" }, "name_short", 400]] as const) {
      vi.stubGlobal("fetch", db({ customer_profile: [CUR], customer_about: [ABOUT], customer_update_profile: reply(answer, 400) }));
      const res = await post(profile, "/api/account/profile", { changes: { phone: "+966500000000" } });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error });
    }
    vi.stubGlobal("fetch", db({ customer_profile: [CUR], customer_about: [ABOUT], customer_set_about: reply({ message: "BAD_INPUT", details: "workplace" }, 400) }));
    expect(await (await post(profile, "/api/account/profile", { changes: { workplace: "Acme" } })).json()).toEqual({ ok: false, error: "workplace" });
    vi.stubGlobal("fetch", db({ customer_profile: [] }));
    expect((await post(profile, "/api/account/profile", { changes: { city: "Mecca" } })).status).toBe(401);
  });
});

describe("api/account/photo", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const send = (body: BodyInit, headers: Record<string, string> = { ...HEADERS, "content-type": "image/jpeg" }) => photo(new Request(`${ORIGIN}/api/account/photo`, { method: "POST", headers, body }));
  it("stores the image under p/ in the photos bucket, then gives the account its address", async () => {
    const f = db({ customer_profile: [CUR], storage: reply({ Key: "photos/p/x.jpg" }), customer_set_photo: true });
    vi.stubGlobal("fetch", f);
    const res = await send(jpeg);
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.photo).toMatch(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/photos\/p\/[a-f0-9]{32}\.jpg$/);
    const [, up, set] = f.mock.calls as unknown as [string, RequestInit][];
    expect(up[0]).toMatch(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/photos\/p\/[a-f0-9]{32}\.jpg$/);
    expect((up[1].headers as Record<string, string>)["x-upsert"]).toBe("false");
    expect(JSON.parse(String(set[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_photo: b.photo });
  });
  it("refuses what is not an image, one too large, and stores nothing for a session that is over", async () => {
    const f = db({ customer_profile: [] });
    vi.stubGlobal("fetch", f);
    expect((await send(new TextEncoder().encode("<svg/>"))).status).toBe(400);
    expect((await send(new Uint8Array(500_000))).status).toBe(413);
    expect(f).not.toHaveBeenCalled();
    expect((await send(jpeg)).status).toBe(401);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("removes the photo", async () => {
    const f = db({ customer_set_photo: true });
    vi.stubGlobal("fetch", f);
    const res = await photoDelete(new Request(`${ORIGIN}/api/account/photo`, { method: "DELETE", headers: HEADERS }));
    expect(await res.json()).toEqual({ ok: true });
    expect(rpcOf(f)[0].body).toEqual({ p_id: "c1", p_token: TOKEN, p_photo: null });
  });
});

describe("api/account/consents and deletion", () => {
  it("records the current notice version and the ride-news answer", async () => {
    const f = db({ customer_consents: { privacy_version: PRIVACY_VERSION, ride_news: false, ride_news_at: "2026-10-03" } });
    vi.stubGlobal("fetch", f);
    const res = await post(consents, "/api/account/consents", { privacy: true, rideNews: false });
    expect(await res.json()).toEqual({ ok: true, rideNews: false, privacyVersion: PRIVACY_VERSION });
    expect(rpcOf(f)[0].body).toEqual({ p_id: "c1", p_token: TOKEN, p_privacy: PRIVACY_VERSION, p_ride_news: false });
    expect((await post(consents, "/api/account/consents", { privacy: "2020-01-01" })).status).toBe(400);
  });
  it("asks for deletion and withdraws it", async () => {
    const f = db({ customer_deletion_request: (b: Record<string, unknown>) => reply({ requested_at: b.p_request ? "2026-10-03T10:00:00Z" : null }) });
    vi.stubGlobal("fetch", f);
    expect(await (await post(deletion, "/api/account/deletion", { request: true })).json()).toEqual({ ok: true, requestedAt: "2026-10-03T10:00:00Z" });
    expect(await (await post(deletion, "/api/account/deletion", { request: false })).json()).toEqual({ ok: true, requestedAt: null });
    expect((await post(deletion, "/api/account/deletion", { request: "yes" })).status).toBe(400);
  });
});

describe("api/account/password", () => {
  it("changes the password and keeps this device signed in with the new token", async () => {
    const f = db({ customer_change_password: NEW_TOKEN });
    vi.stubGlobal("fetch", f);
    const res = await post(password, "/api/account/password", { mode: "change", current: "Old12345", next: "Secret123" });
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toBe(`mm_acct=c1~${NEW_TOKEN}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
    expect(rpcOf(f)[0]).toEqual({ fn: "customer_change_password", body: { p_id: "c1", p_token: TOKEN, p_current: "Old12345", p_new: "Secret123" } });
  });
  it("replaces a temporary password through customer_set_own_password", async () => {
    const f = db({ customer_set_own_password: NEW_TOKEN });
    vi.stubGlobal("fetch", f);
    const res = await post(password, "/api/account/password", { mode: "forced", next: "Secret123" });
    expect(res.headers.get("set-cookie")).toContain(NEW_TOKEN);
    expect(rpcOf(f)[0]).toEqual({ fn: "customer_set_own_password", body: { p_id: "c1", p_token: TOKEN, p_new_pwd: "Secret123" } });
  });
  it("refuses a weak password itself, and passes on the database's refusals", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await (await post(password, "/api/account/password", { mode: "change", next: "short1A" })).json()).toEqual({ ok: false, error: "weak" });
    expect(f).not.toHaveBeenCalled();
    for (const [message, error, status] of [["BAD_PASSWORD", "bad", 403], ["LOCKED", "locked", 429], ["SAME_PASSWORD", "same", 400], ["WEAK_PASSWORD", "weak", 400]] as const) {
      vi.stubGlobal("fetch", db({ customer_change_password: reply({ message }, 400) }));
      const res = await post(password, "/api/account/password", { mode: "change", current: "x", next: "Secret123" });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error });
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });
});

describe("api/account/fix", () => {
  it("saves what was asked, checked as the app's check-up checks it", async () => {
    const f = db({ customer_fix_fields: ["name", "country", "city"], customer_fix_save: [] });
    vi.stubGlobal("fetch", f);
    const res = await post(fix, "/api/account/fix", { values: { name: "ali khan", country: "Palestine", city: "Jerusalem", email: "not-asked@x.sa" } });
    expect(await res.json()).toEqual({ ok: true, left: [] });
    expect(rpcOf(f)[1].body).toEqual({ p_id: "c1", p_token: TOKEN, p_values: { name: "Ali Khan", country: "Palestine", city: "Jerusalem" } });
  });
  it("names the boxes to check, and what the database refused", async () => {
    vi.stubGlobal("fetch", db({ customer_fix_fields: ["email", "height"] }));
    expect(await (await post(fix, "/api/account/fix", { values: { email: "bad", height: "300" } })).json()).toEqual({ ok: false, error: "check", errors: { email: "email", height: "height" } });
    vi.stubGlobal("fetch", db({ customer_fix_fields: ["email"], customer_fix_save: reply({ code: "23505", message: "email_taken" }, 409) }));
    expect(await (await post(fix, "/api/account/fix", { values: { email: "a@b.sa" } })).json()).toEqual({ ok: false, error: "check", errors: { email: "email_taken" } });
    vi.stubGlobal("fetch", db({ customer_fix_fields: ["email", "phone"], customer_fix_save: ["phone"] }));
    expect(await (await post(fix, "/api/account/fix", { values: { email: "a@b.sa", phone: "+966551234567" } })).json()).toEqual({ ok: true, left: ["phone"] });
  });
});
