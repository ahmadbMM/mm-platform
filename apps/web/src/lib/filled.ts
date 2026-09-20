/**
 * A value counts as filled only if it says something. Placeholder dashes are not data.
 *
 * This lives in its own module so the title builder and the field builder share ONE rule.
 * They used to disagree: bikeTitle() tested bare truthiness, so a brand of "-" became the
 * page headline AND suppressed the real Model row beneath it.
 */
export function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && !["—", "-", "–", "n/a", "N/A", "null", "undefined"].includes(s);
}
