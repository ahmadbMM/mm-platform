import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, encodeSession, sameOrigin } from "@/lib/account-core";
import { forVisitor, rpcServer } from "@/lib/account";
import { passesCheck, withinTries } from "@/lib/sign-in-guard";
import { HANDOFF_COOKIE } from "@/lib/handoff";
import { PRIVACY_VERSION } from "@/content/privacy-notice";
import { newCustomerId, signupCheck, signupFieldsOf, signupRefusal } from "@/lib/signup";

// Create account on micromobility.sa (POST, components/account/SignupForm.tsx at /signup): the booking app's own
// sign-up (its doSignup), made here so the new account's session goes into the site's HttpOnly account cookie, as a
// sign-in's does (api/account). The same guards as the sign-in: only this site's own pages, the connection's few tries a
// minute and the Turnstile check once its keys are set (lib/sign-in-guard.ts). Then, as the booking app does:
//   1. everything checked in its order (lib/signup.ts signupCheck): the answer names the problem and its box;
//   2. customer_exists for the email, then for the mobile, so the answer says WHICH is taken (customer_signup's own
//      DUPLICATE covers both);
//   3. customer_signup under an id made here in the booking app's uid() form: the account and its session;
//   4. customer_consents: the Privacy Notice version confirmed (the box it could not be made without) and the ride-news
//      answer either way, so a new account is never asked again;
//   5. customer_set_emergency, then customer_set_emergency2 when a second contact was given.
// A consent or a contact that does not save leaves the account made and signed in: the booking app asks again at the
// next sign-in, and the site's check-up (EmergencyGate) asks for the contact before anything else. The database meters
// customer_exists and customer_signup per address; they go on behalf of the visitor (lib/account.ts forVisitor).
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const json = (body: unknown, status = 200, cookies: string[] = [], headers: Record<string, string> = {}) => {
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store", ...headers });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
};
const down = (status: number) => status === 0 || status >= 500;

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  if (!(await withinTries(req))) return json({ ok: false, error: "slow" }, 429, [], { "retry-after": "60" });
  let body: unknown = null;
  try { body = await req.json(); } catch { /* an empty body is checked like any other */ }
  const f = signupFieldsOf(body);
  const v = signupCheck(f);
  if ("error" in v) return json({ ok: false, ...v }, 400);
  const check = body && typeof body === "object" ? String((body as { check?: unknown }).check ?? "") : "";
  if (!(await passesCheck(req, check))) return json({ ok: false, error: "check" }, 403);

  // Which one is taken, each on its own. An answer that does not come is no answer: customer_signup decides.
  const byEmail = await rpcServer<boolean>("customer_exists", forVisitor(req, { p_email: v.args.p_email, p_phone: "" }));
  if (byEmail.data === true) return json({ ok: false, error: "email_taken", field: "email" }, 409);
  const byPhone = await rpcServer<boolean>("customer_exists", forVisitor(req, { p_email: "", p_phone: v.args.p_phone }));
  if (byPhone.data === true) return json({ ok: false, error: "phone_taken", field: "phone" }, 409);

  const id = newCustomerId();
  const made = await rpcServer<{ session_token?: unknown }[]>("customer_signup", forVisitor(req, { p_id: id, ...v.args }), 10000);
  if (made.status < 200 || made.status >= 300) {
    const no = signupRefusal(made, v.args.p_pwd);
    let status = down(made.status) ? 502 : 400;
    if (no.error === "rate_limited") status = 429;
    else if (no.error === "email_taken") status = 409;
    return json({ ok: false, ...no }, status);
  }
  const token = Array.isArray(made.data) ? made.data[0]?.session_token : null;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,200}$/.test(token)) return json({ ok: false, error: "connection" }, 502);

  await rpcServer("customer_consents", { p_id: id, p_token: token, p_privacy: PRIVACY_VERSION, p_ride_news: v.news });
  const first = await rpcServer<boolean>("customer_set_emergency", { p_id: id, p_token: token, p_name: v.em1.name, p_phone: v.em1.phone, p_relation: v.em1.rel });
  if (first.data === true && v.em2) {
    await rpcServer("customer_set_emergency2", { p_id: id, p_token: token, p_name: v.em2.name, p_phone: v.em2.phone, p_relation: v.em2.rel });
  }
  // Signed in, as a sign-in leaves it; a session the booking app handed over for an earlier visitor goes.
  return json({ ok: true, name: v.args.p_name }, 200, [cookie(ACCOUNT_COOKIE, encodeSession({ id, token }), ACCOUNT_MAX_AGE), cookie(HANDOFF_COOKIE, "", 0)]);
}
