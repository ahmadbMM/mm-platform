/* eslint-disable */
// @ts-nocheck
// GENERATED from forms/shared/account.js by `npm run build` in forms/community or forms/defe. Do not edit here:
// change forms/shared/account.js, then rebuild both forms. Typed for the website in lib/account-step.ts.
/* The account step the account forms share (the owner, 2026-10-25: "one shared sign-in and account step", so a
   fix lands on every form at once). forms/community and forms/defe inline this file (their builds read it), and
   the website's Learn to ride form imports apps/web/src/lib/account-shared.ts, which those builds write from it
   (CI rebuilds the forms and refuses a stale copy). There is no page here: each form draws its own boxes in its
   own words; this file decides what a sign-in, a hand-over and a signed-in account's questions come to.

     ident(raw)               what customer_login takes for what was typed: an email in lower case, or a mobile
                              in E.164 (+966 when it has no code; a Saudi 05X / 5X / 9665X number as +9665X)
     signIn(rpc, raw, pwd)    customer_login, then customer_pwd_state: {row} or {error, cc}
                                error: id (nothing typed), pwd (no password), locked (too many tries),
                                busy (the network's limit), network, wrong (cc: a number typed without its
                                country code that is not a Saudi mobile), temp (a temporary password, changed
                                on the booking site first)
     takeCode()               the booking site's hand-over code (?code=), taken out of the address at once
     redeem(rpc, code)        customer_handoff_redeem: {row} or {error: expired | network}
     plan(me, keys)           a signed-in account's questions (the owner, 2026-10-25: "don't ask for the fields
                              he already has filled, only if flagged"): skip what the account holds unless
                              staff flagged it (me.flags = customers.fix_fields); {skip, ask, flagged}
     draft(key, days)         a half-filled form kept on this device for a few days: {load, save, clear}

   rpc(fn, body) is the form's own: it answers {data} or {error: {message, code}} and never throws. */
