// A stand-in for the database's portal functions (POST /rest/v1/rpc/<name>), in memory, for the
// browser smoke test. One venue login: cafe@example.com / Temp1234 (a change is due), and the
// Saturdays of the coming months open for breakfast.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8799);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const now = new Date();
const today = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
const add = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

const user = { id: 7, login: "cafe@example.com", pwd: "Temp1234", token: "t".repeat(48), must_change: true };
const tier = { id: "multi", name_en: "Multi", name_ar: "عدة أيام", modes: ["single", "multi"], max_per_month: 2, horizon_days: 120, min_lead_days: 7, cancel_cutoff_days: 5, benefits: [], active: true };
const venue = { id: 3, name: "Harbour Cafe", name_ar: "مقهى الميناء", map_url: "", seats: 40, contact_name: "", contact_phone: "", contact_email: "", offer_en: "", offer_ar: "", tier_id: "multi", status: "active" };
const dates = new Map();
for (let d = add(today, -40); d <= add(today, 200); d = add(d, 1)) {
  if (new Date(`${d}T00:00:00Z`).getUTCDay() === 6) dates.set(d, { state: "open", reason: "", taken: false });
}
// One closed and one taken Saturday, a few weeks out.
const sats = [...dates.keys()].filter((d) => d > add(today, 7));
dates.get(sats[2]).state = "closed"; dates.get(sats[2]).reason = "Ramadan";
dates.get(sats[3]).taken = true;
const bookings = [];
let nextId = 1;

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

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    if (req.url === "/__reset") {
      Object.assign(user, { pwd: "Temp1234", token: "t".repeat(48), must_change: true });
      bookings.length = 0;
      return ok(res, { ok: true });
    }
    const name = (req.url || "").split("/rpc/")[1];
    const a = body ? JSON.parse(body) : {};
    if (req.headers.apikey !== "test-anon") return err(res, "No API key", 401);
    if (name === "fnb_login") {
      if (a.p_login.toLowerCase() !== user.login || a.p_pwd !== user.pwd) return ok(res, { error: "BAD_LOGIN" });
      return ok(res, { id: user.id, token: user.token, must_change: user.must_change });
    }
    if (a.p_uid !== user.id || a.p_token !== user.token) return err(res, "BAD_TOKEN", 403);
    switch (name) {
      case "fnb_set_password":
        if (!user.must_change && a.p_old !== user.pwd) return err(res, "BAD_PASSWORD");
        if (a.p_new.length < 8 || !/[A-Z]/.test(a.p_new) || !/\d/.test(a.p_new)) return err(res, "WEAK_PASSWORD");
        if (a.p_new === user.pwd) return err(res, "SAME_PASSWORD");
        user.pwd = a.p_new; user.must_change = false; user.token = "n".repeat(48);
        return ok(res, user.token);
      case "fnb_me":
        return ok(res, { user: { id: 7, name: "Owner", login: user.login, role: "owner", must_change: user.must_change }, venue, tier, today, series: [] });
      case "fnb_calendar": {
        const out = [];
        for (const [day, d] of [...dates].sort()) {
          if (day < a.p_from || day > a.p_to) continue;
          const mine = bookings.filter((b) => b.day === day).at(-1) || null;
          out.push({ day, state: d.state, reason: d.state === "closed" ? d.reason : "", mine, taken: d.taken, riders: mine?.status === "confirmed" ? 12 : null });
        }
        return ok(res, out);
      }
      case "fnb_preview":
        return ok(res, (a.p_days || []).map((day) => ({ day, verdict: verdict(day), reason: dates.get(day)?.reason || "" })));
      case "fnb_request": {
        const days = (a.p_days || []).map((day) => ({ day, verdict: verdict(day), reason: "" }));
        let n = 0;
        for (const d of days) if (d.verdict === "ok") { bookings.push({ id: nextId++, day: d.day, status: "pending", kind: a.p_mode, series_id: null, note: a.p_note || "", staff_note: "" }); n++; }
        return ok(res, { requested: n, series_id: null, days });
      }
      case "fnb_cancel": {
        const b = bookings.find((x) => x.id === a.p_booking);
        if (!b) return err(res, "NOT_FOUND", 404);
        b.status = "cancelled";
        return ok(res, 1);
      }
      case "fnb_profile_save":
        Object.assign(venue, a.p_data, { seats: a.p_data.seats ? Number(a.p_data.seats) : null });
        return ok(res, undefined);
      default:
        return err(res, "unknown", 404);
    }
  });
}).listen(PORT, "127.0.0.1", () => console.log(`stub db on ${PORT}`));
