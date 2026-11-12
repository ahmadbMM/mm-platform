import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/site/PageShell";
import { Link } from "@/i18n/navigation";
import PayScreen from "@/components/pay/PayScreen";
import { T } from "@/components/pay/Pay.text";
import "@/components/experiences/experiences.css";
import "@/components/pay/pay.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { MOYASAR_FORM_CSS, MOYASAR_FORM_JS, payEnv, payMode, payReady } from "@/lib/pay/config";
import { sar } from "@/lib/pay/money";
import { payView, type PayView } from "@/lib/pay/server";
import { paySettings } from "@/lib/pay/settings";
import { serverLocalize } from "@/i18n/dicts";
import { fill } from "@/i18n/tx";

// micromobility.sa/pay/<id>: the one page that takes a payment, whatever it pays (a store order, ride
// bookings, lockers, a wallet top-up, a workshop job; rentals 20261110150000 payments). Its address is the
// payment's own id, which nobody can guess; it shows what is paid, the total the database wrote, the hold's
// time left, the refund policy before the Pay button (Saudi E-Commerce Law art. 7), and Moyasar's form.
// Paid, it says so with the receipt number and where to go next; a store order goes to its order page.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

const BRAND: Record<string, string> = { mada: "mada", visa: "Visa", mastercard: "Mastercard", amex: "American Express" };
const METHOD: Record<string, string> = { applepay: "Apple Pay", stcpay: "STC Pay", samsungpay: "Samsung Pay", googlepay: "Google Pay" };

function paidWith(v: PayView): string | null {
  const m = v.method && METHOD[v.method];
  const card = v.brand ? `${BRAND[v.brand] ?? v.brand}${v.last4 ? ` •••• ${v.last4}` : ""}` : null;
  return m ? (card ? `${m} (${card})` : m) : card;
}

