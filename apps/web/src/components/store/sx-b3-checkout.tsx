import CheckoutForm from "./CheckoutForm";
import type { SxCheckout } from "./CheckoutPlus";
import { allWhens, type StoreState } from "./store-data";
import { cartProducts } from "./slim";
import { sxCheckout } from "./sx-b3-data";
import { rpcServer, type Account } from "@/lib/account";
import type { CartItem } from "@/lib/cart";
import { storeEnv } from "@/lib/store-api";
import { deliverySlots, servedDistricts, storeSwitches } from "@/lib/store-settings";
import { walletOf } from "@/lib/wallet";
import { intlOf } from "@/i18n/locales";

// Checkout's form as /store/checkout draws it, and a quote's link (/store/q/<token>, N23, 2026-11-18) with the quote's
// lines in place of the cart: one drawing for both, so a quote is paid exactly as any order is.
export async function CheckoutView({ s, locale, acct, buy, quote = null }: {
  s: StoreState; locale: string; acct: Account | null; buy: CartItem[]; quote?: SxCheckout["quote"];
}) {
  // the wallet (rentals 20261102210000): no switch while it cannot be read
  const wallet = acct ? await rpcServer<unknown>("customer_wallet", { p_id: acct.id, p_token: acct.token }).then((r) => (r.status === 200 ? walletOf(r.data) : null)) : null;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  // the build of 2026-11-18 (B3): a company, the map pin, the handover slot, a booked session, still learning, a quote
  const sx = await sxCheckout(s, locale, acct, { lines: buy.length ? buy.length : null, quote });
  return (
    <CheckoutForm
      locale={locale}
      intl={intlOf(locale)}
      products={cartProducts(s.store)}
      settings={s.settings}
      whens={allWhens(s, locale)}
      showroom={{ address: S(s.site.contact.address), hours: S(s.site.contact.hoursText) }}
      account={acct ? { name: acct.name, phone: acct.phone, email: acct.email } : null}
      balance={wallet?.balance ?? 0}
      // the returns policy is its own page, open whatever the switches say (/returns); the Terms only while switched on
      links={{ returns: "/returns", terms: s.hidden.includes("terms") ? null : "/terms" }}
      licence={s.licence}
      today={s.today}
      slots={deliverySlots(s.content)}
      districts={servedDistricts(s.content)}
      lookup={storeSwitches(s.content).addressLookup && !!storeEnv().NATIONAL_ADDRESS_KEY}
      buy={buy.length ? buy : null}
      sx={sx}
      minOrder={s.rules.minOrder}
    />
  );
}
