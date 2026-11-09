import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import CheckoutForm from "@/components/store/CheckoutForm";
import { allWhens, openOr404, storeState } from "@/components/store/store-data";
import { cartProducts } from "@/components/store/slim";
import { getAccount, rpcServer } from "@/lib/account";
import { walletOf } from "@/lib/wallet";
import "@/components/experiences/experiences.css";
import "@/components/account/account.css";
import "@/components/store/store.css";

// micromobility.sa/store/checkout - one page from the cart to payment (components/store/CheckoutForm.tsx).
// A signed-in account's name, mobile and email fill the contact in, and its wallet may pay first; a guest
// orders without an account.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/checkout", locale, title: `${s.t.checkoutTitle} · Micromobility`, noindex: true });
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  const [s, acct] = await Promise.all([storeState(locale), getAccount()]);
  openOr404(s);
  // the wallet (rentals 20261102210000): no switch while it cannot be read
  const wallet = acct ? await rpcServer<unknown>("customer_wallet", { p_id: acct.id, p_token: acct.token }).then((r) => (r.status === 200 ? walletOf(r.data) : null)) : null;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <h1 className="st-title">{s.t.checkoutTitle}</h1>
        <CheckoutForm
          locale={locale}
          products={cartProducts(s.store)}
          settings={s.settings}
          whens={allWhens(s, locale)}
          showroom={{ address: S(s.site.contact.address), hours: S(s.site.contact.hoursText) }}
          account={acct ? { name: acct.name, phone: acct.phone, email: acct.email } : null}
          balance={wallet?.balance ?? 0}
          links={{ returns: s.hidden.includes("help") ? null : "/help#returns", terms: s.hidden.includes("terms") ? null : "/terms" }}
        />
      </div>
    </PageShell>
  );
}
