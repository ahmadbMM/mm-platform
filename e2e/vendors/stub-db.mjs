// A stand-in for the database's portal functions (POST /rest/v1/rpc/<name>), in memory, for the
// browser smoke test. One venue login: cafe@example.com / Temp1234 (a change is due), and the
// Saturdays of the coming months open for breakfast. It answers in the shapes of the rentals
// migration 20261004130000: a new token per sign-in (sessions), MUST_CHANGE before the password is
// changed, TEMP_EXPIRED, roles (owner / manager / viewer), the 48-hour reason, the password policy.
// Test-only routes (POST /__name) set the scene; they are not part of any real API.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.STUB_PORT || 8799);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const now = new Date();
const today = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
const add = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

const START_PWD = "Temp1234";
const user = { id: 7, login: "cafe@example.com", pwd: START_PWD, must_change: true, role: "owner", expired: false };
const sessions = new Set(); // live tokens of the login
const tier = { id: "multi", name_en: "Multi", name_ar: "عدة أيام", modes: ["single", "multi"], max_per_month: 2, horizon_days: 120, min_lead_days: 7, cancel_cutoff_days: 5, benefits: [], active: true };
const venue = { id: 3, name: "Harbour Cafe", name_ar: "مقهى الميناء", map_url: "", seats: 40, contact_name: "", contact_phone: "", contact_email: "", offer_en: "", offer_ar: "", tier_id: "multi", status: "active" };
const dates = new Map();
for (let d = add(today, -40); d <= add(today, 200); d = add(d, 1)) {
  if (new Date(`${d}T00:00:00Z`).getUTCDay() === 6) dates.set(d, { state: "open", reason: "", taken: false, others: 0 });
}
// One closed and one taken Saturday, a few weeks out.
const sats = [...dates.keys()].filter((d) => d > add(today, 7));
dates.get(sats[2]).state = "closed"; dates.get(sats[2]).reason = "Ramadan";
dates.get(sats[3]).taken = true;
const bookings = [];
const series = [];
const feedback = new Map(); // booking id -> row, as vendor_feedback_save answers it
const shared = []; // the riders' breakfast ratings staff shared, as vendor_shared_ratings_mine answers
let nextId = 1;
let locked = false;
// The breakfast window for feedback: from the day itself until 14 days after.
const feedbackOpen = (b) => b.status === "confirmed" && today >= b.day && today <= add(b.day, 14);
const within48h = (day) => Date.parse(`${day}T00:00:00+03:00`) - Date.now() < 48 * 3600_000;

const err = (res, message, status = 400) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify({ code: "P0001", message })); };
const ok = (res, data) => { if (data === undefined) { res.writeHead(204); res.end(); return; } res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };

function verdict(day) {
  const d = dates.get(day);
  if (!d) return "not_open";
  if (d.state === "closed") return "closed";
  if (day < add(today, tier.min_lead_days)) return "too_soon";
  if (day > add(today, tier.horizon_days)) return "too_far";
  if (bookings.some((b) => b.day === day && ["pending", "confirmed"].includes(b.status))) return "mine";
  if (d.taken) return "taken";
  return "ok";
}

/** The Saturdays of a monthly pattern (the first .. fourth, or the last, Saturday every N months). */
function patternDays(ordinal, interval, from, until) {
  const out = [];
  const start = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  for (let m = 0; m < 60; m += Math.max(1, interval || 1)) {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1));
    const satsOf = [];
    for (let d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() === 6) satsOf.push(iso(d));
    const day = ordinal === -1 ? satsOf.at(-1) : satsOf[ordinal - 1];
    if (day && day > until) break;
    if (day && day >= from) out.push(day);
  }
  return out;
}

const COMMON = new Set(["password123", "micromobility", "1234567890", "qwerty12345", "breakfast123"]);
function pwdProblem(p) {
  if ([...p].length < 10 || [...p].length > 200) return "WEAK_PASSWORD";
  const bare = p.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (COMMON.has(bare) || /^(.)\1*$/su.test(p)) return "COMMON_PASSWORD";
  if (p.toLowerCase().includes("harbour") || p.toLowerCase().includes(user.login.split("@")[0])) return "PERSONAL_PASSWORD";
  return "";
}

function e164(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (!/^[0-9+()\s.-]+$/.test(v)) return null;
  let d = v.replace(/\D/g, "");
  if (!v.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (/^05\d{8}$/.test(d)) d = `966${d.slice(1)}`;
    else if (/^5\d{8}$/.test(d)) d = `966${d}`;
  }
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
}

