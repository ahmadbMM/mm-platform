import type { Session } from "./account-core";
import { rpcServer } from "./account";
import { hubMonthOf, hubPlanOf, monthDue, type HubMonth, type HubPlan } from "./member-hub";

/** Plan my Saturdays and My month for a signed-in member of /club (lib/member-hub.ts), read with the account's own
 *  token, at once: hub_plan always, hub_month only from the 26th (Riyadh's `today`, "YYYY-MM-DD"), as the booking app
 *  asks it. A piece whose read failed is null. */
export async function readMemberHub(acct: Session, today: string): Promise<{ plan: HubPlan | null; month: HubMonth | null }> {
  const args = { p_id: acct.id, p_token: acct.token };
  const [p, m] = await Promise.all([rpcServer<unknown>("hub_plan", args), monthDue(today) ? rpcServer<unknown>("hub_month", args) : null]);
  return { plan: hubPlanOf(p, today), month: m ? hubMonthOf(m, today) : null };
}
