"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { handoverAnswer, HANDOVER_STORE, keptSlot, type HoAnswer } from "@/lib/sx-B2";
import { T } from "./Store.text";
import { T as B } from "./sx-B2.text";
import { B2Icon } from "./sx-B2-icons";
import Modal from "./Modal";

// N13 (the "do all" build of 2026-11-18), the buy box's half: under "Collect fully built" a bike offers a 20-minute
// handover (a mechanic sets the saddle, fits the pedals, shows the gears and the tyres). "Pick a time" opens a centred
// pop-up with the handover days and their free times; the time picked waits in this visit's sessionStorage
// (mm-handover = {day, at}) for checkout, which offers it again and sends it (B3's half and the database's check).
// Nothing shows while the feature is off, the route is missing or the times cannot be read: the pickup row stays as it
// was. Times are the showroom's clock, written as staff set them (16:20).
const EVT = "mm-handover";
const read = (): string | null => { try { return sessionStorage.getItem(HANDOVER_STORE); } catch { return null; } };
const sub = (f: () => void) => { window.addEventListener(EVT, f); return () => window.removeEventListener(EVT, f); };
function put(v: { day: string; at: string }) {
  try { sessionStorage.setItem(HANDOVER_STORE, JSON.stringify(v)); } catch { /* private window: the pick lives in the page only */ }
  window.dispatchEvent(new Event(EVT));
}

export default function HandoverPick({ locale }: { locale: string }) {
  const t = useLocalize(T);
  const b = useLocalize(B);
  const [ans, setAns] = useState<HoAnswer | null>(null);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const raw = useSyncExternalStore(sub, read, () => null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/store/handover", { signal: ctl.signal, headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => setAns(handoverAnswer(j)))
      .catch(() => { /* off: the pickup row stays as it was */ });
    return () => ctl.abort();
  }, []);

  if (!ans?.on) return null;
  const kept = keptSlot(raw, ans);
  const dayFmt = new Intl.DateTimeFormat(intlOf(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const dayText = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));
  const shown = ans.days.find((d) => d.day === (day ?? kept?.day)) ?? ans.days[0];

  return (
    <div className="st-b2-ho">
      <span><B2Icon name="clock" size={18} />{kept ? <bdi>{`${dayText(kept.day)} · ${kept.at}`}</bdi> : b.handover(ans.minutes)}</span>
      <button type="button" className="st-linkbtn" aria-haspopup="dialog" onClick={() => { setDay(kept?.day ?? null); setOpen(true); }}>
        {kept ? b.changeTime : b.pickTime}
      </button>
      {open && (
        <Modal title={b.handover(ans.minutes)} onClose={() => setOpen(false)} closeLabel={t.close}>
          {ans.days.length > 1 && (
            <div className="st-b2-hodays" role="group" aria-label={b.pickTime}>
              {ans.days.map((d) => (
                <button key={d.day} type="button" aria-pressed={d.day === shown.day} onClick={() => setDay(d.day)}>{dayText(d.day)}</button>
              ))}
            </div>
          )}
          {ans.days.length === 1 && <p className="st-b2-slots-day">{dayText(shown.day)}</p>}
          {shown.slots.some((s) => s.open) ? (
            <div className="st-b2-slots" role="group" aria-label={dayText(shown.day)}>
              {shown.slots.map((s) => (
                <button key={s.at} type="button" disabled={!s.open} aria-pressed={kept?.day === shown.day && kept.at === s.at}
                  onClick={() => { put({ day: shown.day, at: s.at }); setOpen(false); }}><bdi>{s.at}</bdi></button>
              ))}
            </div>
          ) : <p className="st-b2-slots-note">{b.noTimes}</p>}
        </Modal>
      )}
    </div>
  );
}
