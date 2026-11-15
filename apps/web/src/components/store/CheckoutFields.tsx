"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { digitsOnly, shortAddress, type Address } from "@/lib/store-form";
import type { Way } from "@/lib/store-checkout";
import type { StoreText } from "./Store.text";

// The checkout's fields: a label that says whether the field is needed (a small mark) or "(optional)" (F74), the box,
// and what is wrong with it, said as the box is left (F77) and read out with the box (aria-describedby). No line that
// only helps (X12, the owner's rule). The address takes the national address's parts; the courier needs its short
// code (4 letters, 4 digits), written in capitals with Latin digits whatever the keyboard typed. With the lookup on
// (F76) the short address comes first and Find fills the rest in, which stays editable.
type FieldProps = {
  id: string; label: string; hint?: ReactNode; error?: string; optional?: string; required?: boolean; requiredLabel?: string;
  value: string; onValue: (v: string) => void; after?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "required">;

export function Field({ id, label, hint, error, optional, required, requiredLabel, value, onValue, after, ...rest }: FieldProps) {
  const desc = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const input = (
    <input id={id} name={id} type="text" value={value} onChange={(e) => onValue(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={desc}
      aria-required={required || undefined} {...rest} />
  );
  return (
    <div className="bk-field st-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="st-req" aria-hidden="true">*</span>}
        {required && requiredLabel && <span className="mm-sr"> ({requiredLabel})</span>}
        {optional && !required && <span className="bk-hint"> {optional}</span>}
      </label>
      {after ? <div className="st-co-withbtn">{input}{after}</div> : input}
      {hint && <p id={`${id}-h`} className="bk-hint2">{hint}</p>}
      {error && <p id={`${id}-e`} className="bk-ferr">{error}</p>}
    </div>
  );
}

export type AddressProps = {
  t: StoreText; way: Way; a: Address; set: (patch: Partial<Address>) => void; errs: Record<string, string>;
  /** A field left: its own check (F77). */
  check: (field: string) => void;
  requiredLabel: string;
  /** The districts staff deliver to in Jeddah (F79), offered as the district is typed. */
  districts: string[] | null;
  /** The short address lookup (F76), only while staff switch it on and the service's key is there. */
  lookup: { label: string; busy: string; busyNow: boolean; find: () => void } | null;
};

export function AddressFields({ t, way, a, set, errs, check, requiredLabel, districts, lookup }: AddressProps) {
  const ksa = way === "ksa";
  const short = (
    <Field id="st-short" label={t.shortAddr} optional={ksa ? undefined : t.optional} required={ksa} requiredLabel={requiredLabel} value={a.short}
      onValue={(v) => set({ short: shortAddress(v) })} onBlur={() => check("short")} error={errs.short}
      dir="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="RCMA7933" maxLength={8}
      after={lookup ? (
        <button type="button" className="bk-btn2 st-co-find" onClick={lookup.find} disabled={lookup.busyNow} aria-busy={lookup.busyNow}>
          {lookup.busyNow ? lookup.busy : lookup.label}
        </button>
      ) : undefined} />
  );
  const list = districts && !ksa ? districts : null;
  return (
    <div className="st-addr">
      {lookup && short}
      {ksa
        ? <Field id="st-city" label={t.city} required requiredLabel={requiredLabel} value={a.city} onValue={(v) => set({ city: v })} onBlur={() => check("city")} error={errs.city} autoComplete="address-level2" maxLength={40} />
        : <div className="bk-field st-field"><span className="bk-label">{t.city}</span><p className="st-fixed">{t.jeddahCity}</p></div>}
      <Field id="st-district" label={t.district} required requiredLabel={requiredLabel} value={a.district} onValue={(v) => set({ district: v })} onBlur={() => check("district")}
        error={errs.district || errs.district_unserved} autoComplete="address-level3" maxLength={60} list={list ? "st-districts" : undefined} />
      {list && <datalist id="st-districts">{list.map((d) => <option key={d} value={d} />)}</datalist>}
      <Field id="st-street" label={t.street} required requiredLabel={requiredLabel} value={a.street} onValue={(v) => set({ street: v })} onBlur={() => check("street")} error={errs.street} autoComplete="address-line1" maxLength={80} />
      <div className="st-row3">
        <Field id="st-building" label={t.building} optional={t.optional} value={a.building} onValue={(v) => set({ building: digitsOnly(v, 10) })} inputMode="numeric" dir="ltr" maxLength={10} />
        <Field id="st-postal" label={t.postal} optional={t.optional} value={a.postal} onValue={(v) => set({ postal: digitsOnly(v, 5) })} onBlur={() => check("postal")} error={errs.postal} inputMode="numeric" autoComplete="postal-code" dir="ltr" maxLength={5} />
        <Field id="st-extra" label={t.extra} optional={t.optional} value={a.extra} onValue={(v) => set({ extra: digitsOnly(v, 4) })} onBlur={() => check("extra")} error={errs.extra} inputMode="numeric" dir="ltr" maxLength={4} />
      </div>
      {!lookup && short}
    </div>
  );
}
