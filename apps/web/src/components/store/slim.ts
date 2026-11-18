import { linePhotos, type Store, type StoreProduct } from "@/lib/store-core";

/** The products as the cart and checkout need them: no descriptions or specifications, and only the photos a line can
 *  show (the first, then each colour's first: linePhotos), so a line shows the colour picked as the product page and
 *  the order page do (bug hunt 2026-11-18: the first photo alone drew every colour as the cover's). */
export const cartProducts = (store: Store): StoreProduct[] =>
  store.products.map((p) => ({ ...p, description_en: null, description_ar: null, tagline_en: null, tagline_ar: null, specs: [], images: linePhotos(p) }));
