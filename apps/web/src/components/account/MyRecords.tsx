import { fill } from "@/i18n/tx";
import { FLEET_TYPES, type MyRecords as Records } from "@/lib/my-records";
import { monthName } from "@/lib/member-hub";
import { recordsWords } from "./Records.words";

// My records on My Account's Stats, after Your rides (lib/my-records.ts; the booking app's _recHtml and its .rec card,
// 2026-11-18): under "My records", two tiles a row, each a big number, its name and at most one short value - Saturdays in
// a row with the month the run ended, Sessions in your best month with that month, Bike types tried as "3 of 5", Routes
// ridden. A tile with nothing to say is left out; the page draws the card only when one has.
export default function MyRecords({ locale, recs }: { locale: string; recs: Records }) {
  const w = recordsWords(locale);
  const tiles: [string, string, string, string][] = [];
  if (recs.sat) tiles.push(["sat", String(recs.sat.n), w.sat, monthName(recs.sat.end, locale, true)]);
  if (recs.month) tiles.push(["month", String(recs.month.n), w.month, monthName(recs.month.ym, locale, true)]);
  if (recs.types) tiles.push(["types", fill(w.of, recs.types, FLEET_TYPES.length), w.types, ""]);
  if (recs.routes) tiles.push(["routes", String(recs.routes), w.routes, ""]);
  if (!tiles.length) return null;
  return (
    <div className="myr myr-c myr-rec">
      <p className="myr-h">{w.title}</p>
      <div className="rec-g">
        {tiles.map(([k, n, l, v]) => (
          <div key={k} className="rec-t" data-rec={k}>
            <b className="rec-n"><bdi>{n}</bdi></b>
            <span className="rec-l">{l}</span>
            {v && <span className="rec-v"><bdi>{v}</bdi></span>}
          </div>
        ))}
      </div>
    </div>
  );
}
