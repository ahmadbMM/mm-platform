// The contact side's one database call that lib/market/server.ts does not have (W3; server only, never sent to a
// browser): taking back a WhatsApp number shared in a thread. The build's contract gives "Share my WhatsApp" one way
// only (market_share_whatsapp(p_id, p_token, p_thread)); the owner's brief also lets a person withdraw it, so this
// asks the same function with a fourth argument, p_on false, and answers {shared: false}. A database whose function
// does not take p_on yet answers "absent" (PostgREST finds no function of that shape), which the thread's page says as
// "it could not be done"; sharing itself never sends p_on and works either way.
import { forVisitor, rpcServer } from "../account";
import type { Session } from "../account-core";
import { mkErrorOf, mkIsObj } from "./core";
import type { MkResult } from "./server";

/** market_share_whatsapp with p_on false: the account's number is no longer shown to the other person of this thread. */
export async function mkUnshareWhatsapp(s: Session, thread: number, req?: Request): Promise<MkResult<{ shared: boolean }>> {
  const args = { p_id: s.id, p_token: s.token, p_thread: thread, p_on: false };
  const r = await rpcServer<unknown>("market_share_whatsapp", req ? forVisitor(req, args) : args, 6000);
  if (r.status >= 200 && r.status < 300) {
    return mkIsObj(r.data) ? { ok: true, data: { shared: r.data.shared === true } } : { ok: false, error: "generic", detail: "", status: 502 };
  }
  return { ok: false, ...mkErrorOf(r) };
}