var MMAccount = (function () {
  "use strict";
  // Arabic-Indic, Persian, Devanagari and Bengali digits as 0-9.
  var DIGITS = /[٠-٩۰-۹०-९০-৯]/g;
  function ascii(s) {
    return String(s == null ? "" : s).replace(DIGITS, function (c) {
      var n = c.charCodeAt(0), base = n >= 0x09E6 ? 0x09E6 : n >= 0x0966 ? 0x0966 : n >= 0x06F0 ? 0x06F0 : 0x0660;
      return String(n - base);
    });
  }
  // Direction marks and invisible spaces a paste from a right-to-left contact card carries.
  function bare(s) { return String(s == null ? "" : s).replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, "").trim(); }

  function ident(raw) {
    var v = bare(raw), low = v.toLowerCase();
    if (!v) return "";
    if (low.indexOf("@") >= 0) return low.replace(/\s+/g, "");
    var s = ascii(v).replace(/[\s()\-.]/g, "");
    if (s[0] === "+") { var x = s.slice(1).replace(/\D/g, ""); if (x.indexOf("9660") === 0) x = "966" + x.slice(4); return x ? "+" + x : ""; }
    s = s.replace(/\D/g, "");
    if (!s) return low;
    if (s.slice(0, 2) === "00") { var y = s.slice(2); if (y.indexOf("9660") === 0) y = "966" + y.slice(4); return "+" + y; }
    if (/^9665\d{8}$/.test(s)) return "+" + s;
    if (s[0] === "0") return "+966" + s.slice(1);
    if (s.length >= 11) return "+" + s; // a number pasted with its code and no plus
    return "+966" + s;
  }

  function errText(e) { return String((e && (e.code || "")) + " " + (e && e.message || "") + " " + (e && e.details || "") + " " + (e && e.hint || "")); }

  async function signIn(rpc, raw, pwd) {
    var id = ident(raw);
    if (!id) return { error: "id" };
    if (!pwd) return { error: "pwd" };
    var r = await rpc("customer_login", { p_identifier: id, p_pwd: pwd });
    if (r.error) {
      var m = errText(r.error);
      if (/LOCKED/.test(m)) return { error: "locked" };
      if (/RATE_LIMITED/.test(m)) return { error: "busy" };
      if (r.error.message === "network" || /^HTTP 5|PGRST/.test(r.error.message || "")) return { error: "network" };
      return { error: "wrong" };
    }
    var row = Array.isArray(r.data) ? r.data[0] : null;
    if (!row || !row.id || !row.session_token) {
      return { error: "wrong", cc: id.indexOf("@") < 0 && !/^\s*(\+|00)/.test(bare(raw)) && !/^\+9665\d{8}$/.test(id) };
    }
    // A password staff issued (a temporary one) is replaced before the account is used, as the booking site asks.
    var ps = await rpc("customer_pwd_state", { p_id: row.id, p_token: row.session_token });
    if (ps.data === true) return { error: "temp" };
    return { row: row };
  }

  function takeCode() {
    var q = new URLSearchParams(location.search), code = q.get("code");
    if (code == null) return null;
    q.delete("code");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
    return code;
  }

  async function redeem(rpc, code) {
    if (!/^[0-9a-f]{48}$/.test(String(code || ""))) return { error: "expired" };
    var r = await rpc("customer_handoff_redeem", { p_code: code });
    var row = Array.isArray(r.data) ? r.data[0] : null;
    if (!row || !row.id || !row.session_token) return { error: r.error && r.error.message === "network" ? "network" : "expired" };
    return { row: row };
  }

  // What the account already answers, question by question (customer_community_me's names).
  var HAS = {
    whatsapp: function (me) { return me.whatsapp_same === true || (me.whatsapp_same === false && !!bare(me.whatsapp)); },
    birth_date: function (me) { return /^\d{4}-\d{2}-\d{2}$/.test(String(me.birth_date || "")); },
    nationality: function (me) { return !!bare(me.nationality); },
    instagram: function (me) { return !!bare(me.instagram); },
    linkedin: function (me) { return !!bare(me.linkedin); },
    profession: function (me) { return !!bare(me.profession); },
    workplace: function (me) { return !!bare(me.workplace); },
    own_bike: function (me) { return typeof me.own_bike === "boolean"; },
    bike_type: function (me) { return !!bare(me.bike_type); },
    heard_from: function (me) { return !!bare(me.heard_from); },
    height: function (me) { return typeof me.height === "number" && me.height >= 100 && me.height <= 250; },
    gender: function (me) { return me.gender === "male" || me.gender === "female"; }
  };
  function plan(me, keys) {
    var flags = me && Array.isArray(me.flags) ? me.flags.map(String) : [], out = { skip: [], ask: [], flagged: [] };
    (keys || Object.keys(HAS)).forEach(function (k) {
      var has = !!me && !!HAS[k] && HAS[k](me), fl = flags.indexOf(k) >= 0;
      if (fl) out.flagged.push(k);
      (has && !fl ? out.skip : out.ask).push(k);
    });
    return out;
  }

  // A form's answers kept on this device so a closed tab or a reload does not lose them. Never a password or a
  // session (the form leaves those out); gone after `days`, and the moment the form is sent or started over.
  function draft(key, days) {
    var ttl = (days || 3) * 86400000;
    function load() {
      try {
        var v = JSON.parse(localStorage.getItem(key) || "null");
        if (!v || typeof v !== "object" || !(v.at > 0) || Date.now() - v.at > ttl || !v.data || typeof v.data !== "object") { clear(); return null; }
        return v.data;
      } catch (e) { return null; }
    }
    function save(data) { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {} }
    function clear() { try { localStorage.removeItem(key); } catch (e) {} }
    return { load: load, save: save, clear: clear };
  }

  return { ident: ident, signIn: signIn, takeCode: takeCode, redeem: redeem, plan: plan, has: function (me, k) { return !!me && !!HAS[k] && HAS[k](me); }, draft: draft };
})();

export default MMAccount;
