import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, encodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";

// The booking app hands a rider back here signed in: after they sign up, reset a password or
// sign in with Google or Apple there (it was opened with ?handoff=site from the account page), it
// sends them to /api/account/handoff?code=<one-time code>. The code (48 hex characters, two
// minutes, one use; customer_handoff_redeem) is traded for the session, kept in the same HttpOnly
// cookie a sign-in here sets, and the rider lands on their account. A code that is used, unknown
// or late lands them on the sign-in instead.
export const dynamic = "force-dynamic";

const back = (req: Request, to: string, cookie?: string) =>
  new Response(null, {
    status: 303,
    headers: {
      location: new URL(to, req.url).toString(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      ...(cookie ? { "set-cookie": cookie } : {}),
    },
  });

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[0-9a-f]{48}$/.test(code)) return back(req, "/account");
  const r = await rpcServer<{ id?: string; session_token?: string }[]>("customer_handoff_redeem", { p_code: code });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row?.id || !row.session_token) return back(req, "/account?handoff=expired");
  const cookie = `${ACCOUNT_COOKIE}=${encodeSession({ id: row.id, token: row.session_token })}; Path=/; Max-Age=${ACCOUNT_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
  return back(req, "/account", cookie);
}
