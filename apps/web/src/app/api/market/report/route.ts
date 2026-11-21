import { isMkReportReason, isMkReportTarget } from "@/lib/market/core";
import { bodyId, bodyText, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkReport } from "@/lib/market/server";

// POST /api/market/report: a listing or a thread reported to staff (market_report). Body {target: "listing" |
// "thread", ref: number, reason: one of lib/market/core.ts MK_REPORT_REASONS, note?: string}; the note is optional,
// cleaned and cut at 300 by the database. One report per account per thing: a second answers `dup` true and writes
// nothing. Who reported is never told to anyone but staff. Answers {ok: true, dup}, or {ok: false, error, detail?}:
// "invalid", "gone", "own" (the account's own listing), "limit" (detail reports), "signin", "busy".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const target = g.body.target, ref = bodyId(g.body.ref), reason = g.body.reason;
  const note = g.body.note === undefined || g.body.note === null ? "" : bodyText(g.body.note, 2000);
  if (!isMkReportTarget(target) || !ref || !isMkReportReason(reason) || note === null) return mkRefuse("invalid", 400);
  return mkAnswer(await mkReport(g.session, target, ref, reason, note.trim() ? note : null, req), (d) => ({ dup: d.dup === true }));
}
