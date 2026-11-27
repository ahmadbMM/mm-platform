import { rpcServer } from "./account";
import type { Session } from "./account-core";
import { readBoard, readMine, type Board, type BoardAnswer, type BoardGender, type MyDistances } from "./distance-board";

// The distance leaderboards' reads on the server (lib/distance-board.ts; rentals migration 20261127180000): a board as
// anyone may read it (distance_board, anon), with the signed-in account's own place when the request carries its
// session, and the account's own figures and distances (customer_distances). Null when the database could not answer,
// refused, or has no such function yet: the page then says it could not load the leaderboard.

export async function readDistanceBoard(b: Board, g: BoardGender, acct: Session | null): Promise<BoardAnswer | null> {
  const r = await rpcServer<unknown>("distance_board", { p_board: b, p_gender: g, p_id: acct?.id ?? null, p_token: acct?.token ?? null });
  return r.status === 200 ? readBoard(r.data) : null;
}

export async function readMyDistances(acct: Session): Promise<MyDistances | null> {
  const r = await rpcServer<unknown>("customer_distances", { p_id: acct.id, p_token: acct.token });
  return r.status === 200 ? readMine(r.data) : null;
}