export default async function PayPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, id } = await params;
  const q = await searchParams;
  const L = asLocale(locale);
  const t = serverLocalize(T, locale);
  const [{ content, previewing, hidden }, v] = await Promise.all([pageState(), payView(id)]);
  if (!v) notFound();
  const site = resolvePage(siteSchema, content, L);
  const env = payEnv();
  const s = paySettings(content);
  const kind = v.kind;
  const open = v.status === "initiated" && payReady(env) && s.enabled;
  const policy = kind === "booking"
    ? (s.refundDays > 1 ? fill(t.policy.bookingDays, s.refundDays) : s.refundDays === 0 ? t.policy.bookingSameDay : t.policy.booking)
    : t.policy[kind];
  // The policy's link, left out while staff have that page switched off (the checkout and the order page do the same):
  // a closed page sends the payer away from this one while the hold runs.
  const policyHref = kind === "order" ? (hidden.includes("help") ? null : "/help#returns") : (hidden.includes("terms") ? null : "/terms");
  const next: Record<PayView["kind"], string> = {
    booking: "/account", order: v.order_no && v.order_key ? `/store/order/${v.order_no}?k=${v.order_key}` : "/store",
    locker: "/lockers", topup: "/account", workshop: "/workshop",
  };
  // Start again on a store order: the cart was emptied when the order was placed, so its own page, which puts the items
  // back (PutBack), not the empty cart (bug hunt 2026-11-11)
  const orderAgain = v.order_no && v.order_key ? next.order : "/store/cart";

  const lines: { k: string; v?: string }[] = [];
  for (const r of v.rides ?? []) lines.push({ k: [r.name, r.type && r.type !== "None" ? r.type : "", r.date].filter(Boolean).join(" · ") });
  for (const i of v.items ?? []) lines.push({ k: `${i.name}${i.variant ? ` · ${i.variant}` : ""}${i.qty > 1 ? ` ×${i.qty}` : ""}`, v: sar(i.unit_price * i.qty) });
  if ((v.delivery_fee ?? 0) > 0) lines.push({ k: t.delivery, v: sar(v.delivery_fee!) });
  if ((v.wallet_paid ?? 0) > 0) lines.push({ k: t.fromWallet, v: `− ${sar(v.wallet_paid!)}` });
  for (const l of v.lockers ?? []) lines.push({ k: `${fill(t.locker, l.code)} · ${l.day}` });

  let body: React.ReactNode;
  if (v.status === "paid" || v.status === "partly_refunded") {
    const w = paidWith(v);
    body = (
      <div className="py-done" role="status">
        <span className="py-tick" aria-hidden="true" />
        <h1 className="bk-title">{t.paidTitle}</h1>
        <p className="bk-sub">{t.paidSub[kind]}</p>
        <p className="py-paid-amt"><bdi className="tk-amt">{sar(v.amount)}</bdi></p>
        {w && <p className="py-meta">{fill(t.paidWith, w)}</p>}
        {v.receipt_no != null && <p className="py-meta">{fill(t.receipt, String(v.receipt_no))}</p>}
        <div className="bk-foot"><Link className="bk-btn wide" href={next[kind]}>{t.next[kind]}</Link></div>
      </div>
    );
  } else if (v.status === "refunded") {
    body = <div className="py-done"><h1 className="bk-title">{t.refundedTitle}</h1><p className="bk-sub">{t.refundedSub}</p><Link className="bk-btn2" href="/">{t.home}</Link></div>;
  } else if (v.status === "expired" || v.status === "cancelled") {
    body = (
      <div className="py-done">
        <h1 className="bk-title">{v.status === "expired" ? t.expiredTitle : t.cancelledTitle}</h1>
        <p className="bk-sub">{t.expiredSub}</p>
        <Link className="bk-btn wide" href={kind === "order" ? orderAgain : kind === "locker" ? "/lockers" : kind === "booking" ? "/experiences" : "/"}>{t.startAgain}</Link>
      </div>
    );
  } else {
    // The hold's time left by this server's clock, never the phone's: the page counts down from it, so a phone clock
    // set wrong neither ends the hold early nor keeps the form up after it.
    const leftMs = Date.parse(v.expires_at) - new Date().getTime();
    body = (
      <div className="py-grid">
        <section className="py-sum" aria-labelledby="py-h">
          <p className="py-kind">{t.kinds[kind]}</p>
          <h1 id="py-h" className="py-desc">{v.description}</h1>
          {lines.length > 0 && (
            <ul className="py-lines">
              {lines.map((l, i) => <li key={i}><span>{l.k}</span>{l.v && <bdi className="tk-amt">{l.v}</bdi>}</li>)}
            </ul>
          )}
          <p className="py-total"><span>{t.total}</span><bdi className="tk-amt">{sar(v.amount)}</bdi></p>
          <p className="py-vat">{t.vat}</p>
          {policy && (
            <p className="py-policy">{policy}{policyHref && <> <a href={policyHref}>{kind === "order" ? t.returns : t.terms}</a></>}</p>
          )}
          <p className="py-marks" aria-label={t.methods}>
            {["mada", "visa", "mastercard"].map((m) => <img key={m} src={`/site/payments/${m}.svg`} alt="" width={46} height={30} />)}
            <span className="py-marks-t">{t.methods}</span>
          </p>
        </section>
        <section className="py-pay">
          {open ? (
            <PayScreen locale={locale} publishableKey={env.MOYASAR_PUBLISHABLE_KEY!} testMode={payMode(env) === "test"} formJs={MOYASAR_FORM_JS} formCss={MOYASAR_FORM_CSS}
              pay={{ id: v.id, kind, ref: v.ref, amount: v.amount, description: v.description, hold: v.hold, leftMs: Number.isFinite(leftMs) ? leftMs : 0 }}
              declined={q.tried ? v.message : null} tried={!!q.tried} againHref={kind === "order" ? orderAgain : null} />
          ) : (
            <p className="py-msg" role="status">{t.notOpen}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="xs bk py">{body}</div>
    </PageShell>
  );
}
