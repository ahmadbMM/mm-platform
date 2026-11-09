// A stand-in for the database's portal functions (POST /rest/v1/rpc/<name>), in memory, for the browser test. It keeps the
// real functions' rules only as far as the page needs them: those are tested against a real Postgres when they are written
// (rentals migrations 20261105120000 onwards; the rework, 20261109120000). One rider: sara@example.com / Pass1234.
// Test-only routes (POST /__name) set the scene.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8801);
const soon = (h) => new Date(Date.now() + h * 3600000).toISOString();
const fresh = () => ({
  rider: { id: "c1", name: "Sara Haddad", name_ar: "سارة حداد", session_token: "tok-sara-0123456789", hours: 0, status: null, profile_at: null, agreed: false,
    account: null, auto: false, skills: null, days: [], shirt: null, whatsapp: null, birth_date: "1995-04-02",
    emergency: { name: "Huda Haddad", phone: "+966500000009", relation: "Sister" }, records: [] },
  opps: [
    { id: "2099-11-05-bd", title: null, ride_kind: "blood", event_kind: "community", date: "2099-11-05", time: "17:00 - 23:00", location: "JCC", about: "Help donors at the door.", needed: 5,
      roles: ["Check-in", "Guide"], min_age: 18, hours_mode: "clock", fixed_hours: null, signup_open: true, opens_at: null, closes_at: soon(4), accepted: 0, briefing: "Meet at gate 3.",
      caps: { checkin: true, undo: true, donated: true, list: false, counts: true } },
    { id: "2099-12-01", title: "Beach clean-up", ride_kind: "event", event_kind: "community", date: "2099-12-01", time: null, location: null, about: null, needed: null,
      roles: [], min_age: null, hours_mode: "fixed", fixed_hours: 3, signup_open: false, opens_at: soon(100), closes_at: soon(200), accepted: 0, briefing: null, caps: {} },
  ],
  shifts: new Map(), // session -> the rider's shift
  // the rest of the blood night's team, for its lead (names only)
  mates: [
    { shift: 11, name: "Omar Saleh", role: "Guide", status: "accepted", lead: false, clock_in: null, clock_out: null, clock_in_by: null, clock_out_by: null, briefed: true },
    { shift: 12, name: "Lina Farouk", role: "Check-in", status: "accepted", lead: false, clock_in: soon(-1), clock_out: null, clock_in_by: "self", clock_out_by: null, briefed: false },
  ],
  bookings: [
    { id: "q1111111", blood_type: "O+", club: "Runners", status: "waiting", name: "Dana Donor", number: 2, checked_in: false, donated: false, own: false, desk: null, mine_in: false, mine_donated: false, phone: "500000003" },
    { id: "q2222222", name: "Ali Owes", number: 3, checked_in: false, donated: false, own: false, desk: "desk", mine_in: false, mine_donated: false, phone: "500000004" },
    { id: "q3333333", name: "Sara Haddad", number: 4, checked_in: false, donated: false, own: true, desk: null, mine_in: false, mine_donated: false, phone: "500000005" },
  ],
  updates: [],
  push: [],
  certs: new Map(), // session -> certificate
  codes: new Map([["a".repeat(48), "c1"]]),
});
let db = fresh();
let nextUpdate = 1;

