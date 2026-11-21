import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import ShopDesk from "@/components/market/w4/ShopDesk";
import { T } from "@/components/market/w4.text";
import "@/components/market/w4.css";
import { serverLocalize } from "@/i18n/dicts";
import { MK_MY_SHOP } from "@/lib/market/core";
import { mkSession } from "@/lib/market/server";
import { w4ShopData } from "@/lib/market/w4-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/my-shop: a signed-in account's own shop. The state of its application (waiting, open,
// not approved, paused); staff's reason on a refusal, with the way to change the application and send it again; the
// details as they were sent; and for an approved shop the link to its public page, how many of its listings are on
// sale, and the form for the details its owner may still change (the Arabic name, the address and map link, the
// phone and WhatsApp, about, return terms, what it sells, the logo). The trade name, the registration, the VAT number
// and the city of an approved shop are staff's to change. An account with no shop is shown the way to apply.
// Signed out, the site's sign-in. It is the account's own page: never in search engines, never kept at the edge.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const w = serverLocalize(T, locale);
  return pageMeta({ path: MK_MY_SHOP, locale, noindex: true, title: `${w.myShop} · MicroMobility` });
}

export default async function MyShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [at, session] = await Promise.all([marketSite(locale), mkSession()]);
  const data = session ? await w4ShopData(session) : null;
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={session}>
        {data && <ShopDesk page="mine" locale={locale} {...data} />}
      </MkGate>
    </MkFrame>
  );
}
