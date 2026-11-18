import { memberHubWords } from "./MemberHub.words";

// The Ramadan season's card on /club (lib/hub-season.ts; the booking app's _ssnHtml and _ssnArt, 2026-11-18): night blue
// into a deeper blue, "Ramadan Kareem" (or "Eid Mubarak" on Eid al-Fitr's first three days) in pale gold beside a crescent
// with its star (the badge's crescent, badge-glyphs.ts) and two lanterns hanging on their cords, drawn in the season's gold.
// It leads the members' area, as the app's leads its tab; the area's members' sessions take the same night and gold
// (.club-ssn-on, club.css). One look in both themes, as the app's rider side has one.
const lamp = (x: number, y: number, k: number) => (
  <g key={`${x}-${y}`}>
    <path className="hs-str" d={`M${x + 12 * k} 0V${(y + 4.6 * k).toFixed(1)}`} />
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path className="hs-cap" d="M8.4 4.6h7.2l-1.1 2.2H9.5z" />
      <path className="hs-glass" d="M8 7.4h8l1.6 4-1.6 7.2H8l-1.6-7.2z" />
      <path className="hs-core" d="M10.6 9.2h2.8v7.6h-2.8z" />
      <path className="hs-cap" d="M7.4 19h9.2l-1.2 2.8H8.6z" />
    </g>
  </g>
);

export default function SeasonCard({ locale, kind }: { locale: string; kind: "ramadan" | "eid" }) {
  const w = memberHubWords(locale);
  return (
    <div className={`club-ssn club-ssn-${kind}`}>
      <strong className="club-ssn-t">{kind === "eid" ? w.ssnEid : w.ssnRam}</strong>
      <svg className="club-ssn-art" viewBox="0 0 124 56" aria-hidden="true" focusable="false">
        <g transform="translate(2 1) scale(2.25)">
          <path className="hs-moon" d="M15.6 3.2A9.3 9.3 0 1 0 15.6 20.8 8.83 8.83 0 1 1 15.6 3.2Z" />
          <path className="hs-star" d="M18.6 7.4l.68 1.87 1.98.06-1.57 1.23.56 1.91-1.65-1.12-1.65 1.12.56-1.91-1.57-1.23 1.98-.06z" />
        </g>
        {lamp(62, 6, 1.5)}{lamp(92, 16, 1.2)}
      </svg>
    </div>
  );
}
