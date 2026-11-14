import "./marks.css";

// The ways to pay online, as the card schemes ask (2026-11-14, before Moyasar's review): mada first (first from the
// left on an English page, from the right on an Arabic one: the row follows the page's direction), never smaller than
// the other marks and never in a white box; Visa and Mastercard in their own colours; STC Pay's own mark (the one
// Moyasar's form shows). Apple Pay is Apple's own button inside Moyasar's form, so the words below name it. The marks
// are pictures beside those words, so they say nothing to a screen reader. Used where a payment is taken or begun:
// the payment page, the store's checkout and the booking review.
export const PAY_MARKS = [
  { id: "mada", src: "/site/payments/mada-color.svg", w: 100, h: 34 },
  { id: "visa", src: "/site/payments/visa-color.svg", w: 95, h: 31 },
  { id: "mastercard", src: "/site/payments/mastercard-color.svg", w: 70, h: 55 },
  { id: "stcpay", src: "/site/payments/stcpay.svg", w: 512, h: 174 },
] as const;

export default function PayMarks({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`py-marks${compact ? " small" : ""}`}>
      <span className="py-marks-row">
        {PAY_MARKS.map((m) => <img key={m.id} className={`py-mark py-mark-${m.id}`} src={m.src} alt="" width={m.w} height={m.h} />)}
      </span>
      <span className="py-marks-t">{label}</span>
    </div>
  );
}
