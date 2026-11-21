import { Link } from "@/i18n/navigation";
import { MK_RULES } from "@/lib/market/core";
import type { W4Anchor } from "@/lib/market/w4-rules";
import MkIcon from "../MkIcon";
import type { MkWords } from "../Market.text";

// A link to the Marketplace's rules, in the shared words ("Marketplace rules"), for any Marketplace screen: the
// selling form and the shop application beside their tick, a listing's page and a conversation beside Report, the
// commission pop-up. `anchor` opens the page at one of its sections (lib/market/w4-rules.ts W4_ANCHORS: "safety",
// "not-allowed", "commission", "reports" ...). It reads only the anchor's type from the rules' file, so a screen that
// draws it in the browser never carries the rules' text.
//   t         the shared words in the page's language (Market.text.ts)
//   anchor    the section to open at; the top of the page without it
//   label     other words for the link (a section's own name); the shared "Marketplace rules" without it
//   newTab    open beside a form, so that what was typed is not left
export default function RulesLink({ t, anchor, label, newTab = false, className = "" }: { t: MkWords; anchor?: W4Anchor; label?: string; newTab?: boolean; className?: string }) {
  return (
    <Link className={`mk-link${className ? ` ${className}` : ""}`} href={anchor ? `${MK_RULES}#${anchor}` : MK_RULES} {...(newTab ? { target: "_blank", rel: "noopener" } : {})}>
      {label ?? t.rules}<MkIcon name="next" size={16} flip />
    </Link>
  );
}
