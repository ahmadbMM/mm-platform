import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { siteSchema } from "@/content/pages/site";
import { termsSchema } from "@/content/pages/terms";
import { asLocale, resolvePage } from "@/lib/content";
import { payReady } from "@/lib/pay/config";
import { paySettings } from "@/lib/pay/settings";
import { fill } from "@/lib/fill";
import { isoDay, parseBody } from "@/lib/journal";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";

// micromobility.sa/terms - the Terms & Conditions staff keep in Website > Terms (content/pages/
// terms.ts). Legal text in English and Arabic only, like the Privacy Notice: every other language
// reads the English, told so in its own language. Plain text, never markup.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("terms");
  const tx = serverL(locale);
  const t = resolvePage(termsSchema, content, asLocale(locale));
  return pageMeta({ path: "/terms", locale, title: `${tx("Terms & Conditions", "الشروط والأحكام")} · Micromobility`, description: S(t.intro.text), closed });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const own = L === "en" || L === "ar";
  const { content, previewing, hidden } = await pageState("terms");
  const site = resolvePage(siteSchema, content, L);
  const t = resolvePage(termsSchema, content, L);
  const day = isoDay(S(t.intro.updated)); // a day that is not a real one is left out, never a broken page
  const updated = day
    ? new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))
    : "";
  const clauses = list(t.clauses.items).filter((c) => S(c.title) || S(c.body));
  // Paying online (2026-11-10): while this site takes payments, the Terms say how (the E-Commerce Law's disclosures
  // before a purchase, and Moyasar's: who processes it, refunds, their timing, complaints). Written in English and
  // Arabic as the rest of the Terms; staff do not edit it, the settings it names are theirs (pay.*).
  const ps = paySettings(content);
  if (ps.enabled && payReady() && clauses.length) {
    const ar = L === "ar";
    // The refund rule as the database decides it (pay_booking_cancel: not refunded once today + refundDays is after
    // the ride day), so 0 days refunds a cancellation made on the ride day itself.
    const days = ps.refundDays;
    const when = ar
      ? (days > 1 ? `قبل يوم الرحلة بـ ${days} أيام على الأقل` : days === 1 ? "قبل يوم الرحلة" : "حتى نهاية يوم الرحلة")
      : (days > 1 ? `at least ${days} days before the ride day` : days === 1 ? "by the day before the ride" : "by the end of the ride day");
    // How rides are paid follows staff's pay.bookings, as the Experiences page does: paid when booking, the rider's
    // choice of online or the desk, or at the desk only ("off": no ride is paid online, so that line goes; one paid
    // online before can still be cancelled and refunded, so the cancelling line stays).
    const rideLine = ps.bookings === "off" ? null : ar
      ? (ps.bookings === "optional"
        ? `- يمكن دفع الرحلات المدفوعة إلكترونياً عند الحجز أو في المكتب. إذا دفعت إلكترونياً نحتفظ بمكانك لمدة ${ps.holdMinutes} دقيقة أثناء الدفع، وإذا لم يكتمل الدفع خلالها يُلغى الحجز المؤقت ولا يُخصم أي مبلغ.`
        : `- تُدفع الرحلات المدفوعة عند الحجز. نحتفظ بمكانك لمدة ${ps.holdMinutes} دقيقة أثناء الدفع، وإذا لم يكتمل الدفع خلالها يُلغى الحجز المؤقت ولا يُخصم أي مبلغ.`)
      : (ps.bookings === "optional"
        ? `- Paid rides can be paid online when you book, or at the desk. If you pay online, your place is held for ${ps.holdMinutes} minutes while you pay; if the payment is not completed in that time, the place is released and nothing is charged.`
        : `- Paid rides are paid when you book. Your place is held for ${ps.holdMinutes} minutes while you pay; if the payment is not completed in that time, the place is released and nothing is charged.`);
    const payClause = {
      title: ar ? "الدفع الإلكتروني" : "Paying online",
      body: (ar ? [
        `- تتم معالجة المدفوعات الإلكترونية عبر شركة ميسّر للمدفوعات، المرخّصة من البنك المركزي السعودي. نقبل مدى وفيزا وماستركارد وApple Pay وSTC Pay. تُرسل بيانات بطاقتك مباشرة إلى ميسّر، ولا نطّلع عليها ولا نحتفظ بها. الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة، ولا نضيف أي رسوم على الدفع بالبطاقة.`,
        rideLine,
        `- يمكنك إلغاء الرحلة المدفوعة إلكترونياً من «حجوزاتي». ألغِ الحجز ${when} لاسترداد المبلغ كاملاً، إلى محفظتك فوراً أو إلى بطاقتك. لا يُسترد المبلغ عند الإلغاء بعد ذلك أو عدم الحضور. وإذا ألغينا نحن الرحلة نعيد المبلغ كاملاً بطريقة الدفع نفسها ما لم تختر المحفظة.`,
        `- في طلبات المتجر يشمل الإجمالي المعروض قبل الدفع رسوم التوصيل، ويظهر موعد التوصيل قبل الدفع وفي صفحة طلبك.`,
        `- يصل المبلغ المسترد إلى بطاقات مدى خلال 1 إلى 3 أيام عمل، وإلى البطاقات الائتمانية خلال 14 يوم عمل كحد أقصى.`,
        `- لأي استفسار أو شكوى عن الدفع راسلنا عبر واتساب أو البريد الإلكتروني، ونرد خلال يوم عمل واحد.`,
      ] : [
        `- Online payments are processed by Moyasar, a payment company licensed by the Saudi Central Bank. We accept mada, Visa, Mastercard, Apple Pay and STC Pay. Your card details go straight to Moyasar: we never see or keep them. Prices are in Saudi riyals and include VAT, and we never add a fee for paying by card.`,
        rideLine,
        `- You can cancel a ride paid online from My bookings. Cancel ${when} for a full refund, to your wallet straight away or back to your card. Cancelling later, or not coming, is not refunded. If we cancel a ride, we refund it in full, the way you paid unless you choose your wallet.`,
        `- For store orders, the total shown before you pay includes delivery, and the delivery date is shown before you pay and on your order page.`,
        `- Refunds reach mada cards within 1 to 3 working days, and credit cards within up to 14 working days.`,
        `- For any question or complaint about a payment, message us on WhatsApp or by email: we reply within one working day.`,
      ]).filter(Boolean).join("\n"),
    };
    clauses.splice(Math.max(0, clauses.length - 1), 0, payClause as (typeof clauses)[number]);
  }
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg pg-privacy">
        <h1>{tx("Terms & Conditions", "الشروط والأحكام")}</h1>
        {updated && <p className="pg-updated">{fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: updated })}</p>}
        {!own && <p className="pg-updated">{tx("These terms are available in English and Arabic.", "هذه الشروط متاحة بالإنجليزية والعربية.")}</p>}
        <div className="pg-notice" {...(own ? {} : { lang: "en", dir: "ltr" })}>
          {S(t.intro.text) && <p>{S(t.intro.text)}</p>}
          {clauses.map((c, i) => (
            <section key={i}>
              {S(c.title) && <h2>{S(c.title)}</h2>}
              {parseBody(S(c.body)).map((b, k) => ("h" in b ? <h3 key={k}>{b.h}</h3> : "ul" in b ? <ul key={k}>{b.ul.map((x, j) => <li key={j}>{x}</li>)}</ul> : <p key={k}>{b.p}</p>))}
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
