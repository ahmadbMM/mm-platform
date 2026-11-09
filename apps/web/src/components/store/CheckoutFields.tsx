"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { digitsOnly, shortAddress, type Address } from "@/lib/store-form";
import type { Fulfil } from "@/lib/store-delivery";
import type { StoreText } from "./Store.text";

// The checkout's fields: a label, the box, a line that helps, and what is wrong with it, read out with the
// box (aria-describedby). The address takes the national address's parts; the courier needs its short
// code (4 letters, 4 digits), written in capitals with Latin digits whatever the keyboard typed.
type FieldProps = { id: string; label: string; hint?: ReactNode; error?: string; optional?: string; value: string; onValue: (v: string) => void }
  & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">;

export function Field({ id, label, hint, error, optional, value, onValue, ...rest }: FieldProps) {
  const desc = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="bk-field st-field">
      <label htmlFor={id}>{label}{optional && <span className="bk-hint"> {optional}</span>}</label>
      <input id={id} name={id} type="text" value={value} onChange={(e) => onValue(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={desc} {...rest} />
      {hint && <p id={`${id}-h`} className="bk-hint2">{hint}</p>}
      {error && <p id={`${id}-e`} className="bk-ferr">{error}</p>}
    </div>
  );
}

export function AddressFields({ t, fulfil, a, set, errs }: { t: StoreText; fulfil: Fulfil; a: Address; set: (patch: Partial<Address>) => void; errs: Record<string, string> }) {
  const ksa = fulfil === "ksa";
  return (
    <div className="st-addr">
      {ksa
        ? <Field id="st-city" label={t.city} value={a.city} onValue={(v) => set({ city: v })} error={errs.city} autoComplete="address-level2" maxLength={40} />
        : <div className="bk-field st-field"><span className="bk-label">{t.city}</span><p className="st-fixed">{t.jeddahCity}</p></div>}
      <Field id="st-district" label={t.district} value={a.district} onValue={(v) => set({ district: v })} error={errs.district} autoComplete="address-level3" maxLength={60} />
      <Field id="st-street" label={t.street} value={a.street} onValue={(v) => set({ street: v })} error={errs.street} autoComplete="address-line1" maxLength={80} />
      <div className="st-row3">
        <Field id="st-building" label={t.building} optional={t.optional} value={a.building} onValue={(v) => set({ building: digitsOnly(v, 10) })} inputMode="numeric" dir="ltr" maxLength={10} />
        <Field id="st-postal" label={t.postal} optional={t.optional} value={a.postal} onValue={(v) => set({ postal: digitsOnly(v, 5) })} error={errs.postal} inputMode="numeric" autoComplete="postal-code" dir="ltr" maxLength={5} />
        <Field id="st-extra" label={t.extra} optional={t.optional} value={a.extra} onValue={(v) => set({ extra: digitsOnly(v, 4) })} error={errs.extra} inputMode="numeric" dir="ltr" maxLength={4} />
      </div>
      <Field id="st-short" label={t.shortAddr} optional={ksa ? undefined : t.optional} value={a.short} onValue={(v) => set({ short: shortAddress(v) })} error={errs.short}
        hint={t.shortHint} dir="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="RCMA7933" maxLength={8} required={ksa} />
    </div>
  );
}
