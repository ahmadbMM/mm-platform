import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_COOKIE, encodeSession } from "@/lib/account-core";
import { visitorOf } from "@/lib/account";
import { clientIp } from "@/lib/sign-in-guard";
import { claimPhotoPathOk } from "@/lib/sx-f1";

// The security review of 2026-11-18 (the store and Experiences "do all" build), fixed by F1: the quote link and the gift
// card's wallet move name the visitor to the database's meter (M1), and a claim or return photo is stored only at a name
// the database handed out for the order (M2).

const KEY = "ab".repeat(16);
const SITE = "https://staging.micromobility.sa";
type Call = { url: string; body: Record<string, unknown> | null; h: Headers };

function db(answer: (url: string, body: Record<string, unknown> | null) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
  vi.stubEnv("MOYASAR_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("MOYASAR_SECRET_KEY", "sk_test_x"); vi.stubEnv("MM_SITE_KEY", "site-key-0123456789");
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    const url = String(u);
    let body: Record<string, unknown> | null = null;
    try { body = JSON.parse(String(init?.body ?? "")) as Record<string, unknown>; } catch { body = null; }
    calls.push({ url, body, h: new Headers(init?.headers) });
    const a = answer(url, body);
    return new Response(JSON.stringify(a.body), { status: a.status });
  }));
  return calls;
}

describe("the visitor in a server component (M1)", () => {
  it("carries only the address Cloudflare saw, or nothing", () => {
    const h = new Headers({ "cf-connecting-ip": " 203.0.113.7 ", cookie: "mm_acct=x", "x-mm-visitor-ip": "1.2.3.4" });
    const r = visitorOf(h);
    expect(clientIp(r)).toBe("203.0.113.7");
    expect(r.headers.get("cookie")).toBeNull();
    expect(r.headers.get("x-mm-visitor-ip")).toBeNull();
    expect(clientIp(visitorOf(new Headers()))).toBe("");
  });

  it("the quote page reads the quote for its visitor", () => {
    const src = readFileSync(resolve(__dirname, "../../app/[locale]/store/q/[token]/page.tsx"), "utf8");
    expect(src).toMatch(/payRpc<unknown>\("store_quote_get", \{ p_token: token \}, undefined, visitorOf\(await headers\(\)\)\)/);
  });
});

describe("the gift card into the wallet names the visitor (M1)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("sends x-mm-visitor-ip with the site's key", async () => {
    const { POST } = await import("../../app/api/store/gift-card/wallet/route");
    const calls = db(() => ({ status: 200, body: { amount: 150, balance: 200 } }));
    const res = await POST(new Request(`${SITE}/api/store/gift-card/wallet`, {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json", "cf-connecting-ip": "198.51.100.23",
        cookie: `${ACCOUNT_COOKIE}=${encodeSession({ id: "c1", token: "tok-0123456789abcdef" })}` },
      body: JSON.stringify({ code: "GC-ABCD-EFGH-JKLM" }),
    }));
    expect(await res.json()).toEqual({ ok: true, amount: 150, balance: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/rpc\/store_gift_card_to_wallet$/);
    expect(calls[0].body).toEqual({ p_key: "k".repeat(40), p_id: "c1", p_token: "tok-0123456789abcdef", p_code: "GC-ABCD-EFGH-JKLM" });
    expect(calls[0].h.get("x-mm-visitor-ip")).toBe("198.51.100.23");
    expect(calls[0].h.get("x-mm-site-key")).toBe("site-key-0123456789");
  });
});

describe("claim and return photos go only where the database says (M2)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...new Array(64).fill(0)]);
  const TICKET = `o1042/${"0f".repeat(16)}.jpg`;
  const send = async (headers: Record<string, string> = {}) => {
    const { POST } = await import("../../app/api/store/claim-photo/route");
    return POST(new Request(`${SITE}/api/store/claim-photo?no=1042&k=${KEY}`, {
      method: "POST", headers: { origin: SITE, "content-type": "image/jpeg", "cf-connecting-ip": "203.0.113.50", ...headers }, body: JPEG,
    }));
  };
  const order = { no: 1042, status: "delivered", fulfil: "pickup" };

  it("asks for a ticket after reading the order, and uploads to its name", async () => {
    const calls = db((url) => url.endsWith("/rpc/store_order_get") ? { status: 200, body: order }
      : url.endsWith("/rpc/store_after_photo_slot") ? { status: 200, body: { path: TICKET, expires_at: "2026-11-18T20:05:00Z" } }
      : { status: 200, body: { Key: `store-claims/${TICKET}` } });
    const res = await send();
    expect(await res.json()).toEqual({ ok: true, path: TICKET });
    expect(calls.map((c) => c.url.replace("https://db.test", ""))).toEqual(["/rest/v1/rpc/store_order_get", "/rest/v1/rpc/store_after_photo_slot",
      `/storage/v1/object/store-claims/${TICKET}`]);
    expect(calls[1].body).toEqual({ p_key: "k".repeat(40), p_no: 1042, p_track: KEY });
    expect(calls[1].h.get("x-mm-visitor-ip")).toBe("203.0.113.50");
    expect(calls[2].h.get("x-upsert")).toBe("false");
  });

  it("stores nothing without a ticket for this order", async () => {
    const cases: [unknown, number, string, number][] = [
      [{ status: 400, body: { message: "STORE_AFTER_BUSY" } }, 429, "busy", 2],
      [{ status: 400, body: { message: "STORE_AFTER_STATE" } }, 409, "state", 2],
      [{ status: 500, body: { message: "NOT_FOUND" } }, 404, "not_found", 2],
      [{ status: 404, body: { code: "PGRST202", message: "Could not find the function" } }, 502, "off", 2],
      [{ status: 200, body: { path: `o999/${"0f".repeat(16)}.jpg` } }, 502, "generic", 2],
      [{ status: 200, body: { path: `o1042/../x.jpg` } }, 502, "generic", 2],
      [{ status: 200, body: {} }, 502, "generic", 2],
    ];
    for (const [slot, status, error, n] of cases) {
      const calls = db((url) => url.endsWith("/rpc/store_order_get") ? { status: 200, body: order } : (slot as { status: number; body: unknown }));
      const res = await send();
      expect([res.status, (await res.json()).error]).toEqual([status, error]);
      expect(calls).toHaveLength(n);
      expect(calls.some((c) => c.url.includes("/storage/"))).toBe(false);
    }
  });

  it("knows a ticket's name", () => {
    expect(claimPhotoPathOk(TICKET, 1042)).toBe(true);
    expect(claimPhotoPathOk(TICKET, 104)).toBe(false);
    expect(claimPhotoPathOk(`o10420/${"0f".repeat(16)}.jpg`, 1042)).toBe(false);
    expect(claimPhotoPathOk(`o1042/${"0F".repeat(16)}.jpg`, 1042)).toBe(false);
    expect(claimPhotoPathOk(`o1042/${"0f".repeat(16)}.png`, 1042)).toBe(false);
    expect(claimPhotoPathOk(`o1042/${"0f".repeat(16)}.jpg/x`, 1042)).toBe(false);
  });
});
