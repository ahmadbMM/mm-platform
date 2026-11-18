import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import { openOr404, storeState } from "@/components/store/store-data";
import { CheckoutView } from "@/components/store/sx-b3-checkout";
import { getAccount } from "@/lib/account";
import { buyLinesOf } from "@/lib/store-checkout";
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
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <h1 className="st-title">{s.t.checkoutTitle}</h1>
        {/* the form, with the build of 2026-11-18's parts (components/store/sx-b3-checkout.tsx), as a quote's link draws it */}
        <CheckoutView s={s} locale={locale} acct={acct} buy={buyLinesOf(q)} />
      </div>
    </PageShell>
  );
}