const raise = (res, message, details) => {
  res.writeHead(400, { "content-type": "application/json" });
  res.end(JSON.stringify({ message, code: "P0001", details }));
};
// The three lines the database stamps on a certificate (_vol_cert_words, rentals 20261108220000).
const WORDS = {
  female: { lead: "This certificate is proudly presented to", recognition: "in recognition of her time, energy and commitment as a volunteer in", arabic_line: "تقديرًا لعطائها ومشاركتها التطوعية في المبادرة" },
};
const send = (res, data) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};
// _vol_note: one row per person, session and kind, back to the top and unread when it happens again.
const note = (kind, session_id = null, data = {}) => {
  const was = db.updates.find((u) => u.kind === kind && u.session_id === session_id);
  if (was) { Object.assign(was, { data, at: new Date().toISOString(), read: false }); return; }
  db.updates.push({ id: nextUpdate++, kind, session_id, data, at: new Date().toISOString(), read: false });
};
const pub = (o) => { const { briefing, caps, ...rest } = o; void briefing; void caps; return rest; };
const mine = () => [...db.shifts.entries()].map(([id, sh]) => {
  const o = db.opps.find((x) => x.id === id);
  const open = Date.parse(o.closes_at) > Date.now() && (!o.opens_at || Date.parse(o.opens_at) <= Date.now());
  const cert = db.certs.get(id);
  return { id, title: o.title, ride_kind: o.ride_kind, date: o.date, time: o.time, location: o.location, status: sh.status, role: sh.role ?? null, lead: !!sh.lead,
    clock_in: sh.clock_in ?? null, clock_out: sh.clock_out ?? null, opens_at: o.opens_at, closes_at: o.closes_at, starts_at: `${o.date}T17:00:00+03:00`,
    briefing: sh.status === "accepted" || sh.status === "done" ? o.briefing : null,
    can_work: (sh.status === "accepted" || sh.status === "done") && db.rider.status === "active" && open,
    reward: sh.reward ?? null, cert: cert ? { serial: cert.serial, hours: cert.hours } : null };
});
const team = (id) => {
  const sh = db.shifts.get(id);
  const me = { shift: 10, name: db.rider.name, role: sh.role ?? null, status: sh.status, me: true, lead: !!sh.lead, clock_in: sh.clock_in ?? null, clock_out: sh.clock_out ?? null,
    clock_in_by: sh.clock_in_by ?? null, clock_out_by: sh.clock_out_by ?? null, briefed: !!sh.briefed_at };
  return [me, ...db.mates.map((m) => ({ ...m, me: false }))]
    .sort((a, b) => Number(!!b.clock_in && !b.clock_out) - Number(!!a.clock_in && !a.clock_out) || a.name.localeCompare(b.name));
};
const certFor = (session, initiative) => {
  const was = db.certs.get(session);
  if (was) return was;
  const c = { ok: true, id: 2, kind: "session", serial: `MMV-2026-0000${db.certs.size + 2}`, code: "ZZZZ11112222", name: db.rider.name, name_ar: db.rider.name_ar ?? null,
    gender: "female", words: WORDS.female, session_id: session, initiative: initiative || "Micromobility Blood Donation", event_date: "2099-11-05",
    from: "2099-11-05", to: "2099-11-05", hours: db.rider.records.filter((r) => r.session_id === session).reduce((a, r) => a + r.hours, 0) || db.rider.hours, sessions: [], issued_at: "2026-11-08T10:00:00Z" };
  db.certs.set(session, c);
  return c;
};

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://x");
    // ── the scene ──
    if (url.pathname === "/__reset") { db = fresh(); nextUpdate = 1; return send(res, { ok: true }); }
    if (url.pathname === "/__profile") { db.rider.profile_at = new Date().toISOString(); db.rider.days = [5, 6]; if (!db.rider.status) db.rider.status = "applied"; return send(res, { ok: true }); }
    if (url.pathname === "/__approve") { db.rider.profile_at ??= new Date().toISOString(); db.rider.status = "active"; note("approved"); return send(res, { ok: true }); }
    if (url.pathname === "/__accept") {
      db.rider.profile_at ??= new Date().toISOString(); db.rider.status = "active";
      const sh = db.shifts.get(body.id) ?? { status: "interested" };
      sh.status = "accepted"; sh.role = body.role ?? sh.pref_role ?? null;
      db.shifts.set(body.id, sh);
      note("accepted", body.id, { role: sh.role });
      return send(res, { ok: true });
    }
    if (url.pathname === "/__lead") { const sh = db.shifts.get(body.id); sh.lead = true; note("lead", body.id); return send(res, { ok: true }); }
    if (url.pathname === "/__cutoff") { db.opps.find((o) => o.id === body.id).closes_at = soon(-1); return send(res, { ok: true }); }
    if (url.pathname === "/__caps") { Object.assign(db.opps.find((o) => o.id === body.id).caps, body.caps); return send(res, { ok: true }); }
    if (url.pathname === "/__hours") { db.rider.hours = body.hours; return send(res, { ok: true }); }
    if (url.pathname === "/__account") { if ("birth_date" in body) db.rider.birth_date = body.birth_date; if ("emergency" in body) db.rider.emergency = body.emergency; return send(res, { ok: true }); }
    // staff give the hours of an event: its free ride, its certificate and the update that says so (_vol_reward)
    if (url.pathname === "/__reward") {
      const sh = db.shifts.get(body.id) ?? { status: "done" };
      sh.status = "done"; sh.clock_out ??= new Date().toISOString();
      sh.reward = { code: "VL-1A2B3C4D", expires_at: "2099-12-05", used: !!body.used };
      db.shifts.set(body.id, sh);
      db.rider.records.push({ id: db.rider.records.length + 1, hours: body.hours ?? 4, on: "2099-11-05", note: null, session_id: body.id, title: null, ride_kind: "blood" });
      db.rider.hours += body.hours ?? 4;
      const c = certFor(body.id, "Micromobility Blood Donation");
      note("reward", body.id, { code: sh.reward.code, expires_at: sh.reward.expires_at, cert: c.serial });
      return send(res, { ok: true });
    }
    if (url.pathname === "/__state") return send(res, { push: db.push, mates: db.mates, updates: db.updates, bookings: db.bookings });
    const name = url.pathname.split("/rpc/")[1];
    const authed = body.p_id === db.rider.id && body.p_token === db.rider.session_token;
    switch (name) {
      case "customer_login":
        if (body.p_identifier === "sara@example.com" && body.p_pwd === "Pass1234") return send(res, [{ id: "c1", name: db.rider.name, session_token: db.rider.session_token }]);
        return send(res, []);
      case "customer_handoff_redeem": {
        const ok = db.codes.get(body.p_code);
        if (!ok) return send(res, []);
        db.codes.delete(body.p_code);
        return send(res, [{ id: "c1", name: db.rider.name, session_token: db.rider.session_token }]);
      }
      case "volunteer_cert_check": { // anyone holding the code
        const c = [...db.certs.values()].find((x) => x.code === body.p_code);
        return send(res, c ? { ...c, revoked: false } : { ok: false });
      }
      case "volunteer_opportunities":
        return send(res, db.opps.filter((o) => Date.parse(o.closes_at) > Date.now()).map((o) => pub({ ...o, accepted: [...db.shifts.entries()].filter(([id, s]) => id === o.id && s.status === "accepted").length })));
      case "volunteer_me": {
        if (!authed) return send(res, null);
        const sessions = new Set(db.rider.records.map((r) => r.session_id)).size;
        return send(res, { id: "c1", name: db.rider.name, hours: db.rider.hours, account: db.rider.account, status: db.rider.status, profile: !!db.rider.profile_at, agreed: db.rider.agreed,
          promote: false, open_count: 1, unread: db.updates.filter((u) => !u.read).length, mine: mine(),
          record: [...db.rider.records].reverse(), first_on: db.rider.records[0]?.on ?? null, last_on: db.rider.records.at(-1)?.on ?? null, sessions, cert_signer: "The Team", cert_title: null });
      }
      case "volunteer_profile":
        if (!authed) return send(res, null);
        return send(res, { status: db.rider.status, applied_at: db.rider.profile_at, profile_at: db.rider.profile_at, skills: db.rider.skills, days: db.rider.days, shirt: db.rider.shirt,
          whatsapp: db.rider.whatsapp, auto: db.rider.auto, birth_date: db.rider.birth_date, emergency: db.rider.emergency,
          briefed: Object.fromEntries([...db.shifts.entries()].filter(([, s]) => s.briefed_at).map(([id, s]) => [id, s.briefed_at])),
          name_ar: db.rider.name_ar ?? null, gender: "female" });
      case "volunteer_apply": {
        if (!authed) return raise(res, "VOL_TOKEN");
        if (!db.rider.birth_date) return raise(res, "VOL_DOB");
        if (!db.rider.emergency) return raise(res, "VOL_EMERGENCY");
        const days = [...new Set((body.p_days ?? []).filter((d) => d >= 0 && d <= 6))].sort();
        if (!days.length) return raise(res, "BAD_INPUT");
        Object.assign(db.rider, { days, skills: body.p_skills || null, shirt: body.p_shirt || db.rider.shirt, whatsapp: body.p_whatsapp || null });
        db.rider.profile_at ??= new Date().toISOString();
        if (!db.rider.status) db.rider.status = "applied";
        return send(res, { ok: true, status: db.rider.status });
      }
      case "volunteer_name_ar_save": {
        if (!authed) return raise(res, "VOL_TOKEN");
        const v = String(body.p_name_ar ?? "").trim();
        if (/[A-Za-z0-9]/.test(v)) return raise(res, "BAD_INPUT");
        db.rider.name_ar = v || null;
        return send(res, { ok: true, name_ar: db.rider.name_ar });
      }
      case "volunteer_cert_issue":
        if (!authed) return raise(res, "VOL_TOKEN");
        if (!db.rider.hours) return raise(res, "VOL_CERT_EMPTY");
        return send(res, { ok: true, id: 1, kind: "period", serial: "MMV-2026-00001", code: "ABCDEF123456", name: db.rider.name, name_ar: db.rider.name_ar ?? null,
          gender: "female", words: WORDS.female, from: body.p_from, to: body.p_to, hours: db.rider.hours, sessions: [], issued_at: "2026-11-08T10:00:00Z" });
      case "volunteer_cert_issue_session":
        if (!authed) return raise(res, "VOL_TOKEN");
        if (!db.rider.records.some((r) => r.session_id === body.p_session)) return raise(res, "VOL_CERT_EMPTY");
        return send(res, certFor(body.p_session, body.p_initiative)); // the one already made, if there is one
      case "volunteer_updates":
        if (!authed) return raise(res, "VOL_TOKEN");
        return send(res, { items: [...db.updates].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).map((u) => {
          const o = db.opps.find((x) => x.id === u.session_id);
          return { ...u, title: o?.title ?? null, ride_kind: o?.ride_kind ?? null, date: o?.date ?? null };
        }), unread: db.updates.filter((u) => !u.read).length });
      case "volunteer_updates_seen": {
        if (!authed) return raise(res, "VOL_TOKEN");
        const n = db.updates.filter((u) => !u.read).length;
        for (const u of db.updates) u.read = true;
        return send(res, { ok: true, n });
      }
      case "customer_push_subscribe":
        if (!authed) return send(res, false);
        db.push = db.push.filter((p) => p.endpoint !== body.p_endpoint).concat([{ endpoint: body.p_endpoint, p256dh: body.p_p256dh, auth: body.p_auth }]);
        return send(res, true);
      case "customer_push_unsubscribe":
        if (!authed) return send(res, false);
        db.push = db.push.filter((p) => p.endpoint !== body.p_endpoint);
        return send(res, true);
    }
    if (!authed) return raise(res, "VOL_TOKEN");
    const o = db.opps.find((x) => x.id === body.p_session);
    const open = o && Date.parse(o.closes_at) > Date.now();
    const gate = () => {
      if (!open) return "VOL_CLOSED";
      if (!db.rider.agreed) return "VOL_AGREE";
      const sh = db.shifts.get(o.id);
      if (sh?.status !== "accepted" && sh?.status !== "done") return "VOL_NOT_ACCEPTED";
      return null;
    };
    switch (name) {
      case "volunteer_interest": {
        if (!open) return raise(res, "VOL_CLOSED");
        const sh = db.shifts.get(o.id);
        if (body.p_on) {
          if (sh && ["interested", "accepted", "done"].includes(sh.status)) return send(res, { ok: true, noop: true, status: sh.status });
          if (sh && ["declined", "no_show", "ended"].includes(sh.status)) return raise(res, "VOL_DECLINED");
          // the profile first, then staff's yes on the person (20261109120000)
          if (db.rider.status !== "active") return raise(res, db.rider.profile_at ? "VOL_PENDING" : "VOL_PROFILE");
          if (!o.signup_open) return raise(res, "VOL_SIGNUP_CLOSED");
          const st = db.rider.auto ? "accepted" : "interested";
          db.shifts.set(o.id, { status: st, pref_role: body.p_role, message: body.p_message });
          return send(res, { ok: true, status: st });
        }
        if (!sh || sh.status === "withdrawn") return send(res, { ok: true, noop: true, status: "withdrawn" });
        if (sh.clock_in) return raise(res, "VOL_ALREADY_IN");
        sh.status = "withdrawn"; sh.lead = false;
        return send(res, { ok: true, status: "withdrawn" });
      }
      case "volunteer_agree": db.rider.agreed = true; return send(res, { ok: true });
      case "volunteer_brief_ack": {
        const sh = db.shifts.get(o?.id);
        if (!sh) return raise(res, "VOL_NOT_ACCEPTED");
        sh.briefed_at = new Date().toISOString();
        return send(res, { ok: true, briefed_at: sh.briefed_at });
      }
      case "volunteer_enter": {
        const no = gate();
        if (no) return raise(res, no);
        const sh = db.shifts.get(o.id);
        return send(res, { ok: true, closes_at: o.closes_at, caps: o.caps, briefing: o.briefing, hours_mode: o.hours_mode, clock_in: sh.clock_in ?? null, clock_out: sh.clock_out ?? null,
          clock_out_by: sh.clock_out_by ?? null, role: sh.role ?? null, lead: !!sh.lead, mine: 0,
          counts: o.caps.counts ? { booked: db.bookings.length, in: db.bookings.filter((b) => b.checked_in).length, donated: db.bookings.filter((b) => b.donated).length, visitors: db.bookings.filter((b) => b.visitor).length } : null });
      }
      case "volunteer_arrive": {
        const no = gate();
        if (no) return raise(res, no);
        const sh = db.shifts.get(o.id);
        if (sh.clock_out && sh.clock_out_by !== "self") return raise(res, "VOL_CHECKED_OUT");
        sh.clock_in = sh.clock_in ?? new Date().toISOString(); sh.clock_in_by ??= "self"; sh.clock_out = null; sh.clock_out_by = null;
        return send(res, { ok: true, clock_in: sh.clock_in, clock_out: null });
      }
      case "volunteer_clock_out": { const sh = db.shifts.get(body.p_session); sh.clock_out = new Date().toISOString(); sh.clock_out_by = "self"; return send(res, { ok: true }); }
      case "volunteer_team": {
        const no = gate();
        if (no) return raise(res, no);
        if (!db.shifts.get(o.id).lead) return raise(res, "VOL_NOT_LEAD");
        return send(res, team(o.id));
      }
      case "volunteer_team_clock": {
        const no = gate();
        if (no) return raise(res, no);
        if (!db.shifts.get(o.id).lead) return raise(res, "VOL_NOT_LEAD");
        if (!["in", "out", "undo_in", "undo_out"].includes(body.p_action)) return raise(res, "BAD_INPUT");
        const m = db.mates.find((x) => x.shift === body.p_shift);
        if (!m) return raise(res, "NOT_FOUND");
        const now = new Date().toISOString();
        if (body.p_action === "in") {
          if (m.clock_in && !m.clock_out) return send(res, { ok: true, noop: true });
          if (m.clock_out && m.clock_out_by === "staff") return raise(res, "VOL_CHECKED_OUT");
          m.clock_in_by = m.clock_in ? m.clock_in_by : "lead"; m.clock_in = m.clock_in ?? now; m.clock_out = null; m.clock_out_by = null;
        } else if (body.p_action === "out") {
          if (!m.clock_in || m.clock_out) return send(res, { ok: true, noop: true });
          m.clock_out = now; m.clock_out_by = "lead";
        } else if (body.p_action === "undo_in") {
          if (m.clock_in_by !== "lead" || m.clock_out) return raise(res, "VOL_NOT_YOURS");
          m.clock_in = null; m.clock_in_by = null;
        } else {
          if (m.clock_out_by !== "lead") return raise(res, "VOL_NOT_YOURS");
          m.clock_out = null; m.clock_out_by = null;
        }
        return send(res, { ok: true, shift: m.shift, clock_in: m.clock_in, clock_out: m.clock_out, clock_in_by: m.clock_in_by, clock_out_by: m.clock_out_by });
      }
      case "volunteer_find": {
        if (!open) return raise(res, "VOL_CLOSED");
        const hit = db.bookings.filter((b) => (body.p_number != null && b.number === body.p_number) || (body.p_mobile && b.phone === body.p_mobile.replace(/^0/, "")) || (body.p_ref && b.id.startsWith(body.p_ref)));
        return send(res, hit.map((b) => { const c = { ...b }; delete c.phone; return c; }));
      }
      case "volunteer_list": {
        if (!open) return raise(res, "VOL_CLOSED");
        const caps = db.opps.find((x) => x.id === body.p_session).caps;
        if (!caps.list) return raise(res, "VOL_CAP");
        return send(res, db.bookings.map((b) => {
          const c = { ...b };
          if (!caps.phone) delete c.phone;
          if (!caps.details) { delete c.blood_type; delete c.club; delete c.status; }
          return c;
        }));
      }
      case "volunteer_checkin": {
        if (!open) return raise(res, "VOL_CLOSED");
        const b = db.bookings.find((x) => x.id === body.p_entry_id);
        if (b.own) return raise(res, "VOL_OWN_BOOKING");
        if (b.desk) return raise(res, "VOL_ASK_DESK", b.desk);
        if (b.checked_in === body.p_on) return send(res, { ok: true, noop: true });
        b.checked_in = body.p_on; b.mine_in = body.p_on;
        return send(res, { ok: true });
      }
      case "volunteer_donated": {
        if (!open) return raise(res, "VOL_CLOSED");
        const b = db.bookings.find((x) => x.id === body.p_entry_id);
        if (body.p_on && b.visitor) return raise(res, "BLOOD_VISITOR");
        b.donated = body.p_on; b.mine_donated = body.p_on;
        return send(res, { ok: true });
      }
      case "volunteer_blood_role": {
        if (!open) return raise(res, "VOL_CLOSED");
        const b = db.bookings.find((x) => x.id === body.p_entry_id);
        if (b.own) return raise(res, "VOL_OWN_BOOKING");
        if (body.p_role === "visitor" && b.donated) return raise(res, "BLOOD_DONATED");
        b.visitor = body.p_role === "visitor";
        return send(res, { ok: true, role: body.p_role });
      }
    }
    return raise(res, `unknown ${name}`);
  });
});
server.listen(PORT, "127.0.0.1");
