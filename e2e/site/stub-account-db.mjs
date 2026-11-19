// A stand-in for the database's customer functions (POST /rest/v1/rpc/<name>), in memory, for the account pages' browser
// test (tests/account-menu.spec.ts, playwright.account.config.ts): one signed-in rider, "Sara Khalid" (id c-test, any
// token), her profile, contacts, wallet, invite code, bookings (a ride in two days, a circuit night in five, one done, one
// cancelled), a workshop appointment ahead and one done, a locker taken alone, a volunteer shift, desk purchases. The
// writes the pages make change it (customer_update_profile, customer_set_about ...). Every other read answers empty (the
// site's own content: its defaults), and a function it does not know answers as one the database does not have (404,
// PGRST202). Test-only routes (POST /__reset, GET /__state) set and read the scene; they are not part of any real API.
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
    writes: [],
  };
}
let st = fresh();

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
const READS = {
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
  company_challenge_mine: () => ({ ok: true, rows: [], open: false }),
  calendar_link: () => ({ ok: false }),
  customer_deletion_request: (a) => {
    if (a.p_request === true) st.deletion = new Date().toISOString();
    if (a.p_request === false) st.deletion = null;
    return { requested_at: st.deletion };
  },
  customer_lockers: () => [{ id: "lk-1", booking_id: null, day: day(4), period: "both", code: "B7", name: "Sara Khalid", status: "reserved", pay: "wallet", paid: true }],
  learn_ladder: () => ({ ok: true, skills: [], learners: [] }),
  my_bookings: () => BOOKINGS(),
  list_sessions: (_a, q) => {
    const ids = /id=in\.\(([^)]*)\)/.exec(decodeURIComponent(q))?.[1]?.split(",") ?? null;
    return SESSIONS().filter((s) => !ids || ids.includes(s.id));
  },
  community_member: () => false,
  customer_helper_path: () => ({ ok: true, member: false }),
  customer_my_badges: () => [],
  customer_badge_requests: () => [],
  customer_vl_teams: () => [],
};
const WRITES = {
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
    if (url.pathname === "/__reset") { st = fresh(); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__state") return send(res, 200, st);
    const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (m) {
      let a = {};
      try { a = raw ? JSON.parse(raw) : {}; } catch { a = {}; }
      const fn = m[1];
      if (fn in WRITES) { st.writes.push({ fn, a }); return send(res, 200, WRITES[fn](a)); }
      if (fn in READS) return send(res, 200, READS[fn](a, url.search));
      return send(res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }
    if (url.pathname.startsWith("/rest/v1/")) return send(res, 200, []);
    if (url.pathname.startsWith("/storage/v1/object/photos/")) return send(res, 200, { Key: url.pathname });
    return send(res, 404, { message: "not here" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub account db on ${PORT}`));
