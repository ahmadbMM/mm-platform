import type { Session } from "../account-core";
import type { MkCategory, MkListingMine, MkMe } from "./core";
import { loadMarketCategories, mkMe, mkMyListings } from "./server";

// What the selling pages read on the server for a signed-in account (W2; server only): the categories anyone can list
// under, what this account may do (market_me) and its own listings (market_my_listings), asked for together. The
// account's two reads are never kept: they are its own and they change with every save. When either failed, the
// reason is handed to the page's script instead, which says it and can ask again through the site's own routes.
export type SellData = {
  cats: MkCategory[];
  me: MkMe | null;
  mine: MkListingMine[] | null;
  error: { error: string; detail: string } | null;
};

/** The moment a page is drawn, handed to its script so both count a listing's days left from the same instant. */
export const drawnAt = (): number => Date.now();

export async function sellData(s: Session): Promise<SellData> {
  const [cats, me, mine] = await Promise.all([loadMarketCategories(), mkMe(s), mkMyListings(s)]);
  if (me.ok && mine.ok) return { cats, me: me.data, mine: mine.data.items, error: null };
  const no = !me.ok ? me : !mine.ok ? mine : null;
  return { cats, me: null, mine: null, error: no ? { error: no.error, detail: no.detail } : { error: "generic", detail: "" } };
}
