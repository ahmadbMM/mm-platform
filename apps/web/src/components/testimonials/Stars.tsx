import { starFills } from "@/lib/testimonials";

// Stars, drawn (never a character): five, each full, half or empty for the value given (lib/testimonials.ts starFills).
// The whole row is one image named by `label` ("4.9 out of 5 stars"); a half star fills from the reading side, so it
// reads right in Arabic and Urdu too.
export const STAR_PATH = "M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.86l-5.5 2.9 1.05-6.13L3.1 9.3l6.15-.9z";

export function StarGlyph({ size }: { size: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"><path d={STAR_PATH} /></svg>;
}

export default function Stars({ value, label, size = 18, className = "" }: { value: number; label: string; size?: number; className?: string }) {
  return (
    <span className={`tm-stars${className ? ` ${className}` : ""}`} role="img" aria-label={label}>
      {starFills(value).map((f, i) => (
        <span key={i} className={`tm-star is-${f}`} style={{ width: size, height: size }}>
          <StarGlyph size={size} />
          {f === "half" && <span className="tm-star-cut"><StarGlyph size={size} /></span>}
        </span>
      ))}
    </span>
  );
}
