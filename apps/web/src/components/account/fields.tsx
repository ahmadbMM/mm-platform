"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { COUNTRY_CODES, cityFile, dobRange } from "@/lib/account-profile";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { intlOf } from "@/i18n/locales";
import { riyadhToday } from "@/lib/learn";

// The account form's pickers, shared by the details form and the correction request: the birth
// date as day, month and year (the booking app's dobFieldHtml: the years run from 5 to 100 years
// ago, and a day or month the chosen year puts out of reach cannot be picked), the country of
// residence and its cities (public/cities/<iso2>.json, the booking app's own lists - Palestine
// includes Jerusalem; Israel is on no list), the nationality, and the mobile with its country code.

/** The country list as the pickers show it, built in the browser once the page has drawn (Intl's
 *  region names differ between the server and a phone). Until then, only the saved value. */
const never = () => () => {};
/** Whether the page has drawn in the browser (false on the server and in the first paint). */
export const useOnClient = () => useSyncExternalStore(never, () => true, () => false);
export function useNatOptions(locale: string): NatOption[] | null {
  const onClient = useOnClient();
  return useMemo(() => (onClient ? natOptions(locale) : null), [onClient, locale]);
}

export function CountrySelect({ id, value, onChange, opts, placeholder, label, disabled }: {
  id?: string; value: string; onChange: (v: string) => void; opts: NatOption[] | null; placeholder: string; label?: string; disabled?: boolean;
}) {
  const known = !value || !opts || opts.some((o) => o.value === value);
  return (
    <select id={id} className={`ac-in-sel${value ? "" : " ph"}`} value={value} aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {/* A value saved before this list existed still shows, so a save keeps it. */}
      {(!opts || !known) && value && <option value={value}>{value}</option>}
      {opts?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const cityCache = new Map<string, Promise<[string, string?][] | null>>();
function loadCities(file: string): Promise<[string, string?][] | null> {
  let p = cityCache.get(file);
  if (!p) {
    p = fetch(file).then((r) => (r.ok ? r.json() : null)).then((v) => (Array.isArray(v) ? (v as [string, string?][]) : null)).catch(() => null);
    p.then((v) => { if (!v) cityCache.delete(file); }); // a failed load is tried again next time
    cityCache.set(file, p);
  }
  return p;
}

/** The cities of a country, in the page's language and alphabet; null while they load, [] for a country with no list. */
export function useCities(country: string, locale: string): { value: string; label: string }[] | null {
  const [list, setList] = useState<{ key: string; rows: [string, string?][] | null } | null>(null);
  const file = country ? cityFile(country) : null;
  useEffect(() => {
    let live = true;
    if (!file) return;
    loadCities(file).then((rows) => { if (live) setList({ key: file, rows }); });
    return () => { live = false; };
  }, [file]);
  return useMemo(() => {
    if (!country || !file) return [];
    if (!list || list.key !== file) return null;
    const rows = (list.rows ?? []).map(([en, ar]) => ({ value: en, label: locale === "ar" && ar ? ar : en }));
    let coll: Intl.Collator;
    try { coll = new Intl.Collator(intlOf(locale)); } catch { coll = new Intl.Collator(); }
    return rows.sort((a, b) => coll.compare(a.label, b.label));
  }, [country, file, list, locale]);
}

export function CitySelect({ id, country, value, onChange, locale, placeholder, firstText, label, disabled }: {
  id?: string; country: string; value: string; onChange: (v: string) => void; locale: string; placeholder: string; firstText: string; label?: string; disabled?: boolean;
}) {
  const cities = useCities(country, locale);
  const known = !value || !cities || cities.some((c) => c.value === value);
  return (
    <select id={id} className={`ac-in-sel${value ? "" : " ph"}`} value={value} aria-label={label} disabled={disabled || !country} onChange={(e) => onChange(e.target.value)}>
      <option value="">{country ? placeholder : firstText}</option>
      {value && (!cities || !known) && <option value={value}>{value}</option>}
      {cities?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  );
}

/** Day, month and year for a birth date; `onChange` hears YYYY-MM-DD once all three are chosen, else "". */
export function DobPicker({ idBase, value, onChange, locale, labels, disabled }: {
  idBase: string; value: string; onChange: (v: string, partial: boolean) => void; locale: string; labels: { day: string; month: string; year: string }; disabled?: boolean;
}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [y, setY] = useState(m ? +m[1] : 0), [mo, setMo] = useState(m ? +m[2] : 0), [d, setD] = useState(m ? +m[3] : 0);
  const onClient = useOnClient();
  const months = useMemo(() => (onClient ? monthNames(locale) : null), [onClient, locale]);
  const { max, min } = dobRange(riyadhToday());
  const yMax = +max.slice(0, 4), yMin = +min.slice(0, 4);
  const mMax = y === yMax ? +max.slice(5, 7) : 12;
  const dim = y && mo ? new Date(Date.UTC(y, mo, 0)).getUTCDate() : 31;
  const dMax = y === yMax && mo === +max.slice(5, 7) ? +max.slice(8, 10) : 31;
  const emit = (yy: number, mm: number, dd: number) => {
    const full = yy && mm && dd ? `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : "";
    onChange(full, !full && !!(yy || mm || dd));
  };
  const years: number[] = [];
  if (y > yMax) years.push(y);
  for (let yy = yMax; yy >= yMin; yy--) years.push(yy);
  if (y && y < yMin) years.push(y);
  return (
    <div className="ac-dob" role="group">
      <select id={`${idBase}-d`} className={d ? "" : "ph"} aria-label={labels.day} value={d || ""} disabled={disabled}
        onChange={(e) => { const v = +e.target.value || 0; setD(v); emit(y, mo, v); }}>
        <option value="">{labels.day}</option>
        {Array.from({ length: dim }, (_, i) => i + 1).map((n) => <option key={n} value={n} disabled={n > dMax}>{n}</option>)}
      </select>
      <select id={`${idBase}-m`} className={mo ? "" : "ph"} aria-label={labels.month} value={mo || ""} disabled={disabled}
        onChange={(e) => { const v = +e.target.value || 0; const dd = y && v && d > new Date(Date.UTC(y, v, 0)).getUTCDate() ? 0 : d; setMo(v); setD(dd); emit(y, v, dd); }}>
        <option value="">{labels.month}</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n} disabled={n > mMax}>{months?.[n - 1] ?? n}</option>)}
      </select>
      <select id={`${idBase}-y`} className={y ? "" : "ph"} aria-label={labels.year} value={y || ""} disabled={disabled}
        onChange={(e) => {
          const v = +e.target.value || 0;
          // A month or day the new year puts out of reach is cleared, not kept.
          const mm = v === yMax && mo > +max.slice(5, 7) ? 0 : mo;
          const dd = mm && v && (d > new Date(Date.UTC(v, mm, 0)).getUTCDate() || (v === yMax && mm === +max.slice(5, 7) && d > +max.slice(8, 10))) ? 0 : d;
          setY(v); setMo(mm); setD(dd); emit(v, mm, dd);
        }}>
        <option value="">{labels.year}</option>
        {years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

export function PhoneInput({ id, cc, num, onCc, onNum, ccLabel, disabled }: {
  id?: string; cc: string; num: string; onCc: (v: string) => void; onNum: (v: string) => void; ccLabel: string; disabled?: boolean;
}) {
  return (
    <div className="ac-phone" dir="ltr">
      <select aria-label={ccLabel} value={cc} disabled={disabled} onChange={(e) => onCc(e.target.value)}>
        {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={num} placeholder="5x xxx xxxx" maxLength={20} disabled={disabled} onChange={(e) => onNum(e.target.value)} />
    </div>
  );
}

/** The Google and Apple marks, drawn (the booking app's SI_LOGO): never emoji. */
export function SignInMarks({ value, labels }: { value: string | null | undefined; labels: { google: string; apple: string } }) {
  const on = String(value || "").split(",").map((s) => s.trim());
  return (
    <>
      {on.includes("google") && (
        <span className="ac-si" role="img" aria-label={labels.google} title={labels.google}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" /></svg>
        </span>
      )}
      {on.includes("apple") && (
        <span className="ac-si" role="img" aria-label={labels.apple} title={labels.apple}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 17 17" fill="currentColor"><path d="M14.06 8.98c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.3 2-1.4 2.44-.36 6.05 1.01 8.03.67.97 1.47 2.06 2.52 2.02 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-.99 2.44-1.96.77-1.12 1.09-2.21 1.11-2.27-.02-.01-2.12-.81-2.14-3.22zM12.05 3.03c.56-.68.93-1.62.83-2.56-.8.03-1.77.53-2.35 1.21-.51.6-.96 1.56-.84 2.48.9.07 1.8-.45 2.36-1.13z" /></svg>
        </span>
      )}
    </>
  );
}

/** A picked image as a 256 px square JPEG (centre-cropped, the booking app's pickImage), or null when it cannot be read. */
export async function squareJpeg(file: File, size = 256): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("read")); img.src = url; });
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return null;
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const g = c.getContext("2d");
      if (!g) return null;
      g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      return await new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), "image/jpeg", 0.82));
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/** Sends a picked photo to /api/account/photo: its address, or the error code. */
export async function uploadPhoto(file: File): Promise<{ photo: string } | { error: string }> {
  const blob = await squareJpeg(file);
  if (!blob) return { error: "read" };
  try {
    const r = await fetch("/api/account/photo", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    const b = (await r.json().catch(() => ({}))) as { ok?: boolean; photo?: string; error?: string };
    return b.ok && b.photo ? { photo: b.photo } : { error: b.error || "generic" };
  } catch {
    return { error: "generic" };
  }
}

/** A POST of JSON to one of the account's routes, with its answer. */
export async function postJson<T extends Record<string, unknown>>(url: string, body: unknown): Promise<T & { ok?: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "generic" }))) as T & { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "generic" } as T & { ok?: boolean; error?: string };
  }
}
