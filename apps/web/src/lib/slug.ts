/** An id from an English name ("Fleet Programmes" -> "fleet-programmes"), for the staff page to
 *  read the same whatever language the visitor used. `fallback` when nothing is left. */
export function slugId(s: string, fallback: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;
}
