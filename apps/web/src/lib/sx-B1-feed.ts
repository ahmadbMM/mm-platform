import { brandOnce } from "./sx-B1-list";
import {
  pick, productHref, productStock, sortProducts, variantPrice, wasPriceAt,
  type StoreProduct, type StoreVariant,
} from "./store-core";
import { BUILTIN_TREE, catPath, topOf, type CatTree } from "./store-cats";

// The store's products as a Google Merchant Center feed (the user, 2026-11-18: "do all", N27): micromobility.sa/store/
// feed.xml, one RSS 2.0 file in the Google namespace, so the bikes and the gear can show free in Shopping, Images and Lens
// (app/store/feed.xml/route.ts serves it while the store is open). One item for each size and colour on sale, grouped by
// its product, its link opening the page with that size and colour picked; the price with VAT in riyals, as every page shows it; a former price only beside the discount licence,
// between its dates (F107), as the cards show it; the stock as it is. Gift cards are left out (Merchant Center refuses
// them) and so is a product without a photo (an item needs one). ?lang=ar writes the Arabic names and links the Arabic
// pages, for a second feed of Arabic listings. Pure, so it is tested without a database.

/** Google's own category for each of the store's, where its taxonomy has one beyond doubt; others are left to Google.
 *  Staff's sub-category takes its category's (the product-management build 2026-11-19). */
const GOOGLE_CATEGORY: Partial<Record<string, string>> = {
  bikes: "Sporting Goods > Outdoor Recreation > Cycling > Bicycles",
  accessories: "Sporting Goods > Outdoor Recreation > Cycling > Bicycle Accessories",
  parts: "Sporting Goods > Outdoor Recreation > Cycling > Bicycle Parts",
};

// the characters XML 1.0 refuses are taken out, then the five it reserves written as entities
const XML = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const money = (n: number) => `${n.toFixed(2)} SAR`;
/** Plain text from staff's description: no markdown marks, one space between words, at most 5,000 characters (Google's). */
const plain = (s: string) => s
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
  .replace(/[*_`~]+/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 5000);

/** A photo's address on the open web: the site's own (/site/..., /media/...) under the site's address, others as they are. */
export function absolute(src: string, site: string): string | null {
  if (/^https:\/\//i.test(src)) return src;
  return src.startsWith("/") && !src.startsWith("//") ? `${site}${src}` : null;
}

export type FeedOptions = { site: string; lang: "en" | "ar"; licence: string | null; today: string; storeName: string; cats?: CatTree };

/** One <item> for each variant of each product the feed can list, in staff's order. */
export function feedItems(products: readonly StoreProduct[], o: FeedOptions): string[] {
  const out: string[] = [];
  const cats = o.cats ?? BUILTIN_TREE;
  for (const p of sortProducts([...products], "featured")) {
    // a Preview (the staging site's alone) is never listed
    if (p.kind === "gift_card" || p.preview) continue;
    const google = GOOGLE_CATEGORY[topOf(cats, p.category)];
    // the store's own path to it: "bikes > road" for staff's sub-category
    const type = cats.table ? catPath(cats, p.category).map((c) => c.slug).join(" > ") || p.category : p.category;
    const photos = p.images.map((src) => absolute(src, o.site)).filter((x): x is string => !!x);
    if (!photos.length) continue;
    const name = pick(o.lang, p.name_en, p.name_ar);
    const title = (p.brand ? `${p.brand} ${brandOnce(name, p.brand)}` : name).slice(0, 150);
    const description = plain(pick(o.lang, p.description_en, p.description_ar) || pick(o.lang, p.tagline_en, p.tagline_ar) || title);
    const variants: (StoreVariant | null)[] = p.variants.length ? p.variants : [null];
    const grouped = variants.length > 1;
    for (const v of variants) {
      const price = v ? variantPrice(p, v) : p.price;
      if (!(price > 0)) continue;
      const stock = v ? v.stock : productStock(p).kind === "out" ? 0 : 1;
      const was = wasPriceAt(p, o.licence, o.today, price);
      const colour = v ? pick(o.lang, v.color_en, v.color_ar) : "";
      // the page opens with this size and colour picked (?size=&colour=, the product page's preset, N09)
      const q = new URLSearchParams({ lang: o.lang });
      if (v?.size) q.set("size", v.size);
      if (v?.color_en) q.set("colour", v.color_en);
      const link = `${o.site}${productHref(p)}?${q.toString()}`;
      const tags = [
        ["g:id", (v ? v.id : p.id).toLowerCase()],
        ...(grouped ? [["g:item_group_id", p.id.toLowerCase()]] : []),
        ["title", title],
        ["description", description],
        ["link", link],
        ["g:image_link", photos[0]],
        ...photos.slice(1, 11).map((x) => ["g:additional_image_link", x]),
        // a pre-order (the product-management build 2026-11-19): Google's own value, with the day it ships when staff gave one
        ...(p.preorder ? [["g:availability", "preorder"], ...(p.ships_on ? [["g:availability_date", `${p.ships_on}T00:00+03:00`]] : [])]
          : [["g:availability", stock > 0 ? "in_stock" : "out_of_stock"]]),
        ...(was !== null && was > price ? [["g:price", money(was)], ["g:sale_price", money(price)]] : [["g:price", money(price)]]),
        ...(p.brand ? [["g:brand", p.brand]] : [["g:brand", o.storeName]]),
        ["g:condition", p.condition === "certified" ? "refurbished" : "new"],
        ["g:identifier_exists", "no"],
        ...(google ? [["g:google_product_category", google]] : []),
        ["g:product_type", type],
        ...(v?.size ? [["g:size", v.size]] : []),
        ...(colour ? [["g:color", colour]] : []),
      ];
      out.push(`<item>${tags.map(([k, x]) => `<${k}>${XML(x)}</${k}>`).join("")}</item>`);
    }
  }
  return out;
}

/** The whole feed: the channel names the store and its page, then every item. */
export function productFeed(products: readonly StoreProduct[], o: FeedOptions & { description: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>`
    + `<title>${XML(o.storeName)}</title><link>${XML(`${o.site}/store?lang=${o.lang}`)}</link><description>${XML(o.description)}</description>`
    + `${feedItems(products, o).join("\n")}</channel></rss>\n`;
}
