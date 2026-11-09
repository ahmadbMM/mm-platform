import { describe, expect, it } from "vitest";
import { payReady, payMode, MOYASAR_FORM_JS, MOYASAR_FORM_CSS, MOYASAR_FORM_VERSION } from "../pay/config";
import { MOYASAR_ID, safeEqual, sourceInfo, toHalalas } from "../pay/moyasar";
import { deliveryFee, paySettings, refundable } from "../pay/settings";
import { sar } from "../pay/money";
import { payError, refusedVariant } from "../pay/http";

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
    expect(payError({ status: 0, message: "" })).toEqual({ error: "generic", status: 502 });
    expect(payError({ status: 400, message: "SOMETHING_NEW" })).toEqual({ error: "generic", status: 502 });
  });
  it("writes amounts with the riyal sign on the left, isolated, halalas only when there are some", () => {
    expect(sar(57.5)).toBe("⁦⃁ 57.50⁩");
    expect(sar(75)).toBe("⁦⃁ 75⁩");
  });
});
