"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { RATING_TAGS, type RatingTag } from "@/lib/rating";
import { T } from "./RateRide.text";

// The post-ride rating, as the booking app asks it once a ride is done: the experience and the
// bike from 1 to 10, what stood out as tap-once chips, a note. It goes to /api/account/rate with
// the account cookie; a rating that lands turns the card into a thank-you.
type Props = { entryId: string; name: string; when: string; bikes: boolean };

export default function RateRide({ entryId, name, when, bikes }: Props) {
  const t = useLocalize(T);
  const [exp, setExp] = useState(0);
  const [bike, setBike] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const toggle = (tag: RatingTag) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!exp) return setErr(t.errors.missing);
    setBusy(true);
    try {
      const r = await fetch("/api/account/rate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, exp, bike: bikes && bike ? bike : undefined, tags, note }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { setDone(true); return; }
      setErr(t.errors[b.error || ""] || t.errors.generic);
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }

  const scale = (label: string, value: number, set: (n: number) => void) => (
    <fieldset className="rr-scale">
      <legend>{label}</legend>
      <div className="rr-scale-row">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={value === n ? "on" : ""} aria-pressed={value === n} onClick={() => set(n)}>{n}</button>
        ))}
      </div>
      <div className="rr-scale-ends" aria-hidden="true"><span>{t.low}</span><span>{t.high}</span></div>
    </fieldset>
  );

  return (
    <article className="rr-card">
      <header className="rr-head"><strong>{name}</strong><span>{when}</span></header>
      {done ? (
        <p className="rr-thanks" role="status">{t.thanks}</p>
      ) : (
        <form className="rr-form" onSubmit={submit} noValidate>
          {scale(t.exp, exp, setExp)}
          {bikes && scale(t.bike, bike, setBike)}
          <div className="rr-tags">
            <p>{t.tags}</p>
            <div>
              {RATING_TAGS.map((tag) => (
                <button key={tag} type="button" className={tags.includes(tag) ? "on" : ""} aria-pressed={tags.includes(tag)} onClick={() => toggle(tag)}>{t.tag[tag]}</button>
              ))}
            </div>
          </div>
          <label className="rr-note">{t.note}<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} /></label>
          {err && <p className="ac-err" role="alert">{err}</p>}
          <button type="submit" className="rr-send" disabled={busy}>{busy ? t.sending : t.send}</button>
        </form>
      )}
    </article>
  );
}
