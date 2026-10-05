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

export default function Medal({ icon, color, className = "" }: { icon: string; color: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const g = GLYPH[icon] ?? GLYPH.medal, sp = SPECIAL[color];
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
