/* Defe x MicroMobility (micromobility.sa/defe): one page that books a place on the Saturday Social Ride
   with Defe (the owner, 2026-10-17). In order:
   1. the landing: the ride (partner_status: which session, places open or full, whether a code is
      needed) - never a count of places or bookings, only open or full;
   2. the account: the booking site's own sign-up (customer_exists, customer_signup, customer_consents,
      customer_set_emergency/2) or its sign-in (customer_login, customer_pwd_state); Google, Apple and a
      forgotten password go through the booking app, which hands the rider back here signed in
      (?code=, customer_handoff_redeem);
   3. the details a Saturday ride asks for, only what the account is missing, the height always
      (customer_profile, customer_emergency, customer_whatsapp, customer_fix_fields; saved with
      customer_set_birth_nat, customer_set_whatsapp, customer_set_socials, customer_set_height);
   4. the booking: the Defe code while it is needed, the group, the bike, the review and the ride
      waiver (partner_book);
   5. booked: then the booking in the app, signed in there by a one-time code (customer_handoff_create).
   The session lives in this page only, never in storage. */
(function () {
  "use strict";
  // The public anon key (the same one the booking site ships): every call is a SECURITY DEFINER
  // function that checks the session token and throttles on the server.
  var SUPABASE_URL = "https://qpffkzmsfyilicwcsszz.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmZrem1zZnlpbGljd2Nzc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDQwODAsImV4cCI6MjEwNTgyMDA4MH0.K6qZpK0oR4MXIaFk4DRJGy-H_m6BYnJ-S31swTiHMhQ";
  var PARTNER = "defe";
  var LANG_KEY = "mm-defe-lang";
  // The booking app: where Google, Apple and a forgotten password are handled, and where the ticket lives.
  var BOOKING_URL = "https://micromobilityrentals.pages.dev/";

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
  function clean(v) { return String(v == null ? "" : v).replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, " ").replace(/\s+/g, " ").trim(); }
  function isolate(s) { return "⁦" + s + "⁩"; }

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
  function pickLang() {
    var q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (q === "en" || q === "ar") return q;
    try { var s = localStorage.getItem(LANG_KEY); if (s === "en" || s === "ar") return s; } catch (e) {}
    var nav = navigator.languages || [navigator.language || "en"];
    for (var i = 0; i < nav.length; i++) { var c = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (c === "ar" || c === "en") return c; }
    return "en";
  }
  function setLang(code, save) {
    lang = code;
    html.lang = code; html.dir = langInfo(code).rtl ? "rtl" : "ltr";
    if (save) { try { localStorage.setItem(LANG_KEY, code); } catch (e) {} }
    var other = code === "ar" ? "en" : "ar", b = $("#lang");
    b.textContent = langInfo(other).label; b.lang = other;
    b.setAttribute("aria-label", other === "ar" ? "اقرأ الصفحة بالعربية" : "Read this page in English");
    paint();
  }
  $("#lang").addEventListener("click", function () {
    var next = lang === "ar" ? "en" : "ar";
    setLang(next, true);
    try { var u = new URL(location.href); u.searchParams.set("lang", next); history.replaceState(null, "", u); } catch (e) {}
  });
  function paint() {
    document.title = tr("Defe x MicroMobility | Saturday Social Ride");
    $$("[data-t]").forEach(function (el) { el.textContent = tr(el.getAttribute("data-t")); });
    $$("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", tr(el.getAttribute("data-t-aria"))); });
    $$("[data-site]").forEach(function (el) { el.textContent = site(el.getAttribute("data-site")); });
    $$("[data-site-aria]").forEach(function (el) { el.setAttribute("aria-label", site(el.getAttribute("data-site-aria"))); });
    $$("[data-site-placeholder]").forEach(function (el) { el.placeholder = site(el.getAttribute("data-site-placeholder")); });
    $$("#si-other, #si-temp-a, #d-blocked-a").forEach(function (a) { a.href = handoffUrl(); });
    $("#see-ticket-a").href = bookingsUrl(); $("#done-fallback").href = bookingsUrl();
    $("#ack-lbl").innerHTML = ackLabel();
    $("#waiver-lbl").innerHTML = esc(tr("I have read and accept the {waiver}.")).replace("{waiver}", '<button type="button" class="d-link" id="wv-open">' + esc(tr("ride waiver")) + "</button>") + ' <span class="req" aria-hidden="true">*</span>';
    buildNationalities(); buildDob(); buildCc(); buildEm(); paintWa();
    $$(".field").forEach(function (f) { paintField(f.id); });
    if (!$("#pv").hidden) renderNotice();
    paintLanding(); paintStep(); paintReview(); paintDone(); paintWho();
    if (bannerKey) showBanner(bannerKey);
  }
  function ackLabel() { return esc(site("privacyAckOpt")).replace("{0}", '<button type="button" class="d-link" id="pv-open">' + esc(site("privacyNotice")) + "</button>") + ' <span class="req" aria-hidden="true">*</span>'; }
  function handoffUrl() { return BOOKING_URL + "?handoff=defe&lang=" + lang; }
  function bookingsUrl() { return BOOKING_URL + "?tab=bookings&lang=" + lang; }

  /* ── The ride: dates and times as the page shows them ──────────────────── */
  var ride = undefined; // undefined: not read yet; null: no Defe ride open; else the partner_status row
  var rideErr = false;
  function rideDate(o) {
    if (!ride || !/^\d{4}-\d{2}-\d{2}$/.test(ride.session_date || "")) return "";
    try { return new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: "UTC" }, o)).format(new Date(ride.session_date + "T12:00:00Z")); }
    catch (e) { return ride.session_date; }
  }
  // The bike pickup: sessions.bike_slots' "_time" ("05:45 - 06:15").
  function pickup() {
    if (!ride) return null;
    var s = ride.bike_slots, o = null;
    try { o = typeof s === "string" ? JSON.parse(s) : s; } catch (e) { o = null; }
    var t = o && typeof o === "object" && typeof o._time === "string" ? o._time : "";
    var p = t.split("-").map(function (x) { return x.trim(); }).filter(function (x) { return /^\d{1,2}:\d{2}$/.test(x); });
    if (!p.length) return null;
    p = p.map(function (x) { return x.length === 4 ? "0" + x : x; });
    return p;
  }
  function meetUrl() { var u = ride && ride.meet_url; return typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ""; }

  /* ── The landing ─────────────────────────────────────────────────────── */
  function fact(dt, dd) { return '<div class="fact"><dt>' + esc(dt) + "</dt><dd>" + dd + "</dd></div>"; }
  function paintLanding() {
    var eb = $("#eyebrow");
    eb.textContent = tr("Saturday Social Ride") + (rideDate({ day: "numeric" }) ? " · " + rideDate({ day: "numeric", month: "short", year: "numeric" }) : "");
    var f = "";
    if (ride) {
      f += fact(tr("Date"), esc(rideDate({ weekday: "long", day: "numeric", month: "long" })));
      var p = pickup(); if (p) f += fact(tr("Bike pickup"), "<bdi dir=\"ltr\">" + esc(p.join(" – ")) + "</bdi>");
      var m = meetUrl(); if (m) f += fact(tr("Meeting point"), '<a class="d-link" href="' + esc(m) + '" target="_blank" rel="noopener">' + esc(tr("Open in Maps")) + "</a>");
    }
    f += fact(tr("Routes"), esc(tr("Beginners 20 km to the Jeddah Yacht Club")) + "<br>" + esc(tr("Intermediates 40 km to just before the Marine Sciences roundabout")));
    f += fact(tr("Cost"), esc(tr("Free · helmet comes with the bike")));
    $("#facts").innerHTML = f;

    // Never a number: open, full, closed (the owner, 2026-10-17).
    var st = $("#state"), go = $("#go"), note = $("#land-notice");
    var state = ride === undefined ? (rideErr ? "error" : "loading") : !ride ? "closed" : !ride.open ? "full" : "open";
    st.className = "chip state st-" + state;
    st.innerHTML = state === "loading" ? '<span class="spinner-dark" aria-hidden="true"></span>' + esc(tr("Loading...")) :
      '<svg aria-hidden="true"><use href="#' + (state === "open" ? "i-open" : "i-stop") + '"/></svg>' + esc(tr({ open: "Places open", full: "Full", closed: "Booking is closed", error: "Could not load the ride" }[state]));
    $("#code-chip").hidden = !(state === "open" && ride.code_needed);
    var n = null;
    if (state === "full") n = ["All Defe places are taken.", "Thank you for the support. Follow @defebreastcancer for their next event."];
    else if (state === "closed") n = ["Booking for this ride is closed.", "Thank you for the support. Follow @defebreastcancer for their next event."];
    else if (state === "error") n = ["Could not reach the server. Please try again.", ""];
    else if (state === "open" && ride.code_needed && !ride.code_open) n = ["Code places are all booked.", "More places open to everyone soon on this page."];
    note.hidden = !n;
    if (n) { $(".notice-h", note).textContent = tr(n[0]); $(".notice-p", note).textContent = n[1] ? tr(n[1]) : ""; }
    go.disabled = state === "loading" || state === "full" || state === "closed";
    go.textContent = state === "full" ? tr("Full") : state === "closed" ? tr("Booking is closed") : state === "error" ? tr("Try again") : tr("Register & book");
    $("#have-acct").hidden = !!acct || state === "full" || state === "closed";
    $("#see-ticket").hidden = !(state === "full" || state === "closed");
  }
  $("#go").addEventListener("click", function () {
    hideBanner();
    if (ride === undefined && rideErr) { loadRide(); return; }
    if (!ride || !ride.open) return;
    if (acct) { enterDetails(); return; }
    openAccount("ask");
  });
  $("#go-signin").addEventListener("click", function () { hideBanner(); openAccount("signin"); });

  /* ── Views and steps ─────────────────────────────────────────────────── */
  var view = "landing", step = 1;
  var STEP_TITLES = { 1: "Your account", 2: "Your details", 3: "Book your place" };
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
    $("#st-n").textContent = tr("Step {n} of 3", { n: step });
    $("#st-title").textContent = tr(STEP_TITLES[step]);
  }
  function backToLanding() { showView("landing"); paintLanding(); }
  // On the sign-in or sign-up fields, Back goes to the account question; on the question, to the ride.
  $("#back-land").addEventListener("click", function () {
    if (step === 1 && accPanel !== "ask") { setTab("ask"); var h = $("#st-title"); if (h) h.focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    backToLanding();
  });

  /* ── Banner ─────────────────────────────────────────────────────────── */
  var bannerKey = null;
  function showBanner(k) {
    bannerKey = k;
    $("#banner .banner-text").textContent = k.indexOf("site:") === 0 ? site(k.slice(5)) : tr(k);
    $("#banner").hidden = false;
  }
  function hideBanner() { bannerKey = null; $("#banner").hidden = true; }
  $("#banner .banner-close").addEventListener("click", hideBanner);
  var SITE_TOO_MANY = "site:errTooManyTries";
  var NET = "Could not reach the server. Please try again.";

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
  function absent(e) { return !!e && (e.code === "PGRST202" || /could not find the function/i.test(String(e.message || ""))); }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); } // the booking site's own ids
  var busy = false;
  function setLoading(btn, on) { busy = on; $(btn).classList.toggle("loading", on); $(btn).disabled = on; }

  async function loadRide() {
    rideErr = false; ride = undefined; paintLanding();
    var r = await rpc("partner_status", { p_partner: PARTNER });
    if (r.error) { rideErr = true; ride = undefined; }
    else ride = Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
    paintLanding(); paintBookState();
    return ride;
  }

  /* ── Nationality: Saudi Arabia first and again in its alphabetical place (the owner, 2026-10-05) ── */
  function selOnce(cur) { var done = false; return function (v) { if (done || v !== cur) return false; return (done = true); }; }
  function natLabel(name) { return lang === "ar" && SH.COUNTRY_AR[name] ? SH.COUNTRY_AR[name] : name; }
  function buildNationalities() {
    var sel = $("#nat"), cur = sel.value;
    var all = SH.NATIONALITIES.map(function (x) { return x[1]; }), on = selOnce(cur);
    try { all.sort(function (a, b) { return natLabel(a).localeCompare(natLabel(b), lang); }); } catch (e) { all.sort(); }
    sel.innerHTML = '<option value="">' + esc(tr("Choose your nationality")) + "</option>" +
      ["Saudi Arabia"].concat(all).map(function (n) { return '<option value="' + esc(n) + '"' + (on(n) ? " selected" : "") + ">" + esc(natLabel(n)) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  $("#nat").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-nat"); });

  /* ── Date of birth: day / month / year, the site's rule (never in the future, nobody under five) ── */
  function todayKsa() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function dobMax() { var p = todayKsa().split("-"); return (+p[0] - 5) + "-" + p[1] + "-" + p[2]; }
  function monthNames() {
    try { var f = new Intl.DateTimeFormat(locale(), { month: "long" }); var out = []; for (var i = 0; i < 12; i++) out.push(f.format(new Date(2000, i, 1))); return out; }
    catch (e) { return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; }
  }
  function buildDob() {
    var ds = $("#birth-d"), ms = $("#birth-m"), ys = $("#birth-y");
    var d = +ds.value || 0, m = +ms.value || 0, y = +ys.value || 0;
    var mx = dobMax().split("-").map(Number);
    var yMax = mx[0], yMin = mx[0] - 94;
    var mMax = y === mx[0] ? mx[1] : 12;
    if (m > mMax) m = 0;
    var dim = y && m ? new Date(y, m, 0).getDate() : 31, dMax = (y === mx[0] && m === mx[1]) ? mx[2] : 31;
    if (d > dim) d = dim;
    if (d > dMax) d = 0;
    var yrs = '<option value="">' + esc(site("dobYear")) + "</option>";
    for (var yy = yMax; yy >= yMin; yy--) yrs += '<option value="' + yy + '"' + (yy === y ? " selected" : "") + ">" + yy + "</option>";
    ys.innerHTML = yrs;
    ms.innerHTML = '<option value="">' + esc(site("dobMonth")) + "</option>" + monthNames().map(function (n, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === m ? " selected" : "") + (i + 1 > mMax ? " disabled" : "") + ">" + esc(n) + "</option>"; }).join("");
    var days = '<option value="">' + esc(site("dobDay")) + "</option>";
    for (var dd = 1; dd <= dim; dd++) days += '<option value="' + dd + '"' + (dd === d ? " selected" : "") + (dd > dMax ? " disabled" : "") + ">" + dd + "</option>";
    ds.innerHTML = days;
    [ds, ms, ys].forEach(function (s) { s.classList.toggle("ph", !s.value); });
  }
  function birthValue() {
    var d = +$("#birth-d").value, m = +$("#birth-m").value, y = +$("#birth-y").value;
    return d && m && y ? y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0") : "";
  }
  function setBirth(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return;
    var b = iso.split("-").map(Number);
    $("#birth-y").value = String(b[0]); buildDob(); $("#birth-m").value = String(b[1]); buildDob(); $("#birth-d").value = String(b[2]); buildDob();
  }
  ["#birth-d", "#birth-m", "#birth-y"].forEach(function (s) { $(s).addEventListener("change", function () { buildDob(); clearMsg("f-birth"); }); });
  function ageAt(iso) {
    var p = iso.split("-").map(Number), t = todayKsa().split("-").map(Number);
    var a = t[0] - p[0]; if (t[1] < p[1] || (t[1] === p[1] && t[2] < p[2])) a--; return a;
  }

  /* ── Phone: country code + number, E.164 out, Google's libphonenumber mobile patterns (the same
     rules file the booking site's staff check reads). ─────────────────────────────────────── */
  var RULES = SH.PHONE_RULES, reCache = {};
  var CC_DIGITS = {}; SH.COUNTRY_CODES.forEach(function (x) { CC_DIGITS[x[0].slice(1)] = true; });
  function flagOf(iso) { return String.fromCodePoint.apply(null, iso.toUpperCase().split("").map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; })); }
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
  var PK = { sel: "#cc", flag: "#cc-flag", code: "#cc-code", input: "#phone" };
  var WPK = { sel: "#wacc", flag: "#wacc-flag", code: "#wacc-code", input: "#wa" };
  function buildCc() { buildCcOne(PK); buildCcOne(WPK); }
  function buildCcOne(pk) {
    var sel = $(pk.sel), cur = sel.value || "SA+966", on = selOnce(cur);
    sel.innerHTML = ccList().map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-iso="' + o.x[1] + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + flagOf(o.x[1]) + " " + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
    if (!sel.value) sel.value = "SA+966";
    ccFace(pk);
  }
  function ccFace(pk) {
    var o = $(pk.sel).selectedOptions[0]; if (!o) return;
    $(pk.flag).textContent = flagOf(o.getAttribute("data-iso")); $(pk.code).textContent = o.getAttribute("data-cc");
  }
  function ccDigits(pk) { var o = $(pk.sel).selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function setCcDigits(k, pk) { var o = $$(pk.sel + " option").filter(function (x) { return x.getAttribute("data-cc") === "+" + k; })[0]; if (o) { $(pk.sel).value = o.value; ccFace(pk); } }
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
  function onPhoneInput(pk) {
    var el = $(pk.input), raw = toAscii(el.value).trim(), d = raw.replace(/\D/g, "");
    var ccd = ccDigits(pk), intl = raw[0] === "+" || d.slice(0, 2) === "00", plus = false;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (intl) {
      if (d.indexOf(ccd) !== 0) { var k = ccOf(d); if (k) { setCcDigits(k, pk); ccd = k; } }
      if (d.indexOf(ccd) === 0) d = d.slice(ccd.length); else plus = true;
    } else if (ccIncluded(d, ccd)) d = d.slice(ccd.length);
    d = d.slice(0, 15);
    var g = ccd === "966" && d[0] === "5" ? [2, 5] : [3, 6];
    var out = d.length > g[1] ? d.slice(0, g[0]) + " " + d.slice(g[0], g[1]) + " " + d.slice(g[1]) : d.length > g[0] ? d.slice(0, g[0]) + " " + d.slice(g[0]) : d;
    el.value = (plus ? "+" : "") + out;
  }
  function e164(pk) { return toE164(ccDigits(pk), $(pk.input).value); }
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
  $("#phone").addEventListener("input", function () { onPhoneInput(PK); clearMsg("f-phone"); acked.create = null; });
  $("#cc").addEventListener("change", function () { ccFace(PK); $("#phone").placeholder = ccDigits(PK) === "966" ? "5X XXX XXXX" : ""; clearMsg("f-phone"); });
  function checkMobile(raw, p, wa) {
    var d = p.replace(/\D/g, "");
    if (!raw) return wa ? { hard: ["Enter your WhatsApp number"] } : { hard: ["Enter your mobile number"] };
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

  /* ── WhatsApp: is the account's mobile their WhatsApp number too, or which number is ── */
  var waSame = null;
  function paintWa() {
    var p = acct && acct.phone;
    $("#wa-label").textContent = p ? tr("Is {phone} your WhatsApp number too?", { phone: isolate(p) }) : tr("Is this mobile number your WhatsApp number too?");
  }
  $("#was").addEventListener("click", function (e) {
    var b = e.target.closest(".tile"); if (!b) return;
    pickWa(b.getAttribute("data-v") === "yes", true);
  });
  function pickWa(same, typed) {
    waSame = same; acked.details = null;
    $$("#was .tile").forEach(function (x) { x.setAttribute("aria-checked", String((x.getAttribute("data-v") === "yes") === same)); });
    $("#f-wanum").hidden = same; clearMsg("f-wa");
    if (same) clearMsg("f-wanum"); else if (typed) $("#wa").focus({ preventScroll: true });
  }
  $("#wa").addEventListener("input", function () { onPhoneInput(WPK); clearMsg("f-wanum"); acked.details = null; });
  $("#wacc").addEventListener("change", function () { ccFace(WPK); $("#wa").placeholder = ccDigits(WPK) === "966" ? "5X XXX XXXX" : ""; clearMsg("f-wanum"); });

  /* ── The emergency contact (the owner, 2026-10-07: the first required, a second optional), as the
     booking site asks it and in its words. "em" on the sign-up, "xem" on the details step for an
     account without one. ───────────────────────────────────────────────────────────────────── */
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
  function emBlock(pre, hidden) {
    return '<fieldset id="' + pre + '-block" class="em-block"' + (hidden ? " hidden" : "") + '>' +
      '<legend class="em-h"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg><span data-site="emTitle"></span></legend>' +
      '<p class="hint" data-site="emSubAcc"></p>' + emFields(pre) +
      '<button type="button" id="' + pre + '2-add" class="em-add"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span data-site="em2Add"></span></button>' +
      '<div id="' + pre + '2-box" class="em2" hidden><p class="em-h"><span data-site="em2Title"></span> <span class="em-opt">(<span data-site="optionalLabel"></span>)</span></p>' +
      '<p class="hint" data-site="em2Sub"></p>' + emFields(pre + "2") + '</div></fieldset>';
  }
  $("#em-slot").outerHTML = emBlock("em", false);
  $("#xem-slot").outerHTML = emBlock("xem", true);
  var EM_PRE = ["em", "em2", "xem", "xem2"];
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
  ["em", "xem"].forEach(function (pre) {
    $("#" + pre + "2-add").addEventListener("click", function () { emOpen2(pre, true); $("#" + pre + "2-name").focus(); });
  });
  function emOpen2(pre, on) { $("#" + pre + "2-box").hidden = !on; $("#" + pre + "2-add").hidden = on; }
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
  // Both contacts of a block checked into `hard`; what to save, or null. need2: the second is asked for.
  function emCheck(pre, own, hard, need2) {
    var one = emRead(pre, own, "", false);
    if (one.err) { hard[one.err[0]] = [one.err[1], null, true]; return null; }
    if ($("#" + pre + "2-box").hidden) return { one: one, two: null };
    var two = emRead(pre + "2", own, one.phone, !need2);
    if (two && two.err) { hard[two.err[0]] = [two.err[1], null, true]; return null; }
    return { one: one, two: two };
  }
  var EM_DETAIL = { em_name: ["name", "errEmName"], em_phone: ["phone", "errEmPhone"], em_relation: ["rel", "errEmRelation"], em_self: ["phone", "errEmSelf"], em_same: ["phone", "errEmSame"], em_required: ["name", "errEmName"] };
  // Saves a block's contacts on the signed-in account: {ok:true}, {field, key} for a refused box,
  // {signedOut:true}, or {banner}.
  async function emSave(pre, need2) {
    var h = {}, c = emCheck(pre, acct.phone, h, need2);
    if (!c) { var k = Object.keys(h)[0]; return { field: k, key: h[k][0] }; }
    var steps = [["customer_set_emergency", c.one, pre]];
    if (c.two) steps.push(["customer_set_emergency2", c.two, pre + "2"]);
    for (var i = 0; i < steps.length; i++) {
      var x = steps[i][1];
      var r = await rpc(steps[i][0], { p_id: acct.id, p_token: acct.token, p_name: x.name, p_phone: x.phone, p_relation: x.rel });
      if (r.error) {
        if (absent(r.error)) { if (i === 0) return { ok: true }; continue; }
        var d = EM_DETAIL[String(r.error.details || "")];
        if (d) return { field: "f-" + steps[i][2] + "-" + d[0], key: d[1] };
        if (/RATE_LIMITED/.test(errText(r.error))) return { banner: SITE_TOO_MANY };
        return { banner: NET };
      }
      if (r.data === false) return { signedOut: true };
    }
    return { ok: true };
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

  /* ── Instagram: a pasted link becomes the bare handle the site stores ── */
  function igNorm(raw) {
    var v = clean(raw).replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "").replace(/[?#].*$/, "").replace(/^[@\/\s]+|[\/\s]+$/g, "");
    return v.slice(0, 100);
  }
  $("#ig").addEventListener("input", function () { clearMsg("f-ig"); });
  function heightInput(id, step) { return function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, 3); if (v !== this.value) this.value = v; clearMsg(id); acked[step] = null; }; }
  $("#height").addEventListener("input", heightInput("f-height", "create"));
  $("#xheight").addEventListener("input", heightInput("f-xheight", "details"));
  $("#pwd").addEventListener("input", function () { clearMsg("f-pwd"); });
  $("#pwd2").addEventListener("input", function () { clearMsg("f-pwd2"); });
  $("#ident").addEventListener("input", function () { clearMsg("f-ident"); });
  $("#spwd").addEventListener("input", function () { clearMsg("f-spwd"); });
  $("#code").addEventListener("input", function () { clearMsg("f-code"); });

  /* ── Tiles and tick boxes ───────────────────────────────────────────────── */
  var gender = null, ack = false, news = false, waiverOk = false, group = null, bike = null;
  function radios(groupSel, fieldId, onPick) {
    $(groupSel).addEventListener("click", function (e) {
      var b = e.target.closest("[role=radio]"); if (!b) return;
      pickRadio(groupSel, b.getAttribute("data-v")); onPick(b.getAttribute("data-v")); clearMsg(fieldId);
    });
  }
  function pickRadio(groupSel, v) { $$("[role=radio]", $(groupSel)).forEach(function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-v") === v)); }); }
  radios("#genders", "f-gender", function (v) { gender = v; });
  radios("#groups", "f-group", function (v) { group = v; paintReview(); });
  radios("#bikes", "f-bike", function (v) { bike = v; paintReview(); });
  function tick(id, get, set, field) {
    var el = document.getElementById(id);
    function toggle() { set(!get()); el.setAttribute("aria-checked", String(get())); if (field) clearMsg(field); }
    el.addEventListener("click", function (e) { if (e.target.closest(".d-link")) return; toggle(); });
    el.addEventListener("keydown", function (e) { if (e.target.closest(".d-link")) return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
  }
  tick("ack", function () { return ack; }, function (v) { ack = v; }, "f-ack");
  tick("news", function () { return news; }, function (v) { news = v; });
  tick("waiver", function () { return waiverOk; }, function (v) { waiverOk = v; }, "f-waiver");

  /* ── The two pop-ups, centred: the Privacy Notice and the ride waiver ───── */
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
  function showModal(id) {
    modalReturn = document.activeElement; openModal = id;
    if (id === "#pv") renderNotice();
    $(id).hidden = false; document.body.classList.add("modal-open");
    $(id + " .modal-x").focus();
  }
  function closeModal() {
    if (!openModal) return;
    $(openModal).hidden = true; openModal = null; document.body.classList.remove("modal-open");
    if (modalReturn && modalReturn.focus) modalReturn.focus();
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("#pv-open, #pv-open-foot")) { e.preventDefault(); e.stopPropagation(); showModal("#pv"); }
    else if (e.target.closest("#wv-open")) { e.preventDefault(); e.stopPropagation(); showModal("#wv"); }
  });
  $$(".modal-x").forEach(function (b) { b.addEventListener("click", closeModal); });
  $$(".modal").forEach(function (m) { m.addEventListener("click", function (e) { if (e.target === m) closeModal(); }); });
  document.addEventListener("keydown", function (e) {
    if (!openModal) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key === "Tab") {
      var box = $(openModal + " .modal-box"), els = $$("button, a[href]", box), first = els[0], last = els[els.length - 1];
      if (!first) return;
      if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── Checking a step: {hard:{field:[k,a,site]}, soft:{field:[k,a]}} ─────── */
  var acked = {};
  var FIELDS = {
    create: ["f-name", "f-gender", "f-email", "f-phone", "f-pwd", "f-pwd2", "f-height"].concat(emFieldIds("em"), ["f-ack"]),
    signin: ["f-ident", "f-spwd"],
    details: ["f-birth", "f-nat", "f-wa", "f-wanum", "f-ig", "f-xheight"].concat(emFieldIds("xem")),
    book: ["f-code", "f-group", "f-bike", "f-waiver"]
  };
  function passwordErr(pw) { return pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw); }
  function heightCheck(id, val, hard, soft) {
    var h = parseInt(toAscii(val), 10);
    if (!(h >= 100 && h <= 250)) hard[id] = ["Enter your height in cm (100 to 250)"];
    else if (soft && (h < 140 || h > 209)) soft[id] = ["Is {n} cm right?", { n: h }];
  }
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
      r = checkMobile($("#phone").value.replace(/\D/g, ""), e164(PK), false);
      if (r.hard) hard["f-phone"] = r.hard; else if (r.soft) soft["f-phone"] = r.soft;
      var pw = $("#pwd").value;
      if (passwordErr(pw)) hard["f-pwd"] = ["errPasswordLen", null, true];
      else if ($("#pwd2").value !== pw) hard["f-pwd2"] = ["errPasswordMatch", null, true];
      heightCheck("f-height", $("#height").value, hard, soft);
      emCheck("em", e164(PK), hard, false);
      if (!ack) hard["f-ack"] = ["privacyAckRequired", null, true];
    } else if (n === "signin") {
      if (!clean($("#ident").value)) hard["f-ident"] = ["errEmailOrPhone", null, true];
      if (!$("#spwd").value) hard["f-spwd"] = ["errPasswordRequired", null, true];
    } else if (n === "details") {
      if (need.birth) {
        var b = birthValue();
        if (!b) hard["f-birth"] = ["Choose your date of birth"];
        else if (b > todayKsa()) hard["f-birth"] = ["dobErrFuture", null, true];
        else if (b > dobMax()) hard["f-birth"] = ["dobErrYoung", null, true];
        else if (ageAt(b) > 85) soft["f-birth"] = ["Please check your date of birth."];
      }
      if (need.nat && !$("#nat").value) hard["f-nat"] = ["Choose your nationality"];
      if (need.wa) {
        if (waSame === null) hard["f-wa"] = ["Tell us whether this is your WhatsApp number"];
        else if (!waSame) { r = checkMobile($("#wa").value.replace(/\D/g, ""), e164(WPK), true); if (r.hard) hard["f-wanum"] = r.hard; else if (r.soft) soft["f-wanum"] = r.soft; }
      }
      if (need.ig) {
        var ig = igNorm($("#ig").value);
        if (!ig) hard["f-ig"] = ["Your Instagram username, or a link to your profile"];
        else if (!/^[A-Za-z0-9._]{1,30}$/.test(ig)) hard["f-ig"] = ["An Instagram username has only letters, numbers, dots and underscores"];
      }
      heightCheck("f-xheight", $("#xheight").value, hard, soft);
      if (need.em) emCheck("xem", acct.phone, hard, need.em2);
    } else if (n === "book") {
      if (ride && ride.code_needed && !clean($("#code").value)) hard["f-code"] = ["Enter the code Defe sent you"];
      if (!group) hard["f-group"] = ["Choose your ride group"];
      if (!bike) hard["f-bike"] = ["Choose a bike"];
      if (!waiverOk) hard["f-waiver"] = ["Tick the box to accept the ride waiver"];
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
    var el = $("input, select, [role=radio], .tick", f); if (el) { el.focus({ preventScroll: true }); f.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  /* ── Step 1: the account ───────────────────────────────────────────────── */
  var acct = null; // {id, token, name, email, phone, made}
  // Step 1 opens on the question "Do you have a MicroMobility account?" (the owner, 2026-10-17); the
  // answer shows the sign-in or the sign-up fields, and Back goes to the question again. A rider sent
  // straight to signing in (signed out, the landing's "Sign in") skips the question.
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
    var email = clean($("#email").value).toLowerCase(), phone = e164(PK), name = fullName();
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
      // Then the emergency contact typed with it. Should it not save, the details step asks again.
      var em = await emSave("em", false);
      if (!em.ok) emCarry();
      await enterDetails();
      if (!em.ok && em.field) { setErr(em.field.replace("f-em", "f-xem"), em.key, null, true); }
    } finally { setLoading("#create", false); }
  }
  // The sign-up's contacts, copied into the details step's boxes, which then ask for them.
  function emCarry() {
    ["name", "cc", "phone", "rel"].forEach(function (k) { ["", "2"].forEach(function (n) { $("#xem" + n + "-" + k).value = $("#em" + n + "-" + k).value; }); });
    ["xem", "xem2"].forEach(function (p) { emCcFace(p); $("#" + p + "-rel").classList.toggle("ph", !$("#" + p + "-rel").value); });
    emOpen2("xem", !$("#em2-box").hidden);
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

  // Sign in as the booking site does: an email in lower case, a number in E.164 (+966 when it has no code).
  function loginIdent(raw) {
    var v = String(raw || "").replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, "").trim();
    var low = v.toLowerCase();
    return low.indexOf("@") >= 0 ? low : (toE164("966", v) || low);
  }
  $("#p-signin").addEventListener("submit", async function (e) {
    e.preventDefault(); hideBanner(); if (busy || !passStep("signin")) return;
    $("#si-temp").hidden = true;
    var raw = $("#ident").value, ident = loginIdent(raw);
    setLoading("#signin", true);
    try {
      var r = await rpc("customer_login", { p_identifier: ident, p_pwd: $("#spwd").value });
      if (r.error) {
        var m = errText(r.error);
        if (/LOCKED/.test(m)) setErr("f-spwd", "errLoginLocked", null, true);
        else if (/RATE_LIMITED/.test(m)) showBanner(SITE_TOO_MANY);
        else if (r.error.message === "network" || /^HTTP 5|PGRST/.test(r.error.message || "")) showBanner(NET);
        else setErr("f-spwd", "errInvalidCredentials", null, true);
        return;
      }
      var row = Array.isArray(r.data) ? r.data[0] : null;
      if (!row || !row.id || !row.session_token) {
        var ccHint = ident.indexOf("@") < 0 && !/^\s*(\+|00)/.test(raw) && !/^\+9665\d{8}$/.test(ident);
        setErr("f-spwd", ccHint ? "errLoginPhoneCc" : "errInvalidCredentials", null, true); return;
      }
      // A temporary password is changed on the booking site first (customer_pwd_state).
      var ps = await rpc("customer_pwd_state", { p_id: row.id, p_token: row.session_token });
      if (ps.data === true) { $("#si-temp").hidden = false; $("#si-temp").scrollIntoView({ block: "center" }); return; }
      acct = { id: row.id, token: row.session_token, name: row.name || "", email: row.email || "", phone: row.phone || "", made: false };
      $("#spwd").value = "";
      await enterDetails();
    } finally { setLoading("#signin", false); }
  });

  /* ── Arriving signed in from the booking app (?code=, one use, two minutes) ── */
  async function arrive() {
    var q = new URLSearchParams(location.search), code = q.get("code");
    if (code == null) return false;
    q.delete("code");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
    if (!/^[0-9a-f]{48}$/.test(code)) { showBanner("This sign-in link has expired. Sign in again to continue."); return false; }
    var r = await rpc("customer_handoff_redeem", { p_code: code });
    var row = Array.isArray(r.data) ? r.data[0] : null;
    if (!row || !row.id || !row.session_token) { showBanner(r.error && r.error.message === "network" ? NET : "This sign-in link has expired. Sign in again to continue."); return false; }
    acct = { id: row.id, token: row.session_token, name: row.name || "", email: "", phone: "", made: false };
    return true;
  }

  function signedOut() {
    acct = null; prof = null;
    showBanner("You were signed out. Sign in again to book.");
    paintWho(); openAccount("signin");
  }
  function paintWho() {
    var t = acct ? tr("Booking as {name}", { name: acct.name || "" }) + (acct.email ? " · " + isolate(acct.email) : "") : "";
    ["#land-who", "#d-who", "#b-who"].forEach(function (s) { $(s).textContent = t; $(s).hidden = !acct || (s === "#d-who" && acct.made); });
  }

  /* ── Step 2: the details ───────────────────────────────────────────────── */
  // What the details step can ask. Anything else the account still owes (customer_fix_fields: an
  // email, a password, a field staff flagged) is answered on the booking site.
  var ASKABLE = ["birth_date", "nationality", "whatsapp", "instagram", "height", "emergency", "emergency2"];
  var prof = null, need = {}, blocked = false;
  async function readAccount() {
    var all = await Promise.all([
      rpc("customer_profile", { p_id: acct.id, p_token: acct.token }),
      rpc("customer_emergency", { p_id: acct.id, p_token: acct.token }),
      rpc("customer_whatsapp", { p_id: acct.id, p_token: acct.token }),
      rpc("customer_fix_fields", { p_id: acct.id, p_token: acct.token })
    ]);
    var p = all[0], em = all[1], wa = all[2], fx = all[3];
    if (p.error) return { error: p.error };
    var row = Array.isArray(p.data) ? p.data[0] : null;
    if (!row || row.id !== acct.id) return { signedOut: true };
    var er = !em.error && Array.isArray(em.data) ? em.data[0] || null : null;
    var w = !wa.error && Array.isArray(wa.data) ? wa.data[0] || {} : null;
    return {
      prof: row,
      em: em.error ? (absent(em.error) ? "absent" : null) : er,
      wa: wa.error ? (absent(wa.error) ? "absent" : null) : w,
      fix: !fx.error && Array.isArray(fx.data) ? fx.data.map(String) : []
    };
  }
  async function enterDetails() {
    var a = await readAccount();
    if (a.signedOut) { signedOut(); return; }
    if (a.error) { showBanner(NET); return; }
    prof = a.prof;
    acct.name = prof.name || acct.name; acct.email = prof.email || acct.email; acct.phone = (a.wa && a.wa !== "absent" && a.wa.phone) || prof.phone || acct.phone;
    var fix = a.fix, flag = function (k) { return fix.indexOf(k) >= 0; };
    var hasEm = a.em === "absent" || !!(a.em && a.em.emergency_name && a.em.emergency_phone && a.em.emergency_relation);
    var waKnown = a.wa === "absent" || !!(a.wa && (a.wa.whatsapp_same === true || a.wa.whatsapp_same === false));
    var socials = prof.socials && typeof prof.socials === "object" && !Array.isArray(prof.socials) ? prof.socials : {};
    need = {
      birth: !prof.birth_date || flag("birth_date"),
      nat: !prof.nationality || flag("nationality"),
      wa: !waKnown || flag("whatsapp"),
      ig: !clean(socials.instagram) || flag("instagram"),
      em: !hasEm || flag("emergency") || flag("emergency2"),
      em2: flag("emergency2")
    };
    blocked = fix.some(function (k) { return ASKABLE.indexOf(k) < 0; });
    // What the account holds goes into the boxes it asks again.
    if (prof.birth_date) setBirth(prof.birth_date);
    if (prof.nationality && $$("#nat option").some(function (o) { return o.value === prof.nationality; })) { $("#nat").value = prof.nationality; $("#nat").classList.remove("ph"); }
    if (clean(socials.instagram)) $("#ig").value = socials.instagram;
    $("#xheight").value = prof.height ? String(prof.height) : $("#xheight").value;
    if (a.wa && a.wa !== "absent" && (a.wa.whatsapp_same === true || a.wa.whatsapp_same === false)) {
      pickWa(a.wa.whatsapp_same, false);
      var wd = String(a.wa.whatsapp || "").replace(/\D/g, ""), wk = ccOf(wd);
      if (!a.wa.whatsapp_same && wk) { setCcDigits(wk, WPK); $("#wa").value = wd.slice(wk.length); onPhoneInput(WPK); }
    }
    if (!acct.phone && need.wa) pickWa(false, false); // no mobile on the account: only the number is asked
    if (a.em && a.em !== "absent" && $("#xem-name").value === "") {
      fillEm("xem", a.em.emergency_name, a.em.emergency_phone, a.em.emergency_relation);
      if (a.em.emergency2_name) { fillEm("xem2", a.em.emergency2_name, a.em.emergency2_phone, a.em.emergency2_relation); emOpen2("xem", true); }
    }
    if (need.em2) emOpen2("xem", true);
    if (prof.type_preference && ["Road", "Hybrid", "Mountain", "Own"].indexOf(prof.type_preference) >= 0 && !bike) { bike = prof.type_preference; pickRadio("#bikes", bike); }
    paintDetails();
    goStep(2);
    if (acct.made) $("#acct-made").focus({ preventScroll: true });
  }
  function fillEm(p, name, phone, rel) {
    $("#" + p + "-name").value = name || "";
    var d = String(phone || "").replace(/\D/g, ""), k = ccOf(d);
    if (k) { var o = $$("#" + p + "-cc option").filter(function (x) { return x.getAttribute("data-cc") === "+" + k; })[0]; if (o) $("#" + p + "-cc").value = o.value; emCcFace(p); $("#" + p + "-phone").value = d.slice(k.length); }
    if (rel && EM_RELS.indexOf(rel) >= 0) { $("#" + p + "-rel").value = rel; $("#" + p + "-rel").classList.remove("ph"); }
  }
  function paintDetails() {
    $("#acct-made").hidden = !(acct && acct.made);
    $("#f-birth").hidden = !need.birth; $("#f-nat").hidden = !need.nat;
    $("#f-wa").hidden = !need.wa || !(acct && acct.phone); $("#f-wanum").hidden = !need.wa || waSame !== false;
    $("#f-ig").hidden = !need.ig;
    $("#xem-block").hidden = !need.em;
    $("#d-blocked").hidden = !blocked;
    paintWa(); paintWho();
  }
  $("#s-details").addEventListener("submit", async function (e) {
    e.preventDefault(); hideBanner(); if (busy || !acct) return;
    if (!passStep("details")) return;
    setLoading("#d-next", true);
    try { await saveDetails(); } finally { setLoading("#d-next", false); }
  });
  async function saveDetails() {
    var saved = [], r;
    var gone = function (x) { return x && x.data === false; };
    if (need.em) {
      var em = await emSave("xem", need.em2);
      if (em.signedOut) { signedOut(); return; }
      if (!em.ok) { if (em.field) { setErr(em.field, em.key, null, true); focusField(em.field); } else showBanner(em.banner); return; }
      saved.push("emergency", "emergency2");
    }
    if (need.birth || need.nat) {
      // Both are written together: the one not asked goes back as the account holds it.
      r = await rpc("customer_set_birth_nat", { p_id: acct.id, p_token: acct.token, p_birth_date: need.birth ? birthValue() : (prof.birth_date || ""), p_nationality: need.nat ? $("#nat").value : (prof.nationality || "") });
      if (gone(r)) { signedOut(); return; }
      if (r.error) { if (/dob|birth/i.test(errText(r.error))) { setErr("f-birth", "Please check your date of birth."); focusField("f-birth"); } else showBanner(/RATE_LIMITED/.test(errText(r.error)) ? SITE_TOO_MANY : NET); return; }
      saved.push("birth_date", "nationality");
    }
    if (need.wa) {
      r = await rpc("customer_set_whatsapp", { p_id: acct.id, p_token: acct.token, p_same: waSame === true, p_phone: waSame ? null : e164(WPK) });
      if (gone(r)) { signedOut(); return; }
      if (r.error) { if (/wa_/.test(errText(r.error))) { setErr("f-wanum", "Enter a valid mobile number"); $("#f-wanum").hidden = false; focusField("f-wanum"); } else showBanner(/RATE_LIMITED/.test(errText(r.error)) ? SITE_TOO_MANY : NET); return; }
      saved.push("whatsapp");
    }
    if (need.ig) {
      // customer_set_socials replaces the whole object: the other handles go back as they are.
      var cur = prof.socials && typeof prof.socials === "object" && !Array.isArray(prof.socials) ? prof.socials : {};
      var soc = {}; Object.keys(cur).forEach(function (k) { soc[k] = cur[k]; }); soc.instagram = igNorm($("#ig").value);
      r = await rpc("customer_set_socials", { p_id: acct.id, p_token: acct.token, p_socials: soc });
      if (gone(r)) { signedOut(); return; }
      if (r.error) { if (/instagram|handle|social/i.test(errText(r.error))) { setErr("f-ig", "An Instagram username has only letters, numbers, dots and underscores"); focusField("f-ig"); } else showBanner(NET); return; }
      prof.socials = soc; saved.push("instagram");
    }
    var h = parseInt(toAscii($("#xheight").value), 10);
    if (h !== Number(prof.height)) {
      r = await rpc("customer_set_height", { p_id: acct.id, p_token: acct.token, p_height: h });
      if (gone(r)) { signedOut(); return; }
      if (r.error) { if (/height/i.test(errText(r.error))) { setErr("f-xheight", "Enter your height in cm (100 to 250)"); focusField("f-xheight"); } else showBanner(NET); return; }
      prof.height = h;
    }
    saved.push("height");
    // What the account still owes, read again: one this page just answered, or one it cannot ask,
    // is finished on the booking site.
    var fx = await rpc("customer_fix_fields", { p_id: acct.id, p_token: acct.token });
    var left = !fx.error && Array.isArray(fx.data) ? fx.data.map(String) : [];
    var askNow = left.filter(function (k) { return ASKABLE.indexOf(k) >= 0 && saved.indexOf(k) < 0; });
    if (left.some(function (k) { return ASKABLE.indexOf(k) < 0 || saved.indexOf(k) >= 0; })) {
      blocked = true; paintDetails(); $("#d-blocked").scrollIntoView({ behavior: "smooth", block: "center" }); return;
    }
    if (askNow.length) { await enterDetails(); return; }
    enterBook();
  }

  /* ── Step 3: the booking ──────────────────────────────────────────────── */
  var bookState = null; // null, "full", "closed", "codeUsed", "already"
  function enterBook() { bookState = null; paintBookState(); paintReview(); goStep(3); }
  function paintBookState() {
    if (!$("#s-book")) return;
    $("#f-code").hidden = !(ride && ride.code_needed);
    var st = bookState;
    if (!st && ride === null) st = "closed";
    else if (!st && ride && !ride.open) st = "full";
    else if (!st && ride && ride.code_needed && !ride.code_open) st = "codeUsed";
    var n = $("#b-notice"), map = {
      full: ["All Defe places are taken.", "Thank you for the support. Follow @defebreastcancer for their next event."],
      closed: ["Booking for this ride is closed.", "Thank you for the support. Follow @defebreastcancer for their next event."],
      codeUsed: ["Code places are all booked.", "More places open to everyone soon on this page. Your account is ready, so booking will take a few seconds."],
      already: ["You already have a place on this ride.", "Your ticket is in My Bookings in the MicroMobility app."]
    };
    n.hidden = !st;
    if (st) { $(".notice-h", n).textContent = tr(map[st][0]); $(".notice-p", n).textContent = tr(map[st][1]); }
    $("#b-open").hidden = st !== "already";
    $("#book").disabled = !!st;
    paintWho();
  }
  function groupName(g) { return g === "beg" ? tr("Beginners · 20 km") : g === "int" ? tr("Intermediates · 40 km") : "—"; }
  function bikeName(b) { return b === "Own" ? tr("My own bike") : b ? tr("{bike} + helmet", { bike: tr(b) }) : "—"; }
  function rideWhen() {
    var p = pickup(), d = rideDate({ weekday: "short", day: "numeric", month: "short" });
    return d ? esc(d) + (p ? ' · <bdi dir="ltr">' + esc(p[0]) + "</bdi>" : "") : "—";
  }
  function row(k, v) { return "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>"; }
  function paintReview() {
    $("#review").innerHTML = row(tr("Ride"), rideWhen()) + row(tr("Group"), esc(groupName(group))) + row(tr("Bike"), esc(bikeName(bike))) + row(tr("Price"), esc(tr("Free")));
  }
  // The frame size that suits the rider (the booking app's SIZE_CHART, the owner's 2026-09-29 chart):
  // Road XS -159, S -172, M -179, L -189, XL 190+; Hybrid and Mountain XS -159, S -170, M -185, L 186+;
  // 144 cm and under a Kids bike (no frame size); their own bike and any other type read Road's.
  var SIZE_CHART = { Road: [[159, "XS"], [172, "S"], [179, "M"], [189, "L"], [Infinity, "XL"]], Hybrid: [[159, "XS"], [170, "S"], [185, "M"], [Infinity, "L"]] };
  SIZE_CHART.Mountain = SIZE_CHART.Hybrid;
  function sizeFor(h, ty) {
    h = Number(h); if (!(h > 0) || h <= 144) return "";
    return (SIZE_CHART[ty] || SIZE_CHART.Road).filter(function (x) { return h <= x[0]; })[0][1];
  }
  function entryId() { var a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); } return "df" + Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  $("#s-book").addEventListener("submit", async function (e) {
    e.preventDefault(); hideBanner(); if (busy || !acct || bookState) return;
    if (!passStep("book")) return;
    var h = Number(prof && prof.height) || parseInt(toAscii($("#xheight").value), 10);
    var entry = { id: entryId(), type_preference: bike, height: h, size: sizeFor(h, bike), ride_group: group, waiver_version: SH.WAIVER_VERSION };
    setLoading("#book", true);
    var r;
    try { r = await rpc("partner_book", { p_id: acct.id, p_token: acct.token, p_partner: PARTNER, p_code: ride && ride.code_needed ? clean($("#code").value) : null, p_entry: entry }); }
    finally { setLoading("#book", false); }
    if (r.error) { bookRefused(r.error); return; }
    var b = Array.isArray(r.data) ? r.data[0] : null;
    if (!b || !b.id) { showBanner(NET); return; }
    booked = { id: b.id, group: group, bike: bike };
    showDone();
  });
  function bookRefused(e) {
    var m = errText(e);
    if (/PARTNER_FULL/.test(m)) { if (ride) ride.open = false; bookState = "full"; paintBookState(); paintLanding(); $("#b-notice").scrollIntoView({ block: "center" }); }
    else if (/PARTNER_CLOSED/.test(m)) { ride = null; bookState = "closed"; paintBookState(); paintLanding(); }
    else if (/BAD_CODE/.test(m)) { setErr("f-code", "That code doesn't work. Check the code Defe sent you."); focusField("f-code"); }
    else if (/CODE_USED_UP/.test(m)) { if (ride) ride.code_open = false; bookState = "codeUsed"; paintBookState(); paintLanding(); $("#b-notice").scrollIntoView({ block: "center" }); }
    else if (/ONE_PER_SESSION/.test(m)) { bookState = "already"; paintBookState(); $("#b-notice").scrollIntoView({ block: "center" }); }
    else if (/FIX_FIRST/.test(m)) { showBanner("Your account still needs a few details before it can book."); enterDetails(); }
    else if (/WAIVER_OUTDATED/.test(m)) showBanner("The ride waiver has changed. Reload this page to read the new one.");
    else if (/WAIVER_REQUIRED/.test(m)) { waiverOk = false; $("#waiver").setAttribute("aria-checked", "false"); setErr("f-waiver", "Tick the box to accept the ride waiver"); focusField("f-waiver"); }
    else if (/PICK_TYPE/.test(m)) { setErr("f-bike", "Choose a bike"); focusField("f-bike"); }
    else if (/STALE_SESSION/.test(m)) signedOut();
    else if (/RATE_LIMITED/.test(m)) showBanner(SITE_TOO_MANY);
    else showBanner(NET);
  }
  $("#b-open").addEventListener("click", function () { openBooking(); });

  /* ── Booked ──────────────────────────────────────────────────────────── */
  var booked = null, leaving = false, autoTimer = null;
  function paintDone() {
    if (!booked) return;
    var p = pickup();
    $("#done-sum").innerHTML = row(tr("Date"), esc(rideDate({ weekday: "long", day: "numeric", month: "long" }) || "—")) +
      (p ? row(tr("Bike pickup"), '<bdi dir="ltr">' + esc(p.join(" – ")) + "</bdi>") : "") +
      row(tr("Group"), esc(groupName(booked.group))) + row(tr("Bike"), esc(bikeName(booked.bike))) + row(tr("Price"), esc(tr("Free")));
  }
  function showDone() {
    showView("done"); paintDone();
    $("#done-title").focus({ preventScroll: true });
    autoTimer = setTimeout(openBooking, 2000);
  }
  // The booking in the app, signed in there by a one-time code (customer_handoff_create; the app
  // reads ?signin=). Without a code, the app's My Bookings, where the rider signs in themselves.
  async function openBooking() {
    if (leaving || !acct) return;
    leaving = true; clearTimeout(autoTimer);
    $("#done-open").disabled = true; $("#b-open").disabled = true;
    var r = await rpc("customer_handoff_create", { p_id: acct.id, p_token: acct.token });
    var code = !r.error && typeof r.data === "string" && /^[0-9a-f]{48}$/.test(r.data) ? r.data : null;
    if (code) { location.assign(BOOKING_URL + "?signin=" + code + "&tab=bookings&lang=" + lang); return; }
    leaving = false; $("#done-open").disabled = false; $("#b-open").disabled = false;
    $("#done-going").hidden = true; $("#done-fallback").hidden = false;
    if (view !== "done") location.assign(bookingsUrl());
  }
  $("#done-open").addEventListener("click", function () { openBooking(); });

  // Test hook: the specs read what the page would send without a network.
  window.DefeForm = { e164: function () { return e164(PK); }, igNorm: igNorm, sizeFor: sizeFor, loginIdent: loginIdent, checkName: checkName };

  setLang(pickLang(), false);
  showView("landing");
  (async function start() {
    var both = await Promise.all([loadRide(), arrive()]);
    // Handed back signed in: straight on to the details, unless the ride is full or closed.
    if (both[1] && acct) { if (ride && ride.open) await enterDetails(); else paintWho(); }
  })();
})();
