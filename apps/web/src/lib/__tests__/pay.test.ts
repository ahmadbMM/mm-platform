import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { payReady, payMode, MOYASAR_FORM_JS, MOYASAR_FORM_CSS, MOYASAR_FORM_VERSION } from "../pay/config";
import { MOYASAR_ID, safeEqual, sourceInfo, toHalalas, verifyWebhook } from "../pay/moyasar";
import { isBoothCard, withoutBoothLine } from "../pay/booth";
import { deliveryFee, paySettings, refundable } from "../pay/settings";
import { sar } from "../pay/money";
import { payError, refusedVariant } from "../pay/http";
import { confirmRefunds, sendRefund, type PendingRefund } from "../pay/server";

// Online payments (2026-11-10, rentals 20261110150000): the parts that are plain logic.

describe("payment settings (site_content pay.* and store.*)", () => {
  it("reads what is missing or out of range as the database's defaults", () => {
    const s = paySettings({});
    expect(s).toMatchObject({ enabled: false, bookings: "required", holdMinutes: 15, refundDays: 1, topup: false, storeOpen: false, orderMinutes: 30 });
    expect(paySettings({ "pay.holdMinutes": 500, "pay.bookings": "maybe", "pay.refundDays": -1 })).toMatchObject({ holdMinutes: 15, bookings: "required", refundDays: 1 });
    expect(paySettings({ "pay.enabled": true, "pay.bookings": "optional", "pay.holdMinutes": 20 })).toMatchObject({ enabled: true, bookings: "optional", holdMinutes: 20 });
  });
  it("prices delivery as _store_delivery_fee does: pickup free, a way switched off refused, free over the threshold", () => {
    const s = paySettings({ "store.delivery": { jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: false, fee: 45 }, freeOver: 500 } });
    expect(deliveryFee(s, "pickup", 100)).toBe(0);
    expect(deliveryFee(s, "jeddah", 100)).toBe(30);
    expect(deliveryFee(s, "jeddah", 500)).toBe(0);
    expect(deliveryFee(s, "ksa", 100)).toBeNull();
  });
  it("drops only the default pay-at-the-booth words while rides are paid when booking", () => {
    const body = "- Rides and rentals are booked in our booking app.\n- At the Corniche Circuit, payment is collected at our booth when you arrive. Please have your queue number ready.\n- Bikes are assigned first come, first served.";
    expect(withoutBoothLine(body)).toBe("- Rides and rentals are booked in our booking app.\n- Bikes are assigned first come, first served.");
    const rewritten = "- Pay at our booth, or online when you book.";
    expect(withoutBoothLine(rewritten)).toBe(rewritten);
    expect(withoutBoothLine("- في حلبة الكورنيش، يتم الدفع عند الكشك عند وصولك. يرجى إحضار رقم طابورك.\n- سطر")).toBe("- سطر");
    expect(isBoothCard("Pay at the booth")).toBe(true);
    expect(isBoothCard("الدفع عند الكشك")).toBe(true);
    expect(isBoothCard("Come early")).toBe(false);
  });
  it("refunds a cancel made at least refundDays before the ride day (by Riyadh's date)", () => {
    expect(refundable("2026-11-12", "2026-11-11", 1)).toBe(true);
    expect(refundable("2026-11-12", "2026-11-12", 1)).toBe(false);
    expect(refundable("2026-11-12", "2026-11-12", 0)).toBe(true);
    expect(refundable("2026-11-12", "2026-11-10", 3)).toBe(false);
    expect(refundable("bad", "2026-11-10", 1)).toBe(false);
  });
});

