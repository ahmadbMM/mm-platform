"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { carOf, riyadhHm, type AfterArrival } from "@/lib/sx-B4";
import { T as STORE } from "../Store.text";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";
import { postJson } from "./net";

// "I'm here" (N14), on a pickup order's page on the day it is ready for collection (and the Wallet pass links here):
// one tap tells the showroom the customer has arrived, with the car's colour if they give it, and staff see it at once
// in the staff Store screen and bring the bike out. Once sent it says when, and once staff have seen it, that they are
// bringing it out. A second tap only updates the car.
export default function Arrive({ no, k, was }: { no: number; k: string; was: AfterArrival | null }) {
  const t = useLocalize(T);
  const s = useLocalize(STORE);
  const [car, setCar] = useState(was?.car ?? "");
  const [at, setAt] = useState<AfterArrival | null>(was);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (busy) return;
    const c = carOf(car);
    if (c === null) return setErr(t.errs.car);
    setBusy(true); setErr("");
    const r = await postJson<{ arrival?: AfterArrival }>("/api/store/arrive", { no, key: k, car: c });
    setBusy(false);
    if (r.ok && r.arrival) { setAt(r.arrival); return; }
    setErr(t.errs[r.error ?? ""] ?? t.errs.generic);
  }
  return (
    <div className="sxb-here" id="arrive">
      {at && <p className="sxb-here-at" role="status"><AfterIcon name="tick" size={18} />{[t.arrivedAt(riyadhHm(at.at)), at.car, at.seen ? t.comingOut : ""].filter(Boolean).join(" · ")}</p>}
      <div className="sxb-here-row">
        <div className="bk-field st-field">
          <label htmlFor="sxb-car">{t.car}<span className="bk-hint"> {s.optional}</span></label>
          <input id="sxb-car" value={car} maxLength={30} autoComplete="off" enterKeyHint="send" onChange={(e) => { setCar(e.target.value); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
        </div>
        <button type="button" className="bk-btn sxb-here-btn" onClick={go} disabled={busy}>
          {busy ? <span className="bk-spin" aria-hidden="true" /> : <AfterIcon name="here" size={18} />}{t.imHere}
        </button>
      </div>
      {err && <p className="bk-err" role="alert">{err}</p>}
    </div>
  );
}
