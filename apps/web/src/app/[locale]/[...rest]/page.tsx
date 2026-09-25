import { notFound } from "next/navigation";

// Any address the site has no page for. Without this, an unknown address fell through to Next's
// built-in 404 - English only, unstyled, with no <html lang>. Here it reaches the site's own
// not-found page (../not-found.tsx), in the visitor's language, inside the header and footer.
export default function Unknown() {
  notFound();
}
