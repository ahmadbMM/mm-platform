// A stand-in for the database's portal functions (POST /rest/v1/rpc/<name>), in memory, for the browser test. It keeps the
// real functions' rules only as far as the page needs them: those are tested against a real Postgres when they are written
// (rentals migrations 20261105120000 onwards; the rework, 20261109120000; the enhancements, 20261111140000). One rider:
// sara@example.com / Pass1234. Test-only routes (POST /__name) set the scene; /__old answers as a database from before
// the enhancements (none of their fields), which the page must still draw.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8801);
const soon = (h) => new Date(Date.now() + h * 3600000).toISOString();
const ksaDay = (days = 0) => new Date(Date.now() + 3 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const fresh = () => ({
  rider: { id: "c1", name: "Sara Haddad", name_ar: "سارة حداد", session_token: "tok-sara-0123456789", hours: 0, status: null, profile_at: null, agreed: false,
    account: null, auto: false, skills: null, days: [], shirt: null, whatsapp: null, birth_date: "1995-04-02", gender: "female", motive: null, reason: null,
    emergency: { name: "Huda Haddad", phone: "+966500000009", relation: "Sister" }, records: [] },
  old: false, // a database from before 20261111140000
  feedback: new Map(), // session -> { rating, again, comment }
  opps: [
    { id: "2099-11-05-bd", title: null, ride_kind: "blood", event_kind: "community", date: "2099-11-05", time: "17:00 - 23:00", location: "JCC", about: "Help donors at the door.", needed: 5,
      roles: ["Check-in", "Guide"], min_age: 18, hours_mode: "clock", fixed_hours: null, signup_open: true, opens_at: null, closes_at: soon(4), accepted: 0, briefing: "Meet at gate 3.",
      caps: { checkin: true, undo: true, donated: true, list: false, counts: true },
      // what staff wrote for the day (20261111140000)
      meet_point: "North gate, by the flags", meet_map: "https://maps.google.com/?q=21.5433,39.1728", bring: "Comfortable shoes and a cap", provided: "Water and a snack",
      shirt_pickup: "At the desk from 4 PM", demands: "Standing for about three hours", contact_name: "Ahmad", contact_phone: "+966500000010", partner: "Saudi Red Crescent",
      partner_ar: "هيئة الهلال الأحمر السعودي", skills: "Event check-in and guiding", skills_ar: "تسجيل الحضور والإرشاد", gender: null, thanks_note: null },
    { id: "2099-12-01", title: "Beach clean-up", ride_kind: "event", event_kind: "community", date: "2099-12-01", time: null, location: null, about: null, needed: null,
      roles: [], min_age: null, hours_mode: "fixed", fixed_hours: 3, signup_open: false, opens_at: soon(100), closes_at: soon(200), accepted: 0, briefing: null, caps: {},
      meet_point: null, meet_map: null, bring: null, provided: null, shirt_pickup: null, demands: null, contact_name: null, contact_phone: null, partner: null, partner_ar: null,
      skills: null, skills_ar: null, gender: null, thanks_note: null },
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
// what volunteer_opportunities shows anyone: no briefing, no caps, no contact, no thanks; nothing of 20261111140000 on an old database
const NEW_OPP = ["meet_point", "meet_map", "bring", "provided", "shirt_pickup", "demands", "partner", "partner_ar", "skills", "skills_ar", "gender"];
const pub = (o) => {
  const { briefing, caps, contact_name, contact_phone, thanks_note, ...rest } = o; void briefing; void caps; void contact_name; void contact_phone; void thanks_note;
  if (db.old) for (const k of NEW_OPP) delete rest[k];
  return rest;
};
const mine = () => [...db.shifts.entries()].map(([id, sh]) => {
  const o = db.opps.find((x) => x.id === id);
  const open = Date.parse(o.closes_at) > Date.now() && (!o.opens_at || Date.parse(o.opens_at) <= Date.now());
  const cert = db.certs.get(id);
  return { id, title: o.title, ride_kind: o.ride_kind, date: o.date, time: o.time, location: o.location, status: sh.status, role: sh.role ?? null, lead: !!sh.lead,
    clock_in: sh.clock_in ?? null, clock_out: sh.clock_out ?? null, opens_at: o.opens_at, closes_at: o.closes_at, starts_at: `${o.date}T17:00:00+03:00`,
    briefing: sh.status === "accepted" || sh.status === "done" ? o.briefing : null, cancelled: false,
    can_work: (sh.status === "accepted" || sh.status === "done") && db.rider.status === "active" && open,
    reward: sh.reward ?? null, cert: cert ? { serial: cert.serial, hours: cert.hours } : null,
    ...(db.old ? {} : enhanced(o, sh)) };
});
// every key of 20261111140000 on each shift, null where it does not apply (as volunteer_me sends them)
const enhanced = (o, sh) => {
  const team = sh.status === "accepted" || sh.status === "done";
  const worked = sh.status === "done" || (sh.status === "accepted" && !!sh.clock_in);
  const over = o.date < ksaDay() || Date.parse(o.closes_at) <= Date.now();
  const fb = db.feedback.get(o.id);
  return {
    plan_leave: sh.plan_leave ?? null, coming_at: sh.coming_at ?? null, withdraw_reason: sh.withdraw_reason ?? null,
    reason: sh.status === "declined" || sh.status === "ended" ? sh.decline_reason ?? null : null,
    feedback: fb ? { rating: fb.rating, again: fb.again } : null,
    thanks: sh.status === "done" && o.thanks_note ? { note: o.thanks_note, at: new Date().toISOString() } : null,
    impact: worked && over ? { checked_in: db.bookings.filter((b) => b.checked_in).length, donated: o.ride_kind === "blood" ? db.bookings.filter((b) => b.donated).length : null } : null,
    contact_name: team ? o.contact_name : null, contact_phone: team ? o.contact_phone : null, meet_point: team ? o.meet_point : null, meet_map: team ? o.meet_map : null,
    bring: team ? o.bring : null, provided: team ? o.provided : null, shirt_pickup: team ? o.shirt_pickup : null, demands: team ? o.demands : null,
    ends_at: team && o.time ? `${o.date}T23:00:00+03:00` : null,
  };
};
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
    gender: "female", words: WORDS.female, session_id: session, initiative: initiative || "MicroMobility Blood Donation", event_date: "2099-11-05",
    role: db.shifts.get(session)?.role ?? null, skills: "Event check-in and guiding", skills_ar: "تسجيل الحضور والإرشاد", partner: "Saudi Red Crescent", partner_ar: "هيئة الهلال الأحمر السعودي",
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
      const c = certFor(body.id, "MicroMobility Blood Donation");
      note("reward", body.id, { code: sh.reward.code, expires_at: sh.reward.expires_at, cert: c.serial });
      return send(res, { ok: true });
    }
    // the enhancements' scenes: the day of a session (days from today in Riyadh), staff's no with a reason, staff's thanks,
    // hours with no session, an opportunity's fields, the motive, and a database from before them
    if (url.pathname === "/__date") { const o = db.opps.find((x) => x.id === body.id); o.date = ksaDay(body.days); return send(res, { ok: true, date: o.date }); }
    if (url.pathname === "/__opp") { Object.assign(db.opps.find((x) => x.id === body.id), body.patch); return send(res, { ok: true }); }
    if (url.pathname === "/__decline") {
      const sh = db.shifts.get(body.id) ?? { status: "interested" };
      sh.status = "declined"; sh.decline_reason = body.reason ?? null; sh.lead = false;
      db.shifts.set(body.id, sh);
      note("declined", body.id, { reason: sh.decline_reason });
      return send(res, { ok: true });
    }
    if (url.pathname === "/__thanks") {
      const o = db.opps.find((x) => x.id === body.id); o.thanks_note = body.note;
      note("thanks", body.id, { note: body.note });
      return send(res, { ok: true });
    }
    if (url.pathname === "/__extra") {
      db.rider.records.push({ id: db.rider.records.length + 100, hours: body.hours ?? 2, on: body.on ?? "2026-10-20", note: "Set-up help", session_id: null, title: null, ride_kind: null });
      db.rider.hours += body.hours ?? 2;
      return send(res, { ok: true });
    }
    if (url.pathname === "/__old") { db.old = true; return send(res, { ok: true }); }
    if (url.pathname === "/__state") return send(res, { push: db.push, mates: db.mates, updates: db.updates, bookings: db.bookings, rider: db.rider,
      shifts: Object.fromEntries(db.shifts), feedback: Object.fromEntries(db.feedback) });
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
        const sessions = new Set(db.rider.records.filter((r) => r.session_id).map((r) => r.session_id)).size;
        const me = { id: "c1", name: db.rider.name, hours: db.rider.hours, account: db.rider.account, status: db.rider.status, profile: !!db.rider.profile_at, agreed: db.rider.agreed,
          promote: false, open_count: 1, unread: db.updates.filter((u) => !u.read).length, mine: mine(),
          record: [...db.rider.records].reverse(), first_on: db.rider.records[0]?.on ?? null, last_on: db.rider.records.at(-1)?.on ?? null, sessions,
          cert_signer: "The Team", cert_title: null };
        if (!db.old) {
          me.team = { hours: 54 + db.rider.hours, volunteers: 10, events: 1 };
          me.extra_hours = db.rider.records.filter((r) => !r.session_id).map((r) => ({ id: r.id, on: r.on, hours: r.hours })).reverse();
        }
        return send(res, me);
      }
      case "volunteer_profile":
        if (!authed) return send(res, null);
        return send(res, { status: db.rider.status, applied_at: db.rider.profile_at, profile_at: db.rider.profile_at, skills: db.rider.skills, days: db.rider.days, shirt: db.rider.shirt,
          whatsapp: db.rider.whatsapp, auto: db.rider.auto, birth_date: db.rider.birth_date, emergency: db.rider.emergency,
          briefed: Object.fromEntries([...db.shifts.entries()].filter(([, s]) => s.briefed_at).map(([id, s]) => [id, s.briefed_at])),
          name_ar: db.rider.name_ar ?? null, gender: db.rider.gender, ...(db.old ? {} : { motive: db.rider.motive, reason: db.rider.status === "removed" ? db.rider.reason : null }) });
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
      case "volunteer_motive": {
        if (!authed) return raise(res, "VOL_TOKEN");
        if (!db.rider.status) return raise(res, "VOL_PROFILE");
        const m = body.p_motive ?? null;
        if (m !== null && !["community", "learn", "cv", "people", "active"].includes(m)) return raise(res, "BAD_INPUT");
        db.rider.motive = m;
        return send(res, { ok: true, motive: m });
      }
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
          if (!db.rider.birth_date) return raise(res, "VOL_DOB"); // any new offer, since 20261111140000
          if (!o.signup_open) return raise(res, "VOL_SIGNUP_CLOSED");
          if (o.gender && o.gender !== db.rider.gender) return raise(res, "VOL_GENDER");
          const st = db.rider.auto ? "accepted" : "interested";
          db.shifts.set(o.id, { status: st, pref_role: body.p_role, message: body.p_message });
          return send(res, { ok: true, status: st });
        }
        if (!sh || sh.status === "withdrawn") return send(res, { ok: true, noop: true, status: "withdrawn" });
        if (sh.clock_in) return raise(res, "VOL_ALREADY_IN");
        sh.status = "withdrawn"; sh.lead = false;
        return send(res, { ok: true, status: "withdrawn" });
      }
      // the plan, "Still coming?", how it was (20261111140000)
      case "volunteer_plan": {
        const sh = db.shifts.get(o?.id);
        if (!sh || sh.status !== "accepted") return raise(res, "VOL_NOT_ACCEPTED");
        const v = body.p_leave == null || body.p_leave === "" ? null : String(body.p_leave);
        if (v !== null && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) return raise(res, "BAD_INPUT");
        sh.plan_leave = v ? v.padStart(5, "0") : null;
        return send(res, { ok: true, plan_leave: sh.plan_leave });
      }
      case "volunteer_coming": {
        const sh = db.shifts.get(o?.id);
        if (sh?.status === "withdrawn" && !body.p_yes) return send(res, { ok: true, noop: true, status: "withdrawn" });
        if (!sh || sh.status !== "accepted") return raise(res, "VOL_NOT_ACCEPTED");
        if (sh.clock_in) return raise(res, "VOL_ALREADY_IN");
        if (!open) return raise(res, "VOL_CLOSED");
        if (body.p_reason != null && !["sick", "clash", "travel", "transport", "other"].includes(body.p_reason)) return raise(res, "BAD_INPUT");
        if (body.p_yes) { sh.coming_at ??= new Date().toISOString(); return send(res, { ok: true, coming_at: sh.coming_at }); }
        sh.status = "withdrawn"; sh.withdraw_reason = body.p_reason ?? null; sh.lead = false;
        return send(res, { ok: true, status: "withdrawn" });
      }
      case "volunteer_feedback": {
        const sh = db.shifts.get(o?.id);
        if (!sh || !(sh.status === "done" || (sh.status === "accepted" && o.date < ksaDay()))) return raise(res, "VOL_NOT_ACCEPTED");
        if (!(body.p_rating >= 1 && body.p_rating <= 5) || (body.p_again != null && !["yes", "maybe", "no"].includes(body.p_again))) return raise(res, "BAD_INPUT");
        db.feedback.set(o.id, { rating: body.p_rating, again: body.p_again ?? null, comment: body.p_comment ?? null });
        return send(res, { ok: true });
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
