import { describe, expect, it } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { storeOf } from "../store";
import { orderOf } from "../store-order";
import { paySettings } from "../pay/settings";

// The store's pages as the server draws them, in English and Arabic: the words they must say (the price
// with VAT, the payment duty on the button, the invoice's numbers) and nothing they must not (an emoji, a
// former price without a licence).
const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  // the providers' children come as createElement's third argument (their prop types want them in the props)
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const V = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STORE = storeOf(
  [{ id: "p1", slug: "helmet", category: "accessories", brand: "Alvas", name_en: "Aero Helmet", name_ar: "خوذة انسيابية", price: 520, compare_at: 600, ship_ksa: true, images: ["/site/store/helmet/1.webp"], specs: [{ en: ["Weight", "280 g"], ar: ["الوزن", "280 غ"] }], sort: 1, created_at: "" },
   { id: "p2", slug: "da54", category: "bikes", brand: "Alvas", name_en: "DA54", price: 8435, ship_ksa: false, images: [], specs: [], sort: 2, created_at: "" }],
  [{ id: V(1), product_id: "p1", size: "M", stock: 2, sort: 1 }, { id: V(2), product_id: "p1", size: "L", stock: 0, sort: 2 }, { id: V(3), product_id: "p2", size: "M", stock: 1, sort: 1, price: 8935 }],
);

describe("the store's pages", () => {
  it("list the products with their prices, low stock and no former price without a licence", async () => {
    const { default: StoreGrid } = await import("@/components/store/StoreGrid");
    const html = render(wrap("en", createElement(StoreGrid, { locale: "en", products: STORE.products, cats: ["bikes", "accessories"], start: { cat: "all", sort: "featured" }, licence: false })));
    expect(html).toContain("Aero Helmet");
    expect(html).toContain("Only 2 left");
    expect(html).toContain("8,935");
    expect(html).not.toContain("st-was");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("offer a product's sizes, a sold-out one closed, with the price and VAT", async () => {
    const { default: BuyBox } = await import("@/components/store/BuyBox");
    const en = render(wrap("en", createElement(BuyBox, { p: STORE.products[0], locale: "en", licence: null })));
    expect(en).toContain("VAT included");
    expect(en).toMatch(/aria-label="L, Sold out"[^>]*disabled|disabled[^>]*aria-label="L, Sold out"/);
    expect(en).toContain("Add to cart");
    const ar = render(wrap("ar", createElement(BuyBox, { p: STORE.products[0], locale: "ar", licence: "123" })));
    expect(ar).toContain("أضف إلى السلة");
    expect(ar).toContain("رقم ترخيص التخفيض 123");
  });
  it("draw an order with its invoice, the payment it took and the seller's numbers", async () => {
    const { default: OrderView } = await import("@/components/store/OrderView");
    const { T } = await import("@/components/store/Store.text");
    const o = orderOf({
      id: "o", no: 1001, status: "paid", fulfil: "jeddah", name: "Sara", phone: "•••• 5678", address: { city: "Jeddah", district: "Al Rawdah" }, subtotal: 520, delivery_fee: 30,
      total: 550, wallet_paid: 50, vat: 71.74, created_at: new Date().toISOString(), paid_at: new Date().toISOString(),
      payment: { id: "pay", status: "paid", method: "creditcard", brand: "mada", last4: "4242", receipt_no: 88, expires_at: "", amount: 500 },
      items: [{ name: "Aero Helmet", variant: "M", qty: 1, unit_price: 520, variant_id: V(1), image: null, slug: "helmet" }], events: [{ at: new Date().toISOString(), status: "paid", note: null }],
    }, "k".repeat(32))!;
    for (const locale of ["en", "ar"]) {
      const t = localize(T, locale, null);
      const html = render(wrap(locale, createElement(OrderView, {
        o, t, locale, now: Date.now(), whatsapp: "966566668818", showroom: "Al Sharafeyah", expected: "Wed 11 – Thu 12 Nov", signup: "https://experiences.micromobility.sa/?handoff=site&auth=signup", returnsHref: "/help#returns",
        seller: { trade: "Micromobility", legal: "Micromobility Company Ltd.", vat: "312555068900003", cr: "1009107240" },
      })));
      expect(html, locale).toContain("MM-1001");
      expect(html, locale).toContain("312555068900003");
      expect(html, locale).toContain("1009107240");
      expect(html, locale).toContain("mada •••• 4242");
      expect(html, locale).toContain("wa.me/966566668818");
      expect(html, locale).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it("say on the checkout button that it places the order and obliges payment", async () => {
    const { T } = await import("@/components/store/Store.text");
    expect(localize(T, "en", null).place("SAR 550")).toBe("Place order and pay SAR 550");
    expect(localize(T, "ar", null).place("550")).toBe("تأكيد الطلب والدفع 550");
    expect(paySettings({}).delivery.freeOver).toBeNull();
  });
});
