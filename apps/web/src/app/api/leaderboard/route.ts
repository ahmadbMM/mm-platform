import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { asBoard, asGender } from "@/lib/distance-board";
import { readDistanceBoard } from "@/lib/distance-board-server";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// GET /api/leaderboard?b=longest|month|lifetime|year&g=all|male|female: one distance leaderboard for the page's switches
// (components/leaderboard/Leaderboard.tsx), through the booking app's distance_board (rentals migration 20261127180000),
// which anyone may read. With the account cookie its id and token go too, so the answer marks the rider's own row and
// carries their own place (`me`), as the booking app's page asks it (_dbdFetch). Answers {ok: true, board} or
// {ok: false, error: "busy" | "generic"}. A connection asks 30 a minute at most (an account its own 30).
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!(await withinLimit(req, "account-check", undefined, acct?.id ?? ""))) return json({ ok: false, error: "busy" }, 429);
  const board = await readDistanceBoard(asBoard(q.get("b")), asGender(q.get("g")), acct);
  return board ? json({ ok: true, board }) : json({ ok: false, error: "generic" }, 502);
}
