"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { CLAIM_MAX, claimText, type ClaimLine } from "@/lib/sx-B4";
import { T as STORE } from "../Store.text";
import { T } from "../sx-B4.text";
import { NoPhoto } from "../bits";
import Modal from "../Modal";
import { AfterIcon } from "./icons";
import { postJson } from "./net";
import PhotoPick, { type Picked } from "./PhotoPick";

// Start a warranty claim from an order line (N31): a centred pop-up with the item, what is wrong (10-600 characters) and
// up to three photos (N08), sent to the staff queue (store_after_claim). The order's page then lists the claim and
// where it is; nothing is sent by email or SMS.
export default function ClaimStart({ no, k, line, lines }: { no: number; k: string; line: number; lines: ClaimLine[] }) {
  const t = useLocalize(T);
  const s = useLocalize(STORE);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(line);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p className="st-ok" role="status">{t.claimSent}</p>;

  const close = () => { if (!busy) { setOpen(false); setErr(""); } };
  async function send() {
    if (busy) return;
    if (!claimText(text)) return setErr(t.errs.text); // said after the tap (R4), never as a line under the field
    setBusy(true); setErr("");
    const r = await postJson("/api/store/claim", { no, key: k, item, text, photos: photos.map((p) => p.path) });
    setBusy(false);
    if (r.ok) { setOpen(false); setSent(true); router.refresh(); return; }
    setErr(t.errs[r.error ?? ""] ?? t.errs.generic);
  }

  return (
    <>
      <button type="button" className="bk-btn2 sxb-claim-btn" onClick={() => { setItem(line); setOpen(true); }}><AfterIcon name="shield" size={18} />{t.claimStart}</button>
      {open && (
        <Modal title={t.claimTitle} onClose={close} closeLabel={s.close}>
          <div className="st-ret sxb-claim">
            {lines.length > 1 ? (
              <fieldset className="st-ways-pick">
                <legend>{t.claimItem}</legend>
                {lines.map((l) => (
                  <label key={l.id} className={item === l.id ? "on" : undefined}>
                    <input type="radio" name="sxb-claim-item" checked={item === l.id} onChange={() => setItem(l.id)} />
                    <span className="st-mini-img">{l.image ? <img src={sized(l.image, 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
                    <span><b>{l.name}</b>{l.variant && <small>{l.variant}</small>}</span>
                  </label>
                ))}
              </fieldset>
            ) : lines[0] && (
              <p className="sxb-claim-one">
                <span className="st-mini-img">{lines[0].image ? <img src={sized(lines[0].image, 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
                <span><b>{lines[0].name}</b>{lines[0].variant && <small>{lines[0].variant}</small>}</span>
              </p>
            )}
            <div className="bk-field st-field">
              <label htmlFor="sxb-claim-text">{t.claimWhat}</label>
              <textarea id="sxb-claim-text" value={text} maxLength={CLAIM_MAX} rows={4} onChange={(e) => setText(e.target.value)} />
            </div>
            <PhotoPick no={no} k={k} photos={photos} onChange={setPhotos} id="sxb-claim-ph" />
            {err && <p className="bk-err" role="alert">{err}</p>}
            <button type="button" className="bk-btn wide" onClick={send} disabled={busy}>
              {busy ? <><span className="bk-spin" aria-hidden="true" />{t.working}</> : t.sendClaim}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
