import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import CartView from "@/components/store/CartView";
import { allWhens, openOr404, storeState } from "@/components/store/store-data";
import { cartProducts } from "@/components/store/slim";
import { payEnv, payReady } from "@/lib/pay/config";
import { boxCookie, CART_N_COOKIE, reserveHeights, reserveOf } from "@/lib/sx-b3";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/cart - the cart kept in this browser, priced with the store as it is now. Apple Pay's own button
// (F83) shows on a device that has it only while payments are taken here and Apple Pay's domain file is in place.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/cart", locale, title: `${s.t.cart} · Micromobility`, noindex: true });
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  const [s, jar] = await Promise.all([storeState(locale), cookies()]);
  openOr404(s);
  // the cart's place kept until the browser reads it (P10, 2026-11-18): its height when last drawn, or its line count's
  const reserve = reserveHeights(reserveOf(jar.get(CART_N_COOKIE)?.value, jar.get(boxCookie("cart"))?.value), "cart");
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <h1 className="st-title">{s.t.cart}</h1>
        <CartView locale={locale} products={cartProducts(s.store)} settings={s.settings} whens={allWhens(s, locale)} licence={s.licence}
          applePay={s.settings.enabled && payReady() && !!payEnv().APPLE_PAY_DOMAIN_FILE} reserve={reserve} />
      </div>
    </PageShell>
  );
}
