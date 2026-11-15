import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import CheckoutForm from "@/components/store/CheckoutForm";
import { allWhens, openOr404, storeState } from "@/components/store/store-data";
import { cartProducts } from "@/components/store/slim";
import { getAccount, rpcServer } from "@/lib/account";
import { storeEnv } from "@/lib/store-api";
import { buyLinesOf } from "@/lib/store-checkout";
import { deliverySlots, servedDistricts, storeSwitches } from "@/lib/store-settings";
import { walletOf } from "@/lib/wallet";
import { intlOf } from "@/i18n/locales";
import "@/components/experiences/experiences.css";
import "@/components/account/account.css";
import "@/components/store/store.css";

// micromobility.sa/store/checkout - from the cart to payment in steps (components/store/CheckoutForm.tsx). A signed-in
// account's name, mobile and email fill the contact in, and its wallet may pay part; a guest orders without an account.
// /store/checkout?buy=<variant>&qty=<n>&with=<variant>,… (Buy now, F35) checks out those lines and leaves the cart alone.
// Scheduled Jeddah delivery (F78), the districts served (F79) and the short address lookup (F76) come only while staff
// switch them on (the lookup also needs its key in the Worker); a code (F67) only beside the discount licence.
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/checkout", locale, title: `${s.t.checkoutTitle} · Micromobility`, noindex: true });
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const [s, acct, q] = await Promise.all([storeState(locale), getAccount(), searchParams]);
  openOr404(s);
  // the wallet (rentals 20261102210000): no switch while it cannot be read
  const wallet = acct ? await rpcServer<unknown>("customer_wallet", { p_id: acct.id, p_token: acct.token }).then((r) => (r.status === 200 ? walletOf(r.data) : null)) : null;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const buy = buyLinesOf(q);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <h1 className="st-title">{s.t.checkoutTitle}</h1>
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
        />
      </div>
    </PageShell>
  );
}
