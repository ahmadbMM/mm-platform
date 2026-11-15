"use client";

import { useId, useState, type ReactNode } from "react";
import { sar } from "@/lib/store-core";
import { dateLabel } from "@/lib/store-checkout";
import { Amt, Ic } from "./bits";
import type { GiftCardPay, Promo } from "./useCode";
import type { StoreText } from "./Store.text";
import type { W4Text } from "./w4.text";

// The small pieces the cart and checkout share (store build 2026-11-15, chain w4): the collapsed "Have a code?" in the
// summary (F67), the gift card to pay with (F57), pills to pick a day and a time (F78), Apple's own Apple Pay button
// (F83) and one step of checkout that closes into its summary (O12-C).

/** A riyal amount taken off, as the summary writes it. */
export const Off = ({ n }: { n: number }) => <Amt>{`− ${sar(n)}`}</Amt>;

/** "Have a code?" (F67): a link in the summary that opens the code's box; a code taken shows as a line with Remove. */
export function CodeRow({ promo, off, t, w }: { promo: Promo; off: number; t: StoreText; w: W4Text }) {
  const [open, setOpen] = useState(!!promo.want && !promo.hit);
  const [raw, setRaw] = useState(promo.want ?? "");
  const id = useId();
  if (promo.hit) {
    return (
      <p className="bk-sum-row st-co-off">
        <span>{w.codeLine(promo.hit.code)}<button type="button" className="st-co-x" onClick={() => { promo.remove(); setRaw(""); }} aria-label={w.removeOf(promo.hit.code)}><Ic name="close" size={14} /></button></span>
        <Off n={off} />
      </p>
    );
  }
  if (!open) return <button type="button" className="st-co-more" aria-expanded="false" onClick={() => setOpen(true)}>{w.haveCode}</button>;
  const err = promo.err ? w.checks[promo.err] ?? t.errs[promo.err] ?? t.errs.generic : "";
  return (
    // not a form of its own: on checkout it sits inside the order's form, so Enter applies the code instead of placing it
    <div className="bk-field st-field st-co-code">
      <label htmlFor={`${id}-c`}>{w.codeLabel}</label>
      <div className="st-co-withbtn">
        <input id={`${id}-c`} value={raw} onChange={(e) => setRaw(e.target.value)} dir="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={24}
          aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : undefined}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); promo.apply(raw); } }} />
        <button type="button" className="bk-btn2" disabled={promo.busy || !raw.trim()} aria-busy={promo.busy} onClick={() => promo.apply(raw)}>{w.applyCode}</button>
      </div>
      {err && <p id={`${id}-e`} className="bk-ferr" role="alert">{err}</p>}
    </div>
  );
}

/** "Pay with a gift card" (F57): the code, then what the card holds and until when, with Remove. Not a form of its own:
 *  it sits inside checkout's form, so Enter uses the card instead of placing the order. */
export function GiftCardBox({ gift, taken, intl, t, w }: { gift: GiftCardPay; taken: number; intl: string; t: StoreText; w: W4Text }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  if (gift.card) {
    const until = gift.card.expires ? dateLabel(gift.card.expires, intl) : "";
    return (
      <div className="st-co-gc on" role="status">
        <Ic name="tick" size={18} />
        <span>
          <b dir="ltr">{gift.card.code}</b>
          <small><Amt>{until ? w.giftBal(sar(gift.card.balance), until) : t.balance(sar(gift.card.balance))}</Amt></small>
          {taken > 0 && <small><Amt>{`${w.giftLine} − ${sar(taken)}`}</Amt></small>}
        </span>
        <button type="button" className="st-remove" onClick={() => { gift.remove(); setRaw(""); }}>{t.remove}</button>
      </div>
    );
  }
  if (!open) return <button type="button" className="st-co-more" aria-expanded="false" onClick={() => setOpen(true)}>{w.payGift}</button>;
  const err = gift.err ? w.checks[gift.err] ?? t.errs[gift.err] ?? t.errs.generic : "";
  return (
    <div className="bk-field st-field st-co-gcf">
      <label htmlFor="st-giftCard">{w.giftCode}</label>
      <div className="st-co-withbtn">
        <input id="st-giftCard" value={raw} onChange={(e) => setRaw(e.target.value)} dir="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          placeholder="GC-XXXX-XXXX-XXXX" maxLength={20} aria-invalid={err ? true : undefined} aria-describedby={err ? "st-giftCard-e" : undefined}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void gift.use(raw); } }} />
        <button type="button" className="bk-btn2" disabled={gift.busy || !raw.trim()} aria-busy={gift.busy} onClick={() => void gift.use(raw)}>{w.useCard}</button>
      </div>
      {err && <p id="st-giftCard-e" className="bk-ferr" role="alert">{err}</p>}
    </div>
  );
}

/** Pills to pick one of (F78's days and times): radio buttons drawn as pills, read as a group. */
export function Pills<V extends string>({ name, label, items, value, onPick, error }: {
  name: string; label: string; items: { value: V; label: string }[]; value: V | null; onPick: (v: V) => void; error?: string;
}) {
  return (
    <fieldset className="st-co-pills" aria-describedby={error ? `${name}-e` : undefined}>
      <legend>{label}</legend>
      <div>
        {items.map((it) => (
          <label key={it.value} className={value === it.value ? "on" : undefined}>
            <input type="radio" name={name} value={it.value} checked={value === it.value} onChange={() => onPick(it.value)} />
            <span>{it.label}</span>
          </label>
        ))}
      </div>
      {error && <p id={`${name}-e`} className="bk-ferr">{error}</p>}
    </fieldset>
  );
}

/** Apple's own Apple Pay button, as Safari draws it in the page's language (the official artwork; F83). */
export const ApplePayButton = ({ label, lang, onClick }: { label: string; lang: string; onClick: () => void }) => (
  <button type="button" className="st-co-ap" lang={lang === "ar" ? "ar" : "en"} onClick={onClick} aria-label={label} />
);

export type StepState = "open" | "done" | "todo";
/** One step of checkout (O12-C): open with its fields and Continue, or closed into a line that says what was given,
 *  with Edit; a step not reached yet is its heading alone. */
export function Step({ id, n, of, title, state, summary, onEdit, onContinue, w, children }: {
  id: string; n: number; of: number; title: string; state: StepState; summary?: ReactNode; onEdit: () => void; onContinue?: () => void; w: W4Text; children: ReactNode;
}) {
  return (
    <section className={`bk-card st-co-step is-${state}`} aria-labelledby={`st-co-${id}-h`}>
      <div className="st-co-step-head">
        <span className="st-co-step-n" aria-hidden="true">{state === "done" ? <Ic name="tick" size={15} /> : n}</span>
        <h2 id={`st-co-${id}-h`} className="bk-h3" tabIndex={-1}>
          <span className="mm-sr">{w.stepOf(n, of)}: </span>{title}{state === "done" && <span className="mm-sr"> ({w.done})</span>}
        </h2>
        {state === "done" && <button type="button" className="st-co-edit" onClick={onEdit} aria-label={w.editOf(title)}>{w.edit}</button>}
      </div>
      {state === "done" && summary && <div className="st-co-step-sum">{summary}</div>}
      {state === "open" && (
        <div className="st-co-step-body">
          {children}
          {onContinue && <button type="button" className="bk-btn st-co-go" onClick={onContinue}>{w.continue}</button>}
        </div>
      )}
    </section>
  );
}
