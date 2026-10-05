import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, decodeSession, encodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { HANDOFF_COOKIE, HANDOFF_MAX_AGE, cookieLine, sessionProfile } from "@/lib/handoff";
import { cookieValue } from "@/lib/live";

// The booking app hands a rider back here signed in: after they sign up, reset a password or
// sign in with Google or Apple there (it was opened with ?handoff=site from the account page), it
// sends them to /api/account/handoff?code=<one-time code>. The code (48 hex characters, two
// minutes, one use; customer_handoff_redeem) is traded for the session, kept in the same HttpOnly
// cookie a sign-in here sets, and the rider lands on their account, which says whom they are signed
// in as (?handoff=done). A code that is used, unknown or late lands them on the sign-in instead.
//
// A code is anyone's to pass on (lib/handoff.ts): when ANOTHER account is signed in on this browser,
// the session handed over is kept aside (HANDOFF_COOKIE) and the account page asks which account to
// keep; its two buttons POST here, from this site's own page only.
export const dynamic = "force-dynamic";

const back = (req: Request, to: string, ...cookies: string[]) => {
  const headers = new Headers({ location: new URL(to, req.url).toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 303, headers });
};
const clearHanded = cookieLine(HANDOFF_COOKIE, "", 0);

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[0-9a-f]{48}$/.test(code)) return back(req, "/account");
  const r = await rpcServer<{ id?: string; session_token?: string }[]>("customer_handoff_redeem", { p_code: code });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row?.id || !row.session_token) return back(req, "/account?handoff=expired");
  const handed = encodeSession({ id: row.id, token: row.session_token });
  // another account still signed in here (or no answer about it): the account page asks first
  const now = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (now && now.id !== row.id && (await sessionProfile(now)) !== "none") return back(req, "/account", cookieLine(HANDOFF_COOKIE, handed, HANDOFF_MAX_AGE));
  return back(req, "/account?handoff=done", cookieLine(ACCOUNT_COOKIE, handed, ACCOUNT_MAX_AGE), clearHanded);
}

/** The account page's answer (a form: do=switch, anything else stays): sign in with the account
 *  handed over, or keep the one signed in. Either way the session kept aside is dropped. */
export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  const form = await req.formData().catch(() => null);
  const handed = decodeSession(cookieValue(req.headers.get("cookie"), HANDOFF_COOKIE));
  if (form?.get("do") === "switch" && handed) return back(req, "/account?handoff=done", cookieLine(ACCOUNT_COOKIE, encodeSession(handed), ACCOUNT_MAX_AGE), clearHanded);
  return back(req, "/account", clearHanded);
}
