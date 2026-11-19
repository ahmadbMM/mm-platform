// A stand-in for the database's member functions (POST /rest/v1/rpc/<name>), in memory, for /club's members' area in a
// browser (tests-club/, playwright.club.config.ts): one signed-in Community member, "Sara Khalid" (id c-test, any token),
// her membership (member_area), the Community tab's read (hub_feed: a level challenge to pick, a Ramadan challenge done
// with its medal and the Eid ride, the club goal reached with her own share and the next Saturday's target, a Saturday
// report with its photo, a call for volunteers, the year), the Mentorship programme (mentor_feed and its writes), her
// invitation code and her bookings. hub_feed also carries the club's numbers and each session's riders, with numbers
// no page may show, so a test can look for them. A scene (POST /__reset {scene}) changes the bookings: "regular" (six
// rides done, a Saturday ride booked ahead), "new" (two rides done: the first five rides), "recap" (a ride done
// yesterday, nothing ahead, the report from that ride). The writes change the state; GET /__state reads it. Every other
// read answers empty and an unknown function as one the database does not have (404, PGRST202). Nothing here reaches a
// real database.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.STUB_PORT || 8788);
const PHOTO = `data:image/jpeg;base64,${readFileSync(new URL("../../apps/web/public/site/home/gallery-9.jpg", import.meta.url)).toString("base64")}`;
const pad = (n) => String(n).padStart(2, "0");
const ksa = () => new Date(Date.now() + 3 * 3600e3);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const day = (n) => { const d = ksa(); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthEnd = () => { const d = ksa(); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); };
const wd = (s) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${s}T12:00:00Z`).getUTCDay()];
const nextSat = () => { for (let i = 1; i < 8; i++) if (new Date(`${day(i)}T12:00:00Z`).getUTCDay() === 6) return day(i); return day(7); };

function fresh(scene = "regular") {
  const done = scene === "new" ? [-30, -12] : scene === "recap" ? [-60, -50, -40, -30, -20, -1] : [-60, -50, -40, -30, -20, -12];
  const sessions = done.map((n, i) => ({ id: `s-d${i}`, session_date: day(n), ride_kind: "saturday", event_kind: "community", paid_ride: false, needs_approval: false, bike_slots: "{}", status: "closed" }));
  const bookings = done.map((n, i) => ({ id: `e-d${i}`, session_id: `s-d${i}`, session_date: day(n), session_day: wd(day(n)), status: "done", queue_num: 3, price: 0, paid: true, name: "Sara Khalid", rating_detail: {} }));
  if (scene !== "recap") {
    sessions.push({ id: "s-sat", session_date: day(2), ride_kind: "saturday", event_kind: "community", paid_ride: false, needs_approval: false, bike_slots: JSON.stringify({ _time: "06:00-06:30" }), status: "open" });
    bookings.push({ id: "e-sat", session_id: "s-sat", session_date: day(2), session_day: wd(day(2)), status: "waiting", queue_num: 4, price: 0, paid: false, name: "Sara Khalid" });
  }
  return {
    scene, sessions, bookings,
    me: { kind: "level", levels: [2, 4, 6], target: 4, chosen: false, n: 1, ends_on: monthEnd(), sats: 4 },
    mentor: {
      ask: null, mentor: null, offers: [],
      profiles: [
        { num: 12, university: "King Abdulaziz University", field: "Computer science", offered: null },
        { num: 15, university: "Effat University", field: "Architecture", offered: null },
      ],
    },
    writes: [],
  };
}
let st = fresh();

function hubFeed() {
  return {
    ok: true, today: day(0),
    me: st.me,
    club: { scope: "saturday", target: 40, n: 44, mine: 3, from: day(-20), ends_on: monthEnd(), next: { date: nextSat(), target: 12 } },
    goals: [
      { id: "goal_ramadan_2027", name: "Ramadan challenge", name_ar: "تحدي رمضان", scope: "community", target: 4, n: 4, ends_on: day(20), badge: { slug: "ramadan_2027", icon: "crescent", color: "gold" } },
      { id: "goal_eid_2027", name: "Eid ride", name_ar: "جولة العيد", scope: "saturday", target: 1, n: 0, ends_on: day(25), badge: null },
    ],
    // the club's numbers and the report's counts: hub_feed sends them, no customer page shows them
    numbers: { last: day(-5), last_riders: 873, last_rides: 891, month: 3107, all: 54021, since: "2025-01-04" },
    post: { id: "post-1", line: "A calm sea and a full breakfast table.", line_ar: "بحر هادئ ومائدة إفطار عامرة.", riders: 871, rides: 889, first_rides: 113, leads: 117, volunteers: 119,
      prev_riders: 802, auto: false, kind: "saturday", mine: 2, date: st.scene === "recap" ? day(-1) : day(-12), img: true },
    announce: [], volunteer: "s-vol", birthday: false, awarded: [],
    year: { year: Number(day(0).slice(0, 4)), full: false, sessions: 14, saturdays: 9, first: "2026-03-07", kinds: ["saturday", "rental", "swim"], busiest: "2026-10",
      sats_held: 30, club: 24019, club_first: "2026-02-07", badges: 3 },
    going: { "s-sat": { n: 457, first: 129 } },
  };
}

const READS = {
  customer_profile: () => [{ id: "c-test", name: "Sara Khalid", email: "sara@example.com", phone: "+966500000001", gender: "female", birth_date: "1994-03-02" }],
  customer_seen: () => null,
  member_area: () => ({
    ok: true, member: true, first_name: "Sara", since: "2025-06-01T00:00:00Z", credits: 120, tier: 1, next: 300, rides: st.bookings.filter((b) => b.status === "done").length, group_rides: 4,
    last: st.bookings.filter((b) => b.status === "done").reverse().slice(0, 5).map((b) => ({ date: b.session_date, title: "", kind: "saturday", rated: true })),
    upcoming: st.scene === "recap" ? [] : [{ id: "s-sat", date: day(2), title: "", kind: "saturday", time: "06:00 - 06:30", booked: true }],
    birth_date: "1994-03-02", announcements: [],
  }),
  hub_feed: () => hubFeed(),
  hub_post_img: (a) => (a.p_post === "post-1" ? PHOTO : null),
  mentor_feed: () => ({ ok: true, ...st.mentor }),
  member_invite_code: () => ({ ok: true, code: "INV7Q2" }),
  my_bookings: () => st.bookings,
  list_sessions: (_a, q) => {
    const ids = /id=in\.\(([^)]*)\)/.exec(decodeURIComponent(q))?.[1]?.split(",") ?? null;
    return ids ? st.sessions.filter((s) => ids.includes(s.id)) : [];
  },
  community_member: () => true,
  customer_my_badges: () => [],
};
const ok = { ok: true };
const WRITES = {
  hub_pick_level: (a) => {
    if (!st.me.levels.includes(a.p_level)) return { ok: false, error: "level" };
    if (st.me.chosen && st.me.target !== a.p_level) return { ok: false, error: "chosen" };
    st.me = { ...st.me, target: a.p_level, chosen: true };
    return ok;
  },
  mentor_join: (a) => {
    if (a.p_ok !== true) return { ok: false, error: "consent" };
    st.mentor.mentor = { university: a.p_university, field: a.p_field, work: a.p_work, places: a.p_places, helps: a.p_helps, about: a.p_about };
    return ok;
  },
  mentor_offer: (a) => {
    if (!st.mentor.mentor) return { ok: false, error: "register" };
    const p = st.mentor.profiles.find((x) => x.num === a.p_num);
    if (!p) return { ok: false, error: "gone" };
    p.offered = "offered";
    st.mentor.offers.push({ id: `o-${p.num}`, num: p.num, university: p.university, field: p.field, status: "offered", name: null, wa: null, at: null, due: false });
    return ok;
  },
  mentor_ask: (a) => {
    if (a.p_ok !== true) return { ok: false, error: "consent" };
    st.mentor.ask = { num: null, status: "pending", university: a.p_university, field: a.p_field, city: a.p_city, country: a.p_country, class_year: a.p_class_year,
      helps: a.p_helps, goal: a.p_goal, gender_pref: a.p_gender_pref, proposed: [], matches: [] };
    return ok;
  },
  mentor_leave: (a) => {
    if (a.p_offer === null) { st.mentor.ask = null; return ok; }
    const o = st.mentor.offers.find((x) => x.id === a.p_offer);
    if (!o) return { ok: false, error: "gone" };
    st.mentor.offers = st.mentor.offers.filter((x) => x !== o);
    const p = st.mentor.profiles.find((x) => x.num === o.num); if (p) p.offered = null;
    return ok;
  },
  mentor_quit: () => { st.mentor.mentor = null; return ok; },
  mentor_answer: () => ok,
  mentor_check: () => ok,
};

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    let a = {};
    try { a = raw ? JSON.parse(raw) : {}; } catch { a = {}; }
    if (url.pathname === "/__reset") { st = fresh(a.scene); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__state") return send(res, 200, st);
    const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (m) {
      const fn = m[1];
      if (fn in WRITES) { st.writes.push({ fn, a }); return send(res, 200, WRITES[fn](a)); }
      if (fn in READS) return send(res, 200, READS[fn](a, url.search));
      return send(res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }
    if (url.pathname.startsWith("/rest/v1/")) return send(res, 200, []);
    return send(res, 404, { message: "not here" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub club db on ${PORT}`));
