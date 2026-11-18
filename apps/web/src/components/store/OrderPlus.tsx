import { Link } from "@/i18n/navigation";
import { dayLabel } from "@/lib/store-checkout";
import type { OrderExtras } from "@/lib/sx-b3";
import { clock } from "@/lib/sx-b3-handover";
import type { SxText } from "./sx-B3.text";
import { SxIcon } from "./sx-b3-icons";

// An order's parts from the build of 2026-11-18 (B3), on its page: the handover slot of "Collect fully built" (N13), the
// session it is handed over at (N15) and the Jeddah delivery's pin (N07, said only as pinned: the point is the driver's
// alone), as facts in the way's card; and, for a bike bought by someone still learning (N17), a place on the next
// learn-to-ride lessons, only while staff take sign-ups.

/** The way's facts; null when the order has none of them. */
export function OrderWayFacts({ e, x, intl }: { e: OrderExtras; x: SxText; intl: string }) {
  if (!e.handover && !e.session && !e.pinned) return null;
  return (
    <dl className="st-kv sx3-ow">
      {e.handover && (
        <div><dt>{x.handover}</dt><dd>{`${dayLabel(e.handover.day, intl)} · ${clock(e.handover.at, intl)} – ${clock(e.handover.to, intl)}`}</dd></div>
      )}
      {e.session && <div><dt>{x.handover}</dt><dd>{x.atSessionOn(dayLabel(e.session.date, intl))}</dd></div>}
      {e.pinned && <div><dt>{x.pinTitle}</dt><dd><SxIcon name="pin" size={16} className="sx3-ic" />{x.pinned}</dd></div>}
    </dl>
  );
}

/** "Learn to ride with us" and the lessons' sign-up. */
export function LearnOffer({ x }: { x: SxText }) {
  return (
    <section className="sx3-learn" aria-labelledby="sx3-learn-h">
      <h2 id="sx3-learn-h">{x.learnH}</h2>
      <Link href="/experiences/learn" className="bk-btn2">{x.learnGo}</Link>
    </section>
  );
}
