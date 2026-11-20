import Gone from "@/components/market/w1/Gone";

// /marketplace/<number> for a listing nobody is shown any more: the page calls notFound(), the address answers 404,
// and this draws the Marketplace's own dead end (components/market/w1/Gone.tsx) in place of the site's.
export default function ListingNotFound() {
  return <Gone />;
}
