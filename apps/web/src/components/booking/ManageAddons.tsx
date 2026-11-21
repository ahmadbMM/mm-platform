"use client";

import { useId, useState } from "react";
import { ADDON_MAX, addonQty, LOCKER_LINE, paidLock, type RawAddon } from "@/lib/booking-manage";
import type { ManageCtx, SoldItem } from "@/lib/booking-manage-server";
import type { ManageWords } from "./Manage.words";
import { ManageDialog, sayError } from "./ManageDialog";
import { fillN, postManage } from "./manage-client";
import { Sar } from "./Sar";

// Add-ons on a ticket (the booking app's Edit add-ons: renderAddonPicker and _addonPickerStep): whose they are (each rider
// of a party picks theirs: "#7 Sara", or Waitlist on a rider waiting for a place), then the items the session sells, each
// with its photo, its stock when it runs low ("3 left", Out of stock), its price and a - quantity + stepper; what a rider
// holds that the session no longer sells is listed so it can come off. Each tap is saved on its own (POST
// /api/booking/addons), one at a time, and the stock follows. A priced item is not added to a booking paid at the desk, by
// card or online (_adPaidLock), and nothing past 20 of one. The rider's add-ons' total, then Done.

const Minus = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 12h12" /></svg>;
const Plus = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M12 6v12M6 12h12" /></svg>;

export default function ManageAddons({ open, onClose, ctx, w, sarWord }: { open: boolean; onClose: (changed: boolean) => void; ctx: ManageCtx; w: ManageWords; sarWord: string }) {
  const [changed, setChanged] = useState(false);
  const close = () => { const c = changed; setChanged(false); onClose(c); };
  return (
    <ManageDialog open={open} onClose={close} title={w.adTitle} closeLabel={w.close} className="mg-ad-dlg">
      <AddonsBody ctx={ctx} w={w} sarWord={sarWord} onChange={() => setChanged(true)} onDone={close} />
    </ManageDialog>
  );
}

/** The dialog's inside, drawn afresh each time it opens: the riders' add-ons and the stock as the booking's read has them. */
function AddonsBody({ ctx, w, sarWord, onChange, onDone }: { ctx: ManageCtx; w: ManageWords; sarWord: string; onChange: () => void; onDone: () => void }) {
  const id = useId();
  const [who, setWho] = useState(0);
  const [lines, setLines] = useState<Record<string, RawAddon[]>>(() => Object.fromEntries(ctx.rows.map((r) => [r.id, r.addons])));
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(ctx.addons.map((x) => [x.id, x.qty])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const row = ctx.rows[who] ?? ctx.rows[0];
  if (!row) return null;
  const mine = lines[row.id] ?? row.addons;
  const lock = paidLock(row);
  // the rider's add-ons as the ticket counts them: each line at the price it was sold at, else today's
  const total = mine.filter((a) => a.id !== LOCKER_LINE).reduce((n, a) => n + (a.p ?? ctx.addons.find((x) => x.id === a.id)?.price ?? 0) * a.qty, 0);
  const items = ctx.addons.filter((x) => x.sold || addonQty(mine, x.id) > 0);
  const label = (r: (typeof ctx.rows)[number]) => <><bdi dir="ltr">{r.status === "waitlist" ? w.wl : `#${r.queueNum ?? ""}`}</bdi> <bdi>{r.name}</bdi></>;

  async function tap(item: SoldItem, delta: 1 | -1) {
    if (busy) return;
    setBusy(true); setErr("");
    const a = await postManage<{ lines: RawAddon[] }>("/api/booking/addons", { booking: row.id, item: item.id, delta });
    setBusy(false);
    if (!a.ok) { setErr(sayError(w, a)); return; }
    setLines((l) => ({ ...l, [row.id]: a.lines }));
    if (row.status !== "waitlist") setStock((s) => ({ ...s, [item.id]: (s[item.id] ?? item.qty) - delta }));
    onChange();
  }

  return (
    <>
      {ctx.rows.length === 1 ? <p className="mg-sub">{label(row)}</p> : (
        <div className="mg-who" role="radiogroup" aria-label={w.adTitle}>
          {ctx.rows.map((r, i) => (
            <label key={r.id} className="mg-who-o">
              <input type="radio" name={`${id}-who`} checked={who === i} onChange={() => { setWho(i); setErr(""); }} />
              <span>{label(r)}</span>
            </label>
          ))}
        </div>
      )}
      {items.length ? (
        <ul className="mg-ad-list">
          {items.map((x) => {
            const q = addonQty(mine, x.id), left = stock[x.id] ?? x.qty, out = left <= 0;
            const noAdd = busy || out || !x.sold || (lock && x.price > 0) || q >= ADDON_MAX;
            return (
              <li key={x.id} className={`mg-ad${q > 0 ? " on" : ""}`}>
                {x.photo ? <img className="mg-ad-img" src={x.photo} alt="" width={44} height={44} loading="lazy" decoding="async" /> : <span className="mg-ad-img" aria-hidden="true" />}
                <div className="mg-ad-t">
                  <p className="mg-ad-n"><bdi>{x.name}</bdi>{x.brand && <span className="mg-ad-b"> · <bdi>{x.brand}</bdi></span>}</p>
                  {left <= 10 && <p className={`mg-ad-s${out ? " out" : ""}`}>{out ? w.adOut : <><bdi dir="ltr">{left}</bdi> {w.adLeft}</>}</p>}
                  <Sar n={x.price} word={sarWord} className="mg-ad-p" />
                </div>
                <div className="mg-step sm" role="group" aria-label={x.name}>
                  <button type="button" aria-label={fillN(w.adDec, x.name)} disabled={busy || q <= 0} onClick={() => tap(x, -1)}><Minus /></button>
                  <span aria-live="polite">{q}</span>
                  <button type="button" aria-label={fillN(w.adInc, x.name)} disabled={noAdd} onClick={() => tap(x, 1)}><Plus /></button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mg-empty">{w.adNone}</p>}
      {err && <p className="tk-brp-err" role="alert">{err}</p>}
      <div className="mg-tot"><span>{w.total}</span><Sar n={total} word={sarWord} className="mg-tot-n" /></div>
      <div className="tk-dlg-acts"><button type="button" className="mg-btn mg-go" onClick={onDone}>{w.done}</button></div>
    </>
  );
}
