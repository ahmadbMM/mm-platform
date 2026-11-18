import { serverLocalize } from "@/i18n/dicts";
import { isBike, type StoreProduct } from "@/lib/store-core";
import { waHref, waNumber } from "@/lib/store-sections";
import { WhatsAppMark } from "../bits";
import { StIcon } from "../icons";
import { T } from "../w3b.text";
import { SwapMark } from "./marks";

// "Trade in your old bike" (F52), on a bike's page: one row that opens a WhatsApp chat with the store, its first
// message naming this bike; the workshop values the old one by hand. Nothing when the site has no WhatsApp number.
export default function TradeIn({ p, locale, site }: { p: StoreProduct; locale: string; site: { social?: Record<string, unknown>; contact?: Record<string, unknown> } }) {
  if (!isBike(p)) return null;
  const num = waNumber(site);
  if (!num) return null;
  const w = serverLocalize(T, locale);
  return (
    <a className="st-pd-trade" href={waHref(num, w.tradeMsg(p.name_en))} target="_blank" rel="noopener noreferrer">
      <span className="st-pd-trade-ic"><SwapMark /></span>
      <b>{w.tradeIn}</b>
      <span className="st-pd-trade-wa"><WhatsAppMark size={20} /><span className="st-pd-sr">WhatsApp</span></span>
      <StIcon name="next" size={18} flip />
    </a>
  );
}
