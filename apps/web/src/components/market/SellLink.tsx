import { Link } from "@/i18n/navigation";
import { MK_SELL } from "@/lib/market/core";
import MkIcon from "./MkIcon";
import type { MkWords } from "./Market.text";

// PLACEHOLDER (the foundation's): the selling builder (W2) replaces this file and keeps its props. The way into the
// selling form from the browse page, a shop's page and My listings: "Sell an item". Until it is built it is a plain
// link to the form's address.
//   t         the shared words in the page's language (Market.text.ts)
//   variant   "button" (the green button, the default) or "link" (a text link)
export type SellLinkProps = { t: MkWords; variant?: "button" | "link"; className?: string };

export default function SellLink({ t, variant = "button", className = "" }: SellLinkProps) {
  return (
    <Link href={MK_SELL} className={`${variant === "link" ? "mk-link" : "mk-btn"}${className ? ` ${className}` : ""}`} data-mk-placeholder="sell">
      <MkIcon name="plus" size={18} />{t.sell}
    </Link>
  );
}
