import type { Session } from "../account-core";
import type { MkMe, MkShopMine } from "./core";
import { mkMe, mkShopMine } from "./server";

// What the shop pages read on the server for a signed-in account (W4; server only): what the account may do in the
// Marketplace (market_me: an adult by its birth date, a paused seller, the rules' current version) and its own shop
// (market_shop_mine), asked for together and never kept: both are the account's own and change with every save. When
// either failed, the reason is handed to the page's script instead, which says it and can ask again through the
// site's own routes.
export type W4Data = {
  me: MkMe | null;
  shop: MkShopMine | null;
  error: { error: string; detail: string } | null;
  /** Names this account's unsent application in its own browser (lib/market/w4.ts w4DraftKey). */
  tag: string;
};

/** A name for what this account keeps in its browser, made from its session so that it cannot be worked back to the
 *  account and another account on the same phone never reads it. It changes when the session does. */
export async function w4DraftTag(s: Session): Promise<string> {
  const bytes = new TextEncoder().encode(`mk-w4-draft:${s.id}:${s.token}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function w4ShopData(s: Session): Promise<W4Data> {
  const [me, mine, tag] = await Promise.all([mkMe(s), mkShopMine(s), w4DraftTag(s)]);
  if (me.ok && mine.ok) return { me: me.data, shop: mine.data.shop ?? null, error: null, tag };
  const no = !me.ok ? me : !mine.ok ? mine : null;
  return { me: null, shop: null, error: no ? { error: no.error, detail: no.detail } : { error: "generic", detail: "" }, tag };
}
