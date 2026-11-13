import type { ReactNode } from "react";
import { KindIcon } from "@/components/experiences/KindArt";
import { fmtNum } from "@/lib/fill";
import { monthName, type HubMonth } from "@/lib/member-hub";
import type { RideKind } from "@/lib/rides";
import { memberHubWords } from "./MemberHub.words";

// My month in a member's area on /club (the booking app's _monHtml, new features F13): from the 26th, the member's own
// month - its name with its year, the Saturdays they rode, their sessions, the badges they earned, and, when they had
// sessions before this month, this month's sessions against the month before (+2, -1, 0) - then their sessions by kind,
// most first, each with the kind's mark. Every number is the member's own (hub_month, lib/member-hub.ts). The app's
// Share button is not here: it draws through the share pop-up of its badges (F12).
export default function MyMonth({ locale, month: m, kindName }: { locale: string; month: HubMonth; kindName: (k: RideKind) => string }) {
  const w = memberHubWords(locale);
  const N = (n: number) => <bdi>{fmtNum(n, locale)}</bdi>;
  const p = m.prev;
  const tiles: [string, ReactNode, string][] = [["sats", N(m.saturdays), w.sats], ["sessions", N(m.sessions), w.sessions], ["badges", N(m.badges), w.badges]];
  if (p) tiles.push(["prev", <bdi key="x" dir="ltr">{p.x > 0 ? "+" : p.x < 0 ? "-" : ""}{Math.abs(p.x)}</bdi>, w.vs.split("{0}").join(monthName(p.month, locale))]);
  return (
    <section className="club-mon" aria-labelledby="club-mon-h">
      <h3 id="club-mon-h">{w.month}</h3>
      <p className="club-mon-name"><strong><bdi>{monthName(m.month, locale, true)}</bdi></strong></p>
      <div className="club-mon-stats">
        {tiles.map(([k, v, label]) => <div key={k} data-mon={k}><strong>{v}</strong><span>{label}</span></div>)}
      </div>
      {m.kinds.length > 0 && (
        <ul className="club-mon-kinds">
          {m.kinds.map((x) => <li key={x.k} data-kind={x.k}><KindIcon kind={x.k} size={18} /><span>{kindName(x.k)}</span><strong>{N(x.n)}</strong></li>)}
        </ul>
      )}
    </section>
  );
}
