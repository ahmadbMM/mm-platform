import "./marks.css";

// The ways to pay online, as the card schemes ask (2026-11-14, before Moyasar's review): mada first (first from the
// left on an English page, from the right on an Arabic one: the row follows the page's direction), never smaller than
// the other marks and never in a white box; Visa and Mastercard in their own colours; STC Pay's own mark (the one
// Moyasar's form shows). The marks are pictures beside the words below, so they say nothing to a screen reader. Used
// where a payment is taken or begun: the payment page, the store's checkout, the booking review, and the footer's strip.
// The store build (2026-11-15, X05; the owner: "put the original logos, they don't need to match the theme of the
// website"): the row is exactly what checkout takes, every mark the brand's own artwork. Apple Pay's mark (Apple's
// Apple Pay Mark, unaltered) sits second, as the Pay button Moyasar's form draws for it is there on every payment;
// tabby's is not here, since no payment takes it (a Tabby choice, while it is switched on, carries its own mark).
export const PAY_MARKS = [
  { id: "mada", name: "mada", src: "/site/payments/mada-color.svg", w: 100, h: 34 },
  { id: "applepay", name: "Apple Pay", src: "/site/payments/applepay.svg", w: 166, h: 106 },
  { id: "visa", name: "Visa", src: "/site/payments/visa-color.svg", w: 95, h: 31 },
  { id: "mastercard", name: "Mastercard", src: "/site/payments/mastercard-color.svg", w: 70, h: 55 },
  { id: "stcpay", name: "STC Pay", src: "/site/payments/stcpay.svg", w: 512, h: 174 },
] as const;

export default function PayMarks({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`py-marks${compact ? " small" : ""}`}>
      <span className="py-marks-row">
        {PAY_MARKS.map((m) => <img key={m.id} className={`py-mark py-mark-${m.id}`} src={m.src} alt="" width={m.w} height={m.h} />)}
      </span>
      {label && <span className="py-marks-t">{label}</span>}
    </div>
  );
}
