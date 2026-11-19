// A stand-in for the database the booking steps on /experiences talk to (tests-booking/, playwright.booking.config.ts), in
// memory: the sessions ahead (a circuit night that sells add-ons, a Saturday Social Ride for members, a men-only pool session,
// yoga, a Farm House Night, a ticketed event), the bike prices, two add-ons, and one signed-in rider, "Sara Khalid" (id
// c-test, any token), with no booking yet. customer_create_booking keeps what it is given and answers as the database does:
// a place on an open session, the waitlist on a full one, or the refusal the scene asks for (POST /__scene {refuse:
// "TYPE_FULL"}). The browser's own calls (promo_lookup, reserve_funnel_add) are answered too, with CORS. Test-only routes
// (POST /__reset, POST /__scene, GET /__state) set and read the scene; they are not part of any real API. Nothing here
// reaches a real database.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8796);
const pad = (n) => String(n).padStart(2, "0");
const ksa = () => new Date(Date.now() + 3 * 3600e3);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const day = (n) => { const d = ksa(); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const wd = (s) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${s}T12:00:00Z`).getUTCDay()];

const base = { title: null, meet_url: null, location: null, breakfast_name: null, breakfast_name_ar: null, reveal_at: null, vl: null, gender_only: null, closed_types: [], title_ar: null,
  out_bikes: null, hide_queue: true, cancelled_at: null, draft: false, opens_at: null, spots: null, public_at: null, description: null, price: null, route_slug: null, addons: "[]" };
const SESSIONS = () => [
  { ...base, id: "t-jcc", session_date: day(3), day: wd(day(3)), status: "open", ride_kind: null, event_kind: "regular", bike_slots: JSON.stringify({ _time: "20:00-22:00" }), open_to_all: true, paid_ride: true, capacity: 40, needs_approval: false, addons: JSON.stringify(["inv-gel", "inv-water"]) },
  { ...base, id: "t-sat", session_date: day(2), day: wd(day(2)), status: "open", ride_kind: "saturday", event_kind: "community", bike_slots: JSON.stringify({ _time: "06:00-06:30" }), open_to_all: false, paid_ride: false, capacity: 200, needs_approval: true, hide_queue: false },
  { ...base, id: "t-swim", session_date: day(4), day: wd(day(4)), status: "open", ride_kind: "swim", event_kind: "community", bike_slots: JSON.stringify({ _time: "19:00-20:00" }), open_to_all: true, paid_ride: false, capacity: 20, needs_approval: true, gender_only: "male" },
  { ...base, id: "t-yg", session_date: day(5), day: wd(day(5)), status: "open", ride_kind: "yoga", event_kind: "community", bike_slots: JSON.stringify({ _time: "17:00-18:00" }), open_to_all: true, paid_ride: false, capacity: 15, needs_approval: false },
  { ...base, id: "t-fh", session_date: day(6), day: wd(day(6)), status: "open", ride_kind: "farm", event_kind: "community", bike_slots: JSON.stringify({ _time: "18:00-19:00" }), open_to_all: false, paid_ride: false, capacity: 130, needs_approval: true },
];
const PRICES = [{ type: "Road", price: 75 }, { type: "Hybrid", price: 57.5 }, { type: "Mountain", price: 57.5 }, { type: "Kids", price: 57.5 }, { type: "Any", price: 57.5 }, { type: "Road Carbon", price: 250 }];
const INVENTORY = [
  { id: "inv-gel", name: "Energy Gel", brand: "MicroMobility", photo: null, price: 8, qty: 30, category: "EnergyGels", nutrition: true, flavour: null, volume_ml: null },
  { id: "inv-water", name: "Water", brand: "", photo: null, price: 3, qty: 50, category: "Drinks", nutrition: false, flavour: null, volume_ml: 500 },
];

function fresh() {
  return {
    profile: { id: "c-test", name: "Sara Khalid", email: "sara@example.com", phone: "+966500000001", height: 168, type_preference: "Hybrid", birth_date: "1994-03-02",
      country: "Saudi Arabia", city: "Jeddah", nationality: "Saudi Arabia", gender: "female", hidden_types: null, default_pay: null },
    member: true, fix: [], refuse: null, full: [],
    bookings: [],
    writes: [],
    seq: 1,
  };
}
let st = fresh();
const sessions = () => SESSIONS().map((s) => (st.full.includes(s.id) ? { ...s, status: "full" } : s));

const READS = {
  customer_profile: () => [st.profile],
  customer_pwd_state: () => false,
  customer_token_ok: () => true,
  customer_seen: () => null,
  my_bookings: () => st.bookings,
  community_member: () => st.member,
  petromin_member: () => false,
  vlap_member: () => false,
  saturday_link_only: () => false,
  customer_fix_fields: () => st.fix,
  customer_emergency: () => [{ emergency_name: "Ali Saleh", emergency_phone: "+966500000002", emergency_relation: "sibling" }],
  customer_sport: () => [{ competes: false, federations: [], other: null, asked: true }],
  customer_lockers: () => [],
  customer_vl_teams: () => [],
  customer_blood_rewards: () => [],
  promo_lookup: (a) => (String(a.p_code).toUpperCase() === "SAVE10" ? { ok: true, code: "SAVE10", kind: "pct", value: 10, applies_to: null } : { ok: false, reason: "invalid" }),
  reserve_funnel_add: () => null,
  list_sessions: (_a, q) => {
    const s = decodeURIComponent(q);
    const ids = /id=in\.\(([^)]*)\)/.exec(s)?.[1]?.split(",") ?? (/id=eq\.([A-Za-z0-9_-]+)/.exec(s)?.[1] ? [/id=eq\.([A-Za-z0-9_-]+)/.exec(s)[1]] : null);
    return sessions().filter((x) => !ids || ids.includes(x.id));
  },
};
const refusal = (code) => ({
  TYPE_FULL: { code: "P0001", message: "TYPE_FULL: Road is full on this ride", details: "Road" },
  MEMBERS_FIRST: { code: "P0001", message: "MEMBERS_FIRST", details: new Date(Date.now() + 2 * 86400e3).toISOString() },
  WAITLIST_FULL: { code: "P0001", message: "WAITLIST_FULL", details: "" },
  PLACE_GONE: { code: "P0001", message: "PLACE_GONE", details: "" },
}[code] ?? { code: "P0001", message: code, details: "" });
const WRITES = {
  customer_create_booking: (a) => {
    if (st.refuse) return { status: 400, body: refusal(st.refuse) };
    const out = [];
    for (const e of a.p_entries ?? []) {
      const s = sessions().find((x) => x.id === e.session_id);
      const id = `b-${st.seq++}`;
      const status = s && s.status === "full" ? "waitlist" : "waiting";
      const price = s && s.event_kind === "community" && !s.paid_ride ? 0 : e.type_preference === "Road" ? 75 : e.type_preference === "Own" ? 0 : 57.5;
      const row = { ...e, id, customer_id: "c-test", status, queue_num: status === "waitlist" ? 0 : 10 + st.seq, waitlist_num: status === "waitlist" ? st.seq : null, price, paid: false };
      st.bookings.push(row);
      out.push({ id, queue_num: row.queue_num, status, waitlist_num: row.waitlist_num, price });
    }
    return { status: 200, body: out };
  },
  customer_booking_update: (a) => {
    const b = st.bookings.find((x) => x.id === a.p_entry_id);
    if (!b) return { status: 200, body: false };
    Object.assign(b, a.p_patch ?? {});
    return { status: 200, body: true };
  },
  customer_addon_stock: () => ({ status: 200, body: true }),
  customer_set_height: (a) => { st.profile.height = a.p_height; return { status: 200, body: true }; },
  customer_set_birth_nat: (a) => { st.profile.birth_date = a.p_birth_date; st.profile.nationality = a.p_nationality; return { status: 200, body: true }; },
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS,PATCH", "Access-Control-Expose-Headers": "content-range" };
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS, ...extra });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    if (req.method === "OPTIONS") return send(res, 204);
    let a = {};
    try { a = raw ? JSON.parse(raw) : {}; } catch { a = {}; }
    if (url.pathname === "/__reset") { st = fresh(); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__scene") { Object.assign(st, a); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__state") return send(res, 200, st);
    const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (m) {
      const fn = m[1];
      if (fn in WRITES) { st.writes.push({ fn, a }); const r = WRITES[fn](a); return send(res, r.status, r.body); }
      if (fn in READS) return send(res, 200, READS[fn](a, url.search));
      return send(res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }
    if (url.pathname === "/rest/v1/ride_prices") return send(res, 200, PRICES);
    if (url.pathname === "/rest/v1/inventory") {
      const ids = /id=in\.\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",") ?? [];
      return send(res, 200, INVENTORY.filter((x) => ids.includes(x.id)));
    }
    // a count (queue_public, Prefer: count=exact): nobody holds a place yet
    if (req.method === "HEAD") return send(res, 200, undefined, { "Content-Range": "*/0" });
    if (url.pathname.startsWith("/rest/v1/")) return send(res, 200, []);
    return send(res, 404, { message: "not here" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub booking db on ${PORT}`));
