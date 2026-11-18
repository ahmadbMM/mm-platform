"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { T as STORE } from "../Store.text";
import { T } from "../sx-B4.text";
import Modal from "../Modal";
import { AfterIcon } from "./icons";
import { postJson } from "./net";

// Change time (N30): the booked delivery window (F78) or pickup handover (N13) moves to another day and time the store
// still offers, until the cut-off staff set (store.slotChange.hours before it starts) and a set number of times. The
// choices come from this site's server when the pop-up opens (/api/store/slot, "options": the delivery windows from the
// store's settings, the handover windows with places left from the database), and the database checks the choice
// again (store_after_slot_change). Staff see the change in the order's history.
type Day = { day: string; label: string; times: { time: string; label: string }[] };

export default function SlotChange({ no, k, current }: { no: number; k: string; current: { day: string; time: string } }) {
  const t = useLocalize(T);
  const s = useLocalize(STORE);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<Day[] | null>(null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function start() {
    setOpen(true); setErr(""); setDays(null); setDay(current.day); setTime(current.time);
    const r = await postJson<{ days?: Day[] }>("/api/store/slot", { action: "options", no, key: k, lang: document.documentElement.lang || "en" });
    if (r.ok && Array.isArray(r.days)) setDays(r.days);
    else { setDays([]); setErr(t.errs[r.error ?? ""] ?? t.errs.generic); }
  }
  async function save() {
    if (busy || !day || !time) return;
    if (day === current.day && time === current.time) { setOpen(false); return; }
    setBusy(true); setErr("");
    const r = await postJson("/api/store/slot", { action: "change", no, key: k, day, time });
    setBusy(false);
    if (r.ok) { setOpen(false); setDone(true); router.refresh(); return; }
    setErr(t.errs[r.error ?? ""] ?? t.errs.generic);
  }
  const close = () => { if (!busy) setOpen(false); };
  const picked = days?.find((d) => d.day === day) ?? null;

  return (
    <>
      <button type="button" className="sxb-link" onClick={start}><AfterIcon name="clock" size={17} />{t.changeTime}</button>
      {done && <span className="sxb-msg" role="status">{t.timeChanged}</span>}
      {open && (
        <Modal title={t.changeTime} onClose={close} closeLabel={s.close}>
          <div className="sxb-slot">
            {days === null ? <p className="sxb-wait"><span className="bk-spin" aria-hidden="true" /></p>
              : days.length === 0 ? <p>{t.noTimes}</p> : (
                <>
                  <fieldset className="sxb-chips">
                    <legend>{t.pickDay}</legend>
                    {days.map((d) => (
                      <label key={d.day} className={d.day === day ? "on" : undefined}>
                        <input type="radio" name="sxb-slot-day" checked={d.day === day} onChange={() => { setDay(d.day); setTime(d.times.some((x) => x.time === time) ? time : ""); }} />
                        <span>{d.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  {picked && (
                    <fieldset className="sxb-chips">
                      <legend>{t.pickTime}</legend>
                      {picked.times.map((x) => (
                        <label key={x.time} className={x.time === time ? "on" : undefined}>
                          <input type="radio" name="sxb-slot-time" checked={x.time === time} onChange={() => setTime(x.time)} />
                          <span dir="ltr">{x.label}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
            {err && <p className="bk-err" role="alert">{err}</p>}
            {!!days?.length && (
              <button type="button" className="bk-btn wide" onClick={save} disabled={busy || !day || !time}>
                {busy ? <><span className="bk-spin" aria-hidden="true" />{t.working}</> : t.saveTime}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
