import { Link } from "@/i18n/navigation";
import { MK_SELL } from "@/lib/market/core";
import MkIcon from "./MkIcon";
import type { MkWords } from "./Market.text";

// The way into the selling form, "Sell an item": on the browse page, a shop's page and My listings. It leads to
// /marketplace/sell, which asks a visitor to sign in first and offers a seller their drafts to carry on with. It is a
// plain link, so it draws on the server and in the browser alike, and it never says who may or may not sell: the form
// says that to the account it is opened with.
//   t         the shared words in the page's language (Market.text.ts)
//   variant   "button" (the green button, the default) or "link" (a text link)
export type SellLinkProps = { t: MkWords; variant?: "button" | "link"; className?: string };

export default function SellLink({ t, variant = "button", className = "" }: SellLinkProps) {
  return (
    <Link href={MK_SELL} className={`${variant === "link" ? "mk-link" : "mk-btn"}${className ? ` ${className}` : ""}`}>
      <MkIcon name="plus" size={18} />{t.sell}
    </Link>
  );
}
