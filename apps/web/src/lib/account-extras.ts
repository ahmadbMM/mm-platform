import { rpcServer } from "./account";
import type { Session } from "./account-core";
import { fixClean, purchasesOf, type AboutRow, type FixField, type Purchase } from "./account-profile";

// Everything else My Account reads for the signed-in rider, all at once and on the server, with
// the cookie's own id and token: how the account signs in and the community form's answers
// (customer_about), the two consents (customer_consents, read only), a deletion request
// (customer_deletion_request, read only), a temporary password to replace (customer_pwd_state),
// the desk purchases (customer_purchases), what staff asked to correct (customer_fix_fields) and
// the ambassador card (ambassador_mine). Each one that cannot be read is left out (null), as the
// booking app hides a section the server cannot answer for, rather than showing a guess.

export type Consents = { privacyVersion: string | null; rideNews: boolean; rideNewsAt: string | null };
export type AmbassadorMine = {
  code: string; status: string; earned: number; balance: number; uses: number;
  events: { at: string; context: string; points: number; status: string }[];
};
export type AccountExtras = {
  about: AboutRow | null;
  consents: Consents | null;
  deletion: { requestedAt: string | null } | null;
  mustChangePwd: boolean;
  purchases: { rows: Purchase[]; total: number } | null;
  fix: FixField[];
  ambassador: AmbassadorMine | null;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function loadAccountExtras(s: Session): Promise<AccountExtras> {
  const a = { p_id: s.id, p_token: s.token };
  const [about, cons, del, pwd, purch, fix, amb] = await Promise.all([
    rpcServer<AboutRow[]>("customer_about", a),
    rpcServer<{ privacy_version?: string | null; ride_news?: boolean; ride_news_at?: string | null }>("customer_consents", { ...a, p_privacy: null, p_ride_news: null }),
    rpcServer<{ requested_at?: string | null }>("customer_deletion_request", { ...a, p_request: null }),
    rpcServer<boolean>("customer_pwd_state", a),
    rpcServer<unknown[]>("customer_purchases", a),
    rpcServer<string[]>("customer_fix_fields", a),
    rpcServer<Record<string, unknown>>("ambassador_mine", a),
  ]);
  const c = cons.data;
  const m = amb.data;
  return {
    about: Array.isArray(about.data) ? about.data[0] ?? null : null,
    consents: c && typeof c.ride_news === "boolean" ? { privacyVersion: c.privacy_version ?? null, rideNews: c.ride_news, rideNewsAt: c.ride_news_at ?? null } : null,
    deletion: del.data && typeof del.data === "object" && "requested_at" in del.data ? { requestedAt: del.data.requested_at ?? null } : null,
    mustChangePwd: pwd.data === true,
    purchases: Array.isArray(purch.data) ? purchasesOf(purch.data) : null,
    fix: fix.status < 400 ? fixClean(fix.data) : [],
    ambassador: m && m.ok === true && m.ambassador === true ? {
      code: String(m.code ?? ""), status: String(m.status ?? ""), earned: num(m.earned), balance: num(m.balance), uses: num(m.uses),
      events: (Array.isArray(m.events) ? m.events : []).slice(0, 5).map((e) => {
        const x = (e ?? {}) as Record<string, unknown>;
        return { at: String(x.at ?? ""), context: String(x.context ?? ""), points: num(x.points), status: String(x.status ?? "") };
      }),
    } : null,
  };
}
