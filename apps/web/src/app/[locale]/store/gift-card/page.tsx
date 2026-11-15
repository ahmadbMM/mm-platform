import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import GiftCardBuy from "@/components/store/GiftCardBuy";
import { openOr404, storeState } from "@/components/store/store-data";
import { T as W } from "@/components/store/w4.text";
import { Link } from "@/i18n/navigation";
import { serverLocalize } from "@/i18n/dicts";
import { categoryHref, paragraphs, pick, type StoreProduct } from "@/lib/store";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/gift-card (F57): the store's gift cards (store_products of kind "gift_card", each variant one
// face value, CONTRACTS.md section 2), bought like anything else: an amount, how many, Add to cart (it turns into "Added",
// D14-E) or Buy now. A card is issued once the order is paid and its code shows on the order's page (with Print gift
// card); it is valid for a year (the owner, 2026-11-15) and pays at checkout. A gift card alone is never delivered
// (checkout's "digital"). /store/<a gift card's slug> comes here (productHref).
type Props = { params: Promise<{ locale: string }> };

const giftCards = (products: StoreProduct[]) => products.filter((p) => p.kind === "gift_card").sort((a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  const w = serverLocalize(W, locale);
  const p = giftCards(s.store.products)[0];
  return pageMeta({ path: "/store/gift-card", locale, title: `${w.giftTitle} · Micromobility`, description: w.giftLead, image: p?.images[0], closed: s.closed || !s.open || !p });
}

export default async function GiftCardPage({ params }: Props) {
  const { locale } = await params;
  const s = await storeState(locale);
  openOr404(s);
  const cards = giftCards(s.store.products);
  if (!cards.length) notFound();
  const w = serverLocalize(W, locale);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <nav className="st-crumbs" aria-label={s.t.store}>
          <ol>
            <li><Link href="/store">{s.t.store}</Link></li>
            <li><Link href={categoryHref("gift")}>{s.t.cats.gift}</Link></li>
            <li aria-current="page">{w.giftTitle}</li>
          </ol>
        </nav>
        <h1 className="st-title">{cards.length === 1 ? pick(locale, cards[0].name_en, cards[0].name_ar) : w.giftTitle}</h1>
        <p className="st-lead">{w.giftLead}</p>
        {cards.map((p) => (
          <GiftCardBuy key={p.id} p={{ ...p, specs: [], description_en: null, description_ar: null }} locale={locale}
            about={paragraphs(pick(locale, p.description_en, p.description_ar))} named={cards.length > 1} />
        ))}
      </div>
    </PageShell>
  );
}
