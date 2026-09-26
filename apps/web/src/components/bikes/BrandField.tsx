/**
 * The watermark field from docs/loading-screen-handoff.md: the M mark scattered across the
 * whole surface, upright, at 8.5%.
 *
 * The distribution is the spec's reference table, copied literally rather than generated. The
 * spec allows a seeded loop but requires the seed be fixed so the pattern cannot reshuffle
 * between paints; a constant table is the same guarantee with nothing to get wrong. Rows are
 * staggered and widths vary so no two rows line up.
 *
 * Marks are upright — 0 degrees, no exceptions, per the spec and the brand guidelines' rule
 * that the mark is never rotated.
 *
 * Each mark is a span with the SVG as a background rather than an <img>: one cached request
 * for all of them, no 38 elements for next/image to wrap, and nothing for a screen reader to
 * find. The field is decorative and carries aria-hidden.
 *
 * The assets live under /b/assets, not /assets, because the production Worker claims only
 * micromobility.sa/b/* — anything outside that prefix still falls through to the old forward
 * to the store, so a mark at /assets would 302 away and never paint.
 */
type Mark = [left: number, width: number];
type Row = { top: number; marks: Mark[] };

const ROWS: Row[] = [
  { top: 2,  marks: [[4, 56], [28, 44], [52, 64], [76, 48]] },
  { top: 11, marks: [[16, 60], [40, 42], [64, 52], [88, 58]] },
  { top: 22, marks: [[3, 46], [27, 62], [51, 44], [75, 56]] },
  { top: 33, marks: [[14, 50], [38, 58], [62, 44], [87, 60]] },
  { top: 44, marks: [[2, 54], [26, 46], [50, 64], [74, 48]] },
  { top: 55, marks: [[13, 58], [37, 44], [61, 56], [86, 50]] },
  { top: 66, marks: [[4, 48], [28, 60], [52, 44], [76, 54]] },
  { top: 77, marks: [[15, 52], [39, 46], [63, 62], [88, 44]] },
  { top: 88, marks: [[3, 58], [27, 44], [51, 54], [75, 48]] },
  { top: 97, marks: [[16, 50], [64, 56]] },
];

/** The spec asks for two more rows on a wide canvas so density holds; CSS hides them below 1025px. */
const WIDE_ROWS: Row[] = [
  { top: 27, marks: [[9, 52], [33, 44], [57, 58], [81, 46]] },
  { top: 71, marks: [[8, 46], [32, 56], [56, 48], [80, 60]] },
];

export default function BrandField() {
  return (
    <span className="bk-field" aria-hidden="true">
      {ROWS.map((r) =>
        r.marks.map(([left, width]) => (
          <span
            key={`${r.top}-${left}`}
            style={{ top: `${r.top}%`, left: `${left}%`, width: `calc(var(--bk-wm) * ${width}px)` }}
          />
        )),
      )}
      {WIDE_ROWS.map((r) =>
        r.marks.map(([left, width]) => (
          <span
            key={`w-${r.top}-${left}`}
            className="bk-field-wide"
            style={{ top: `${r.top}%`, left: `${left}%`, width: `calc(var(--bk-wm) * ${width}px)` }}
          />
        )),
      )}
    </span>
  );
}
