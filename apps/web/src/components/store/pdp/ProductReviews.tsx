import { loadReviews, type StoreProduct } from "@/lib/store";
import ReviewList from "./ReviewList";

// The product's reviews as staff show them (store_reviews, status shown; lib/store.ts loadReviews, kept a minute).
export default async function ProductReviews({ p, locale }: { p: StoreProduct; locale: string }) {
  const reviews = (await loadReviews()).get(p.id.toLowerCase()) ?? [];
  return <ReviewList reviews={reviews} locale={locale} />;
}
