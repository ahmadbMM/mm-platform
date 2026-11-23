import { T as RECORD } from "@/components/account/RideRecord.text";
import { bloodWords } from "@/content/blood-words";
import { farmBadge } from "@/content/farm-words";
import { paintBadge } from "@/content/paint-words";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { readBookings, rpcServer } from "@/lib/account";
import { cheersOf, eventDays, isCommunityBadge, storeKey, type Cheer } from "@/lib/badge-cheer";
import { asLocale } from "@/lib/content-core";
import { readPulse } from "@/lib/hub";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { referralRodeOf } from "@/lib/referral";
import { badgeList, recordRows, type BadgeItem } from "@/lib/ride-record";
import { loadBadgeData, loadRecordSessions } from "@/lib/ride-record-data";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/badge-new?locale=xx: what My Account's new-badge pop-up may show (components/account/BadgeCelebrate.tsx;
// lib/badge-cheer.ts has the rules, the booking app's _bdgCelebrate, _bdgProfCheer and _plsCheer). Read with the account's
// own session: its bookings and their sessions, its badges (as Stats and Badges read them), the friends who rode with its
// invite, its profile (Race Ready) and hub_pulse, whose Community badges not yet seen come as `community` (the newest,
// with every one brought in `seen`). Answers {signedIn: false}, or {ok: true, who, items, rode, pulse, community, seen,
// close}: who is the account's key in the browser's storage (a hash of its id), the words already in the page's language.
// {ok: false} when the bookings could not be read (no badge is judged from a part of them).
// POST /api/account/badge-new {seen: [slug]}: the Community badges just shown, marked seen on the server (hub_seen), so
// neither this site nor the booking app shows them again.
// Only this site's pages may call it; a connection asks 30 times a minute at most, with the pop-ups' checks.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const SLUG = /^[a-z0-9_]{1,64}$/;

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  const locale = asLocale(new URL(req.url).searchParams.get("locale") || "en");
  const me = { p_id: acct.id, p_token: acct.token };
  const [booked, badges, referral, pulse, prof] = await Promise.all([
    readBookings(acct), loadBadgeData({ ...acct, name: "", email: "", phone: "" }),
    rpcServer<unknown>("customer_referral", { ...me, p_make: false }), rpcServer<unknown>("hub_pulse", me),
    rpcServer<Record<string, unknown>[]>("customer_profile", me),
  ]);
  if (booked === null) return json({ ok: false, error: "generic" }, 502);
  const profile = Array.isArray(prof.data) ? prof.data[0] ?? null : null;
  const record = recordRows(booked);
  const sessions = await loadRecordSessions(record.map((r) => r.sessionId), acct);
  const rode = referralRodeOf(referral.data);
  badges.referralRode = rode;
  const today = riyadhClock(new Date()).slice(0, 10);
  const items = badgeList(record, sessions, badges, today, profile);
  const donated = new Map(booked.filter((r) => typeof r.donated_at === "string" && r.donated_at).map((r) => [String(r.id), String(r.donated_at)]));
  const days = eventDays(record, sessions, donated);

  // the words, as Stats and Badges say them (RideRecord): the app's own badges by slug, any other by its row
  const tx = serverL(locale);
  const base = serverLocalize(RECORD, locale);
  const names: Record<string, readonly string[]> = { ...base.names,
    ...(items.some((x) => x.slug === "blood_visitor") ? { blood_visitor: bloodWords(tx).visitorBadge } : {}),
    ...(items.some((x) => x.slug === "farmhouse_night" && x.on) ? { farmhouse_night: farmBadge(tx) } : {}),
      // the Tee Painting Workshop's too (content/paint-words.ts, 2026-11-24): for community members' eyes alone
      ...(items.some((x) => x.slug === "tee_painting" && x.on) ? { tee_painting: paintBadge(tx) } : {}) };
  const words = (x: BadgeItem): [string, string, string] => {
    const own = names[x.slug];
    if (own && (!x.row || x.row.system !== false)) return [String(own[0] ?? ""), String(own[1] ?? ""), String(own[2] ?? "")];
    const r = x.row;
    return [String((locale === "ar" && r?.name_ar) || r?.name || x.slug), String((locale === "ar" && r?.description_ar) || r?.description || ""), ""];
  };
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d); }
    catch { return ""; }
  };
  const list = cheersOf(items, days, words, (at) => base.givenBy.replace("{0}", day(at)));

  // the Community badges the server gave and this member has not seen: the newest pops up (hub_pulse's fresh, oldest first)
  const p = pulse.status === 200 ? readPulse(pulse.data) : null;
  const seen = p?.member ? p.fresh : [];
  let community: Cheer | null = null;
  if (seen.length) {
    const top = seen[seen.length - 1];
    const x = items.flatMap((y) => [y, ...(y.lv ?? [])]).find((y) => y.slug === top && y.on);
    if (x) { const [name, how, about] = words(x); community = { slug: x.slug, icon: x.icon, color: x.color, name, how, about, kind: "community", at: null }; }
  }
  return json({
    ok: true, who: storeKey(acct.id), rode, pulse: !!p, community, seen: community ? seen.slice(-40) : [],
    // while the pulse answers, the Community badges are its own (the app's _bdgCelebrate leaves them to it)
    items: p ? list.filter((c) => !isCommunityBadge(c.slug) && !seen.includes(c.slug)) : list,
    close: base.close,
  });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  let body: { seen?: unknown } | null = null;
  try { body = (await req.json()) as { seen?: unknown }; } catch { /* empty body */ }
  const slugs = (Array.isArray(body?.seen) ? body.seen : []).filter((s): s is string => typeof s === "string" && SLUG.test(s)).slice(0, 40);
  if (!slugs.length) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("hub_seen", { p_id: acct.id, p_token: acct.token, p_slugs: slugs });
  return json({ ok: r.status === 200 }, r.status === 200 ? 200 : 502);
}
