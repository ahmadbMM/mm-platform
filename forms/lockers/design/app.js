/* The lockers page (micromobility.sa/lockers): a rider reserves a locker for an evening from a drawing of the cabinet
   itself (the owner, 2026-11-09: "customers who dont have an account to be able to sign up when scanning the qr code
   of ... micromobility.sa/lockers to reserve a locker ... choose the locker they want from a dynamic lockers
   distribution that simulates how it look in real life it has 3 columns and 6 rows total of 18 lockers"). In order:
   1. the evening (locker_evenings: tonight first, the coming ones after; a Petromin night only for a rider signed in
      and booked on it), the time (early 6-8 PM, late 9-11 PM or both on a circuit evening; 7-9 PM on a Petromin
      night) and the cabinet (locker_board: three columns, numbered across the rows, 1-2-3 on top; the doors taken
      for that time, never who has them), up to three lockers; read again every 15 seconds while the page is seen and on Continue;
   2. the account, when not signed in: the booking site's own sign-up (customer_exists, customer_signup,
      customer_consents, customer_set_emergency/2) or its sign-in (customer_login, customer_pwd_state); a
      forgotten password goes through the booking app, which hands the rider back here signed in (?code=,
      customer_handoff_redeem), the lockers picked kept for the tab meanwhile;
   3. the review and how to pay: from the wallet now (customer_wallet; never on a Petromin night) or at the desk
      when the key is collected (customer_locker_book);
   4. reserved: the rider's lockers (customer_lockers), one card per evening to show at the desk (each locker's
      number and name, the time, how it is paid, and a code the desk scans: micromobility.sa/lockers/r/<rental>);
      each one not yet collected can be changed (another locker or time that evening, customer_locker_change) and,
      with no booking behind it, removed (customer_locker_drop; a wallet payment comes back).
   A locker's own tag (micromobility.sa/lockers/7, older tags /lockers/L7) arrives as ?locker=7, picked already on
   the first evening and time it is free; ?change=<rental> (the booking app's Change) opens that locker's change once
   signed in. The account stays signed in on this device (localStorage mm-lockers-acct) until the rider signs out or
   the database no longer knows the session. */
