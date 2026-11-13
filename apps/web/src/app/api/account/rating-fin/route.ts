import { T as RECORD } from "@/components/account/RideRecord.text";
import { serverLocalize } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { readBookings, rpcServer } from "@/lib/account";
import { asLocale } from "@/lib/content-core";
import { finBadge, finProgress, readPulse, type Fin } from "@/lib/hub";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { ENTRY_ID, pendingRating } from "@/lib/rating";
import { BADGE_SYS, type BadgeRow } from "@/lib/ride-record";
import { riyadhClock } from "@/lib/workshop-days";

// POST /api/account/rating-fin {entryId, locale}: the post-ride rating's last screen (the booking app's _rgFinFor,
// 2026-11-13, the Community tab reach build's R5), asked by the rating pop-up (RatingGate.tsx) once a rating has
// landed. Only for the last ride waiting to be rated (another one waiting: its own pop-up comes next, and nothing
// here), and only for a Community member with something to show, read with the account's own session (hub_pulse,
// which also gives any Community badge now due):
// - a Community badge the server gave that the member has not seen, the newest (its name and drawing from the
//   account's badges or the catalogue, as My Account names it); every one brought is then marked seen (hub_seen), so
//   neither this site nor the booking app shows it again;
// - else the month's challenge, once the member has a session in it and the ride rated is in its month;
// - else the season challenge running, once it has a session in it.
// {fin: null} for anything else, a database without hub_pulse, or one that did not answer. Only this site's pages may
// call it; a connection asks 30 times a minute at most, with the pop-ups' checks (lib/rate-limit.ts).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const none = (status = 200) => json({ fin: null }, status);
const S = (v: unknown) => (typeof v === "string" ? v : "");
const rows = (v: unknown): BadgeRow[] => (Array.isArray(v) ? (v as BadgeRow[]).filter((b) => b && typeof b.slug === "string") : []);

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return none(403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return none(401);
  if (!(await withinLimit(req, "account-check"))) return none(429);
  type Body = { entryId?: unknown; locale?: unknown };
  let body: Body | null = null;
  try { body = (await req.json()) as Body; } catch { /* empty body */ }
  const entryId = S(body?.entryId), locale = asLocale(S(body?.locale));
  if (!ENTRY_ID.test(entryId)) return none(400);
  const me = { p_id: acct.id, p_token: acct.token };
  const [bookings, pulse] = await Promise.all([readBookings(acct), rpcServer<unknown>("hub_pulse", me)]);
  if (!bookings || pendingRating(bookings, riyadhClock(new Date()).slice(0, 10))) return none();
  const rated = bookings.find((r) => r.id === entryId);
  const p = pulse.status === 200 ? readPulse(pulse.data) : null;
  if (!rated || !p || !p.member) return none();
  let fin: Fin | null = null;
  if (p.fresh.length) {
    const [mine, cat] = await Promise.all([rpcServer<unknown>("customer_my_badges", me), rpcServer<unknown>("badge_catalog", {})]);
    fin = finBadge(p.fresh[p.fresh.length - 1], [rows(mine.data), rows(cat.data)], serverLocalize(RECORD, locale).names, locale, BADGE_SYS);
    if (fin) await rpcServer<unknown>("hub_seen", { ...me, p_slugs: p.fresh.slice(-40) });
  }
  return json({ fin: fin ?? finProgress(p, (S(rated.session_date) || S(rated.session_id)).slice(0, 10), locale) });
}
