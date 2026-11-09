import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import CartView from "@/components/store/CartView";
import { allWhens, openOr404, storeState } from "@/components/store/store-data";
import { cartProducts } from "@/components/store/slim";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/cart - the cart kept in this browser, priced with the store as it is now.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/cart", locale, title: `${s.t.cart} · Micromobility`, noindex: true });
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  const s = await storeState(locale);
  openOr404(s);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <h1 className="st-title">{s.t.cart}</h1>
        <CartView locale={locale} products={cartProducts(s.store)} settings={s.settings} whens={allWhens(s, locale)} />
      </div>
    </PageShell>
  );
}
