"use client";

import { useId } from "react";
import { sinceText, tmFit, tmFitQuality, TM_BODY_MAX, type TmMine, type TmNameMode } from "@/lib/testimonials";
import type { TmWords } from "./Testimonials.text";
import { StarGlyph } from "./Stars";

// The parts the form on /testimonials/write and the ask after a high rating share: how the rider's name shows, the
// consent tick, the words with their counter, and the photo made small in the browser.

/** The name choices the account has, exactly as testimonial_mine says they would show: the full name, the first name
 *  and last initial (left out when it reads the same as the full one), and Anonymous. */
export function nameChoices(names: TmMine["names"]): Array<{ mode: TmNameMode; label: string | null }> {
  const out: Array<{ mode: TmNameMode; label: string | null }> = [];
  if (names.full) out.push({ mode: "full", label: names.full });
  if (names.short && names.short !== names.full) out.push({ mode: "short", label: names.short });
  out.push({ mode: "anon", label: null });
  return out;
}
/** The choice a form starts on: the first name and last initial when the account has one, else the full name, else
 *  Anonymous. */
export const firstChoice = (names: TmMine["names"]): TmNameMode => (names.short ? "short" : names.full ? "full" : "anon");

export function NameChoice({ mine, value, onChange, w, disabled }: { mine: TmMine; value: TmNameMode; onChange: (m: TmNameMode) => void; w: TmWords; disabled?: boolean }) {
  const id = useId();
  const choices = nameChoices(mine.names);
  const since = value === "anon" ? null : sinceText(mine.since, w);
  return (
    <fieldset className="tm-fs">
      <legend className="tm-q">{w.nameQ}</legend>
      <div className="tm-pills tm-radios">
        {choices.map((c) => (
          <label key={c.mode} className={value === c.mode ? "on" : undefined}>
            <input type="radio" name={`${id}-name`} value={c.mode} checked={value === c.mode} disabled={disabled} onChange={() => onChange(c.mode)} />
            {c.label ? <bdi dir="auto">{c.label}</bdi> : w.anonymous}
          </label>
        ))}
      </div>
      {since && <p className="tm-preview">{since}</p>}
    </fieldset>
  );
}

export function ConsentTick({ checked, onChange, w, disabled, invalid }: { checked: boolean; onChange: (v: boolean) => void; w: TmWords; disabled?: boolean; invalid?: boolean }) {
  return (
    <label className={`tm-consent${invalid ? " err" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} aria-invalid={invalid || undefined} />
      <span>{w.consent}</span>
    </label>
  );
}

/** The words, with how many of the 800 are used. */
export function Words({ value, onChange, w, disabled, invalid }: { value: string; onChange: (v: string) => void; w: TmWords; disabled?: boolean; invalid?: boolean }) {
  const id = useId();
  return (
    <div className="tm-field">
      <label className="tm-q" htmlFor={`${id}-w`}>{w.wordsQ}</label>
      <textarea id={`${id}-w`} className="tm-words" dir="auto" rows={5} maxLength={TM_BODY_MAX} value={value} disabled={disabled}
        aria-describedby={`${id}-n`} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.currentTarget.value)} />
      <span id={`${id}-n`} className="tm-count" dir="ltr">{value.trim().length} / {TM_BODY_MAX}</span>
    </div>
  );
}

/** Stars to pick, 1 to 5: five radios drawn as stars, each named "3 out of 5 stars". */
export function StarPick({ value, onChange, w, disabled }: { value: number; onChange: (n: number) => void; w: TmWords; disabled?: boolean }) {
  const id = useId();
  return (
    <fieldset className="tm-fs">
      <legend className="tm-q">{w.starsQ}</legend>
      <div className="tm-starpick">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= value ? "on" : undefined} title={w.starsOf(String(n))}>
            <input type="radio" name={`${id}-stars`} value={n} checked={value === n} disabled={disabled} onChange={() => onChange(n)} aria-label={w.starsOf(String(n))} />
            <StarGlyph size={34} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A picture the rider picked, made small in the browser: its longest side 1200 px at most, a JPEG whose quality is
 *  stepped down until it fits the 600,000 bytes the database takes (lib/testimonials.ts). Null when it is not a picture
 *  the browser can read, or does not fit even then. */
export function readPhoto(f: File): Promise<string | null> {
  return new Promise((ok) => {
    if (!/^image\//.test(f.type) || f.size > 40_000_000) { ok(null); return; }
    const url = URL.createObjectURL(f);
    const im = new Image();
    const done = (v: string | null) => { URL.revokeObjectURL(url); ok(v); };
    im.onerror = () => done(null);
    im.onload = () => {
      try {
        const { w, h } = tmFit(im.naturalWidth, im.naturalHeight);
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const cx = cv.getContext("2d");
        if (!cx) { done(null); return; }
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        done(tmFitQuality((q) => cv.toDataURL("image/jpeg", q)));
      } catch { done(null); }
    };
    im.src = url;
  });
}
