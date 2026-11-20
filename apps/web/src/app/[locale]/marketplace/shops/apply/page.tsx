import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import ShopDesk from "@/components/market/w4/ShopDesk";
import { T } from "@/components/market/w4.text";
import "@/components/market/w4.css";
import { serverLocalize } from "@/i18n/dicts";
import { MK_SHOP_APPLY } from "@/lib/market/core";
import { mkSession } from "@/lib/market/server";
import { w4ShopData } from "@/lib/market/w4-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/shops/apply: a signed-in account applies to open a shop in the Marketplace. The trade
// name in English and Arabic, the commercial registration number and its activity, the VAT number if the shop has
// one, the city, address and map link, the phone and WhatsApp, what it sells, about the shop, its return terms, a
// logo, and the tick for the rules and the shop agreement (components/market/w4/ShopForm.tsx). A shop's registration
// and VAT numbers are a business's identifiers and are shown on its page; no personal ID number is asked for.
// What is typed is kept in the browser as it goes. One shop per account: an account that has applied reads the
// application's state here, and can change and send it again while it is waiting or was not approved (?edit=1 opens
// the form at once). Staff approve each shop. Signed out, the site's sign-in.
// It is the account's own page: never in search engines, never kept at the edge (lib/page-cache.ts).
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const w = serverLocalize(T, locale);
  return pageMeta({ path: MK_SHOP_APPLY, locale, noindex: true, title: `${w.applyTitle} · MicroMobility` });
}

export default async function ShopApplyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  const [at, session, q] = await Promise.all([marketSite(locale), mkSession(), searchParams]);
  const data = session ? await w4ShopData(session) : null;
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={session}>
        {data && <ShopDesk page="apply" locale={locale} {...data} edit={q.edit === "1"} />}
      </MkGate>
    </MkFrame>
  );
}
