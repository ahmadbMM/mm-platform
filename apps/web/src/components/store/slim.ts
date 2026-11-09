import type { Store, StoreProduct } from "@/lib/store-core";

/** The products as the cart and checkout need them: no descriptions or specifications, the first photo only. */
export const cartProducts = (store: Store): StoreProduct[] =>
  store.products.map((p) => ({ ...p, description_en: null, description_ar: null, tagline_en: null, tagline_ar: null, specs: [], images: p.images.slice(0, 1) }));
