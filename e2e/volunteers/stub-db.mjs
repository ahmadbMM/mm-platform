// A stand-in for the database's portal functions (POST /rest/v1/rpc/<name>), in memory, for the browser test. It keeps the
// real functions' rules only as far as the page needs them: those are tested against a real Postgres when they are written
// (rentals migration 20261105120000). One rider: sara@example.com / Pass1234. Test-only routes (POST /__name) set the scene.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT || 8801);
const soon = (h) => new Date(Date.now() + h * 3600000).toISOString();
const fresh = () => ({
  rider: { id: "c1", name: "Sara Haddad", session_token: "tok-sara-0123456789", hours: 0, status: null, agreed: false, account: null },
  opps: [
    { id: "2099-11-05-bd", title: null, ride_kind: "blood", event_kind: "community", date: "2099-11-05", time: "17:00 - 23:00", location: "JCC", about: "Help donors at the door.", needed: 5,
      roles: ["Check-in", "Guide"], min_age: 18, hours_mode: "clock", fixed_hours: null, signup_open: true, opens_at: null, closes_at: soon(4), accepted: 0, briefing: "Meet at gate 3.", caps: { checkin: true, undo: true, donated: true, list: false, counts: true } },
    { id: "2099-12-01", title: "Beach clean-up", ride_kind: "event", event_kind: "community", date: "2099-12-01", time: null, location: null, about: null, needed: null,
      roles: [], min_age: null, hours_mode: "fixed", fixed_hours: 3, signup_open: false, opens_at: soon(100), closes_at: soon(200), accepted: 0, briefing: null, caps: {} },
  ],
  shifts: new Map(),
  bookings: [
    { id: "q1111111", name: "Dana Donor", number: 2, checked_in: false, donated: false, own: false, desk: null, mine_in: false, mine_donated: false, phone: "500000003" },
    { id: "q2222222", name: "Ali Owes", number: 3, checked_in: false, donated: false, own: false, desk: "desk", mine_in: false, mine_donated: false, phone: "500000004" },
    { id: "q3333333", name: "Sara Haddad", number: 4, checked_in: false, donated: false, own: true, desk: null, mine_in: false, mine_donated: false, phone: "500000005" },
  ],
  codes: new Map([["a".repeat(48), "c1"]]),
});
let db = fresh();

