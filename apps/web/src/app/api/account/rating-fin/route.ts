import { T as RECORD } from "@/components/account/RideRecord.text";
import { serverLocalize } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { readBookings, rpcServer } from "@/lib/account";
import { asLocale } from "@/lib/content-core";
import { firstFive, firstFiveIds } from "@/lib/first-five";
import { finBadge, finProgress, readPulse, type Fin } from "@/lib/hub";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { ENTRY_ID, pendingRating } from "@/lib/rating";
import { BADGE_SYS, type BadgeRow, type RecordSession } from "@/lib/ride-record";
import { loadRecordSessions } from "@/lib/ride-record-data";
import { loadSiteContent, pageOn } from "@/lib/site";
import { riyadhClock } from "@/lib/workshop-days";

// POST /api/account/rating-fin {entryId, locale}: the post-ride rating's last screen (the booking app's _rgFinFor,
// 2026-11-13, the Community tab reach build's R5), asked by the rating pop-up (RatingGate.tsx) once a rating has
// landed. Only for the last ride waiting to be rated (another one waiting: its own pop-up comes next, and nothing
// here), and only with something to show, read with the account's own session (hub_pulse, which also gives any
// Community badge now due):
// - a Community badge the server gave that the member has not seen, the newest (its name and drawing from the
//   account's badges or the catalogue, as My Account names it); every one brought is then marked seen (hub_seen), so
//   neither this site nor the booking app shows it again;
// - else the first five rides (lib/first-five.ts, the new features build F1): a bike ride rated by a rider with 1 to 4
//   rides, counted from the account's own bookings with their sessions' kinds (as My Account counts Your rides);
// - else the month's challenge, once the member has a session in it and the ride rated is in its month;
// - else the season challenge running, once it has a session in it.
// A rider who is not a Community member gets the first five rides alone, without the Community button (mem false); a
// rider on that path with nothing booked ahead gets Book too, beside a badge as well (book), while staff have
// Experiences switched on. When hub_pulse gives no
// answer, community_member (the booking app's commAccess) says whether the path keeps its Community button.
// {fin: null} for anything else, a database without hub_pulse (unless the path shows), or one that did not answer.
// Only this site's pages may call it; a connection asks 30 times a minute at most, with the pop-ups' checks
// (lib/rate-limit.ts).
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
  const today = riyadhClock(new Date()).slice(0, 10);
  const [bookings, pulse] = await Promise.all([readBookings(acct), rpcServer<unknown>("hub_pulse", me)]);
  if (!bookings || pendingRating(bookings, today)) return none();
  const rated = bookings.find((r) => r.id === entryId);
  if (!rated) return none();
  const p = pulse.status === 200 ? readPulse(pulse.data) : null;
  const fresh = p?.member ? p.fresh : [];
  // the sessions of the finished bookings (the path's count) beside the badges a fresh one is looked up in
  const ids = firstFiveIds(bookings);
  const [sessions, badges] = await Promise.all([
    ids.length ? loadRecordSessions(ids, acct) : Promise.resolve(new Map<string, RecordSession>()),
    fresh.length ? Promise.all([rpcServer<unknown>("customer_my_badges", me), rpcServer<unknown>("badge_catalog", {})]) : Promise.resolve(null),
  ]);
  // counted only once every finished booking's session came back (a read cut short would count a long-standing rider's
  // free rides as none, as the booking app counts only from a whole read); Book only while Experiences is switched on
  const f5 = ids.every((id) => sessions.has(id)) ? firstFive(bookings, entryId, sessions, today) : null;
  const book = !!f5?.book && pageOn(await loadSiteContent(), "experiences");
  const path: Fin | null = f5 ? { k: "p5", n: f5.n, tg: f5.tg, ...(book ? { book: true } : {}) } : null;
  if (!p) {
    // no pulse: the path alone, its Community button only for an account community_member says is a member
    if (!path) return none();
    const m = await rpcServer<unknown>("community_member", me);
    return json({ fin: m.status === 200 && m.data === true ? path : { ...path, mem: false } });
  }
  if (!p.member) return json({ fin: path && { ...path, mem: false } });
  let fin: Fin | null = null;
  if (badges) {
    const [mine, cat] = badges;
    const b = finBadge(fresh[fresh.length - 1], [rows(mine.data), rows(cat.data)], serverLocalize(RECORD, locale).names, locale, BADGE_SYS);
    if (b) {
      fin = path?.book ? { ...b, book: true } : b;
      await rpcServer<unknown>("hub_seen", { ...me, p_slugs: fresh.slice(-40) });
    }
  }
  return json({ fin: fin ?? path ?? finProgress(p, (S(rated.session_date) || S(rated.session_id)).slice(0, 10), locale) });
}
