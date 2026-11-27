// A stand-in for the database's customer functions (POST /rest/v1/rpc/<name>), in memory, for the account pages' browser
// test (tests/account-menu.spec.ts, playwright.account.config.ts): one signed-in rider, "Sara Khalid" (id c-test, any
// token), her profile, contacts, wallet, invite code, bookings (a ride in two days, a circuit night in five, one done, one
// cancelled), a workshop appointment ahead and one done, a locker taken alone, a volunteer shift, desk purchases, ride news
// on and three updates (one unread). The writes the pages make change it (customer_update_profile, customer_set_about,
// customer_consents, company_challenge_join, testimonial_old_answer ...). Every other read answers empty (the site's own
// content: its defaults), and a function it does not know answers as one the database does not have (404, PGRST202).
// Test-only routes (POST /__reset, POST /__scene with any of {learner, freshBadge, tmAsk, member, owes}, GET /__state) set and
// read the scene; they are not part of any real API.
// POST /__reset {scene: "manage"} sets the scene the ticket's changes are tried on (tests-account/manage.spec.ts): the
// circuit night in five days held by Sara and Omar Khalid with an add-on and a locker, a night in six on its waitlist, two
// more open nights to move to, the add-ons the night sells, and the lockers; customer_booking_update, customer_create_booking,
// customer_addon_stock and the customer_locker_* functions change it as the database would, in outline.
// The distance leaderboards' functions (distance_board, customer_distances, customer_distance_claim / _withdraw) answer for tests-account/leaderboard.spec.ts.
// Nothing here reaches a real database.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8797);
const pad = (n) => String(n).padStart(2, "0");
const ksa = () => new Date(Date.now() + 3 * 3600e3);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const day = (n) => { const d = ksa(); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const wd = (s) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${s}T12:00:00Z`).getUTCDay()];

function fresh() {
  return {
    profile: { id: "c-test", name: "Sara Khalid", email: "sara@example.com", phone: "+966500000001", height: 168, type_preference: "Hybrid", birth_date: "1994-03-02",
      country: "Saudi Arabia", city: "Jeddah", nationality: "Saudi Arabia", gender: "female", photo: null, socials: null, hidden_types: null, default_pay: null },
    about: { profession: "Architect", workplace: "", heard_from: "instagram", sign_in: null },
    emergency: { emergency_name: "Ali Saleh", emergency_phone: "+966500000002", emergency_relation: "sibling", emergency2_name: null, emergency2_phone: null, emergency2_relation: null },
    whatsapp: { phone: "+966500000001", whatsapp_same: true, whatsapp: null },
    blood: "B-",
    sport: { competes: false, federations: [], other: null, asked: false },
    deletion: null,
    rideNews: true,
    updates: [
      { id: 3, kind: "waitlist", title: "A place is free", body: "Take your place on Saturday's ride.", at: new Date(Date.now() - 2 * 3600e3).toISOString(), url: "/?claim=0123456789abcdef0123456789abcdef", read: false },
      { id: 2, kind: "reminder", title: "Your ride is tomorrow", body: "Meet at the circuit at 8 PM.", at: `${day(-2)}T15:00:00Z`, url: "/my-bookings?tk=e-jcc1", read: true },
      { id: 1, kind: "note", title: "From the team", body: "Thank you for riding with us.", at: `${day(-9)}T09:00:00Z`, url: null, read: true },
    ],
    company: [],
    tmAnswered: null,
    badgeAt: new Date(Date.now() - 20 * 3600e3).toISOString(), // when staff gave the scene's badge: yesterday
    // the scene: a learner on a lesson, a badge staff gave yesterday, an old comment due, a Community member
    scene: { learner: false, freshBadge: false, tmAsk: false, member: false, owes: false },
    writes: [],
    mscene: "", // the ticket-changes scene (manage), apart from the account scene above
    bookings: BOOKINGS(),
    lockers: [{ id: "lk-1", booking_id: null, day: day(4), period: "both", code: "B7", name: "Sara Khalid", status: "reserved", pay: "wallet", paid: true }],
    stock: {},
    // the distance leaderboards (rentals 20261127180000, 20261128150000): Sara's own distances, one staff entered with no date
    claims: [{ id: 5, kind: "ride", km: 64, d: day(-20), from: null, status: "approved", source: "staff", reply: null, at: `${day(-19)}T10:00:00Z` },
      { id: 4, kind: "total", km: 1500, d: null, from: null, status: "approved", source: "staff", reply: null, at: `${day(-30)}T10:00:00Z` }],
  };
}
let st; // set once the bookings below are defined

// ── The scene for the ticket's changes ──
const LK_ID = "0b0e8c1e-5a7d-4f6e-9b1a-1c2d3e4f5a60";
const ITEMS = [
  { id: "gel1", name: "Orange Energy Gel", brand: "HIGH5", photo: null, price: 12, qty: 5, category: "EnergyGels" },
  { id: "bar1", name: "Salted Caramel Protein Bar", brand: "Barebells", photo: null, price: 15, qty: 9, category: "ProteinBars" },
];
function manageScene() {
  const s = fresh();
  s.mscene = "manage";
  s.stock = Object.fromEntries(ITEMS.map((x) => [x.id, x.qty]));
  s.bookings = [
    ...s.bookings.filter((b) => b.id !== "e-jcc1"),
    { id: "e-jcc1", session_id: "s-jcc", session_date: day(5), session_day: wd(day(5)), status: "waiting", queue_num: 11, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid", height: 168, size: "S",
      addons: JSON.stringify([{ id: "gel1", qty: 1, p: 12 }, { id: "locker", qty: 1, p: 10 }]) },
    { id: "e-jcc2", session_id: "s-jcc", session_date: day(5), session_day: wd(day(5)), status: "waiting", queue_num: 12, price: 75, paid: false, name: "Omar Khalid", type_preference: "Road", height: 180, size: "L" },
    { id: "e-wl1", session_id: "s-wl", session_date: day(6), session_day: wd(day(6)), status: "waitlist", queue_num: 21, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid", height: 168, size: "S" },
  ];
  s.lockers.push({ id: LK_ID, booking_id: "e-jcc1", day: day(5), period: "late", code: "7", name: "Sara Khalid", status: "reserved", price: 10, on_bill: true, pay: null, paid: false, bill_paid: false });
  return s;
}
const MANAGE_SESSIONS = () => [
  { id: "s-jcc2", session_date: day(7), day: wd(day(7)), title: null, ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }),
    needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "open", location: null, breakfast_name: null, breakfast_url: null, price: null, capacity: 12 },
  { id: "s-wl", session_date: day(6), day: wd(day(6)), title: null, ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }),
    needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "full", location: null, breakfast_name: null, breakfast_url: null, price: null, capacity: 12 },
];
const sessionsNow = () => {
  const list = SESSIONS();
  if (st.mscene !== "manage") return list;
  return [...list.map((x) => (x.id === "s-jcc" ? { ...x, addons: ["gel1", "bar1"], capacity: 12, lockers: true } : x)), ...MANAGE_SESSIONS()];
};
const lineOf = (b) => { try { return JSON.parse(b.addons || "[]"); } catch { return []; } };
const setLocker = (b, fee) => {
  const rest = lineOf(b).filter((x) => x.id !== "locker");
  b.addons = JSON.stringify(fee ? [...rest, { id: "locker", qty: 1, p: fee }] : rest);
};
const MANAGE_WRITES = {
  customer_booking_update: (a) => {
    const b = st.bookings.find((x) => x.id === a.p_entry_id);
    if (!b) return false;
    const p = a.p_patch || {};
    if (p.status === "cancelled") {
      if (!["waiting", "waitlist"].includes(b.status)) return false;
      Object.assign(b, { status: "cancelled", cancelled_by: "customer", cancel_reason: p.cancel_reason ?? null, cancel_note: p.cancel_note ?? null });
      for (const l of st.lockers) if (l.booking_id === b.id && l.status === "reserved") l.status = "cancelled";
      return true;
    }
    if (p.session_id && p.session_id !== b.session_id) {
      const to = sessionsNow().find((x) => x.id === p.session_id);
      if (!to || !["open", "full"].includes(to.status)) return false;
      const n = Math.max(0, ...st.bookings.filter((x) => x.session_id === to.id).map((x) => x.queue_num || 0)) + 1;
      Object.assign(b, { session_id: to.id, session_date: to.session_date, session_day: to.day, queue_num: n, status: to.status === "full" ? "waitlist" : "waiting" });
      for (const l of st.lockers) if (l.booking_id === b.id) l.day = to.session_date;
    }
    for (const k of ["height", "size", "type_preference", "addons"]) if (k in p) b[k] = p[k];
    return true;
  },
  customer_create_booking: (a) => {
    const out = [];
    for (const e of a.p_entries || []) {
      const n = Math.max(0, ...st.bookings.filter((x) => x.session_id === e.session_id).map((x) => x.queue_num || 0)) + 1;
      const id = `e-new${st.bookings.length + 1}`;
      st.bookings.push({ ...e, id, queue_num: n, price: 75 });
      out.push({ id, queue_num: n, status: e.status, waitlist_num: null, price: 75 });
    }
    return out;
  },
  customer_addon_stock: (a) => { for (const it of a.p_items || []) st.stock[it.id] = (st.stock[it.id] ?? 0) + it.delta; return true; },
  customer_locker_reserve: (a) => {
    const codes = a.p_codes || a.p_booking_ids.map((_, i) => String(12 + i));
    const lockers = a.p_booking_ids.map((id, i) => {
      const b = st.bookings.find((x) => x.id === id);
      const fee = a.p_period === "both" ? 15 : 10;
      st.lockers.push({ id: `0b0e8c1e-5a7d-4f6e-9b1a-1c2d3e4f5a7${i}`, booking_id: id, day: b.session_date, period: a.p_period, code: codes[i], name: b.name, status: "reserved", price: fee, on_bill: true, pay: null, paid: false, bill_paid: false });
      setLocker(b, fee);
      return { booking_id: id, code: codes[i] };
    });
    return { ok: true, lockers, rows: [] };
  },
  customer_locker_change: (a) => {
    const l = st.lockers.find((x) => x.id === a.p_rental);
    if (!l) return null;
    Object.assign(l, { period: a.p_period, code: a.p_code, price: a.p_period === "both" ? 15 : 10 });
    const b = st.bookings.find((x) => x.id === l.booking_id);
    if (b) setLocker(b, l.price);
    return { ok: true, id: l.id, code: l.code, period: l.period, price: l.price, paid: false };
  },
  customer_locker_cancel: (a) => {
    for (const l of st.lockers) if (a.p_booking_ids.includes(l.booking_id) && l.status === "reserved") {
      l.status = "cancelled";
      const b = st.bookings.find((x) => x.id === l.booking_id);
      if (b) setLocker(b, 0);
    }
    return { ok: true, rows: [] };
  },
};
const MANAGE_READS = {
  customer_locker_offer: (a) => (a.p_session === "s-jcc" && st.mscene === "manage"
    ? { kind: "jcc", one: 10, both: 15, left: { early: 16, late: 15, both: 15, pm: 15 }, ended: { early: false, late: false, both: false, pm: false } } : { kind: "" }),
  locker_board: () => ({
    day: day(5), kind: "jcc", one: 10, both: 15,
    units: Array.from({ length: 18 }, (_, i) => ({ code: String(i + 1), out: i === 8 })).filter((u) => u.code !== "14"),
    taken: { e: ["3"], l: ["3", ...st.lockers.filter((l) => l.status === "reserved" && l.booking_id && l.code).map((l) => l.code)] },
  }),
};

const SESSIONS = () => [
  { id: "s-sat", session_date: day(2), day: wd(day(2)), title: null, ride_kind: "saturday", event_kind: "community", bike_slots: JSON.stringify({ _time: "06:00-06:30" }),
    needs_approval: false, hide_queue: false, meet_url: null, paid_ride: false, open_to_all: true, status: "open", location: null, breakfast_name: null, breakfast_url: null, price: null },
  { id: "s-jcc", session_date: day(5), day: wd(day(5)), title: null, ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }),
    needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "open", location: null, breakfast_name: null, breakfast_url: null, price: null },
  { id: "s-old", session_date: day(-12), day: wd(day(-12)), title: null, ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }),
    needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "closed", location: null, breakfast_name: null, breakfast_url: null, price: null },
  { id: "s-cx", session_date: day(9), day: wd(day(9)), title: null, ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }),
    needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "open", location: null, breakfast_name: null, breakfast_url: null, price: null },
];
const BOOKINGS = () => [
  { id: "e-sat1", session_id: "s-sat", session_date: day(2), session_day: wd(day(2)), status: "waiting", queue_num: 4, price: 0, paid: false, name: "Sara Khalid", type_preference: "Hybrid" },
  { id: "e-jcc1", session_id: "s-jcc", session_date: day(5), session_day: wd(day(5)), status: "waiting", queue_num: 11, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid" },
  { id: "e-old1", session_id: "s-old", session_date: day(-12), session_day: wd(day(-12)), status: "done", queue_num: 7, price: 75, paid: true, name: "Sara Khalid", type_preference: "Hybrid", rating_detail: {} },
  { id: "e-cx1", session_id: "s-cx", session_date: day(9), session_day: wd(day(9)), status: "cancelled", cancelled_by: "customer", queue_num: 3, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid" },
];
st = fresh();
// The distance leaderboards (tests-account/leaderboard.spec.ts): each board's rows, men and women apart; on Longest ride Sara
// (a woman) shares second place, with Silver; every row with its full name (2026-11-28), one with none.
const BOARD = (b, g) => {
  if (g === "male") return [{ r: 1, km: b === "lifetime" ? 3200 : 150, name: "Omar-Al_Harbi Khalid", medal: b === "longest" ? 1 : null, mine: false }, { r: 2, km: b === "lifetime" ? 2100 : 110, name: null, medal: b === "longest" ? 2 : null, mine: false }];
  if (b === "longest") return [{ r: 1, km: 120, name: "Noor Ahmed", medal: 1, mine: false }, { r: 2, km: 90.5, name: "Sara Khalid", medal: 2, mine: true }, { r: 2, km: 90.5, name: null, medal: null, mine: false }];
  return [{ r: 1, km: b === "lifetime" ? 1800 : 600, name: "Noor Ahmed", medal: null, mine: false }];
};
const READS = {
  distance_board: (a) => {
    const b = ["longest", "month", "lifetime", "year"].includes(a.p_board) ? a.p_board : "longest", g = a.p_gender === "female" ? "female" : "male";
    const rows = BOARD(b, g).map((r) => ({ ...r, mine: r.mine && !!a.p_id })), me = rows.find((r) => r.mine);
    return { ok: true, board: b, gender: g, rows, ...(a.p_id ? { me: { ...(me ? { r: me.r, km: me.km } : {}), member: true, gender: "female" } } : {}) };
  },
  customer_distances: () => ({ ok: true, best: 90.5, at: day(-3), lifetime: 640, year: 410.4, member: true, medal: 2, claims: st.claims }),
  customer_profile: () => [st.profile],
  customer_seen: () => null,
  customer_about: () => [st.about],
  customer_emergency: () => [st.emergency],
  customer_whatsapp: () => [st.whatsapp],
  customer_blood_type: () => st.blood,
  customer_sport: () => [st.sport],
  sport_option_list: () => [],
  customer_wallet: () => ({ balance: 70, rows: [{ id: 1, amount: 70, kind: "topup", created_at: `${day(-20)}T15:00:00Z` }] }),
  customer_referral: () => ({ ok: true, on: true, code: "K7MQ2X", joined: 2, rode: 1, earned: 0, rewards: [], referred: false, can_enter: false, pct: 50, days: 30 }),
  ambassador_mine: () => ({ ok: true, ambassador: false }),
  volunteer_me: () => ({ id: "c-test", hours: 6, status: "active", promote: false, open_count: 0, record: [{ id: 1, hours: 6, on: day(-30), title: "Saturday ride" }],
    mine: [{ id: "v1", title: "Blood Donation", date: day(8), time: "16:00", status: "accepted", cancelled: false }] }),
  customer_purchases: () => [
    { id: "p1", at: `${day(-12)}T18:10:00Z`, name: "Water", category: "drinks", qty: 2, price: 3, pay: "paid", receipt_id: "r1", session_date: day(-12), session_title: null, voided: false, refunded: false },
    { id: "p2", at: `${day(-12)}T18:12:00Z`, name: "Energy bar", category: "food", qty: 1, price: 8, pay: "paid", receipt_id: "r1", session_date: day(-12), session_title: null, voided: false, refunded: false },
    { id: "p3", at: `${day(-40)}T17:00:00Z`, name: "Bike gloves", category: "gear", qty: 1, price: 45, pay: "paid", receipt_id: "r0", session_date: null, session_title: null, voided: false, refunded: true },
  ],
  customer_workshop_jobs: () => [
    { id: 42, ref: "W-0042", status: "confirmed", service: "Full service", preferred_date: day(3), preferred_time: "17:00", scheduled_for: null, lane: "dropoff", price_quoted: 150, price_final: null, bike: "Trek FX 3", created_at: `${day(-1)}T10:00:00Z` },
    { id: 17, ref: "W-0017", status: "completed", service: "Tune-up", preferred_date: day(-25), preferred_time: "18:00", scheduled_for: null, lane: "wait", price_quoted: 90, price_final: 90, bike: null, created_at: `${day(-27)}T10:00:00Z` },
  ],
  company_challenge_mine: () => ({ ok: true, rows: st.company, open: st.company.length > 0 }),
  calendar_link: () => ({ ok: false }),
  customer_deletion_request: (a) => {
    if (a.p_request === true) st.deletion = new Date().toISOString();
    if (a.p_request === false) st.deletion = null;
    return { requested_at: st.deletion };
  },
  customer_lockers: () => st.lockers.filter((l) => l.status !== "cancelled"),
  learn_ladder: () => (st.scene.learner ? {
    ok: true,
    skills: [
      { key: "b1", level: 1, name: { en: "Glide with both feet up", ar: "الانزلاق بالقدمين مرفوعتين" } }, { key: "b2", level: 1, name: { en: "Look ahead, not down", ar: "النظر إلى الأمام" } },
      { key: "p1", level: 2, name: { en: "Start from a stop", ar: "الانطلاق من التوقف" } }, { key: "p2", level: 2, name: { en: "Pedal in a straight line", ar: "التبديل في خط مستقيم" } },
      { key: "s1", level: 3, name: { en: "Turn in a wide circle", ar: "الدوران في دائرة واسعة" } }, { key: "s2", level: 3, name: { en: "Brake to a stop", ar: "الفرملة حتى التوقف" } },
      { key: "c1", level: 4, name: { en: "One lap of the circuit", ar: "لفة واحدة في الحلبة" } },
    ],
    learners: [
      { who: "self", name: null, lesson_at: `${day(-3)}T13:00:00Z`, feedback: "Great balance already. Keep your eyes up when you pedal.", ticked: { b1: `${day(-3)}T13:20:00Z`, b2: `${day(-3)}T13:30:00Z`, p1: `${day(-3)}T13:50:00Z` } },
      { who: "child", name: "Omar", lesson_at: `${day(-3)}T13:00:00Z`, feedback: "", ticked: {} },
    ],
  } : { ok: true, skills: [], learners: [] }),
  customer_consents: (a) => {
    if (a.p_ride_news === true || a.p_ride_news === false) st.rideNews = a.p_ride_news;
    return { privacy_version: "2026-11-18", privacy_at: `${day(-30)}T10:00:00Z`, ride_news: st.rideNews, ride_news_at: `${day(-30)}T10:00:00Z` };
  },
  customer_updates_unread: () => ({ ok: true, n: st.updates.filter((u) => !u.read).length, comm: 0 }),
  customer_updates: () => {
    const rows = st.updates.map(({ read, ...u }) => ({ ...u, unread: !read }));
    st.updates.forEach((u) => { u.read = true; });
    return { ok: true, rows };
  },
  testimonial_mine: () => ({ ok: true, on: st.scene.tmAsk, names: { full: "Sara Khalid", short: "Sara K." }, since: { year: 2025, rides: 1 }, items: [],
    ask: st.scene.tmAsk && !st.tmAnswered ? { entry_id: "e-old1", body: "The best evening at the circuit, the team made sure everyone felt safe and had fun.", rating: 10, date: day(-12), about: "session", title: null, title_ar: null } : null }),
  customer_fix_fields: () => (st.scene.owes ? ["birth_date", "whatsapp"] : []),
  hub_pulse: () => ({ ok: true, member: st.scene.member, dot: false, me: null, goals: [], fresh: [] }),
  my_bookings: () => st.bookings,
  list_sessions: (_a, q) => {
    const d = decodeURIComponent(q);
    const ids = /id=in\.\(([^)]*)\)/.exec(d)?.[1]?.split(",") ?? /[?&]id=eq\.([^&]+)/.exec(d)?.[1]?.split(",") ?? null;
    return sessionsNow().filter((s) => !ids || ids.includes(s.id));
  },
  community_member: () => false,
  customer_helper_path: () => ({ ok: true, member: false }),
  customer_my_badges: () => (st.scene.freshBadge ? [{ slug: "spirit", at: st.badgeAt, note: "For helping a new rider all evening." }] : []),
  customer_badge_requests: () => [],
  customer_vl_teams: () => [],
};
const WRITES = {
  customer_distance_claim: (a) => {
    if (st.claims.filter((c) => c.status === "pending").length >= 3) return { ok: false, error: "limit" };
    if (!(a.p_km >= 1 && a.p_km <= 99999)) return { ok: false, error: "km" }; // no maximum since 2026-11-28
    const id = 100 + st.claims.length;
    st.claims.unshift({ id, kind: a.p_kind, km: a.p_km, d: a.p_date, from: a.p_from, status: "pending", source: "claim", reply: null, at: new Date().toISOString() });
    return { ok: true, id };
  },
  customer_distance_withdraw: (a) => {
    const n = st.claims.length;
    st.claims = st.claims.filter((c) => !(c.id === a.p_claim && c.status === "pending" && c.source === "claim"));
    return st.claims.length < n ? { ok: true } : { ok: false, error: "gone" };
  },
  customer_update_profile: (a) => {
    const map = { p_name: "name", p_email: "email", p_phone: "phone", p_height: "height", p_type_preference: "type_preference", p_birth_date: "birth_date", p_country: "country", p_city: "city", p_nationality: "nationality" };
    for (const [k, col] of Object.entries(map)) if (k in a) st.profile[col] = a[k];
    return true;
  },
  customer_set_about: (a) => {
    st.about.profession = a.p_profession ?? ""; st.about.workplace = a.p_workplace ?? "";
    if (a.p_heard_from) st.about.heard_from = a.p_heard_from;
    if (a.p_gender) st.profile.gender = a.p_gender;
    return true;
  },
  customer_set_socials: (a) => { st.profile.socials = a.p_socials; return true; },
  customer_set_photo: (a) => { st.profile.photo = a.p_photo; return true; },
  customer_set_whatsapp: (a) => { st.whatsapp = { phone: st.profile.phone, whatsapp_same: a.p_same, whatsapp: a.p_same ? null : a.p_phone }; return true; },
  customer_set_emergency: (a) => { Object.assign(st.emergency, { emergency_name: a.p_name, emergency_phone: a.p_phone, emergency_relation: a.p_relation }); return true; },
  customer_set_emergency2: (a) => { Object.assign(st.emergency, { emergency2_name: a.p_name, emergency2_phone: a.p_phone, emergency2_relation: a.p_relation }); return true; },
  customer_set_blood_type: (a) => { st.blood = a.p_type ?? null; return true; },
  customer_change_password: (a) => (a.p_current === "wrong-one" ? "BAD_PASSWORD" : "0123456789abcdef0123456789abcdef0123456789abcdef"),
  company_challenge_join: (a) => {
    if (a.p_code !== "ACME2026") return { ok: false, error: "code" };
    st.company = [{ id: 1, company: "Acme", starts_on: day(-3), ends_on: day(25), state: "on", team: null, sessions: null, mine: 0, badge: false }];
    return { ok: true, joined: 1, rows: st.company, open: true };
  },
  testimonial_old_answer: (a) => {
    if (st.tmAnswered) return { ok: false, error: "done" };
    if (a.p_yes && !a.p_consent) return { ok: false, error: "consent" };
    st.tmAnswered = a.p_yes ? "yes" : "no";
    return { ok: true, id: a.p_yes ? 12 : null };
  },
  hub_seen: () => null,
  customer_handoff_create: () => "0123456789abcdef0123456789abcdef0123456789abcdef",
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
    if (url.pathname === "/__reset") {
      let scene = "";
      try { scene = raw ? JSON.parse(raw).scene ?? "" : ""; } catch { scene = ""; }
      st = scene === "manage" ? manageScene() : fresh();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/__scene") { try { Object.assign(st.scene, JSON.parse(raw || "{}")); } catch { /* the scene as it was */ } return send(res, 200, st.scene); }
    if (url.pathname === "/__state") return send(res, 200, st);
    const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (m) {
      let a = {};
      try { a = raw ? JSON.parse(raw) : {}; } catch { a = {}; }
      const fn = m[1];
      if (fn in WRITES) { st.writes.push({ fn, a }); return send(res, 200, WRITES[fn](a)); }
      if (fn in MANAGE_WRITES) { st.writes.push({ fn, a }); return send(res, 200, MANAGE_WRITES[fn](a)); }
      if (fn in MANAGE_READS) return send(res, 200, MANAGE_READS[fn](a));
      if (fn in READS) return send(res, 200, READS[fn](a, url.search));
      return send(res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }
    // the add-ons' items (the inventory, which anyone may read), with the stock the scene's writes moved
    if (url.pathname === "/rest/v1/inventory") {
      const ids = /id=in\.\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",") ?? [];
      return send(res, 200, st.mscene === "manage" ? ITEMS.filter((x) => ids.includes(x.id)).map((x) => ({ ...x, qty: st.stock[x.id] ?? x.qty })) : []);
    }
    if (url.pathname.startsWith("/rest/v1/")) return send(res, 200, []);
    if (url.pathname.startsWith("/storage/v1/object/photos/")) return send(res, 200, { Key: url.pathname });
    return send(res, 404, { message: "not here" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub account db on ${PORT}`));