const raise = (res, message, details) => {
  res.writeHead(400, { "content-type": "application/json" });
  res.end(JSON.stringify({ message, code: "P0001", details }));
};
const send = (res, data) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};
const pub = (o) => { const { briefing, caps, ...rest } = o; void briefing; void caps; return rest; };
const mine = () => [...db.shifts.entries()].map(([id, sh]) => {
  const o = db.opps.find((x) => x.id === id);
  const open = Date.parse(o.closes_at) > Date.now() && (!o.opens_at || Date.parse(o.opens_at) <= Date.now());
  return { id, title: o.title, ride_kind: o.ride_kind, date: o.date, time: o.time, location: o.location, status: sh.status, role: sh.role ?? null, clock_in: sh.clock_in ?? null, clock_out: sh.clock_out ?? null,
    opens_at: o.opens_at, closes_at: o.closes_at, briefing: sh.status === "accepted" ? o.briefing : null, can_work: sh.status === "accepted" && db.rider.status === "active" && open };
});

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__reset") { db = fresh(); return send(res, { ok: true }); }
    if (url.pathname === "/__accept") { db.shifts.get(body.id).status = "accepted"; db.rider.status = "active"; return send(res, { ok: true }); }
    if (url.pathname === "/__cutoff") { db.opps.find((o) => o.id === body.id).closes_at = soon(-1); return send(res, { ok: true }); }
    if (url.pathname === "/__hours") { db.rider.hours = body.hours; return send(res, { ok: true }); }
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
      case "volunteer_opportunities":
        return send(res, db.opps.filter((o) => Date.parse(o.closes_at) > Date.now()).map((o) => pub({ ...o, accepted: [...db.shifts.entries()].filter(([id, s]) => id === o.id && s.status === "accepted").length })));
      case "volunteer_me":
        if (!authed) return send(res, null);
        return send(res, { id: "c1", name: db.rider.name, hours: db.rider.hours, account: db.rider.account, status: db.rider.status, agreed: db.rider.agreed, promote: false, open_count: 1, mine: mine(),
          record: db.rider.hours ? [{ id: 1, hours: db.rider.hours, on: "2099-11-05", note: null, session_id: "2099-11-05-bd", title: null, ride_kind: "blood" }] : [], first_on: db.rider.hours ? "2099-11-05" : null, last_on: db.rider.hours ? "2099-11-05" : null, sessions: db.rider.hours ? 1 : 0, cert_signer: "The Team", cert_title: null });
    }
    if (!authed) return raise(res, "VOL_TOKEN");
    const o = db.opps.find((x) => x.id === body.p_session);
    const open = o && Date.parse(o.closes_at) > Date.now();
    switch (name) {
      case "volunteer_interest": {
        if (!open) return raise(res, "VOL_CLOSED");
        if (body.p_on) {
          if (!db.rider.status) db.rider.status = "applied";
          db.shifts.set(o.id, { status: "interested", pref_role: body.p_role, message: body.p_message });
          return send(res, { ok: true, status: "interested" });
        }
        db.shifts.get(o.id).status = "withdrawn";
        return send(res, { ok: true, status: "withdrawn" });
      }
      case "volunteer_agree": db.rider.agreed = true; return send(res, { ok: true });
      case "volunteer_enter": {
        if (!open) return raise(res, "VOL_CLOSED");
        if (!db.rider.agreed) return raise(res, "VOL_AGREE");
        const sh = db.shifts.get(o.id);
        if (sh?.status !== "accepted") return raise(res, "VOL_NOT_ACCEPTED");
        sh.clock_in = sh.clock_in ?? new Date().toISOString(); sh.clock_out = null;
        return send(res, { ok: true, closes_at: o.closes_at, caps: o.caps, briefing: o.briefing, hours_mode: o.hours_mode, clock_in: sh.clock_in, role: sh.role ?? null, mine: 0,
          counts: o.caps.counts ? { booked: db.bookings.length, in: db.bookings.filter((b) => b.checked_in).length, donated: db.bookings.filter((b) => b.donated).length } : null });
      }
      case "volunteer_clock_out": db.shifts.get(body.p_session).clock_out = new Date().toISOString(); return send(res, { ok: true });
      case "volunteer_find": {
        if (!open) return raise(res, "VOL_CLOSED");
        const hit = db.bookings.filter((b) => (body.p_number != null && b.number === body.p_number) || (body.p_mobile && b.phone === body.p_mobile.replace(/^0/, "")) || (body.p_ref && b.id.startsWith(body.p_ref)));
        return send(res, hit.map((b) => { const c = { ...b }; delete c.phone; return c; }));
      }
      case "volunteer_checkin": {
        if (!open) return raise(res, "VOL_CLOSED");
        const b = db.bookings.find((x) => x.id === body.p_entry_id);
        if (b.own) return raise(res, "VOL_OWN_BOOKING");
        if (b.desk) return raise(res, "VOL_ASK_DESK", b.desk);
        b.checked_in = body.p_on; b.mine_in = body.p_on;
        return send(res, { ok: true });
      }
      case "volunteer_donated": {
        if (!open) return raise(res, "VOL_CLOSED");
        const b = db.bookings.find((x) => x.id === body.p_entry_id);
        b.donated = body.p_on; b.mine_donated = body.p_on;
        return send(res, { ok: true });
      }
    }
    return raise(res, `unknown ${name}`);
  });
});
server.listen(PORT, "127.0.0.1");