(function () {
  "use strict";
  // The public anon key (the same one the booking site ships): every call is a SECURITY DEFINER
  // function that checks the session token and throttles on the server.
  // On the website's page for it (apps/web/src/components/forms/SiteForm.tsx) the page speaks the language the site's
  // globe picked and talks to the database the website does (staging's on staging): window.MM_SITE_FORM =
  // {lang, db: {url, key}}. The page built on its own (?classic=1) uses these.
  var SITE_FORM = window.MM_SITE_FORM || null;
  var SUPABASE_URL = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.url) || "https://qpffkzmsfyilicwcsszz.supabase.co";
  var SUPABASE_KEY = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.key) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmZrem1zZnlpbGljd2Nzc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDQwODAsImV4cCI6MjEwNTgyMDA4MH0.K6qZpK0oR4MXIaFk4DRJGy-H_m6BYnJ-S31swTiHMhQ";
  var LANG_KEY = "mm-lockers-lang";
  // The evening, the time and the lockers picked, kept for this tab: across the account step, a reload, and the
  // booking app signing the rider in (a forgotten password).
  var PICK_KEY = "mm-lockers-pick";
  // The booking app: where a forgotten password is handled. The staging website talks to the staging database, so it
  // sends riders to the booking app's staging copy, which knows its accounts and hands them back to it (rentals
  // STAGING.md, section 2); everywhere else, the live app.
  var BOOKING_URL = location.hostname === "staging.micromobility.sa" ? "https://micromobility-staff-staging.pages.dev/" : "https://experiences.micromobility.sa/";
  // The account kept on this device (the owner, 2026-11-09: stay signed in): {id, token, name, email}.
  var ACCT_KEY = "mm-lockers-acct";
  // What the desk scans: a rental's own address, which sends a staff phone to the staff app with that rider's lockers.
  var DESK_URL = "https://micromobility.sa/lockers/r/";
  // Up to three lockers per account for each time (customer_locker_book's LOCKER_LIMIT counts the ones held too).
  var MAX_EACH = 3;
  // The cabinet is read again this often while the page is in view (a locker reserved is nobody else's: the owner, 2026-11-09).
  var POLL_MS = 15000;
  // On the website the page can be drawn again without a reload (the rider goes to another page of the site and comes
  // back, and SiteForm.tsx runs this script again): the run before this one stops listening to the document and reading
  // the cabinet, or both runs would answer every click and key and paint the one page.
  var stopper = typeof AbortController === "function" ? new AbortController() : null;
  try { if (window.MM_LOCKERS_RUN) window.MM_LOCKERS_RUN.abort(); } catch (e) {}
  window.MM_LOCKERS_RUN = stopper;
  var OWN = stopper ? { signal: stopper.signal } : false; // the document's listeners: this run's only
  function onStop(fn) { if (stopper) stopper.signal.addEventListener("abort", fn); }
  // It stops by itself too once the website has taken its page away (the rider went on to another page of the site),
  // or it would go on reading the cabinet there: its timers find the form gone.
  var formEl = document.getElementById("v-landing");
  function gone() { if (formEl && !formEl.isConnected) { if (stopper) stopper.abort(); return true; } return false; }

  var SH = window.SHARED, T = window.FORM_T || {};
  var html = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lang = "en";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fill(v, args) { if (args) Object.keys(args).forEach(function (k) { v = v.split("{" + k + "}").join(args[k]); }); return v; }
  function tr(key, args) { return fill((T[lang] && T[lang][key]) || key, args); }
  function site(key) { return (SH.SITE_T[lang] && SH.SITE_T[lang][key]) || SH.SITE_T.en[key] || key; }
  function langInfo(code) { for (var i = 0; i < SH.LANGS.length; i++) if (SH.LANGS[i].code === code) return SH.LANGS[i]; return SH.LANGS[0]; }
  function locale() { return langInfo(lang).locale; }
  function toAscii(s) { return String(s == null ? "" : s).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); }); }
  function clean(v) { return String(v == null ? "" : v).replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, " ").replace(/\s+/g, " ").trim(); }
  function isolate(s) { return "⁦" + s + "⁩"; }
  // An amount as riders read it in the booking app and on the website's tickets: the riyal sign (U+20C1, drawn by the
  // site's /fonts/Riyal-*.woff2) left of the number in every language, isolated left to right.
  function sar(n) { return "⁦⃁ " + Math.round((Number(n) || 0) * 100) / 100 + "⁩"; }
  function amt(n) { return '<bdi class="amt">' + esc(sar(n)) + "</bdi>"; }

  /* ── Messages on fields ──────────────────────────────────────────────────
     Kept as keys, not text, so a language change repaints them in the new language. */
  var msgs = {};
  function setErr(id, k, a, fromSite) { (msgs[id] = msgs[id] || {}).err = { k: k, a: a, site: !!fromSite }; paintField(id); }
  function clearMsg(id) { delete msgs[id]; paintField(id); }
  function paintField(id) {
    var f = document.getElementById(id); if (!f) return;
    var m = msgs[id] || {};
    f.classList.toggle("invalid", !!m.err);
    f.classList.toggle("warned", !m.err && !!m.warn);
    var e = $(".err", f), w = $(".warn", f);
    if (e) e.textContent = m.err ? (m.err.site ? fill(site(m.err.k), m.err.a) : tr(m.err.k, m.err.a)) : "";
    if (w) w.textContent = !m.err && m.warn ? tr(m.warn.k, m.warn.a) + " " + tr("If it is right, press the button again.") : "";
    if (e && !e.id) e.id = id + "-err";
    $$("input, select, [role=radiogroup], .tick", f).forEach(function (c) {
      if (m.err) { c.setAttribute("aria-invalid", "true"); c.setAttribute("aria-describedby", e ? e.id : ""); }
      else { c.removeAttribute("aria-invalid"); c.removeAttribute("aria-describedby"); }
    });
    if (id === "f-email") paintEmailFix();
  }

  /* ── Language: English and Arabic ────────────────────────────────────── */
  /* Language: the website's sixteen. On the website's page, the one its globe picked; on the page built on its own,
     ?lang=, then the one last picked here, then the phone's. */
  function hasLang(c) { for (var i = 0; i < SH.LANGS.length; i++) if (SH.LANGS[i].code === c) return true; return false; }
  function pickLang() {
    if (SITE_FORM && hasLang(SITE_FORM.lang)) return SITE_FORM.lang;
    var q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (hasLang(q)) return q;
    try { var s = localStorage.getItem(LANG_KEY); if (hasLang(s)) return s; } catch (e) {}
    var nav = navigator.languages || [navigator.language || "en"];
    for (var i = 0; i < nav.length; i++) { var c = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (c === "fil") c = "tl"; if (hasLang(c)) return c; }
    return "en";
  }
  function setLang(code, save) {
    lang = code;
    html.lang = code; html.dir = langInfo(code).rtl ? "rtl" : "ltr";
    if (save) { try { localStorage.setItem(LANG_KEY, code); } catch (e) {} }
    var b = $("#lang"); if (b) { b.value = code; b.lang = code; }
    paint();
  }
  // The page on its own: the picker, every language named in its own words; the choice is kept and put in the address.
  (function buildLangs() {
    var sel = $("#lang"); if (!sel) return;
    sel.innerHTML = "";
    SH.LANGS.forEach(function (l) { var o = document.createElement("option"); o.value = l.code; o.textContent = l.label; o.lang = l.code; sel.appendChild(o); });
  })();
  if ($("#lang")) $("#lang").addEventListener("change", function () {
    var next = $("#lang").value;
    setLang(next, true);
    try { var u = new URL(location.href); u.searchParams.set("lang", next); history.replaceState(null, "", u); } catch (e) {}
  });
  function paint() {
    document.title = tr("Lockers | MicroMobility");
    $$("[data-t]").forEach(function (el) { el.textContent = tr(el.getAttribute("data-t")); });
    $$("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", tr(el.getAttribute("data-t-aria"))); });
    $$("[data-site]").forEach(function (el) { el.textContent = site(el.getAttribute("data-site")); });
    $$("[data-site-aria]").forEach(function (el) { el.setAttribute("aria-label", site(el.getAttribute("data-site-aria"))); });
    $$("[data-site-placeholder]").forEach(function (el) { el.placeholder = site(el.getAttribute("data-site-placeholder")); });
    $$("#si-other, #si-temp-a").forEach(function (a) { a.href = handoffUrl() + (a.id === "si-other" ? "&auth=forgot" : ""); }); // si-other is Forgot password (no Google or Apple sign-in, 2026-11-09)
    $("#ack-lbl").innerHTML = ackLabel();
    buildCc(); buildEm();
    $$(".field").forEach(function (f) { paintField(f.id); });
    if (!$("#pv").hidden) renderNotice();
    if (!$("#rm").hidden) paintRemove();
    paintPick(); paintStep(); paintReview(); paintDone(); paintMine(); paintWho();
    if (bannerKey) showBanner(bannerKey.k, bannerKey.a);
  }
  function ackLabel() { return esc(site("privacyAckOpt")).replace("{0}", '<button type="button" class="d-link" id="pv-open">' + esc(site("privacyNotice")) + "</button>") + ' <span class="req" aria-hidden="true">*</span>'; }
  function handoffUrl() { return BOOKING_URL + "?handoff=lockers&lang=" + lang; }
  // Off to the booking app to sign in: the lockers picked wait for the way back in this tab.
  $$("#si-other, #si-temp-a").forEach(function (a) { a.addEventListener("click", function () { savePick(); }); });

  /* ── Days and times ──────────────────────────────────────────────────── */
  // Riyadh is UTC+3 all year, so its day is plain arithmetic, not Intl's "en-CA" layout (an iPhone on iOS 17.2 laid
  // that out as 10/27/2026, 2026-10-27).
  function todayKsa() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
  function isDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
  function dateOf(iso, o) {
    if (!isDay(iso)) return "";
    try { return new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: "UTC" }, o)).format(new Date(iso + "T12:00:00Z")); }
    catch (e) { return iso; }
  }
  // "Tonight", else "Tue 11 Nov" (the pills); the review and the summary say the whole date.
  function dayShort(iso) { return iso === todayKsa() ? tr("Tonight") : dateOf(iso, { weekday: "short", day: "numeric", month: "short" }); }
  function dayLong(iso) {
    var d = dateOf(iso, { weekday: "long", day: "numeric", month: "long" });
    return iso === todayKsa() ? tr("Tonight") + " · " + d : d;
  }
  // The periods, as the booking app and the database have them: 18-20 and 21-23 (or both, one span) on a circuit
  // evening, 19-21 on a Petromin night.
  var SPANS = { early: [18, 20], late: [21, 23], both: [18, 23], pm: [19, 21] };
  var PERIODS = { jcc: ["early", "late", "both"], pm: ["pm"] };
  var SLOTS = { early: ["e"], late: ["l"], both: ["e", "l"], pm: ["e", "l"] };
  function clock(h) {
    var en = lang === "en";
    try { return new Intl.DateTimeFormat(en ? "en-US" : locale(), Object.assign({ hour: "numeric", timeZone: "UTC" }, en ? { hour12: true } : {})).format(new Date(Date.UTC(2000, 0, 1, h))); }
    catch (e) { return (h % 12 || 12) + (h < 12 ? " AM" : " PM"); }
  }
  function spanOf(p) { var s = SPANS[p]; return s ? clock(s[0]) + " – " + clock(s[1]) : ""; }
  function overlap(a, b) { return (SLOTS[a] || []).some(function (s) { return (SLOTS[b] || []).indexOf(s) >= 0; }); }
  function byNumber(a, b) { var x = parseInt(a, 10), y = parseInt(b, 10); return x === y || isNaN(x) || isNaN(y) ? String(a).localeCompare(String(b)) : x - y; }

  /* ── Views and steps ─────────────────────────────────────────────────── */
  var view = "landing", step = 1;
  var STEP_TITLES = { 1: "Your account", 2: "Review and pay" };
  function showView(v) {
    view = v;
    $("#v-landing").hidden = v !== "landing";
    $("#v-steps").hidden = v !== "steps";
    $("#v-done").hidden = v !== "done";
    window.scrollTo(0, 0);
  }
  function goStep(n) {
    step = n;
    showView("steps");
    $$(".step").forEach(function (s) { s.hidden = +s.getAttribute("data-step") !== n; });
    paintStep();
    var h = $("#st-title"); if (h) h.focus({ preventScroll: true });
  }
  function paintStep() {
    $$(".steps li").forEach(function (li, i) { li.className = i < step ? "on" : ""; });
    $("#st-n").textContent = tr("Step {n} of 2", { n: step });
    $("#st-title").textContent = tr(STEP_TITLES[step]);
  }
  function backToPick() { showView("landing"); paintPick(); }
  // On the sign-in or sign-up fields, Back goes to the account question; on the question, to the cabinet.
  $("#back-acct").addEventListener("click", function () {
    if (accPanel !== "ask") { setTab("ask"); var h = $("#st-title"); if (h) h.focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    backToPick();
  });
  $("#back-pick").addEventListener("click", function () { hideBanner(); backToPick(); });

  /* ── Banner ─────────────────────────────────────────────────────────── */
  var bannerKey = null;
  function showBanner(k, a) {
    bannerKey = { k: k, a: a };
    $("#banner .banner-text").textContent = k.indexOf("site:") === 0 ? site(k.slice(5)) : tr(k, a);
    $("#banner").hidden = false;
  }
  function hideBanner() { bannerKey = null; $("#banner").hidden = true; }
  $("#banner .banner-close").addEventListener("click", hideBanner);
  var SITE_TOO_MANY = "site:errTooManyTries";
  var NET = "Could not reach the server. Please try again.";
  // Said to a screen reader only (a locker taken back).
  function say(k, a) { var s = $("#said"); s.textContent = ""; setTimeout(function () { s.textContent = tr(k, a); }, 30); }

  /* ── The database ───────────────────────────────────────────────────── */
  // One RPC with the public key: {data} when it answered, {error} when it refused or never answered.
  async function rpc(fn, body) {
    try {
      var resp = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      var data = null; try { data = await resp.json(); } catch (e) {}
      return resp.ok ? { data: data } : { error: data || { message: "HTTP " + resp.status } };
    } catch (err) { return { error: { message: "network" } }; }
  }
  function errText(e) { return e ? String((e.code || "") + " " + (e.message || "") + " " + (e.details || "") + " " + (e.hint || "")) : ""; }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); } // the booking site's own ids
  var busy = false;
  function setLoading(btn, on) { busy = on; $(btn).classList.toggle("loading", on); $(btn).disabled = on; }

  /* ── The evenings and the cabinet ─────────────────────────────────────── */
  var evenings = undefined;     // undefined: not read yet; [] none coming; else [{day, kind}], soonest first
  var evErr = false;
  var prices = { one: null, both: null };
  var day = null, period = null; // the evening and the time picked
  var board = null, boardErr = false, boardAt = 0, boardSeq = 0; // locker_board's answer for `day`
  var picked = [];              // the lockers picked (their codes), in the order tapped

  function evOf(d) { return (evenings || []).filter(function (e) { return e.day === d; })[0] || null; }
  function kindNow() { return board && board.day === day && board.kind ? board.kind : (evOf(day) || {}).kind || ""; }
  function priceOf(p) {
    var b = board && board.day === day ? board : null;
    var v = p === "both" ? (b && b.both != null ? b.both : prices.both) : (b && b.one != null ? b.one : prices.one);
    return v == null ? null : Number(v);
  }
  function ended(b, p) { return !!(b && b.ended && b.ended[p] === true); }
  function leftOf(b, p) { var v = b && b.left ? Number(b.left[p]) : NaN; return isNaN(v) ? null : v; }
  function unitsOf(b) { return (b && Array.isArray(b.units) ? b.units : []).filter(function (u) { return u && u.code != null && String(u.code) !== ""; }); }
  // The doors taken for a time. While a locker is being changed, its own door is not taken for the times it holds.
  function takenOf(b, p) {
    var out = {}, t = b && b.taken || {}, own = changing && changing.code && b && b.day === changing.day ? changing : null;
    (SLOTS[p] || []).forEach(function (s) {
      (Array.isArray(t[s]) ? t[s] : []).forEach(function (c) {
        c = String(c);
        if (own && c === own.code && (SLOTS[own.period] || []).indexOf(s) >= 0) return;
        out[c] = true;
      });
    });
    return out;
  }
  function freeFor(b, p, code) {
    var u = unitsOf(b).filter(function (x) { return String(x.code) === code; })[0];
    return !!u && !u.out && !takenOf(b, p)[code];
  }
  // The times an evening still offers, in order.
  function openPeriods(b, kind) { return (PERIODS[kind] || []).filter(function (p) { return !ended(b, p); }); }
  // The lockers this account already holds on the evening for an overlapping time (the page's, with no booking).
  function heldNow() {
    return mine.filter(function (r) { return !r.booking_id && r.day === day && (r.status === "reserved" || r.status === "in_use") && overlap(r.period, period); }).length;
  }
  function roomEach() { return Math.max(0, MAX_EACH - (acct ? heldNow() : 0)); }
  function room() { if (changing) return 1; var l = leftOf(board, period); return Math.min(roomEach(), l == null ? MAX_EACH : l); }
  function total() { var p = priceOf(period); return p == null ? null : p * picked.length; }

  function savePick() {
    if (changing) return; // a change is not a pick to keep
    try {
      if (day && picked.length) sessionStorage.setItem(PICK_KEY, JSON.stringify({ day: day, period: period, codes: picked }));
      else sessionStorage.removeItem(PICK_KEY);
    } catch (e) {}
  }
  function readPick() {
    try {
      var v = JSON.parse(sessionStorage.getItem(PICK_KEY) || "null");
      if (v && isDay(v.day) && SPANS[v.period] && Array.isArray(v.codes)) return { day: v.day, period: v.period, codes: v.codes.map(String).slice(0, MAX_EACH) };
    } catch (e) {}
    return null;
  }
  function clearPick() { picked = []; try { sessionStorage.removeItem(PICK_KEY); } catch (e) {} }

  async function loadEvenings() {
    evErr = false;
    var r = await rpc("locker_evenings", acct ? { p_id: acct.id, p_token: acct.token } : {});
    if (r.error || !r.data || typeof r.data !== "object") { evErr = true; paintPick(); return false; }
    if (r.data.one != null) prices.one = Number(r.data.one);
    if (r.data.both != null) prices.both = Number(r.data.both);
    evenings = (Array.isArray(r.data.evenings) ? r.data.evenings : []).filter(function (e) { return e && isDay(e.day) && PERIODS[e.kind]; })
      .map(function (e) { return { day: e.day, kind: e.kind }; }).sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
    if (day && !evOf(day)) { day = null; period = null; board = null; picked = []; }
    paintPick();
    return true;
  }
  async function readBoard(d) {
    var r = await rpc("locker_board", { p_day: d });
    if (r.error || !r.data || typeof r.data !== "object") return null;
    var b = r.data; b.day = isDay(b.day) ? b.day : d; b.kind = PERIODS[b.kind] ? b.kind : "";
    return b;
  }
  // The picked evening's cabinet, read again; the time stays when it is still open, and a locker picked that is
  // no longer free is dropped (and said).
  async function loadBoard() {
    if (!day) return;
    var seq = ++boardSeq, d = day;
    boardErr = false;
    var b = await readBoard(d);
    if (seq !== boardSeq || d !== day) return;
    if (!b) { boardErr = true; paintPick(); return; }
    board = b; boardAt = Date.now();
    return settle(true);
  }
  // The time and the picks made to fit the cabinet read: a time no longer open goes, then any locker no longer free,
  // then any beyond what this account may still hold for that time. True when a pick went and that was said.
  function settle(tell) {
    var kind = kindNow(), open = openPeriods(board, kind), said = null;
    if (period && open.indexOf(period) < 0) period = null;
    if (!period) period = open.filter(function (p) { return changing || leftOf(board, p) !== 0; })[0] || open[0] || null;
    var gone = picked.filter(function (c) { return !period || !freeFor(board, period, c); });
    if (gone.length) {
      picked = picked.filter(function (c) { return gone.indexOf(c) < 0; });
      if (tell && board.kind) said = ["Locker {n} was just taken. Pick another.", { n: gone[0] }];
    }
    if (picked.length > room()) {
      picked = picked.slice(0, room());
      if (tell) said = ["Up to 3 lockers per account for each time."];
    }
    savePick();
    // It is said on the cabinet: a rider on the review (or signing in) is taken back to it, to see what went and pick
    // again (and hears it), never left to reserve fewer lockers than they think.
    if (said && view !== "landing") { backToPick(); say(said[0], said[1]); }
    else paintPick();
    if (said) setErr("f-cab", said[0], said[1]);
    if (view === "steps" && step === 2) { if (!picked.length) backToPick(); else paintReview(); }
    return !!said;
  }
  function pickDay(d) {
    if (d === day) return;
    day = d; board = null; boardErr = false; period = null; picked = [];
    clearMsg("f-cab"); savePick(); paintPick(); loadBoard();
  }
  function pickPeriod(p) {
    if (p === period || ended(board, p) || (!changing && leftOf(board, p) === 0)) return;
    period = p; clearMsg("f-cab");
    var gone = picked.filter(function (c) { return !freeFor(board, p, c); });
    picked = picked.filter(function (c) { return gone.indexOf(c) < 0; }).slice(0, room());
    if (gone.length) setErr("f-cab", "Locker {n} is taken. Pick another.", { n: gone[0] });
    savePick(); paintPick(); loadBoard();
  }
  function toggle(c) {
    var i = picked.indexOf(c);
    if (i >= 0) picked.splice(i, 1);
    else if (changing) {
      // one door at a time: another door takes the place of the one picked
      if (!period || !freeFor(board, period, c)) return;
      picked = [c];
    } else {
      if (!period || !freeFor(board, period, c)) return;
      if (picked.length >= room()) {
        if (picked.length >= roomEach()) setErr("f-cab", "Up to 3 lockers per account for each time.");
        else setErr("f-cab", "The lockers for that time are all taken.");
        return;
      }
      picked.push(c);
    }
    clearMsg("f-cab"); savePick(); paintPick();
  }
  $("#days").addEventListener("click", function (e) { var b = e.target.closest("[role=radio]"); if (b) pickDay(b.getAttribute("data-v")); });
  $("#periods").addEventListener("click", function (e) { var b = e.target.closest("[role=radio]"); if (b && !b.disabled) pickPeriod(b.getAttribute("data-v")); });
  $("#cab-grid").addEventListener("click", function (e) { var b = e.target.closest(".door[data-code]"); if (b && !b.disabled) toggle(b.getAttribute("data-code")); });
  $("#pick-retry").addEventListener("click", function () { if (evenings === undefined || evErr) start2(); else loadBoard(); });
  $("#go").addEventListener("click", async function () {
    hideBanner();
    if (!picked.length) { setErr("f-cab", "Pick a locker"); return; }
    if (changing) { doChange(); return; }
    // The cabinet read again first: a locker someone reserved meanwhile is dropped and said here, on the cabinet,
    // not after the account step (the owner, 2026-11-09: "whenever a locker is reserved dont allow other customers to
    // choose it"). Reserve is refused by the database all the same.
    if ($("#go").classList.contains("loading")) return;
    var n = picked.length;
    setLoading("#go", true);
    try { await loadBoard(); } finally { setLoading("#go", false); }
    if (!picked.length || picked.length < n) return;
    if (acct) enterReview(); else openAccount("ask");
  });

  /* ── Painting the cabinet ─────────────────────────────────────────────── */
  var LOCK = '<svg class="door-mark" aria-hidden="true"><use href="#i-lock"/></svg>';
  var OUT = '<svg class="door-mark" aria-hidden="true"><use href="#i-stop"/></svg>';
  var TICK = '<svg class="door-mark" aria-hidden="true"><use href="#i-check"/></svg>';
  function door(u, taken) {
    var c = String(u.code), st = u.out ? "out" : taken[c] ? "taken" : picked.indexOf(c) >= 0 ? "sel" : "free";
    var label = { free: "Locker {n}", sel: "Locker {n}, picked", taken: "Locker {n}, taken", out: "Locker {n}, out of service" }[st];
    return '<button type="button" class="door st-' + st + '" data-code="' + esc(c) + '"' + (st === "taken" || st === "out" ? " disabled" : ' aria-pressed="' + (st === "sel") + '"') +
      ' aria-label="' + esc(tr(label, { n: c })) + '"><span class="vent" aria-hidden="true"></span><span class="num" aria-hidden="true">' + esc(c) + '</span><span class="handle" aria-hidden="true"></span>' +
      (st === "sel" ? TICK : st === "taken" ? LOCK : st === "out" ? OUT : "") + "</button>";
  }
  // Three columns, numbered across the rows: locker n sits in row ceil(n/3), column ((n-1)%3)+1; a number missing
  // between 1 and the highest leaves its place empty, and a code that is not a number follows at the end.
  function cabinetCells(b) {
    var byN = {}, max = 0, other = [];
    unitsOf(b).forEach(function (u) { var c = String(u.code); if (/^[1-9]\d{0,3}$/.test(c)) { byN[+c] = u; if (+c > max) max = +c; } else other.push(u); });
    var cells = [];
    for (var n = 1; n <= max; n++) cells.push(byN[n] || null);
    other.sort(function (a, b2) { return byNumber(a.code, b2.code); }).forEach(function (u) { cells.push(u); });
    while (cells.length % 3) cells.push(null);
    return cells;
  }
  function paintCab() {
    var grid = $("#cab-grid"), had = document.activeElement && document.activeElement.closest && document.activeElement.closest(".door[data-code]");
    var keep = had ? had.getAttribute("data-code") : null;
    if (!board || board.day !== day || !period) {
      grid.innerHTML = '<p class="cab-wait">' + (boardErr ? esc(tr(NET)) : '<span class="spinner-dark" aria-hidden="true"></span>' + esc(tr("Loading..."))) + "</p>";
      grid.classList.add("waiting");
      return;
    }
    grid.classList.remove("waiting");
    var taken = takenOf(board, period);
    grid.innerHTML = cabinetCells(board).map(function (u) { return u ? door(u, taken) : '<span class="door void" aria-hidden="true"></span>'; }).join("");
    if (keep) { var again = $('.door[data-code="' + keep.replace(/"/g, "") + '"]', grid); if (again && !again.disabled) again.focus({ preventScroll: true }); }
  }
  // A row of buttons drawn again only when what it shows changed (the cabinet is read every 15 seconds, and a button
  // drawn again under a keyboard or a screen reader loses its focus); when it did change, the button that had the
  // focus has it again.
  function putHtml(el, h) {
    if (el.getAttribute("data-h") === h) return;
    var f = document.activeElement, had = f && f !== el && el.contains(f) ? f : null;
    var v = had && had.getAttribute("data-v"), id = had && had.id;
    el.innerHTML = h; el.setAttribute("data-h", h);
    if (!had) return;
    var now = v != null ? $$("[data-v]", el).filter(function (x) { return x.getAttribute("data-v") === v; })[0] : id ? document.getElementById(id) : null;
    if (now && !now.disabled) now.focus({ preventScroll: true });
  }
  function paintPick() {
    var notice = $("#pick-notice"), n = null, retry = false;
    if (evenings === undefined) { if (evErr) { n = tr(NET); retry = true; } else n = tr("Loading..."); }
    else if (!evenings.length) n = tr("No evening has lockers right now.");
    else if (board && board.day === day && !board.kind) n = tr("No lockers this evening.");
    else if (boardErr && !board) { n = tr(NET); retry = true; }
    notice.hidden = !n;
    if (n) $(".notice-h", notice).textContent = n;
    $("#pick-retry").hidden = !retry;
    var some = !!(evenings && evenings.length) || !!changing;
    $("#f-day").hidden = !some || !!changing;
    $("#chg-head").hidden = !changing;
    if (changing) {
      $("#chg-title").textContent = changing.code ? tr("Change locker {n}", { n: changing.code }) : tr("Change your locker");
      $("#chg-when").textContent = dayLong(changing.day);
    }
    putHtml($("#days"), (evenings || []).map(function (e) {
      var on = e.day === day;
      return '<button type="button" class="pill" role="radio" aria-checked="' + on + '" data-v="' + esc(e.day) + '">' + esc(e.kind === "pm" ? tr("{day} · Petromin", { day: dayShort(e.day) }) : dayShort(e.day)) + "</button>";
    }).join(""));
    var kind = kindNow(), hasBoard = !!(board && board.day === day && board.kind);
    var list = hasBoard ? openPeriods(board, kind) : (PERIODS[kind] || []);
    $("#f-period").hidden = !some || !day || !kind || (hasBoard && !list.length);
    putHtml($("#periods"), list.map(function (p) {
      var full = !changing && hasBoard && leftOf(board, p) === 0, on = p === period, pr = priceOf(p);
      return '<button type="button" class="opt" role="radio" aria-checked="' + on + '" data-v="' + p + '"' + (full ? " disabled" : "") + ">" +
        "<b>" + esc(spanOf(p)) + "</b><span>" + (full ? esc(tr("Full")) : pr != null ? amt(pr) : "") + "</span></button>";
    }).join(""));
    if (hasBoard && !list.length && !n) { notice.hidden = false; $(".notice-h", notice).textContent = tr("No lockers this evening."); }
    $("#f-cab").hidden = !some || !day || (board && board.day === day && (!board.kind || !list.length));
    paintCab();
    var sum = $("#pick-sum"), t = total();
    sum.hidden = !picked.length;
    if (picked.length) {
      var codes = picked.slice().sort(byNumber).join(lang === "ar" ? "، " : ", ");
      sum.innerHTML = esc(picked.length > 1 ? tr("Lockers {list}", { list: codes }) : tr("Locker {n}", { n: codes })) + (t != null ? " · " + amt(t) : "");
    }
    var same = changing && picked[0] === changing.code && period === changing.period;
    $("#go").disabled = !picked.length || !hasBoard || !!same;
    $("#go-label").textContent = changing ? tr("Change locker") : tr("Continue");
    paintMine();
  }

  /* ── Phone: country code + number, E.164 out, Google's libphonenumber mobile patterns (the same
     rules file the booking site's staff check reads). No flags beside the codes (no emoji anywhere). ─────── */
  var RULES = SH.PHONE_RULES, reCache = {};
  var CC_DIGITS = {}; SH.COUNTRY_CODES.forEach(function (x) { CC_DIGITS[x[0].slice(1)] = true; });
  var dn = {};
  function regionName(iso, fallback) {
    try {
      if (!(lang in dn)) dn[lang] = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames([lang], { type: "region", fallback: "none" }) : null;
      return (dn[lang] && dn[lang].of(iso)) || fallback;
    } catch (e) { return fallback; }
  }
  function ccName(x) {
    if (lang === "en") return x[2];
    if (x[1] === "US") return regionName("US", "USA") + " / " + regionName("CA", "Canada");
    if (SH.COUNTRY_AR[x[2]]) return SH.COUNTRY_AR[x[2]];
    return regionName(x[1], x[2]);
  }
  // The list: the Gulf first, then every country by name, Saudi Arabia again in its place; never Israel (sync-shared checks).
  function ccList() {
    var gulf = SH.COUNTRY_CODES.slice(0, 6), rest = SH.COUNTRY_CODES.slice(6).concat(SH.COUNTRY_CODES.filter(function (x) { return x[1] === "SA"; })).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, lang); }); } catch (e) {}
    return gulf.map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest);
  }
  function selOnce(cur) { var done = false; return function (v) { if (done || v !== cur) return false; return (done = true); }; }
  var PK = { sel: "#cc", code: "#cc-code", input: "#phone" };
  function buildCc() {
    var sel = $(PK.sel), cur = sel.value || "SA+966", on = selOnce(cur);
    sel.innerHTML = ccList().map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-iso="' + o.x[1] + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
    if (!sel.value) sel.value = "SA+966";
    ccFace();
  }
  function ccFace() { var o = $(PK.sel).selectedOptions[0]; if (o) $(PK.code).textContent = o.getAttribute("data-cc"); }
  function ccDigits() { var o = $(PK.sel).selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function setCcDigits(k) { var o = $$(PK.sel + " option").filter(function (x) { return x.getAttribute("data-cc") === "+" + k; })[0]; if (o) { $(PK.sel).value = o.value; ccFace(); } }
  function ccOf(d) { for (var n = 1; n <= 3 && n <= d.length; n++) if (CC_DIGITS[d.slice(0, n)]) return d.slice(0, n); return ""; }
  function mobileOk(cc, nat) {
    var list = RULES[cc]; if (!list) return true;
    return list.some(function (r) { var re = reCache[r[0]] || (reCache[r[0]] = new RegExp("^(?:" + r[1] + ")$")); return r[2].indexOf(nat.length) >= 0 && re.test(nat); });
  }
  function ccIncluded(d, ccd) {
    if (!ccd || d.indexOf(ccd) !== 0) return false;
    var nat = d.slice(ccd.length);
    if (RULES[ccd]) { if (mobileOk(ccd, d)) return false; if (mobileOk(ccd, nat)) return true; }
    return d.length >= 11 && nat.length >= 8;
  }
  function onPhoneInput() {
    var el = $(PK.input), raw = toAscii(el.value).trim(), d = raw.replace(/\D/g, "");
    var ccd = ccDigits(), intl = raw[0] === "+" || d.slice(0, 2) === "00", plus = false;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (intl) {
      if (d.indexOf(ccd) !== 0) { var k = ccOf(d); if (k) { setCcDigits(k); ccd = k; } }
      if (d.indexOf(ccd) === 0) d = d.slice(ccd.length); else plus = true;
    } else if (ccIncluded(d, ccd)) d = d.slice(ccd.length);
    d = d.slice(0, 15);
    var g = ccd === "966" && d[0] === "5" ? [2, 5] : [3, 6];
    var out = d.length > g[1] ? d.slice(0, g[0]) + " " + d.slice(g[0], g[1]) + " " + d.slice(g[1]) : d.length > g[0] ? d.slice(0, g[0]) + " " + d.slice(g[0]) : d;
    el.value = (plus ? "+" : "") + out;
  }
  function e164() { return toE164(ccDigits(), $(PK.input).value); }
  // A number typed under the dial code `ccd`, as the database stores it (the booking site's _normPhone).
  function toE164(ccd, raw) {
    var s = toAscii(raw).trim().replace(/[\s()\-]/g, "");
    if (!s) return "";
    if (s[0] === "+") { var x = s.slice(1).replace(/\D/g, ""); if (x.indexOf(ccd + "0") === 0) x = ccd + x.slice(ccd.length + 1); return "+" + x; }
    s = s.replace(/\D/g, ""); if (!s) return "";
    if (s.slice(0, 2) === "00") return "+" + s.slice(2);
    if (ccIncluded(s, ccd)) return "+" + s;
    if (s[0] === "0") return "+" + ccd + s.slice(1);
    return "+" + ccd + s;
  }
  function callingCode(d) { for (var n = 3; n >= 1; n--) if (RULES[d.slice(0, n)] || CC_DIGITS[d.slice(0, n)]) return d.slice(0, n); return ""; }
  $("#phone").addEventListener("input", function () { onPhoneInput(); clearMsg("f-phone"); acked.create = null; });
  $("#cc").addEventListener("change", function () { ccFace(); $("#phone").placeholder = ccDigits() === "966" ? "5X XXX XXXX" : ""; clearMsg("f-phone"); });
  function checkMobile(raw, p) {
    var d = p.replace(/\D/g, "");
    if (!raw) return { hard: ["Enter your mobile number"] };
    if (d.indexOf("966") === 0) {
      var nat = d.slice(3);
      if (!/^5\d{8}$/.test(nat) || !mobileOk("966", nat)) return { hard: ["Enter a valid Saudi mobile number (5XXXXXXXX)"] };
    } else {
      var cc = callingCode(d);
      if (!cc || d.length < 8 || d.length > 15) return { hard: ["Enter a valid mobile number"] };
      if (!mobileOk(cc, d.slice(cc.length))) return { hard: ["This is not a mobile number for +{c}. Please check it.", { c: cc }] };
    }
    var tail = d.slice(-9);
    if (/(\d)\1{5,}/.test(tail) || /0123456|1234567|2345678|3456789|9876543|8765432/.test(tail)) return { soft: ["Please check this number: it does not look like a real one."] };
    return {};
  }

  /* ── The emergency contact (the owner, 2026-10-07: the first required, a second optional), as the
     booking site asks it and in its words. ───────────────────────────────────────────────────── */
  var EM_RELS = SH.EM_RELS;
  var CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
  function emFields(p) {
    return '<div id="f-' + p + '-name" class="field"><label for="' + p + '-name" data-site="emName"></label>' +
      '<input id="' + p + '-name" type="text" autocomplete="off" autocapitalize="words" maxlength="80"><p class="err" aria-live="polite"></p></div>' +
      '<div id="f-' + p + '-phone" class="field"><label for="' + p + '-phone" data-site="emPhone"></label><div class="phone-row" dir="ltr">' +
      '<label class="cc-wrap"><span class="cc-face" aria-hidden="true"><span id="' + p + '-cc-code">+966</span></span>' +
      '<select id="' + p + '-cc" class="cc" aria-label="Country code" data-t-aria="Country code"></select>' + CHEVRON + '</label>' +
      '<input id="' + p + '-phone" type="tel" inputmode="tel" autocomplete="off" placeholder="5X XXX XXXX"></div><p class="err" aria-live="polite"></p></div>' +
      '<div id="f-' + p + '-rel" class="field"><label for="' + p + '-rel" data-site="emRelation"></label>' +
      '<span class="sel-wrap"><select id="' + p + '-rel"></select></span><p class="err" aria-live="polite"></p></div>';
  }
  function emBlock(pre) {
    return '<fieldset id="' + pre + '-block" class="em-block">' +
      '<legend class="em-h"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg><span data-site="emTitle"></span></legend>' +
      '<p class="hint" data-site="emSubAcc"></p>' + emFields(pre) +
      '<button type="button" id="' + pre + '2-add" class="em-add"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span data-site="em2Add"></span></button>' +
      '<div id="' + pre + '2-box" class="em2" hidden><p class="em-h"><span data-site="em2Title"></span> <span class="em-opt">(<span data-site="optionalLabel"></span>)</span></p>' +
      '<p class="hint" data-site="em2Sub"></p>' + emFields(pre + "2") + '</div></fieldset>';
  }
  $("#em-slot").outerHTML = emBlock("em");
  var EM_PRE = ["em", "em2"];
  function emCcDigits(p) { var o = $("#" + p + "-cc").selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function emCcFace(p) { $("#" + p + "-cc-code").textContent = "+" + emCcDigits(p); $("#" + p + "-phone").placeholder = emCcDigits(p) === "966" ? "5X XXX XXXX" : ""; }
  function buildEm() {
    EM_PRE.forEach(function (p) {
      var sel = $("#" + p + "-cc"), cur = sel.value || "SA+966", on = selOnce(cur);
      sel.innerHTML = ccList().map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
      if (!sel.value) sel.value = "SA+966";
      emCcFace(p);
      var rs = $("#" + p + "-rel"), rc = rs.value;
      rs.innerHTML = '<option value="">' + esc(site("emPick")) + "</option>" + EM_RELS.map(function (c) { return '<option value="' + c + '"' + (c === rc ? " selected" : "") + ">" + esc(site("emRel_" + c)) + "</option>"; }).join("");
      rs.classList.toggle("ph", !rs.value);
    });
  }
  EM_PRE.forEach(function (p) {
    $("#" + p + "-name").addEventListener("input", function () { var v = this.value.replace(DASHES, " "); if (v !== this.value) this.value = v; clearMsg("f-" + p + "-name"); });
    $("#" + p + "-phone").addEventListener("input", function () { clearMsg("f-" + p + "-phone"); });
    $("#" + p + "-cc").addEventListener("change", function () { emCcFace(p); clearMsg("f-" + p + "-phone"); });
    $("#" + p + "-rel").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-" + p + "-rel"); });
  });
  $("#em2-add").addEventListener("click", function () { $("#em2-box").hidden = false; this.hidden = true; $("#em2-name").focus(); });
  function emFieldIds(pre) { var o = []; ["", "2"].forEach(function (n) { ["name", "phone", "rel"].forEach(function (k) { o.push("f-" + pre + n + "-" + k); }); }); return o; }
  function last9(v) { return String(v || "").replace(/\D/g, "").slice(-9); }
  function emRead(p, own, other, optional) {
    var raw = toAscii($("#" + p + "-phone").value).replace(/[^\d+]/g, "");
    var n = clean($("#" + p + "-name").value.replace(DASHES, " ")), rel = $("#" + p + "-rel").value;
    if (optional && !n && !raw && !rel) return null;
    var nm = nameDots(n);
    if (Array.from(nm).length < 2 || Array.from(nm).length > 80) return { err: ["f-" + p + "-name", "errEmName"] };
    if (NAME_BAD.test(n) || n !== nm || !/\p{L}/u.test(nm)) return { err: ["f-" + p + "-name", "errNameChars"] };
    if (nm.split(/[\s.]+/).some(function (w) { return w && Array.from(w).length < 2; })) return { err: ["f-" + p + "-name", "errNameShort"] };
    var ph = toAscii($("#" + p + "-phone").value).trim() ? toE164(emCcDigits(p), $("#" + p + "-phone").value) : "";
    if (!/^\+?[0-9]{8,15}$/.test(ph)) return { err: ["f-" + p + "-phone", "errEmPhone"] };
    if (last9(own).length === 9 && last9(ph) === last9(own)) return { err: ["f-" + p + "-phone", "errEmSelf"] };
    if (last9(other).length === 9 && last9(ph) === last9(other)) return { err: ["f-" + p + "-phone", "errEmSame"] };
    if (EM_RELS.indexOf(rel) < 0) return { err: ["f-" + p + "-rel", "errEmRelation"] };
    return { name: nm, phone: ph, rel: rel };
  }
  // Both contacts checked into `hard`; what to save, or null.
  function emCheck(own, hard) {
    var one = emRead("em", own, "", false);
    if (one.err) { hard[one.err[0]] = [one.err[1], null, true]; return null; }
    if ($("#em2-box").hidden) return { one: one, two: null };
    var two = emRead("em2", own, one.phone, true);
    if (two && two.err) { hard[two.err[0]] = [two.err[1], null, true]; return null; }
    return { one: one, two: two };
  }
  // Saves the contacts typed with the sign-up on the new account. Should it not save, the booking app's check-up
  // asks for them again; a locker needs only the account.
  async function emSave() {
    var c = emCheck(acct.phone, {});
    if (!c) return;
    var steps = [["customer_set_emergency", c.one]];
    if (c.two) steps.push(["customer_set_emergency2", c.two]);
    for (var i = 0; i < steps.length; i++) {
      var x = steps[i][1];
      var r = await rpc(steps[i][0], { p_id: acct.id, p_token: acct.token, p_name: x.name, p_phone: x.phone, p_relation: x.rel });
      if (r.error || r.data === false) return;
    }
  }

  /* ── Email: the staff check's rules (misspelt providers, fake and throwaway domains) ── */
  var CCTLD = {}; "ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug uk um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw".split(" ").forEach(function (x) { CCTLD[x] = 1; });
  var PROVIDERS = ["gmail", "googlemail", "hotmail", "outlook", "icloud", "yahoo", "windowslive", "rocketmail"];
  var COM_ONLY = ["gmail", "googlemail", "icloud", "windowslive", "rocketmail"];
  var REAL_NEAR = ["mail", "email", "ymail", "gmx", "live", "msn", "me", "mac", "aol", "cloud"];
  var TLD_TYPO = ["con", "cmo", "coml", "comm", "comn", "cpm", "vom", "xom", "cim", "ocm", "cok", "clm", "ccom", "coom"];
  var FAKE_DOMAINS = ["example.com", "example.org", "example.net", "test.com", "domain.com", "mailinator.com", "yopmail.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "temp-mail.org", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com"];
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    var d = [], i, j; for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  var emailFix = null;
  function checkEmail(em) {
    em = em.toLowerCase();
    var at = em.split("@");
    if (at.length !== 2 || !at[0] || !/^[a-z0-9._%+'-]+$/.test(at[0]) || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(at[1]) || em.length > 254) return { hard: ["Enter a valid email address"] };
    var dom = at[1], labels = dom.split("."), tld = labels[labels.length - 1], root = labels[0];
    if (/(^|\.)privaterelay\.appleid\.com$/.test(dom)) return { hard: ["Please use your own email address, not an Apple hidden (relay) address"] };
    if (FAKE_DOMAINS.indexOf(dom) >= 0 || /^(test|asdf|qwerty|abc|x{2,}|none|null|noemail|nomail|na|no)\d*$/.test(at[0])) return { hard: ["Please use your own, permanent email address"] };
    var fix = null;
    if (PROVIDERS.indexOf(root) >= 0) {
      if (COM_ONLY.indexOf(root) >= 0 && dom !== root + ".com") fix = root + ".com";
      else if (TLD_TYPO.indexOf(tld) >= 0 || (tld === "co" && labels.length === 2)) fix = root + ".com";
    } else if (REAL_NEAR.indexOf(root) < 0) {
      var p = PROVIDERS.filter(function (p) { return dist(root, p) <= (p.length >= 6 ? 2 : 1) || (root.indexOf(p) >= 0 && root.length <= p.length + 4); })[0];
      if (p) fix = p + "." + ((COM_ONLY.indexOf(p) >= 0 || TLD_TYPO.indexOf(tld) >= 0) ? "com" : labels.slice(1).join("."));
    }
    if (!fix && TLD_TYPO.indexOf(tld) >= 0) fix = labels.slice(0, -1).join(".") + ".com";
    if (fix && fix !== dom) return { hard: ["Did you mean {s}?", { s: at[0] + "@" + fix }], fix: at[0] + "@" + fix };
    if (tld.length === 2 && !CCTLD[tld]) return { soft: ["Please check the ending of your email address ({t}).", { t: "." + tld }] };
    return {};
  }
  function paintEmailFix() {
    var b = $("#email-fix"); b.hidden = !emailFix;
    if (emailFix) b.textContent = tr("Use {s}", { s: emailFix });
  }
  $("#email-fix").addEventListener("click", function () { if (!emailFix) return; $("#email").value = emailFix; emailFix = null; clearMsg("f-email"); $("#email").focus(); });
  $("#email").addEventListener("input", function () { emailFix = null; clearMsg("f-email"); acked.create = null; });

  /* ── Names: letters, spaces and periods; a dash becomes a space (the owner's rule) ── */
  var NAME_BAD = /[^\p{L}\p{M}\s.]/u;
  var DASHES = /[-‐-―−]/g;
  function nameDots(v) { return v.replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1"); }
  function titleCase(v) { return clean(v).replace(/(^|[\s'’.])(\p{L})/gu, function (m, sep, ch) { return sep + ch.toLocaleUpperCase(); }); }
  function checkName(s) {
    if (!s) return { hard: ["Enter your first and last name"] };
    if (NAME_BAD.test(s) || /(^|[\s.])\./.test(s)) return { hard: ["Names can only contain letters, spaces and periods."] };
    var letters = s.replace(/[ً-ٰٟ]/g, "");
    if (/[A-Za-z]/.test(letters) && /[؀-ۿ]/.test(letters)) return { hard: ["Write your name in one alphabet"] };
    var parts = letters.replace(/[^\p{L}\p{M}\s'’.-]/gu, " ").split(/\s+/).filter(function (p) { return p.replace(/[.'’\p{M}-]/gu, ""); });
    var bare = function (p) { return p.replace(/[.'’-]/g, ""); };
    var cjk = parts.length === 1 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(parts[0]);
    if (parts.length < 2 && !cjk) return { hard: ["Enter your first and last name"] };
    if (parts.length > 1 && parts.some(function (p) { return p.split(".").some(function (w) { w = bare(w); return w && Array.from(w).length < 2; }); })) return { hard: ["Write your first and last name in full, not initials"] };
    if (parts.some(function (p) { return /^(test|asdf|qwerty|user|admin|none|null|name|x{2,}|abc|unknown|other|guest)$/i.test(bare(p)); })) return { hard: ["Please enter your real name"] };
    if (/(\p{L})\1\1/iu.test(letters)) return { soft: ["Please check the spelling of your name."] };
    return {};
  }
  function nameInput() {
    var el = this, raw = el.value, v = raw.replace(DASHES, " "), k = v.replace(/[^\p{L}\p{M}\s.]/gu, ""), c = nameDots(k);
    if (c !== raw) { var at = Math.max(0, (el.selectionStart == null ? c.length : el.selectionStart) - (raw.length - c.length)); el.value = c; try { el.setSelectionRange(at, at); } catch (e) {} }
    if (k !== v) { setErr("f-name", "Names can only contain letters, spaces and periods."); return; }
    clearMsg("f-name"); acked.create = null;
  }
  $("#first").addEventListener("input", nameInput);
  $("#last").addEventListener("input", nameInput);
  function nameParts() { return { first: clean($("#first").value), last: clean($("#last").value) }; }
  function fullName() { var n = nameParts(); return titleCase(n.first + " " + n.last); }
  $("#height").addEventListener("input", function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, 3); if (v !== this.value) this.value = v; clearMsg("f-height"); acked.create = null; });
  $("#pwd").addEventListener("input", function () { clearMsg("f-pwd"); });
  $("#pwd2").addEventListener("input", function () { clearMsg("f-pwd2"); });
  $("#ident").addEventListener("input", function () { clearMsg("f-ident"); });
  $("#spwd").addEventListener("input", function () { clearMsg("f-spwd"); });

  /* ── Tiles and tick boxes ───────────────────────────────────────────────── */
  var gender = null, ack = false, news = false;
  function pickRadio(groupSel, v) { $$("[role=radio]", $(groupSel)).forEach(function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-v") === v)); }); }
  $("#genders").addEventListener("click", function (e) {
    var b = e.target.closest("[role=radio]"); if (!b) return;
    gender = b.getAttribute("data-v"); pickRadio("#genders", gender); clearMsg("f-gender");
  });
  function tick(id, get, set, field) {
    var el = document.getElementById(id);
    function toggleTick() { set(!get()); el.setAttribute("aria-checked", String(get())); if (field) clearMsg(field); }
    el.addEventListener("click", function (e) { if (e.target.closest(".d-link")) return; toggleTick(); });
    el.addEventListener("keydown", function (e) { if (e.target.closest(".d-link")) return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleTick(); } });
  }
  tick("ack", function () { return ack; }, function (v) { ack = v; }, "f-ack");
  tick("news", function () { return news; }, function (v) { news = v; });
  // Arrow keys move along a row of radio buttons (the evenings, the times, how to pay), as a radio group does.
  ["#days", "#periods", "#pays"].forEach(function (g) {
    $(g).addEventListener("keydown", function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys)) return;
      var all = $$("[role=radio]", $(g)).filter(function (x) { return !x.disabled && !x.hidden; }), i = all.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var dir = keys[e.key] * (html.dir === "rtl" && (e.key === "ArrowRight" || e.key === "ArrowLeft") ? -1 : 1);
      var next = all[(i + dir + all.length) % all.length], v = next.getAttribute("data-v");
      next.click();
      var now = $('[data-v="' + v + '"]', $(g)); if (now) now.focus();
    });
  });

  /* ── The pop-ups, centred: the Privacy Notice and taking a locker back ───── */
  var modalReturn = null, openModal = null;
  function renderNotice() {
    var blocks = SH.PRIVACY_NOTICE[lang] || SH.PRIVACY_NOTICE.en;
    $("#pv-body").innerHTML = blocks.map(function (b) {
      if (b.h) return "<h3>" + b.h + "</h3>";
      if (b.p) return "<p>" + b.p + "</p>";
      if (b.ul) return "<ul>" + b.ul.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
      if (b.table) return '<div class="pv-tw"><table class="pv-t"><thead><tr>' + b.table.head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
        b.table.rows.map(function (r) { return "<tr>" + r.map(function (x, i) { return '<td data-label="' + esc(b.table.head[i]) + '">' + x + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
      return "";
    }).join("");
    var d = SH.PRIVACY_VERSION;
    try { d = new Date(SH.PRIVACY_VERSION + "T12:00:00+03:00").toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }); } catch (e) {}
    $("#pv-upd").textContent = site("privacyUpdated").replace("{0}", d);
  }
  function showModal(id, focusSel) {
    modalReturn = document.activeElement; openModal = id;
    if (id === "#pv") renderNotice();
    $(id).hidden = false; document.body.classList.add("modal-open");
    $(focusSel || id + " .modal-x").focus();
  }
  function closeModal() {
    if (!openModal) return;
    $(openModal).hidden = true; openModal = null; document.body.classList.remove("modal-open");
    if (modalReturn && modalReturn.focus && document.contains(modalReturn)) modalReturn.focus();
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("#pv-open, #pv-open-foot")) { e.preventDefault(); e.stopPropagation(); showModal("#pv"); }
    if (e.target.closest("#lt-open")) { e.preventDefault(); e.stopPropagation(); showModal("#lt"); }
  }, OWN);
  $$(".modal-x").forEach(function (b) { b.addEventListener("click", closeModal); });
  $$(".modal").forEach(function (m) { m.addEventListener("click", function (e) { if (e.target === m && !busy) closeModal(); }); });
  document.addEventListener("keydown", function (e) {
    if (!openModal) return;
    if (e.key === "Escape") { if (!busy) closeModal(); return; }
    if (e.key === "Tab") {
      var box = $(openModal + " .modal-box"), els = $$("button:not([disabled]), a[href]", box), first = els[0], last = els[els.length - 1];
      if (!first) return;
      if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, OWN);

  /* ── Checking a step: {hard:{field:[k,a,site]}, soft:{field:[k,a]}} ─────── */
  var acked = {};
  var FIELDS = {
    create: ["f-name", "f-gender", "f-email", "f-phone", "f-pwd", "f-pwd2", "f-height"].concat(emFieldIds("em"), ["f-ack"]),
    signin: ["f-ident", "f-spwd"]
  };
  function passwordErr(pw) { return pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw); }
  function check(n) {
    var hard = {}, soft = {}, r;
    if (n === "create") {
      var nm = nameParts();
      if (!nm.first || !nm.last) hard["f-name"] = ["Enter your first and last name"];
      else { r = checkName(nm.first + " " + nm.last); if (r.hard) hard["f-name"] = r.hard; else if (r.soft) soft["f-name"] = r.soft; }
      if (!gender) hard["f-gender"] = ["Choose your gender"];
      var em = clean($("#email").value).toLowerCase();
      emailFix = null;
      if (!em) hard["f-email"] = ["Enter your email address"];
      else { r = checkEmail(em); if (r.hard) { hard["f-email"] = r.hard; emailFix = r.fix || null; } else if (r.soft) soft["f-email"] = r.soft; }
      r = checkMobile($("#phone").value.replace(/\D/g, ""), e164());
      if (r.hard) hard["f-phone"] = r.hard; else if (r.soft) soft["f-phone"] = r.soft;
      var pw = $("#pwd").value;
      if (passwordErr(pw)) hard["f-pwd"] = ["errPasswordLen", null, true];
      else if ($("#pwd2").value !== pw) hard["f-pwd2"] = ["errPasswordMatch", null, true];
      var h = parseInt(toAscii($("#height").value), 10);
      if (!(h >= 100 && h <= 250)) hard["f-height"] = ["Enter your height in cm (100 to 250)"];
      else if (h < 140 || h > 209) soft["f-height"] = ["Is {n} cm right?", { n: h }];
      emCheck(e164(), hard);
      if (!ack) hard["f-ack"] = ["privacyAckRequired", null, true];
    } else if (n === "signin") {
      if (!clean($("#ident").value)) hard["f-ident"] = ["errEmailOrPhone", null, true];
      if (!$("#spwd").value) hard["f-spwd"] = ["errPasswordRequired", null, true];
    }
    return { hard: hard, soft: soft };
  }
  function passStep(n) {
    var r = check(n), hk = Object.keys(r.hard), sk = Object.keys(r.soft);
    FIELDS[n].forEach(function (id) { delete msgs[id]; });
    hk.forEach(function (id) { var h = r.hard[id]; (msgs[id] = msgs[id] || {}).err = { k: h[0], a: h[1], site: !!h[2] }; });
    sk.forEach(function (id) { (msgs[id] = msgs[id] || {}).warn = { k: r.soft[id][0], a: r.soft[id][1] }; });
    FIELDS[n].forEach(paintField);
    if (hk.length) { focusField(hk[0]); return false; }
    var sig = JSON.stringify(r.soft);
    if (sk.length && acked[n] !== sig) { acked[n] = sig; focusField(sk[0]); return false; }
    return true;
  }
  function focusField(id) {
    var f = document.getElementById(id); if (!f) return;
    var el = $("input, select, [role=radio]:not([disabled]), .tick", f); if (el) { el.focus({ preventScroll: true }); f.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  /* ── Step 1: the account ───────────────────────────────────────────────── */
  var acct = null; // {id, token, name, email, phone, made}
  // Step 1 opens on the question "Do you have a MicroMobility account?" (the owner, 2026-10-17); the
  // answer shows the sign-in or the sign-up fields, and Back goes to the question again.
  var accPanel = "ask";
  function openAccount(t) { setTab(t); goStep(1); }
  function setTab(t) {
    accPanel = t;
    $("#p-ask").hidden = t !== "ask";
    $("#p-create").hidden = t !== "create"; $("#p-signin").hidden = t !== "signin";
  }
  $("#ask-yes").addEventListener("click", function () { setTab("signin"); $("#ident").focus(); });
  $("#ask-no").addEventListener("click", function () { setTab("create"); $("#first").focus(); });
  $$(".to-signin").forEach(function (b) { b.addEventListener("click", function () { setTab("signin"); $("#ident").focus(); }); });
  $$(".to-create").forEach(function (b) { b.addEventListener("click", function () { setTab("create"); $("#first").focus(); }); });

  $("#p-create").addEventListener("submit", function (e) { e.preventDefault(); hideBanner(); if (busy) return; if (passStep("create")) createAccount(); });
  async function createAccount() {
    var email = clean($("#email").value).toLowerCase(), phone = e164(), name = fullName();
    setLoading("#create", true);
    try {
      // Each on its own, so the message says which one is taken (as the sign-up page does).
      var ex = await rpc("customer_exists", { p_email: email, p_phone: "" });
      if (ex.data === true) { setErr("f-email", "An account with this email already exists. Sign in to book with it."); focusField("f-email"); return; }
      ex = await rpc("customer_exists", { p_email: "", p_phone: phone });
      if (ex.data === true) { setErr("f-phone", "An account with this mobile number already exists. Sign in to book with it."); focusField("f-phone"); return; }
      var id = uid();
      var r = await rpc("customer_signup", {
        p_id: id, p_name: name, p_email: email, p_phone: phone, p_pwd: $("#pwd").value,
        p_height: parseInt(toAscii($("#height").value), 10), p_type_preference: "Any", p_gender: gender
      });
      if (r.error) { signupRefused(r.error); return; }
      var tok = r.data && r.data[0] && r.data[0].session_token;
      if (!tok) { showBanner(NET); return; }
      acct = { id: id, token: tok, name: name, email: email, phone: phone, made: true };
      $("#pwd").value = ""; $("#pwd2").value = "";
      // The notice they confirmed and their ride-news answer, recorded the moment the account exists.
      var body = { p_id: id, p_token: tok, p_privacy: SH.PRIVACY_VERSION, p_ride_news: news };
      var c = await rpc("customer_consents", body);
      if (c.error) c = await rpc("customer_consents", body);
      // Then the emergency contact typed with it.
      await emSave();
      await signedIn();
    } finally { setLoading("#create", false); }
  }
  function signupRefused(e) {
    var m = errText(e);
    if (/name_chars/.test(m)) { setErr("f-name", "Names can only contain letters, spaces and periods."); focusField("f-name"); }
    else if (/name_short/.test(m)) { setErr("f-name", "Write your first and last name in full, not initials"); focusField("f-name"); }
    else if (/23505|DUPLICATE/i.test(m)) { setErr("f-email", "An account with this email already exists. Sign in to book with it."); focusField("f-email"); }
    else if (/RATE_LIMITED/.test(m)) showBanner(SITE_TOO_MANY);
    else if (/WEAK_PASSWORD/.test(m)) { setErr("f-pwd", "errPasswordLen", null, true); focusField("f-pwd"); }
    else if (/BAD_INPUT/.test(m) && /phone/.test(m)) { setErr("f-phone", "Enter a valid mobile number"); focusField("f-phone"); }
    else if (/BAD_INPUT/.test(m) && /height/.test(m)) { setErr("f-height", "Enter your height in cm (100 to 250)"); focusField("f-height"); }
    else showBanner(NET);
  }

  // Sign in as the booking site does (the sign-in every account form shares, forms/shared/account.js): an email in
  // lower case, a number in E.164 (+966 when it has no code); a temporary password is changed on the booking site first.
  $("#p-signin").addEventListener("submit", async function (e) {
    e.preventDefault(); hideBanner(); if (busy || !passStep("signin")) return;
    $("#si-temp").hidden = true;
    setLoading("#signin", true);
    try {
      var r = await MMAccount.signIn(rpc, $("#ident").value, $("#spwd").value);
      if (r.row) {
        acct = { id: r.row.id, token: r.row.session_token, name: r.row.name || "", email: r.row.email || "", phone: r.row.phone || "", made: false };
        $("#spwd").value = "";
        await signedIn();
        return;
      }
      if (r.error === "locked") setErr("f-spwd", "errLoginLocked", null, true);
      else if (r.error === "busy") showBanner(SITE_TOO_MANY);
      else if (r.error === "network") showBanner(NET);
      else if (r.error === "temp") { $("#si-temp").hidden = false; $("#si-temp").scrollIntoView({ block: "center" }); }
      else if (r.error === "id") setErr("f-ident", "errEmailOrPhone", null, true);
      else if (r.error === "pwd") setErr("f-spwd", "errPasswordRequired", null, true);
      else setErr("f-spwd", r.cc ? "errLoginPhoneCc" : "errInvalidCredentials", null, true);
    } finally { setLoading("#signin", false); }
  });

  /* ── Arriving signed in from the booking app (?code=, one use, two minutes) ── */
  async function arrive() {
    var hc = MMAccount.takeCode();
    if (hc == null) return false;
    var r = await MMAccount.redeem(rpc, hc);
    if (!r.row) { if (r.error === "network") showBanner(NET); else showBanner("This sign-in link has expired. Sign in again to continue."); return false; }
    acct = { id: r.row.id, token: r.row.session_token, name: r.row.name || "", email: "", phone: "", made: false };
    keepAcct();
    return true;
  }

  /* ── The account kept on this device (the owner, 2026-11-09: stay signed in) ── */
  function keepAcct() {
    try { if (acct) localStorage.setItem(ACCT_KEY, JSON.stringify({ id: acct.id, token: acct.token, name: acct.name || "", email: acct.email || "" })); } catch (e) {}
  }
  function forgetAcct() { try { localStorage.removeItem(ACCT_KEY); } catch (e) {} }
  function keptAcct() {
    try {
      var v = JSON.parse(localStorage.getItem(ACCT_KEY) || "null");
      if (v && typeof v.id === "string" && v.id && typeof v.token === "string" && v.token) return { id: v.id, token: v.token, name: String(v.name || ""), email: String(v.email || ""), phone: "", made: false };
    } catch (e) {}
    return null;
  }
  // The session the database no longer knows: forgotten here, and the page as for anyone.
  function quietOut() {
    acct = null; wallet = undefined; mine = []; pay = null; pendingChange = null;
    forgetAcct();
    if (changing) leaveChange();
    paintWho(); paintMine(); paintPick();
  }
  $$(".who-out").forEach(function (b) {
    b.addEventListener("click", function () {
      if (busy) return;
      quietOut(); hideBanner();
      if (view !== "landing") backToPick();
    });
  });

  // Signed in (a new account, a sign-in, or handed back): the wallet, the rider's lockers, and the evenings again (a
  // Petromin night they are booked on appears), then on to the review with the lockers picked.
  async function signedIn() {
    keepAcct(); paintWho();
    await Promise.all([loadWallet(), loadMine(), loadEvenings()]);
    if (pendingChange) { openChange(pendingChange); return; }
    // a locker picked that went meanwhile, or more than this account may still hold, keeps the rider on the cabinet
    var cut = day ? await loadBoard() : false;
    if (!cut && picked.length && board && board.day === day && board.kind) enterReview();
    else backToPick();
  }
  function signedOut() {
    acct = null; wallet = undefined; mine = []; pay = null;
    forgetAcct();
    if (changing) leaveChange();
    showBanner("You were signed out. Sign in again to reserve.");
    paintWho(); paintMine(); openAccount("signin");
  }
  function paintWho() {
    var t = acct ? tr("Signed in as {name}", { name: acct.name || "" }) + (acct.email ? " · " + isolate(acct.email) : "") : "";
    ["#land-who", "#r-who"].forEach(function (s) { $(".who-t", $(s)).textContent = t; $(s).hidden = !acct || (s === "#r-who" && acct.made); });
  }

  /* ── The wallet and the rider's lockers ───────────────────────────────── */
  var wallet = undefined; // undefined: not read yet; null: none to show (signed out, or a database without it); else {balance}
  async function loadWallet() {
    if (!acct) { wallet = undefined; return; }
    var who = acct, r = await rpc("customer_wallet", { p_id: acct.id, p_token: acct.token });
    if (r.error && /NOT_AUTHORIZED/.test(errText(r.error))) { if (acct === who) quietOut(); return; }
    var b = !r.error && r.data && typeof r.data === "object" ? Number(r.data.balance) : NaN;
    wallet = isFinite(b) ? { balance: b } : null;
    paintReview();
  }
  var mine = []; // customer_lockers: the rider's rentals from yesterday on
  async function loadMine() {
    if (!acct) { mine = []; return; }
    var who = acct, r = await rpc("customer_lockers", { p_id: acct.id, p_token: acct.token });
    if (r.error) { if (/NOT_AUTHORIZED/.test(errText(r.error))) { if (acct === who) quietOut(); return false; } paintMine(); return true; }
    mine = (Array.isArray(r.data) ? r.data : []).filter(function (x) { return x && typeof x === "object" && x.id && isDay(x.day) && SPANS[x.period]; }).map(mineOf);
    paintMine();
    return true;
  }
  function mineOf(x) {
    return { id: String(x.id), booking_id: x.booking_id || null, day: x.day, period: x.period, status: String(x.status || ""), pay: x.pay || null, paid: x.paid === true,
      code: x.code != null && String(x.code) ? String(x.code) : null, name: clean(x.name) };
  }
  var P_ORDER = { early: 0, pm: 1, both: 2, late: 3 };
  // From today on, still reserved or with the rider: the number (once known), the evening and the time.
  function mineNow() {
    var t = todayKsa();
    return mine.filter(function (r) { return r.day >= t && (r.status === "reserved" || r.status === "in_use"); })
      .sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : (P_ORDER[a.period] - P_ORDER[b.period]) || byNumber(a.code || "", b.code || ""); });
  }
  // How a locker is paid, in the booking app's words (lkPaidWallet, lkPayDesk); one on a booking is on its bill. One
  // reserved for "Pay by card" is paid once its payment settles; until then it is held while the rider pays, and let
  // go unpaid (never "Pay at the desk": the desk takes no payment for it).
  function payText(r) {
    return r.booking_id ? tr("On your booking") : r.pay === "wallet" && r.paid ? tr("Paid from your wallet")
      : r.pay === "card" ? (r.paid ? tr("Paid by card") : tr("Card payment not finished")) : tr("Pay at the desk");
  }
  function deskRow(r) {
    var mayChange = r.status === "reserved", mayDrop = mayChange && !r.booking_id;
    return '<li class="desk-row"><span class="desk-n" aria-hidden="true">' + (r.code ? esc(r.code) : '<svg><use href="#i-lock"/></svg>') + "</span>" +
      '<span class="desk-t"><b>' + esc(r.code ? tr("Locker {n}", { n: r.code }) : tr("Locker")) + (r.name ? ' · <bdi>' + esc(r.name) + "</bdi>" : "") + "</b>" +
      "<small>" + esc(spanOf(r.period)) + " · " + esc(payText(r)) + "</small>" + (r.status === "in_use" ? '<span class="chip sm st-use">' + esc(tr("In use")) + "</span>" : "") + "</span>" +
      (mayChange ? '<span class="desk-acts"><button type="button" class="mine-chg" data-id="' + esc(r.id) + '">' + esc(tr("Change")) + "</button>" +
        (mayDrop ? '<button type="button" class="mine-x" data-id="' + esc(r.id) + '">' + esc(tr("Remove")) + "</button>" : "") + "</span>" : "") + "</li>";
  }
  // One card per evening to show at the desk: the code the desk scans names the evening's first locker (the staff app
  // finds the rider's others that evening), then each locker.
  function deskCards(rows) {
    var days = [], by = {};
    rows.forEach(function (r) { if (!by[r.day]) { by[r.day] = []; days.push(r.day); } by[r.day].push(r); });
    return days.map(function (d) {
      var first = mine.filter(function (x) { return x.day === d && by[d].indexOf(x) >= 0; })[0] || by[d][0];
      return '<article class="desk"><div class="desk-top"><div class="desk-head"><p class="desk-h">' + esc(tr("Show this at the desk")) + '</p><p class="desk-when">' + esc(dayLong(d)) + "</p></div>" +
        '<span class="desk-qr"><canvas class="qr" width="1" height="1" data-qr="' + esc(DESK_URL + first.id) + '" role="img" aria-label="' + esc(tr("Code for the desk")) + '"></canvas></span></div>' +
        '<ul class="desk-list">' + by[d].map(deskRow).join("") + "</ul></article>";
    }).join("");
  }
  function paintMine() {
    var rows = acct ? mineNow() : [], h = deskCards(rows);
    ["#mine-pick", "#mine-done"].forEach(function (s) {
      var box = $(s), list = $(".mine-list", box);
      box.hidden = !rows.length || (s === "#mine-pick" && !!changing);
      if (list.getAttribute("data-h") !== h) { list.innerHTML = h; list.setAttribute("data-h", h); } // drawn again only when it changed
    });
    drawCodes();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".mine-x, .mine-chg"); if (!b || busy) return;
    var r = mine.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; if (!r) return;
    if (b.classList.contains("mine-chg")) { enterChange(r); return; }
    dropping = r; paintRemove(); showModal("#rm", "#rm-keep");
  }, OWN);

  /* ── The code the desk scans, drawn on a canvas as the website's tickets draw theirs (components/booking/QrCanvas.tsx,
     lib/qr-paint.ts): a phone's dark mode recolours an svg's shapes, never a canvas's pixels. qrcode-generator is the
     website's own encoder, inlined by the build. ── */
  var QR_CSS = 148;
  function drawCodes() { $$("canvas.qr[data-qr]").forEach(function (c) { paintCode(c, c.getAttribute("data-qr")); }); }
  function paintCode(canvas, text) {
    // qrcode by its name: on its own the encoder is a global; on the website's page every script runs inside one function
    // (forms/shared/site-form.mjs), where its var is that function's, not window's.
    var enc = typeof qrcode === "function" ? qrcode : window.qrcode;
    if (typeof enc !== "function" || canvas.getAttribute("data-drawn") === text) return;
    var q; try { q = enc(0, "M"); q.addData(text); q.make(); } catch (e) { return; }
    var pen = canvas.getContext && canvas.getContext("2d"); if (!pen) return;
    var n = q.getModuleCount(), px = Math.round(QR_CSS * Math.min(window.devicePixelRatio || 1, 3)), edge = [];
    // module edge k on a tile px wide with a margin of n/20 modules each side, in whole pixels (lib/qr-paint.ts qrEdge)
    for (var k = 0; k <= n; k++) edge.push(Math.round(((n + 20 * k) * px) / (22 * n)));
    canvas.width = px; canvas.height = px;
    pen.fillStyle = "#fff"; pen.fillRect(0, 0, px, px);
    pen.fillStyle = "#1a1919";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; ) {
        if (!q.isDark(r, c)) { c++; continue; }
        var end = c + 1; while (end < n && q.isDark(r, end)) end++;
        pen.fillRect(edge[c], edge[r], edge[end] - edge[c], edge[r + 1] - edge[r]);
        c = end;
      }
    }
    canvas.setAttribute("data-drawn", text);
  }

  /* ── Changing a locker before its key is handed: another door, another time of the same evening, one door at a
     time; the locker's own door is free to keep (customer_locker_change). ── */
  var changing = null, beforeChange = null, pendingChange = null;
  function enterChange(r) {
    if (!r || r.status !== "reserved" || !acct) return;
    hideBanner(); clearMsg("f-cab");
    if (!changing) beforeChange = { day: day, period: period, picked: picked.slice() };
    changing = r;
    day = r.day; period = r.period; picked = r.code ? [r.code] : [];
    board = null; boardErr = false;
    backToPick(); loadBoard();
    var h = $("#chg-title"); if (h) h.focus({ preventScroll: true });
  }
  // ?change=<rental>: the locker named, once the account's lockers are read.
  function openChange(id) {
    pendingChange = null;
    var r = mine.filter(function (x) { return x.id === id; })[0];
    if (r && r.status === "reserved") { enterChange(r); return; }
    backToPick(); showBanner("This locker can't be changed now. Ask at the desk.");
  }
  function leaveChange() {
    changing = null;
    if (beforeChange) { day = beforeChange.day; period = beforeChange.period; picked = beforeChange.picked; beforeChange = null; }
    board = null; boardErr = false; clearMsg("f-cab");
    paintPick(); if (day) loadBoard();
  }
  $("#chg-cancel").addEventListener("click", function () { if (!busy) leaveChange(); });
  async function doChange() {
    if (!acct || !changing || busy) return;
    var r0 = changing, c = picked[0], p = period;
    setLoading("#go", true);
    var r;
    try { r = await rpc("customer_locker_change", { p_id: acct.id, p_token: acct.token, p_rental: r0.id, p_period: p, p_code: c }); }
    finally { setLoading("#go", false); }
    if (r.error) { changeRefused(r.error); return; }
    var o = r.data && typeof r.data === "object" ? r.data : {};
    var code = o.code != null ? String(o.code) : c;
    mine.forEach(function (x) { if (x.id === r0.id) { x.code = code; x.period = SPANS[o.period] ? o.period : p; if (typeof o.paid === "boolean") x.paid = o.paid; } });
    if (o.left && board && board.day === r0.day) board.left = o.left;
    leaveChange();
    say("Locker changed");
    var box = $("#mine-pick"); if (box && !box.hidden) box.scrollIntoView({ block: "start" });
    loadMine(); if (r0.pay === "wallet") loadWallet();
  }
  function changeRefused(e) {
    var m = errText(e), n = codeIn(m);
    if (/NOT_AUTHORIZED/.test(m)) { signedOut(); return; }
    if (/NOT_FOUND|LOCKER_NOT_OPEN/.test(m)) { leaveChange(); showBanner("This locker can't be changed now. Ask at the desk."); loadMine(); return; }
    if (/LOCKER_TAKEN|LOCKER_OUT|LOCKER_UNKNOWN/.test(m)) {
      if (n) picked = picked.filter(function (x) { return x !== n; });
      if (/LOCKER_TAKEN/.test(m)) setErr("f-cab", "Locker {n} was just taken. Pick another.", { n: n });
      else if (/LOCKER_OUT/.test(m)) setErr("f-cab", "Locker {n} is out of service", { n: n });
      else setErr("f-cab", "No locker {n}", { n: n });
      paintPick(); loadBoard(); return;
    }
    if (/LOCKERS_FULL/.test(m)) { setErr("f-cab", "The lockers for that time are all taken."); loadBoard(); return; }
    if (/WALLET_SHORT/.test(m)) { setErr("f-cab", "Not enough in the wallet."); loadWallet(); return; }
    if (/RATE_LIMITED/.test(m)) { showBanner(SITE_TOO_MANY); return; }
    showBanner(NET);
  }

  /* ── Taking a locker back (before its key is collected), in a pop-up centred on the screen ── */
  var dropping = null;
  function paintRemove() {
    if (!dropping) return;
    $("#rm-title").textContent = dropping.code ? tr("Remove locker {n}?", { n: dropping.code }) : tr("Remove this locker?");
    // the money back the way it was paid: the wallet's at once, a card's to the card (a refund for staff to send)
    var b = $("#rm-body");
    b.hidden = !(dropping.paid && (dropping.pay === "wallet" || dropping.pay === "card"));
    b.textContent = dropping.pay === "card" ? tr("The money goes back to your card.") : tr("The money goes back to your wallet.");
  }
  $("#rm-keep").addEventListener("click", function () { if (!busy) closeModal(); });
  $("#rm-go").addEventListener("click", async function () {
    if (busy || !dropping || !acct) return;
    var r0 = dropping;
    setLoading("#rm-go", true);
    var r;
    try { r = await rpc("customer_locker_drop", { p_id: acct.id, p_token: acct.token, p_rental: r0.id }); }
    finally { setLoading("#rm-go", false); }
    closeModal(); dropping = null;
    if (r.error) {
      var m = errText(r.error);
      if (/NOT_AUTHORIZED/.test(m)) { signedOut(); return; }
      if (/NOT_FOUND/.test(m)) { loadMine(); return; }
      if (/LOCKER_NOT_OPEN/.test(m)) showBanner("This locker can't be removed now. Ask at the desk.");
      else showBanner(NET);
      loadMine(); return;
    }
    mine = mine.filter(function (x) { return x.id !== r0.id; });
    paintMine(); say("Locker removed");
    if (r.data && r.data.left && board && board.day === r0.day) board.left = r.data.left;
    loadMine(); loadWallet();
    if (r0.day === day) loadBoard();
  });

  /* ── Step 2: the review and how to pay ───────────────────────────────────── */
  var pay = null, walletOff = false; // walletOff: the database refused the wallet for this evening
  function walletUsable() {
    var t = total();
    return !!wallet && kindNow() !== "pm" && !walletOff && t != null && wallet.balance >= t;
  }
  function enterReview() {
    clearMsg("f-pay"); walletOff = false; namesKey = "";
    if (pay === "wallet" && !walletUsable()) pay = null;
    paintReview(); paintWho(); goStep(2);
    if (acct && acct.made) $("#acct-made").focus({ preventScroll: true });
  }
  function row(k, v) { return "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>"; }
  function codesText(list) { return list.slice().sort(byNumber).join(lang === "ar" ? "، " : ", "); }
  function paintReview() {
    $("#acct-made").hidden = !(acct && acct.made);
    var t = total();
    $("#review").innerHTML = row(picked.length > 1 ? tr("Lockers") : tr("Locker"), "<bdi>" + esc(codesText(picked)) + "</bdi>") +
      row(tr("Evening"), esc(day ? dayLong(day) : "—")) + row(tr("Time"), esc(spanOf(period) || "—")) +
      row(tr("Total"), t != null ? amt(t) : "—");
    var wb = $('#pays [data-v="wallet"]'), useW = walletUsable();
    wb.hidden = wallet === null;
    wb.disabled = !useW;
    $("#pay-bal").innerHTML = wallet === undefined ? esc(tr("Loading...")) : wallet ? esc(tr("Balance {amount}", { amount: "\u0000" })).replace("\u0000", amt(wallet.balance)) : "";
    if (pay === "wallet" && !useW) pay = null;
    // With the wallet out of reach, the desk is the one way, already chosen.
    if (!pay && wallet !== undefined && !useW) pay = "desk";
    pickRadio("#pays", pay);
    if (!$("#book").classList.contains("loading")) $("#book").disabled = !picked.length;
    paintNames();
    putHtml($("#terms-line"), esc(tr("By reserving you accept the {terms}.")).replace("{terms}",
      '<button type="button" class="d-link" id="lt-open">' + esc(tr("locker terms")) + "</button>")); // a pop-up: the website's Terms page is not open yet
  }
  // A name on each locker when more than one is reserved (the desk knows whose key it is): the first the account's,
  // each one required, letters and spaces only (the owner's rule for names), 60 at most. One locker is the account's.
  var names = {}, namesKey = "";
  function nameClean(v) { return String(v || "").replace(DASHES, " ").replace(/[^\p{L}\p{M}\s]/gu, "").replace(/\s{2,}/g, " ").slice(0, 60); }
  function namedCodes() { return picked.slice().sort(byNumber); }
  function paintNames() {
    var box = $("#names"), codes = namedCodes(), key = codes.join(",") + "|" + lang;
    box.hidden = codes.length < 2;
    if (codes.length < 2 || key === namesKey) return;
    namesKey = key;
    codes.forEach(function (c, i) { if (names[c] == null) names[c] = i === 0 && acct ? nameClean(acct.name).trim() : ""; });
    box.innerHTML = codes.map(function (c) {
      return '<div id="f-nm-' + esc(c) + '" class="field"><label for="nm-' + esc(c) + '">' + esc(tr("Name on locker {n}", { n: c })) + "</label>" +
        '<input id="nm-' + esc(c) + '" class="nm" data-code="' + esc(c) + '" type="text" autocomplete="off" autocapitalize="words" maxlength="60" value="' + esc(names[c]) + '">' +
        '<p class="err" aria-live="polite"></p></div>';
    }).join("");
    codes.forEach(function (c) { paintField("f-nm-" + c); });
  }
  $("#names").addEventListener("input", function (e) {
    var el = e.target.closest("input.nm"); if (!el) return;
    var c = el.getAttribute("data-code"), v = nameClean(el.value);
    if (v !== el.value) { var at = Math.max(0, (el.selectionStart == null ? v.length : el.selectionStart) - (el.value.length - v.length)); el.value = v; try { el.setSelectionRange(at, at); } catch (x) {} }
    names[c] = v; clearMsg("f-nm-" + c);
  });
  // The names to send beside the lockers, or null for one locker (the database takes the account's); false when one is missing.
  function namesFor(codes) {
    if (codes.length < 2) return null;
    var out = codes.map(function (c) { return clean(names[c]); }), bad = codes.filter(function (c, i) { return !/\p{L}/u.test(out[i]); });
    bad.forEach(function (c) { setErr("f-nm-" + c, "Enter a name for locker {n}", { n: c }); });
    if (bad.length) { focusField("f-nm-" + bad[0]); return false; }
    return out;
  }
  // Card payments, only where the website takes them (apps/web /api/pay/status)
  fetch("/api/pay/status").then(function (r) { return r.json(); }).then(function (b) { if (b && b.open) $("#pay-card").hidden = false; }, function () {});
  $("#pays").addEventListener("click", function (e) {
    var b = e.target.closest("[role=radio]"); if (!b || b.disabled) return;
    pay = b.getAttribute("data-v"); pickRadio("#pays", pay); clearMsg("f-pay");
  });
  $("#s-review").addEventListener("submit", async function (e) {
    e.preventDefault(); hideBanner(); if (busy || !acct) return;
    if (!picked.length) { backToPick(); setErr("f-cab", "Pick a locker"); return; }
    var codes = namedCodes(), nm = namesFor(codes);
    if (nm === false) return;
    if (!pay) { setErr("f-pay", "Choose how to pay"); focusField("f-pay"); return; }
    var d = day, p = period, k = kindNow(), price = priceOf(p), how = pay;
    var body = { p_id: acct.id, p_token: acct.token, p_day: d, p_period: p, p_codes: codes, p_pay: how };
    if (nm) body.p_names = nm;
    setLoading("#book", true);
    if (how === "card") {
      // Paying by card (2026-11-10): the website's server reserves the lockers for card payment and opens the
      // payment page; they are held while the rider pays and let go when unpaid (apps/web /api/pay/locker).
      var cr = null;
      try {
        var res = await fetch("/api/pay/locker", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: acct.id, token: acct.token, day: d, period: p, codes: codes, names: nm || undefined, lang: lang }) });
        cr = await res.json().catch(function () { return null; });
      } catch (x) { cr = null; }
      if (cr && cr.ok && /^\/pay\/[0-9a-f-]{36}$/.test(cr.url || "")) { clearPick(); window.location.assign(cr.url); return; }
      setLoading("#book", false);
      if (cr && cr.detail) { bookRefused({ message: cr.detail }); return; }
      if (cr && cr.error === "signin") { signedOut(); return; }
      showBanner(NET); return;
    }
    var r, made = null;
    try {
      r = await rpc("customer_locker_book", body);
      if (r.error && mayBeMade(errText(r.error))) made = await madeAlready(d, p, codes);
    }
    finally { setLoading("#book", false); }
    if (made) {
      // reserved after all: the lockers read again are the rider's now (the done screen's cards come from them)
      var mp = made[0].pay || how;
      booked = { codes: made.map(function (x) { return x.code; }), day: d, period: p, kind: k, pay: mp, total: price != null ? price * made.length : null };
      clearPick(); pay = null; names = {}; namesKey = "";
      showDone();
      if (mp === "wallet") loadWallet();
      return;
    }
    if (r.error) { bookRefused(r.error); return; }
    var out = r.data && typeof r.data === "object" ? r.data : null;
    if (!out || !out.ok) { showBanner(NET); return; }
    var rentals = (Array.isArray(out.rentals) ? out.rentals : []).filter(function (x) { return x && x.id && x.code != null; });
    var got = rentals.map(function (x) { return String(x.code); });
    booked = { codes: got.length ? got : codes, day: d, period: p, kind: k, pay: how, total: price != null ? price * (got.length || codes.length) : null };
    // the cards to show at the desk at once, before the lockers are read again
    rentals.forEach(function (x, i) {
      if (!mine.some(function (y) { return y.id === String(x.id); }))
        mine.push(mineOf({ id: x.id, booking_id: null, day: d, period: p, status: "reserved", pay: how, paid: how === "wallet", code: x.code, name: x.name || (nm ? nm[i] : acct.name) }));
    });
    if (out.left && board && board.day === d) board.left = out.left;
    clearPick(); pay = null; names = {}; namesKey = "";
    showDone();
    loadMine(); if (how === "wallet") loadWallet();
  });
  // A reservation the database made though its answer never arrived (a phone changing networks), and Reserve pressed
  // again: the second is refused because of the first (its lockers taken, the limit or the room used, the wallet paid),
  // or it had no answer either. Those refusals first read the rider's lockers again.
  function mayBeMade(m) { return !/NOT_AUTHORIZED|RATE_LIMITED|PAY_OFF|WALLET_NOT_OPEN|LOCKER_(?:PAY|PICK|OUT|UNKNOWN|NOT_OPEN)/.test(m); }
  // The rider's lockers for that evening and time, read again: the ones reserved, when they are every locker asked for.
  async function madeAlready(d, p, codes) {
    await loadMine();
    var got = mine.filter(function (x) { return !x.booking_id && x.day === d && x.period === p && x.status === "reserved" && codes.indexOf(x.code) >= 0; });
    return got.length && got.length >= codes.length ? got : null;
  }
  function codeIn(m) { var x = /LOCKER_(?:TAKEN|OUT|UNKNOWN):\s*([A-Za-z0-9]+)/.exec(m); return x ? x[1] : ""; }
  function bookRefused(e) {
    var m = errText(e), n = codeIn(m);
    if (/NOT_AUTHORIZED/.test(m)) { signedOut(); return; }
    if (/LOCKER_TAKEN|LOCKER_OUT|LOCKER_UNKNOWN/.test(m)) {
      if (n) picked = picked.filter(function (c) { return c !== n && c.replace(/^L/i, "") !== n; });
      savePick(); backToPick();
      if (/LOCKER_TAKEN/.test(m)) setErr("f-cab", "Locker {n} was just taken. Pick another.", { n: n });
      else if (/LOCKER_OUT/.test(m)) setErr("f-cab", "Locker {n} is out of service", { n: n });
      else setErr("f-cab", "No locker {n}", { n: n });
      loadBoard(); return;
    }
    if (/LOCKERS_FULL/.test(m)) { backToPick(); setErr("f-cab", "The lockers for that time are all taken."); loadBoard(); return; }
    if (/LOCKER_LIMIT/.test(m)) { showBanner("Up to 3 lockers per account for each time."); loadMine(); return; }
    if (/LOCKER_NOT_OPEN/.test(m)) { backToPick(); showBanner("That time is over or closed. Pick another."); loadEvenings().then(loadBoard); return; }
    if (/LOCKER_PICK/.test(m)) { backToPick(); setErr("f-cab", "Pick a locker"); return; }
    if (/LOCKER_PAY/.test(m)) { pay = null; paintReview(); setErr("f-pay", "Choose how to pay"); focusField("f-pay"); return; }
    if (/WALLET_SHORT/.test(m)) { pay = null; setErr("f-pay", "Not enough in the wallet."); loadWallet(); return; }
    if (/WALLET_NOT_OPEN/.test(m)) { walletOff = true; pay = null; paintReview(); setErr("f-pay", "This evening can't be paid from the wallet."); return; }
    if (/RATE_LIMITED/.test(m)) { showBanner(SITE_TOO_MANY); return; }
    showBanner(NET);
  }

  /* ── Reserved ────────────────────────────────────────────────────────── */
  var booked = null;
  function paintDone() {
    if (!booked) return;
    $("#done-title").textContent = booked.codes.length > 1 ? tr("Your lockers are reserved") : tr("Your locker is reserved");
  }
  function showDone() {
    showView("done"); paintDone(); paintMine();
    $("#done-title").focus({ preventScroll: true });
  }
  $("#again").addEventListener("click", function () { booked = null; clearMsg("f-cab"); backToPick(); loadBoard(); });

  // ?change=<rental id>: the booking app's Change on a locker, opened once signed in.
  function takeChange() {
    var q = new URLSearchParams(location.search), v = q.get("change");
    if (v == null) return null;
    q.delete("change");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
    return /^[0-9a-fA-F-]{36}$/.test(v) ? v.toLowerCase() : null;
  }

  /* ── The cabinet read again while the page is seen ────────────────────── */
  function live() { return document.visibilityState === "visible" && !busy && !!day && (view === "landing" || (view === "steps" && step === 2)); }
  var poll = setInterval(function () { if (!gone() && live()) loadBoard(); }, POLL_MS);
  onStop(function () { clearInterval(poll); });
  document.addEventListener("visibilitychange", function () { if (!gone() && live() && Date.now() - boardAt > POLL_MS) loadBoard(); }, OWN);
  // Back from the card payment page, the browser may show this page as it was left (its back-forward cache): busy, with
  // Reserve spinning and the lockers handed to the payment. It is drawn again from what is true now: the cabinet, with
  // the lockers held for the card among the rider's own.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted || gone()) return; // this run's page only, as the board's poll and the document's listeners
    if ($("#book").classList.contains("loading")) setLoading("#book", false);
    if (view === "steps" && step === 2 && !picked.length) backToPick(); else paintReview();
    loadMine(); loadWallet();
    if (day) loadBoard();
  }, OWN);

  /* ── A locker's own tag: ?locker=7 (older tags L7), picked on the first evening and time it is free ── */
  function tagCode(raw) {
    var c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^L/, "").replace(/^0+(?=\d)/, "");
    return /^[A-Z]{0,3}[1-9]\d{0,3}$/.test(c) ? c : "";
  }
  function takeTag() {
    var q = new URLSearchParams(location.search), raw = q.get("locker");
    if (raw == null) return "";
    q.delete("locker");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
    return tagCode(raw);
  }
  async function seekTag(c) {
    var list = (evenings || []).slice(0, 14);
    for (var i = 0; i < list.length; i++) {
      var b = await readBoard(list[i].day);
      if (!b || !b.kind) continue;
      var u = unitsOf(b).filter(function (x) { return String(x.code) === c; })[0];
      if (!u) { setErr("f-cab", "No locker {n}", { n: c }); return false; }
      if (u.out) { setErr("f-cab", "Locker {n} is out of service", { n: c }); return false; }
      var p = openPeriods(b, b.kind).filter(function (x) { return leftOf(b, x) !== 0 && !takenOf(b, x)[c]; })[0];
      if (p) { day = list[i].day; board = b; boardAt = Date.now(); period = p; picked = [c]; savePick(); return true; }
    }
    setErr("f-cab", "Locker {n} is taken. Pick another.", { n: c });
    return false;
  }

  // Test hook: the specs read what the page works out without a network.
  window.LockersForm = { setLang: setLang, tagCode: tagCode, spanOf: spanOf, nameClean: nameClean, cells: function (units) { return cabinetCells({ units: units }).map(function (u) { return u ? String(u.code) : null; }); } };

  setLang(pickLang(), false);
  showView("landing");
  var kept = readPick(), tag = takeTag();
  pendingChange = takeChange();
  // The evenings and the cabinet; a tag picks its locker, else the lockers this tab picked before come back.
  async function start2() {
    evenings = undefined; evErr = false; paintPick();
    if (!(await loadEvenings())) return;
    if (!evenings.length) { paintPick(); return; }
    var found = false;
    if (tag) { found = await seekTag(tag); tag = ""; }
    if (!found && kept && evOf(kept.day)) { day = kept.day; period = kept.period; picked = kept.codes.slice(); }
    kept = null;
    if (!day) day = evenings[0].day;
    if (found) settle(false); else return await loadBoard();
  }
  (async function start() {
    var handed = await arrive();
    // else the account kept on this device; one the database no longer knows is forgotten (loadMine, quietOut)
    if (!acct) acct = keptAcct();
    if (acct) { paintWho(); await Promise.all([loadWallet(), loadMine()]); }
    var cut = await start2();
    if (pendingChange) {
      if (acct) openChange(pendingChange);
      else openAccount("ask"); // signed in, the change opens (signedIn)
      return;
    }
    // Handed back signed in with lockers picked before: on to the review, unless one of them went meanwhile (said on
    // the cabinet).
    if (handed && acct && !cut && picked.length && board && board.kind) enterReview();
  })();
})();
