// The signed-in rider's own workshop appointments (customer_workshop_jobs, rentals 20261119500000; the user, 2026-11-19:
// "make sure to have a page or dedicated space for purchases and workshop appointments"): /account/workshop lists them,
// upcoming then past, and /bookings puts the upcoming ones among the rider's other bookings. A database without the
// function (PGRST202 until the migration is applied), or a read that failed, gives none: the page shows its empty state.

export type WorkshopJob = {
  id: number; ref: string; status: string; service: string;
  /** The day it is for, Riyadh time: the time staff booked, else the day the rider asked for. */
  date: string | null; time: string | null;
  lane: string; price: number | null; bike: string | null; sent: string | null;
};

export const WS_OPEN = ["new", "confirmed", "in_workshop", "awaiting_parts", "ready"] as const;
export const wsOpen = (j: Pick<WorkshopJob, "status">) => (WS_OPEN as readonly string[]).includes(j.status);

const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A moment as the day and time in Riyadh (UTC+3, no daylight saving). */
export function riyadhParts(iso: string): { date: string; time: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 3 * 3600e3).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

export function workshopJobsOf(data: unknown): WorkshopJob[] {
  if (!Array.isArray(data)) return [];
  const out: WorkshopJob[] = [];
  for (const x of data) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = num(o.id);
    if (id == null) continue;
    const sched = str(o.scheduled_for) ? riyadhParts(String(o.scheduled_for)) : null;
    const pd = str(o.preferred_date), pt = str(o.preferred_time);
    out.push({
      id, ref: str(o.ref) ?? `W-${String(id).padStart(4, "0")}`, status: str(o.status) ?? "new", service: str(o.service) ?? "",
      date: sched?.date ?? (pd && /^\d{4}-\d{2}-\d{2}/.test(pd) ? pd.slice(0, 10) : null),
      time: sched?.time ?? (pt && /^\d{2}:\d{2}/.test(pt) ? pt.slice(0, 5) : null),
      lane: str(o.lane) ?? "dropoff", price: num(o.price_final) ?? num(o.price_quoted), bike: str(o.bike), sent: str(o.created_at),
    });
  }
  return out;
}

/** Still ahead: not finished nor cancelled, and on today or later (or with no day yet). Soonest first; those with no day
 *  last. */
export function upcomingJobs(jobs: WorkshopJob[], today: string): WorkshopJob[] {
  return jobs.filter((j) => wsOpen(j) && (!j.date || j.date >= today))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "") || a.id - b.id);
}
/** The rest, newest first. */
export function pastJobs(jobs: WorkshopJob[], today: string): WorkshopJob[] {
  const up = new Set(upcomingJobs(jobs, today).map((j) => j.id));
  return jobs.filter((j) => !up.has(j.id)).sort((a, b) => (b.date ?? b.sent ?? "").localeCompare(a.date ?? a.sent ?? "") || b.id - a.id);
}