describe("Moyasar", () => {
  it("counts in halalas exactly", () => {
    expect(toHalalas(57.5)).toBe(5750);
    expect(toHalalas(0.1 + 0.2)).toBe(30);
    expect(toHalalas(8435)).toBe(843500);
  });
  it("keeps only how it was paid and the last four digits", () => {
    expect(sourceInfo({ id: "x", status: "paid", amount: 1, currency: "SAR", source: { type: "creditcard", company: "master", number: "5421-08XX-XXXX-0000", message: "APPROVED" } }))
      .toEqual({ method: "creditcard", brand: "mastercard", last4: "0000", message: "APPROVED" });
    expect(sourceInfo({ id: "x", status: "paid", amount: 1, currency: "SAR", source: { type: "stcpay" } })).toEqual({ method: "stcpay", brand: null, last4: null, message: null });
  });
  it("compares the webhook's secret in constant time, and only equal strings pass", () => {
    expect(safeEqual("secret-token", "secret-token")).toBe(true);
    expect(safeEqual("secret-token", "secret-tokem")).toBe(false);
    expect(safeEqual("secret", "secret-token")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
  it("takes payments only with both keys of one mode and the database's key", () => {
    const key = "k".repeat(40);
    expect(payReady({ MOYASAR_PUBLISHABLE_KEY: "pk_test_a", MOYASAR_SECRET_KEY: "sk_test_b", PAY_SERVER_KEY: key })).toBe(true);
    expect(payReady({ MOYASAR_PUBLISHABLE_KEY: "pk_test_a", MOYASAR_SECRET_KEY: "sk_live_b", PAY_SERVER_KEY: key })).toBe(false);
    expect(payReady({ MOYASAR_PUBLISHABLE_KEY: "pk_live_a", MOYASAR_SECRET_KEY: "sk_live_b", PAY_SERVER_KEY: "short" })).toBe(false);
    expect(payReady({})).toBe(false);
    expect(payMode({ MOYASAR_PUBLISHABLE_KEY: "pk_live_a" })).toBe("live");
    expect(payMode({ MOYASAR_PUBLISHABLE_KEY: "pk_test_a" })).toBe("test");
  });
  it("reads a Moyasar payment id as a UUID only", () => {
    expect(MOYASAR_ID.test("760878ec-d1d3-5f72-9056-191683f55872")).toBe(true);
    expect(MOYASAR_ID.test("../payments")).toBe(false);
  });
  it("loads the pinned form, the same version for the script and the style", () => {
    expect(MOYASAR_FORM_JS).toBe(`https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_FORM_VERSION}/dist/moyasar.umd.js`);
    expect(MOYASAR_FORM_CSS).toBe(`https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_FORM_VERSION}/dist/moyasar.css`);
  });
});

describe("the pages' words for the database's refusals", () => {
  it("maps each refusal to a short code and keeps the variant a stock refusal names", () => {
    expect(payError({ status: 400, message: "STORE_STOCK: 00000000-0000-4000-8000-0000000000a1" })).toEqual({ error: "stock", status: 409 });
    expect(refusedVariant("STORE_STOCK: 00000000-0000-4000-8000-0000000000a1")).toBe("00000000-0000-4000-8000-0000000000a1");
    expect(payError({ status: 401, message: "NOT_AUTHORIZED" })).toEqual({ error: "signin", status: 401 });
    expect(payError({ status: 400, message: "PAY_HOLD_MAX" })).toEqual({ error: "hold_max", status: 409 });
    expect(payError({ status: 400, message: "PAY_NOT_OPEN" })).toEqual({ error: "not_open", status: 409 });
    // pay_hold_extend not on the database yet: PostgREST's own 404, never a code the page has words for
    expect(payError({ status: 404, message: "Could not find the function public.pay_hold_extend(p_key, p_pay) in the schema cache" })).toEqual({ error: "generic", status: 502 });
    expect(payError({ status: 0, message: "" })).toEqual({ error: "generic", status: 502 });
    expect(payError({ status: 400, message: "SOMETHING_NEW" })).toEqual({ error: "generic", status: 502 });
    // NOT_FOUND is raised with errcode P0002, which PostgREST answers 500
    expect(payError({ status: 500, message: "NOT_FOUND" })).toEqual({ error: "not_found", status: 409 });
    expect(payError({ status: 503, message: "upstream connect error" })).toEqual({ error: "generic", status: 502 });
  });
  it("writes amounts with the riyal sign on the left, isolated, halalas only when there are some", () => {
    expect(sar(57.5)).toBe("⁦⃁ 57.50⁩");
    expect(sar(75)).toBe("⁦⃁ 75⁩");
    // grouped, as the store's prices and Moyasar's own Pay button write it
    expect(sar(5823)).toBe("⁦⃁ 5,823⁩");
    expect(sar(1100.2)).toBe("⁦⃁ 1,100.20⁩");
  });
  it("answers a webhook's verification with the secret key, and sends nothing for a bad id or code", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "c4bc247d-5288-4673-9b40-39c082ac7fbb", verified: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await verifyWebhook("sk_test_x", "c4bc247d-5288-4673-9b40-39c082ac7fbb", "482913", f);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.moyasar.com/v1/webhooks/c4bc247d-5288-4673-9b40-39c082ac7fbb/verify");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: "482913" });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Basic " + btoa("sk_test_x:"));
    expect((await verifyWebhook("sk_test_x", "../payments", "482913", f)).ok).toBe(false);
    expect((await verifyWebhook("sk_test_x", "c4bc247d-5288-4673-9b40-39c082ac7fbb", "48291", f)).ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

// Card refunds against Moyasar's one refunded total, as the database judges them (rentals 20261110235200): each pending
// refund's 'already' is the card refunds done on that Moyasar payment and those pending sent before it; a refund is done
// only once pay_refund_done recorded it so.
describe("refunds against Moyasar's one total", () => {
  const MID = "11111111-2222-4333-8444-555555555555";
  const env = { MOYASAR_SECRET_KEY: "sk_test_x", PAY_SERVER_KEY: "k".repeat(40) };
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  /** Moyasar holding `refunded` halalas refunded (and growing by a refund it is sent), the database recording each answer. */
  function stub(refunded: number, record: (b: Record<string, unknown>) => Response = (b) => json({ ok: true, status: b.p_ok ? "done" : "failed" })) {
    const told: Record<string, unknown>[] = [];
    let total = refunded;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/refund")) { total += Number(JSON.parse(String(init?.body)).amount); return json({ id: MID, status: "refunded", amount: 10000, currency: "SAR", refunded: total }); }
      if (u.startsWith("https://api.moyasar.com")) return json({ id: MID, status: "paid", amount: 10000, currency: "SAR", refunded: total });
      const b = JSON.parse(String(init?.body)) as Record<string, unknown>;
      told.push(b);
      return record(b);
    }));
    return told;
  }
  const rf = (id: string, amount: number, already: number, at: string): PendingRefund => ({ id, provider_id: MID, amount, already, created_at: at });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("confirms two pending refunds that both went through, each once, from the refunds done", async () => {
    // 10 SAR done before; 20 and 30 pending (their 'already': 10, then 10 + 20); Moyasar shows 60
    const told = stub(6000);
    expect(await confirmRefunds([rf("b", 30, 30, "2026-11-10T10:01:00Z"), rf("a", 20, 10, "2026-11-10T10:00:00Z")], env)).toBe(2);
    expect(told.map((b) => [b.p_refund, b.p_ok, b.p_refunded_halalas])).toEqual([["a", true, 3000], ["b", true, 6000]]);
  });
  it("never confirms a second refund by the first one's money", async () => {
    const told = stub(3000); // only the first (20 SAR) reached Moyasar
    expect(await confirmRefunds([rf("a", 20, 10, "2026-11-10T10:00:00Z"), rf("b", 30, 30, "2026-11-10T10:01:00Z")], env)).toBe(1);
    expect(told.map((b) => [b.p_refund, b.p_ok])).toEqual([["a", true], ["b", false]]);
  });
  it("confirms a later refund that went through when an earlier one never left", async () => {
    const told = stub(4000); // 10 done, then only the 30 SAR one reached Moyasar
    expect(await confirmRefunds([rf("a", 50, 10, "2026-11-10T10:00:00Z"), rf("b", 30, 60, "2026-11-10T10:01:00Z")], env)).toBe(1);
    expect(told.map((b) => [b.p_refund, b.p_ok])).toEqual([["a", false], ["b", true]]);
  });
  it("never confirms an older refund that never left by a newer one's money", async () => {
    const told = stub(7000); // 50 SAR never reached Moyasar, then 70 SAR did
    expect(await confirmRefunds([rf("a", 50, 0, "2026-11-10T10:00:00Z"), rf("b", 70, 50, "2026-11-10T10:01:00Z")], env)).toBe(1);
    expect(told.map((b) => [b.p_refund, b.p_ok, b.p_refunded_halalas])).toEqual([["a", false, 0], ["b", true, 7000]]);
  });
  it("judges nothing while no set of the refunds adds up to Moyasar's total, and an hour on asks staff to check", async () => {
    const recent = new Date(Date.now() - 5 * 60000).toISOString();
    let told = stub(2500);
    expect(await confirmRefunds([rf("a", 20, 0, recent), rf("b", 30, 20, recent)], env)).toBe(0);
    expect(told).toEqual([]);
    told = stub(2500);
    expect(await confirmRefunds([rf("a", 20, 0, "2026-11-10T10:00:00Z"), rf("b", 30, 20, "2026-11-10T10:01:00Z")], env)).toBe(0);
    expect(told.map((b) => [b.p_refund, b.p_ok])).toEqual([["a", false], ["b", false]]);
  });
  it("says a refund done only when the database recorded it", async () => {
    stub(0);
    expect(await sendRefund({ id: "r1", provider_id: MID, amount: 20 }, env)).toBe(true);
    stub(0, () => json({ message: "boom" }, 500));
    expect(await sendRefund({ id: "r1", provider_id: MID, amount: 20 }, env)).toBe(false);
    stub(0, () => json({ ok: true, status: "failed" }));
    expect(await sendRefund({ id: "r1", provider_id: MID, amount: 20 }, env)).toBe(false);
  });
});
