import { useId } from "react";
import { GLYPH } from "./badge-glyphs";

// A badge drawn as the booking app draws it (_bdgMedal): its glyph on a hexagon in one of eight
// colours; Race Ready ('special', gold into green), National Day 96 ('national', the greens) and
// Run for Her ('pink', the pinks) are drawn special (BDG_SPECIAL), a gradient with an inner ring
// and a white glyph.
const COLORS = ["green", "gold", "blue", "red", "purple", "orange", "teal", "silver"];
const SPECIAL: Record<string, [[string, string, string], string]> = {
  special: [["#ffe58a", "#f0a500", "#00b86b"], "#b87d00"],
  national: [["#5fd99a", "#159a57", "#0a5c33"], "#08502c"],
  pink: [["#ffc9da", "#f2789f", "#c2416e"], "#a3325b"],
}; // BadgeGrid's special() lists the same colours, to frame their tiles and pop-ups to match
// The T100 races in Jeddah (redrawn 2026-10-09 as the booking app's _bdgRace): a finisher's medal on a ribbon,
// the race's name struck on it, gold / silver / bronze whatever the badge's colour. [text, [gradient], rim, ink]
const RACE: Record<string, [string, [string, string, string], string, string]> = {
  t100: ["T100", ["#fff3b8", "#f3c431", "#b07c00"], "#7d5800", "#5c3f00"],
  t50: ["T50", ["#fff", "#cfd5de", "#858f9e"], "#636b78", "#323946"],
  t25: ["T25", ["#ffd9b5", "#dc8d4c", "#93501d"], "#713b12", "#4d2408"],
};

export default function Medal({ icon, color, className = "" }: { icon: string; color: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const g = GLYPH[icon] ?? GLYPH.medal, sp = SPECIAL[color], race = RACE[icon];
  if (race) {
    const w = race[0].length > 3 ? 20.5 : 15.5;
    const tx = (y: number, fill: string, op?: number) => (
      <text className="bdg-rt" x="20" y={y} fill={fill} fillOpacity={op} textAnchor="middle" fontSize="11" textLength={w} lengthAdjust="spacingAndGlyphs">{race[0]}</text>
    );
    return (
      <svg className={`bdg-m bdg-race ${className}`} viewBox="0 0 40 40" aria-hidden="true">
        <defs><linearGradient id={`bdg${id}`} x1="0" y1="0" x2="1" y2="1">{race[1].map((c, i) => <stop key={i} offset={i / 2} stopColor={c} />)}</linearGradient></defs>
        <path fill="#1e4f96" d="M9 .8h7.4l6.4 12.6h-7.4z" />
        <path fill="#153a70" d="M31 .8h-7.4l-6.4 12.6h7.4z" />
        <path stroke="#fff" strokeOpacity=".55" strokeWidth=".9" fill="none" d="M12.7.8l6.4 12.6M27.3.8l-6.4 12.6" />
        <circle cx="20" cy="24.8" r="14.2" fill={`url(#bdg${id})`} stroke={race[2]} strokeWidth="1.2" />
        <circle cx="20" cy="24.8" r="11.7" fill="none" stroke={race[2]} strokeOpacity=".45" strokeWidth=".8" />
        <path d="M9.6 21.4a11 11 0 0 1 7.3-7.7" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.3" strokeLinecap="round" />
        {tx(29.1, "#fff", 0.55)}{tx(28.4, race[3])}
      </svg>
    );
  }
  if (sp) {
    return (
      <svg className={`bdg-m bdg-sp ${className}`} viewBox="0 0 40 40" aria-hidden="true">
        <defs><linearGradient id={`bdg${id}`} x1="0" y1="0" x2="1" y2="1">{sp[0].map((c, i) => <stop key={i} offset={[0, 0.45, 1][i]} stopColor={c} />)}</linearGradient></defs>
        <path className="bdg-hexsp" fill={`url(#bdg${id})`} stroke={sp[1]} d="M20 2.2 35.4 11.1v17.8L20 37.8 4.6 28.9V11.1z" />
        <path className="bdg-hexin" d="M20 5.9 32.2 12.95v14.1L20 34.1 7.8 27.05v-14.1z" />
        <g transform="translate(9.4 9.4) scale(.883)" dangerouslySetInnerHTML={{ __html: g }} />
      </svg>
    );
  }
  return (
    <svg className={`bdg-m bdc-${COLORS.includes(color) ? color : "green"} ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <path className="bdg-hex" d="M20 2.2 35.4 11.1v17.8L20 37.8 4.6 28.9V11.1z" />
      <g transform="translate(7.6 7.6) scale(1.034)" dangerouslySetInnerHTML={{ __html: g }} />
    </svg>
  );
}