const newToken = () => { const t = randomBytes(32).toString("hex"); sessions.add(t); return t; };

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const a = body ? JSON.parse(body) : {};
    if (req.url === "/__reset") {
      Object.assign(user, { pwd: START_PWD, must_change: true, role: "owner", expired: false });
      sessions.clear();
      bookings.length = 0;
      series.length = 0;
      feedback.clear();
      shared.length = 0;
      locked = false;
      tier.modes = ["single", "multi"];
      for (const d of dates.values()) d.others = 0;
      Object.assign(venue, { contact_name: "", contact_phone: "", contact_email: "", offer_en: "", offer_ar: "" });
      return ok(res, { ok: true });
    }
    // Test scenes: the password already changed, a role, the recurring plan, a lock, an expired temporary password.
    if (req.url === "/__ready") { Object.assign(user, { pwd: "Breakfast2026", must_change: false }); if (a.role) user.role = a.role; return ok(res, { ok: true }); }
    if (req.url === "/__recurring") { tier.modes = ["single", "multi", "recurring"]; return ok(res, { ok: true }); }
    if (req.url === "/__lock") { locked = true; return ok(res, { ok: true }); }
    if (req.url === "/__expire") { user.expired = true; return ok(res, { ok: true }); }
    if (req.url === "/__sessions") return ok(res, { n: sessions.size });
    if (req.url === "/__bookings") return ok(res, bookings);
    if (req.url === "/__past") {
      // A confirmed breakfast on the last Saturday before today (inside the feedback window).
      const day = [...dates.keys()].filter((d) => d < today).at(-1);
      bookings.push({ id: nextId++, day, status: "confirmed", kind: "single", series_id: null, note: "", staff_note: "" });
      return ok(res, { day });
    }
    if (req.url === "/__book") {
      // A booking straight in: {offset: days from today to the Saturday at or after it, status, series, others}.
      // {day: "tomorrow"} opens tomorrow (whatever weekday) for a breakfast inside 48 hours.
      const day = a.day === "tomorrow" ? add(today, 1) : [...dates.keys()].find((d) => d >= add(today, a.offset || 0));
      if (!dates.has(day)) dates.set(day, { state: "open", reason: "", taken: false, others: 0 });
      const sid = a.series ? (series.find((s) => s.id === 1) || (series.push({ id: 1 }), series[0])).id : null;
      const b = { id: nextId++, day, status: a.status || "confirmed", kind: sid ? "recurring" : "single", series_id: sid, note: "", staff_note: "" };
      bookings.push(b);
      if (a.others) dates.get(day).others = a.others;
      return ok(res, b);
    }
    if (req.url === "/__share") {
      // Staff share the riders' breakfast ratings of the latest past confirmed booking.
      const b = bookings.filter((x) => x.status === "confirmed" && x.day < today).at(-1);
      if (!b) return err(res, "no past booking", 404);
      shared.push({
        booking_id: b.id, day: b.day, riders: 9,
        averages: { breakfast: 8.6, bf_food: 8.4, bf_service: 7 },
        comments: [{ k: "bf_food", text: "The shakshuka was great." }, { k: "bf_service", text: "Coffee took a while." }, { k: "bf_food", text: "Fresh bread." }],
        shared_at: new Date().toISOString(),
      });
      return ok(res, { booking_id: b.id });
    }
    const name = (req.url || "").split("/rpc/")[1];
    if (req.headers.apikey !== "test-anon") return err(res, "No API key", 401);
    if (name === "vendor_login") {
      if (locked) return err(res, "LOCKED");
      if (a.p_login.toLowerCase() !== user.login || a.p_pwd !== user.pwd) return ok(res, { error: "BAD_LOGIN" });
      if (user.must_change && user.expired) return ok(res, { error: "TEMP_EXPIRED" });
      return ok(res, { id: user.id, token: newToken(), must_change: user.must_change });
    }
    if (name === "vendor_logout") {
      if (String(a.p_uid) === String(user.id)) sessions.delete(a.p_token);
      return ok(res, undefined);
    }
    if (a.p_uid !== user.id || !sessions.has(a.p_token)) return err(res, "BAD_TOKEN", 403);
    const free = ["vendor_me", "vendor_set_password", "vendor_logout_others"];
    if (user.must_change && !free.includes(name)) return err(res, "MUST_CHANGE");
    const role = (...allowed) => allowed.includes(user.role);
    switch (name) {
      case "vendor_set_password": {
        if (!user.must_change && a.p_old !== user.pwd) return ok(res, { error: "BAD_PASSWORD" });
        const why = pwdProblem(a.p_new);
        if (why) return err(res, why);
        if (a.p_new === user.pwd) return err(res, "SAME_PASSWORD");
        user.pwd = a.p_new; user.must_change = false;
        sessions.clear();
        return ok(res, { token: newToken() });
      }
      case "vendor_logout_others": {
        const n = sessions.size - 1;
        sessions.clear(); sessions.add(a.p_token);
        return ok(res, n);
      }
      case "vendor_me":
        return ok(res, { user: { id: 7, name: "Owner", login: user.login, role: user.role, must_change: user.must_change, sessions: sessions.size }, venue, tier, today, series: [] });
      case "vendor_team":
        if (!role("owner")) return err(res, "FORBIDDEN", 403);
        return ok(res, [
          { id: 7, name: "Owner", login: user.login, role: user.role, active: true, last_login_at: new Date().toISOString(), me: true },
          { id: 8, name: "Sara", login: "0501234567", role: "viewer", active: true, last_login_at: null, me: false },
        ]);
      case "vendor_calendar": {
        const out = [];
        for (const [day, d] of [...dates].sort()) {
          if (day < a.p_from || day > a.p_to) continue;
          const own = bookings.filter((x) => x.day === day);
          const b = own.find((x) => ["pending", "confirmed"].includes(x.status)) || own.at(-1);
          const mine = b ? { ...b, feedback: feedback.get(b.id) || null, feedback_open: feedbackOpen(b) } : null;
          const live = mine && ["pending", "confirmed"].includes(mine.status);
          out.push({
            day, state: d.state, reason: d.state === "closed" ? d.reason : "", mine, taken: d.taken,
            riders: live ? 12 : null, ride_time: live ? "05:45 - 06:15" : null,
            decide_by: mine?.status === "pending" ? add(day, -tier.min_lead_days) : null,
            others_pending: mine?.status === "pending" ? d.others : null,
            declined: !!mine && ["declined", "cancelled"].includes(mine.status),
          });
        }
        return ok(res, out);
      }
      case "vendor_preview": {
        if (!role("owner", "manager")) return err(res, "FORBIDDEN", 403);
        const days = a.p_mode === "recurring" ? patternDays(a.p_ordinal, a.p_interval, a.p_from, a.p_until) : (a.p_days || []);
        return ok(res, days.map((day) => ({ day, verdict: verdict(day), reason: dates.get(day)?.reason || "" })));
      }
      case "vendor_request": {
        if (!role("owner", "manager")) return err(res, "FORBIDDEN", 403);
        const list = a.p_mode === "recurring" ? patternDays(a.p_ordinal, a.p_interval, a.p_from, a.p_until) : (a.p_days || []);
        const days = list.map((day) => ({ day, verdict: verdict(day), reason: "" }));
        const sid = a.p_mode === "recurring" ? series.push({ id: series.length + 1 }) : null;
        let n = 0;
        for (const d of days) if (d.verdict === "ok") { bookings.push({ id: nextId++, day: d.day, status: "pending", kind: a.p_mode, series_id: sid, note: a.p_note || "", staff_note: "" }); n++; }
        return ok(res, { requested: n, series_id: sid, days });
      }
      case "vendor_cancel": {
        if (!role("owner", "manager") || (a.p_series && !role("owner"))) return err(res, "FORBIDDEN", 403);
        const b = bookings.find((x) => x.id === a.p_booking);
        if (!b) return err(res, "NOT_FOUND", 404);
        const hit = bookings.filter((x) => ["pending", "confirmed"].includes(x.status) && x.day >= today && (x.id === b.id || (a.p_series && b.series_id && x.series_id === b.series_id && x.day >= b.day)));
        const why = String(a.p_reason || "").trim();
        if (!why && hit.some((x) => x.status === "confirmed" && within48h(x.day))) return err(res, "LATE_REASON");
        for (const x of hit) Object.assign(x, { late_cancel: x.status === "confirmed" && (within48h(x.day) || x.day < add(today, tier.cancel_cutoff_days)), status: "cancelled", cancelled_by: "venue", cancel_reason: why });
        return ok(res, hit.length);
      }
      case "vendor_feedback_save": {
        if (!role("owner", "manager")) return err(res, "FORBIDDEN", 403);
        const b = bookings.find((x) => x.id === a.p_booking);
        if (!b) return err(res, "NOT_FOUND", 404);
        if (b.status !== "confirmed") return err(res, "NOT_CONFIRMED");
        if (today < b.day) return err(res, "TOO_EARLY");
        if (today > add(b.day, 14)) return err(res, "TOO_LATE");
        if (!Number.isInteger(a.p_rating) || a.p_rating < 1 || a.p_rating > 5) return err(res, "BAD_RATING");
        const t = a.p_turnout ?? null;
        if (t !== null && (!Number.isInteger(t) || t < 0 || t > 1000)) return err(res, "BAD_INPUT");
        const stamp = new Date().toISOString();
        const row = {
          booking_id: b.id, venue_id: venue.id, day: b.day, rating: a.p_rating, turnout: t,
          went_well: String(a.p_went_well || "").slice(0, 1000), improve: String(a.p_improve || "").slice(0, 1000),
          created_at: feedback.get(b.id)?.created_at || stamp, updated_at: stamp,
        };
        feedback.set(b.id, row);
        return ok(res, row);
      }
      case "vendor_shared_ratings_mine":
        return ok(res, shared);
      case "vendor_profile_save": {
        if (!role("owner")) return err(res, "FORBIDDEN", 403);
        const p = a.p_data || {};
        const phone = "contact_phone" in p ? e164(p.contact_phone) : venue.contact_phone;
        if (phone === null) return err(res, "BAD_PHONE");
        Object.assign(venue, p, { contact_phone: phone, seats: p.seats ? Number(p.seats) : null });
        return ok(res, undefined);
      }
      default:
        return err(res, "unknown", 404);
    }
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub db on ${PORT}`));
