import { T as TM } from "@/components/testimonials/Testimonials.text";
import { serverLocalize } from "@/i18n/dicts";
import { forVisitor, rpcServer } from "@/lib/account";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { storeKey } from "@/lib/badge-cheer";
import { asLocale } from "@/lib/content-core";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { fmtDayDate } from "@/lib/tickets";
import { tmAskTitle, tmMine, tmOldArgs, tmOldAsk, tmOldEnded, tmRefusal } from "@/lib/testimonials";

// The one-time ask about an old 9 or 10 comment (the booking app's _tstAskCheck and rider-testimonial.js _tstAskRun /
// _tstAskAnswer, dfbfba44, fbd39da1, 294f2348), for the pop-up the site's pages show once nothing else waits
// (components/account/TestimonialAskLoader.tsx, after the post-ride rating's). Only while the testimonials switch is on:
// the database names a comment due only then (testimonial_mine's ask: a done ride rated 9 or 10 before the switch was
// last turned on, 40 characters or more, never a testimonial yet, for an account that never answered).
// GET  /api/account/testimonial-ask?locale=xx  {signedIn: false} | {ok: true, who, on, ask: null | {entry, body, meta},
//      names, since}: meta names the ride (its title, else its kind) and its day in the page's language; who is the
//      account's key in the browser's storage (a hash of its id). {ok: false} when the database did not answer.
// POST /api/account/testimonial-ask {entry, yes, nameMode, consent}: the answer (testimonial_old_answer). {ok: true} when
//      it ends the ask for good (taken, answered before, the ride no longer due, the switch off); else {ok: false, error}:
//      "consent", "name", "signin", "busy", "absent", "generic".
// Only this site's pages may post; a connection asks 30 times a minute at most, with the pop-ups' checks.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const sessionOf = (req: Request) => decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));

export async function GET(req: Request) {
  const s = sessionOf(req);
  if (!s) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check", undefined, s.id))) return json({ ok: false, error: "busy" }, 429);
  const locale = asLocale(new URL(req.url).searchParams.get("locale") || "en");
  const r = await rpcServer<unknown>("testimonial_mine", { p_id: s.id, p_token: s.token });
  if (r.status >= 400 && emAbsent(r)) return json({ ok: true, who: storeKey(s.id), on: false, ask: null }); // a database without testimonials yet
  if (r.status !== 200) return json({ ok: false, error: "generic" }, 502);
  const mine = tmMine(r.data);
  if (!mine) return json({ ok: false, error: tmRefusal(r.data) ?? "generic" }, tmRefusal(r.data) === "signin" ? 401 : 502);
  const a = tmOldAsk(r.data);
  const w = serverLocalize(TM, locale);
  const meta = a ? [tmAskTitle(a, locale, w.about), a.date ? fmtDayDate(a.date, locale) : ""].filter(Boolean).join(" · ") : "";
  return json({ ok: true, who: storeKey(s.id), on: mine.on, ask: a ? { entry: a.entry, body: a.body, meta } : null, names: mine.names, since: mine.since });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const s = sessionOf(req);
  if (!s) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, s.id))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const args = tmOldArgs(body);
  if (!args) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("testimonial_old_answer", forVisitor(req, { p_id: s.id, p_token: s.token, ...args }));
  if (r.status >= 400 && emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
  if (r.status !== 200) return json({ ok: false, error: "generic" }, 502);
  if (tmOldEnded(r.data)) return json({ ok: true });
  const e = tmRefusal(r.data);
  return json({ ok: false, error: e === "consent" || e === "name" || e === "signin" ? e : "generic" }, e === "signin" ? 401 : 409);
}
