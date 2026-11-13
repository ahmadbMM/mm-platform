import { cookies } from "next/headers";
import qrcode from "qrcode-generator";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "./account-core";
import { forVisitor, rpcServer } from "./account";
import { ASK_NONE, askList, askScreen, askSlugOk, askView, type AskCard, type AskFull, type AskView } from "./ask";
import { emAbsent } from "./emergency";
import { cookieValue } from "./live";
import { withinLimit } from "./rate-limit";

// "Ask" on the server (lib/ask.ts has the logic): the pages' reads and the API routes' shared parts. The account's
// session stays here - the HttpOnly cookie is read on the server and its token goes to the database, never to the
// browser. A database that does not have the functions yet (PGRST202: the migration is not applied) or does not answer
// reads as "no such page", never as an error page.

/** The account cookie's session in a page (a server component), or null. */
export async function askSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
}
/** The same from an API route's request. */
export const sessionOf = (req: Request): Session | null => decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));

/** A page's screen key as an address carries it (?k=): the big screen's, and a staff preview's. Any run of letters,
 *  digits and the marks a key is written with (hex, a UUID, either base64) is taken as one - the database decides
 *  whether it opens anything; anything else is no key. */
export function askKey(v: unknown): string | null {
  const k = Array.isArray(v) ? v[0] : v;
  return typeof k === "string" && /^[A-Za-z0-9._~+/=-]{6,200}$/.test(k) ? k : null;
}

const who = (s: Session | null) => (s ? { p_id: s.id, p_token: s.token } : {});

/** ask_page for this viewer. `answered` is false when the database did not answer at all (a timeout, a network
 *  error, a 5xx): the view is then "none" for a page being opened, and a page already open keeps what it shows. */
export async function readAskPage(slug: string, session: Session | null, key: string | null, req?: Request): Promise<{ view: AskView; raw: unknown; answered: boolean }> {
  if (!askSlugOk(slug)) return { view: ASK_NONE, raw: { state: "none" }, answered: true };
  const args: Record<string, unknown> = { p_slug: slug, ...who(session), ...(key ? { p_key: key } : {}) };
  const r = await rpcServer<unknown>("ask_page", req ? forVisitor(req, args) : args);
  if (r.status === 200) return { view: askView(r.data), raw: r.data, answered: true };
  return { view: ASK_NONE, raw: { state: "none" }, answered: r.status >= 400 && r.status < 500 };
}

/** ask_list for this viewer. `answered`: the database answered (false: nothing is known, not even whether the
 *  session is good, so the page does not ask a signed-in rider to sign in). */
export async function readAskList(session: Session | null): Promise<{ signed: boolean; pages: AskCard[]; answered: boolean }> {
  const r = await rpcServer<unknown>("ask_list", who(session));
  return r.status === 200 ? { ...askList(r.data), answered: true } : { signed: false, pages: [], answered: false };
}

/** ask_screen: the page for the big screen, or null for a key the database refuses (or no answer). */
export async function readAskScreen(slug: string, key: string | null): Promise<AskFull | null> {
  if (!askSlugOk(slug) || !key) return null;
  const r = await rpcServer<unknown>("ask_screen", { p_slug: slug, p_key: key });
  return r.status === 200 ? askScreen(r.data) : null;
}

/** A QR code's modules for the big screen (lib/qr-paint.ts paints them): n by n, "1" a dark module, row by row. The
 *  library stays on the server; only the modules reach the browser. */
export function qrModules(text: string): { n: number; bits: string } {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let bits = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits += qr.isDark(r, c) ? "1" : "0";
  return { n, bits };
}

/* ------------------------------------------------------------------ the API routes' shared parts */

export const askJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

/** GET /api/ask/<slug>[?k=<key>]: ask_page read again with the account cookie - after an answer the database did not
 *  list back, when the live key has run out, and when a poll says the page itself changed. Answers {ok: true, page}
 *  (ask_page's own answer; a database without the function: {state: "none"}), or {ok: false, error: "busy"} past the
 *  minute's requests and {ok: false, error: "generic"} when the database did not answer - the page then keeps what it
 *  shows. One account asks 30 times a minute at most, and so does one connection with no account (lib/rate-limit.ts). */
export async function askPageGet(req: Request, slug: string): Promise<Response> {
  const session = sessionOf(req);
  if (!(await withinLimit(req, "ask", undefined, session?.id))) return askJson({ ok: false, error: "busy" }, 429);
  const { raw, answered } = await readAskPage(slug, session, askKey(new URL(req.url).searchParams.get("k")), req);
  return answered ? askJson({ ok: true, page: raw }) : askJson({ ok: false, error: "generic" }, 502);
}

type Call = { fn: string; args: (s: Session, body: Record<string, unknown>) => Record<string, unknown> | null };

/** POST /api/ask/send, /unsend and /vote: one of the account's own actions, sent to its database function with the
 *  cookie's id and token. Only this site's pages may call it, signed in. Answers the function's own JSON ({ok: true,
 *  ...} or {ok: false, error: <the contract's code>}), or {ok: false, error}: "origin", "signin" (no session cookie),
 *  "busy" (30 a minute an account), "invalid" (a body that is not the action's), "generic" (no answer, or a database
 *  that does not have the function yet). */
export async function askPost(req: Request, call: Call): Promise<Response> {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return askJson({ ok: false, error: "origin" }, 403);
  const session = sessionOf(req);
  if (!session) return askJson({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "ask", undefined, session.id))) return askJson({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const args = call.args(session, body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {});
  if (!args) return askJson({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>(call.fn, forVisitor(req, args));
  if (r.status !== 200) return askJson({ ok: false, error: "generic" }, r.status >= 400 && r.status < 500 && emAbsent(r) ? 404 : 502);
  const data = r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, unknown>) : null;
  if (!data) return askJson({ ok: false, error: "generic" }, 502);
  if (data.ok === true) return askJson(data);
  return askJson({ ok: false, error: typeof data.error === "string" ? data.error : "generic" }, data.error === "signin" ? 401 : 409);
}

/** An answer's or a question's id in a request: a whole number above zero. */
export const askId = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);
