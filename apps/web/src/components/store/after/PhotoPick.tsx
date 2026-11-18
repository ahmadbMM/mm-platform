"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { PHOTO_MAX } from "@/lib/sx-B4";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";
import { uploadPhoto } from "./net";

// Photos for a warranty claim or a return (N08): "Take photo" opens the camera at once (accept="image/*" capture, on a
// phone), "Choose photo" the library; each is shrunk on the phone and stored in the order's folder as soon as it is
// picked, and shows as a small square with a Remove button. Up to three. The paths go up to the form.
export type Picked = { path: string; url: string };

export default function PhotoPick({ no, k, photos, onChange, id }: { no: number; k: string; photos: Picked[]; onChange: (p: Picked[]) => void; id: string }) {
  const t = useLocalize(T);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const live = useRef(photos);
  useEffect(() => { live.current = photos; });
  // the previews are the browser's own copies: let go of them when the form goes
  useEffect(() => () => { for (const p of live.current) URL.revokeObjectURL(p.url); }, []);

  async function pick(input: HTMLInputElement) {
    const files = [...(input.files ?? [])].slice(0, PHOTO_MAX - photos.length);
    input.value = "";
    if (!files.length) return;
    setBusy(true); setErr("");
    const added: Picked[] = [];
    for (const f of files) {
      const r = await uploadPhoto(no, k, f);
      if ("path" in r) added.push({ path: r.path, url: URL.createObjectURL(r.blob) });
      else { setErr(t.errs[r.error] ?? t.errs.photos); break; }
    }
    setBusy(false);
    if (added.length) onChange([...live.current, ...added].slice(0, PHOTO_MAX));
  }
  const remove = (i: number) => {
    const p = photos[i];
    if (p) URL.revokeObjectURL(p.url);
    onChange(photos.filter((_, j) => j !== i));
  };

  return (
    <fieldset className="sxb-photos" aria-describedby={err ? `${id}-err` : undefined}>
      <legend>{t.photos}</legend>
      {photos.length > 0 && (
        <ul className="sxb-thumbs">
          {photos.map((p, i) => (
            <li key={p.path}>
              <img src={p.url} alt={t.photoN(i + 1)} />
              <button type="button" className="sxb-thumb-x" onClick={() => remove(i)} aria-label={`${t.removePhoto} ${i + 1}`} disabled={busy}><AfterIcon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < PHOTO_MAX && (
        <div className="sxb-photo-btns">
          {/* the camera at once on a phone; a computer has none, so only "Choose photo" shows there (sx-B4.css) */}
          <label className="bk-btn2 sxb-cam">
            <input type="file" accept="image/*" capture="environment" className="sxb-file" disabled={busy} onChange={(e) => pick(e.currentTarget)} />
            <AfterIcon name="camera" size={18} />{busy ? t.adding : t.takePhoto}
          </label>
          <label className="bk-btn2">
            <input type="file" accept="image/*" multiple className="sxb-file" disabled={busy} onChange={(e) => pick(e.currentTarget)} />
            <AfterIcon name="image" size={18} />{busy ? t.adding : t.choosePhoto}
          </label>
        </div>
      )}
      {err && <p id={`${id}-err`} className="bk-err" role="alert">{err}</p>}
    </fieldset>
  );
}
