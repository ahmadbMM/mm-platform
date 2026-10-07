/* Community membership application (micromobility.sa/community/registration).
   Two steps (the owner, 2026-09-30: "let the applicant create an account first with the same sign
   up requirements that is in the sign up landing page then take them to the next step"):
   1. the booking site's own sign-up - name, gender, email, mobile, password, height, the Privacy
      Notice and ride news - which makes the account (customer_signup, customer_consents);
   2. the community questions the sign-up does not ask, sent from that account
      (customer_community_apply).
   Someone who has an account signs in on the booking site, which hands them back here signed in
   (?code=, a one-time code from customer_handoff_create), straight onto step 2; so does the
   "Apply" button of the booking site's members-only popup. Every field is checked the way the
   booking site's staff "Looks off" check reads accounts, BEFORE it reaches us. Hard problems stop
   the step; a soft one ("is 212 cm right?") is shown once and the rider goes on by pressing the
   button again. */
(function () {
  "use strict";
  // The public anon key (the same one the booking site ships): community_apply is a
  // SECURITY DEFINER function that checks and throttles on the server.
  var SUPABASE_URL = "https://qpffkzmsfyilicwcsszz.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmZrem1zZnlpbGljd2Nzc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDQwODAsImV4cCI6MjEwNTgyMDA4MH0.K6qZpK0oR4MXIaFk4DRJGy-H_m6BYnJ-S31swTiHMhQ";
  var LANG_KEY = "mm-community-lang";
  // The booking site: where an existing account signs in (it hands the rider back here signed in).
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
  function toAscii(s) { return String(s == null ? "" : s).replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); }).replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); }).replace(/[\u0966-\u096F]/g, function (c) { return String(c.charCodeAt(0) - 0x0966); }).replace(/[\u09E6-\u09EF]/g, function (c) { return String(c.charCodeAt(0) - 0x09E6); }); }
  function clean(v) { return String(v == null ? "" : v).replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00A0]/g, " ").replace(/\s+/g, " ").trim(); }

  /* ── Messages on fields ──────────────────────────────────────────────────
     Kept as keys, not text, so a language change repaints them in the new language. */
  var msgs = {}; // field id -> {err:{k,a,site}, warn:{k,a}}
  function setErr(id, k, a, fromSite) { (msgs[id] = msgs[id] || {}).err = { k: k, a: a, site: !!fromSite }; paintField(id); }
  function setWarn(id, k, a) { (msgs[id] = msgs[id] || {}).warn = { k: k, a: a }; paintField(id); }
  function clearMsg(id) { delete msgs[id]; paintField(id); }
  function paintField(id) {
    var f = document.getElementById(id); if (!f) return;
    var m = msgs[id] || {};
    f.classList.toggle("invalid", !!m.err);
    f.classList.toggle("warned", !m.err && !!m.warn);
    var e = $(".err", f), w = $(".warn", f);
    if (e) e.textContent = m.err ? (m.err.site ? fill(site(m.err.k), m.err.a) : tr(m.err.k, m.err.a)) : "";
    if (w) w.textContent = !m.err && m.warn ? tr(m.warn.k, m.warn.a) + " " + tr("If it is right, press the button again.") : "";
    if (id === "f-email") paintEmailFix();
  }

  /* ── Language ────────────────────────────────────────────────────────── */
  function pickLang() {
    var codes = SH.LANGS.map(function (l) { return l.code; });
    var q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (codes.indexOf(q) >= 0) return q;
    try { var s = localStorage.getItem(LANG_KEY); if (codes.indexOf(s) >= 0) return s; } catch (e) {}
    var nav = (navigator.languages || [navigator.language || "en"]);
    // The language subtag whole: "fil" (how phones name Filipino) is Tagalog; "fi" is Finnish.
    for (var i = 0; i < nav.length; i++) { var c = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (c === "fil") c = "tl"; if (codes.indexOf(c) >= 0) return c; }
    return "en";
  }
  /* ── The questions, as the booking site's admins set them (2026-10-07) ─────────────────────────
     site_content 'community.form' = {q:{<question>:{on, req, label:{<lang>:text}}}}: a question turned
     off is not shown or sent, one made optional may be left empty (customer_community_apply reads the
     same settings, 20261007230000), and its wording in the reader's language replaces ours. Read once
     as the page opens; with nothing read the form asks what it always asked. */
  var CF = {};
  var CF_FIELD = { birth_date: "f-birth", nationality: "f-nat", profession: "f-prof", workplace: "f-work", own_bike: "f-own", bike_type: "f-type", heard_from: "f-heard", instagram: "f-ig", linkedin: "f-li" };
  var CF_REQ = { birth_date: true, nationality: true, profession: true, workplace: true, own_bike: true, bike_type: true, heard_from: true, instagram: false, linkedin: false };
  function qOn(k) { return !(CF[k] && CF[k].on === false); }
  function qReq(k) { return qOn(k) && (CF[k] && typeof CF[k].req === "boolean" ? CF[k].req : CF_REQ[k]); }
  function paintQuestions() {
    Object.keys(CF_FIELD).forEach(function (k) {
      var f = document.getElementById(CF_FIELD[k]); if (!f) return;
      f.hidden = !qOn(k);
      var lab = f.querySelector("label, .label"); if (!lab) return;
      var own = CF[k] && CF[k].label && typeof CF[k].label[lang] === "string" ? CF[k].label[lang].trim() : "";
      if (own) lab.textContent = own;
      var opt = lab.querySelector(".opt");
      if (!qReq(k) && qOn(k) && CF_REQ[k]) { /* marked only where the admins relaxed a required one */ if (!opt) { opt = document.createElement("span"); opt.className = "opt"; lab.appendChild(opt); } opt.textContent = " " + tr("(optional)"); }
      else if (opt) opt.remove();
    });
  }
  async function loadQuestions() {
    try {
      var resp = await fetch(SUPABASE_URL + "/rest/v1/site_content?select=value&key=eq.community.form", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } });
      var rows = resp.ok ? await resp.json() : null;
      var v = rows && rows[0] && rows[0].value;
      CF = v && v.q && typeof v.q === "object" && !Array.isArray(v.q) ? v.q : {};
    } catch (e) { CF = {}; }
    paintQuestions();
  }
  function setLang(code, save) {
    lang = code;
    html.lang = code; html.dir = langInfo(code).rtl ? "rtl" : "ltr";
    if (save) { try { localStorage.setItem(LANG_KEY, code); } catch (e) {} }
    $("#lang").value = code;
    paint();
  }
  function paint() {
    document.title = tr("Community Membership Application") + " | Micromobility";
    $$("[data-t]").forEach(function (el) { var a = el.getAttribute("data-args"); el.textContent = tr(el.getAttribute("data-t"), a ? JSON.parse(a) : null); });
    $$("[data-t-placeholder]").forEach(function (el) { el.placeholder = tr(el.getAttribute("data-t-placeholder")); });
    $$("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", tr(el.getAttribute("data-t-aria"))); });
    $$("[data-site]").forEach(function (el) { el.textContent = site(el.getAttribute("data-site")); });
    $$("[data-site-aria]").forEach(function (el) { el.setAttribute("aria-label", site(el.getAttribute("data-site-aria"))); });
    $$("[data-site-placeholder]").forEach(function (el) { el.placeholder = site(el.getAttribute("data-site-placeholder")); });
    $$("#signin-link, #banner-signin").forEach(function (a) { a.href = signInUrl(); });
    $("#member-go").href = BOOKING_URL + "?lang=" + lang;
    paintWho();
    $("#ack-lbl").innerHTML = ackLabel("pv-open");
    $("#xack-lbl").innerHTML = ackLabel("pv-open-x");
    buildNationalities(); buildDob(); buildCc(); buildHeard(); buildEm(); paintWa();
    $$(".field").forEach(function (f) { paintField(f.id); });
    if (!$("#pv").hidden) renderNotice();
    paintQuestions();
    if (sent) showSuccess(sent);
    if (bannerKey) showBanner(bannerKey, bannerSignIn);
  }
  // "I have read the {Privacy Notice}", the notice a button that opens it.
  function ackLabel(id) { return esc(site("privacyAckOpt")).replace("{0}", '<button type="button" class="pv-link" id="' + id + '">' + esc(site("privacyNotice")) + "</button>") + ' <span class="req" aria-hidden="true">*</span>'; }
  (function buildLangs() {
    var sel = $("#lang");
    sel.innerHTML = SH.LANGS.map(function (l) { return '<option value="' + l.code + '">' + esc(l.label) + "</option>"; }).join("");
    sel.addEventListener("change", function () { setLang(sel.value, true); try { var u = new URL(location.href); u.searchParams.set("lang", sel.value); history.replaceState(null, "", u); } catch (e) {} });
  })();

  /* ── Nationality: every country, labelled in the rider's language, Saudi Arabia first and again in
     its alphabetical place (the owner, 2026-10-05). Both copies carry the same value, so one
     country is stored; only the first match is marked (with two, the browser shows the last). ── */
  function selOnce(cur) { var done = false; return function (v) { if (done || v !== cur) return false; return (done = true); }; }
  var NAT_CODE = {}; SH.NATIONALITIES.forEach(function (x) { NAT_CODE[x[1]] = x[0]; });
  var dn = {};
  function natLabel(name) {
    if (lang === "en") return name;
    if (lang === "ar" && SH.COUNTRY_AR[name]) return SH.COUNTRY_AR[name];
    try {
      if (!(lang in dn)) dn[lang] = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames([lang], { type: "region", fallback: "none" }) : null;
      return (dn[lang] && dn[lang].of(NAT_CODE[name])) || name; // no data for the language (Chromium has no Nepali): English
    } catch (e) { return name; }
  }
  function buildNationalities() {
    var sel = $("#nat"), cur = sel.value;
    var lab = {}; SH.NATIONALITIES.forEach(function (x) { lab[x[1]] = natLabel(x[1]); });
    var all = SH.NATIONALITIES.map(function (x) { return x[1]; }), on = selOnce(cur);
    try { all.sort(function (a, b) { return lab[a].localeCompare(lab[b], lang); }); } catch (e) { all.sort(); }
    sel.innerHTML = '<option value="">' + esc(tr("Choose your nationality")) + "</option>" +
      ["Saudi Arabia"].concat(all).map(function (n) { return '<option value="' + esc(n) + '"' + (on(n) ? " selected" : "") + ">" + esc(lab[n]) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  $("#nat").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-nat"); });

  /* ── How they heard of us: the booking site's answers (customers.heard_from's codes), in its words ── */
  function buildHeard() {
    var sel = $("#heard"), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(tr("Choose one")) + "</option>" +
      SH.HEARD_OPTS.map(function (c) { return '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + esc(site("heard_" + c)) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  $("#heard").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-heard"); });

  /* ── Date of birth: day / month / year, the site's rule (never in the future, nobody five
     or younger), in Riyadh's calendar day. ───────────────────────────────────────────── */
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
  ["#birth-d", "#birth-m", "#birth-y"].forEach(function (s) { $(s).addEventListener("change", function () { buildDob(); clearMsg("f-birth"); }); });
  function ageAt(iso) {
    var p = iso.split("-").map(Number), t = todayKsa().split("-").map(Number);
    var a = t[0] - p[0]; if (t[1] < p[1] || (t[1] === p[1] && t[2] < p[2])) a--; return a;
  }

  /* ── Phone: country code + number, E.164 out, Google's libphonenumber mobile patterns (the
     same rules file the staff check reads). ──────────────────────────────────────────── */
  var RULES = SH.PHONE_RULES, reCache = {};
  var CC_DIGITS = {}; SH.COUNTRY_CODES.forEach(function (x) { CC_DIGITS[x[0].slice(1)] = true; });
  // The picker reads as one: the closed box shows the flag and code (🇸🇦 +966) over a see-through
  // native select, and the list names every country in the rider's language, the Gulf first, Saudi
  // Arabia again in its alphabetical place (the owner, 2026-10-05; the same "SA+966" value).
  function flagOf(iso) { return String.fromCodePoint.apply(null, iso.toUpperCase().split("").map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; })); }
  function regionName(iso, fallback) {
    try {
      if (!(lang in dn)) dn[lang] = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames([lang], { type: "region", fallback: "none" }) : null;
      return (dn[lang] && dn[lang].of(iso)) || fallback;
    } catch (e) { return fallback; }
  }
  function ccName(x) {
    if (lang === "en") return x[2];
    if (x[1] === "US") return regionName("US", "USA") + " / " + regionName("CA", "Canada"); // +1 is both
    if (lang === "ar" && SH.COUNTRY_AR[x[2]]) return SH.COUNTRY_AR[x[2]];
    return regionName(x[1], x[2]);
  }
  // Two pickers work this way: the mobile's, and the WhatsApp number's (2026-10-07), the same list and rules.
  var PK = { sel: "#cc", flag: "#cc-flag", code: "#cc-code", input: "#phone" };
  var WPK = { sel: "#wacc", flag: "#wacc-flag", code: "#wacc-code", input: "#wa" };
  function buildCc() { buildCcOne(PK); buildCcOne(WPK); }
  function buildCcOne(pk) {
    // Each option is its country AND code ("PS+970", "PS+972"): Palestine answers on two codes,
    // and a value of the country alone made +972 land on +970.
    var sel = $(pk.sel), cur = sel.value || "SA+966";
    var gulf = SH.COUNTRY_CODES.slice(0, 6), rest = SH.COUNTRY_CODES.slice(6).concat(SH.COUNTRY_CODES.filter(function (x) { return x[1] === "SA"; })).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, lang); }); } catch (e) {}
    var list = gulf.map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest), on = selOnce(cur);
    sel.innerHTML = list.map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-iso="' + o.x[1] + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + flagOf(o.x[1]) + " " + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
    if (!sel.value) sel.value = "SA+966";
    ccFace(pk);
  }
  function ccFace(pk) {
    pk = pk || PK;
    var o = $(pk.sel).selectedOptions[0]; if (!o) return;
    $(pk.flag).textContent = flagOf(o.getAttribute("data-iso")); $(pk.code).textContent = o.getAttribute("data-cc");
  }
  function ccDigits(pk) { var o = $((pk || PK).sel).selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function setCcDigits(k, pk) { pk = pk || PK; var o = $$(pk.sel + " option").filter(function (x) { return x.getAttribute("data-cc") === "+" + k; })[0]; if (o) { $(pk.sel).value = o.value; ccFace(pk); } }
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
    pk = pk || PK;
    var el = $(pk.input), raw = toAscii(el.value).trim(), d = raw.replace(/\D/g, "");
    var ccd = ccDigits(pk), intl = raw[0] === "+" || d.slice(0, 2) === "00", cut = false, plus = false;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (intl) {
      if (d.indexOf(ccd) !== 0) { var k = ccOf(d); if (k) { setCcDigits(k, pk); ccd = k; } }
      if (d.indexOf(ccd) === 0) { d = d.slice(ccd.length); cut = true; } else plus = true;
    } else if (ccIncluded(d, ccd)) { d = d.slice(ccd.length); cut = true; }
    d = d.slice(0, 15);
    // A Saudi mobile without its 0 reads as the example does: 5X XXX XXXX. Typed with the 0 it keeps 05X XXX XXXX.
    var g = ccd === "966" && d[0] === "5" ? [2, 5] : [3, 6];
    var out = d.length > g[1] ? d.slice(0, g[0]) + " " + d.slice(g[0], g[1]) + " " + d.slice(g[1]) : d.length > g[0] ? d.slice(0, g[0]) + " " + d.slice(g[0]) : d;
    el.value = (plus ? "+" : "") + out;
  }
  function e164(pk) { pk = pk || PK; return toE164(ccDigits(pk), $(pk.input).value); }
  // A number typed under the dial code `ccd` (its digits), as the database stores it: the rider's
  // mobile, their WhatsApp number and the emergency contacts alike.
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
  $("#phone").addEventListener("input", function () { onPhoneInput(); clearMsg("f-phone"); acked[2] = null; });
  $("#cc").addEventListener("change", function () { ccFace(); $("#phone").placeholder = ccDigits() === "966" ? "5X XXX XXXX" : ""; clearMsg("f-phone"); paintWa(); });
  $("#phone").addEventListener("input", paintWa);
  // A mobile number's problems, for the mobile and the WhatsApp number alike: {hard} or {soft} or {}.
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

  /* ── WhatsApp: is the mobile their WhatsApp number too, or which number is (the owner, 2026-10-07).
     Asked under the mobile on step 1; an applicant handed over signed in skips step 1, so it moves to
     the top of step 2 for them, naming the account's mobile. Sent as whatsapp_same (+ whatsapp). ── */
  var waSame = null, waStep = 1;
  function waPhone() { return waStep === 2 ? (acct && acct.phone) || "" : ($("#phone").value.replace(/\D/g, "") ? e164() : ""); }
  function paintWa() {
    var p = waPhone();
    $("#wa-label").textContent = p ? tr("Is {phone} your WhatsApp number too?", { phone: "\u2066" + p + "\u2069" }) : tr("Is this mobile number your WhatsApp number too?");
  }
  function waCheck(hard, soft) {
    if (waSame === null) { hard["f-wa"] = ["Tell us whether this is your WhatsApp number"]; return; }
    if (waSame) return;
    var r = checkMobile($("#wa").value.replace(/\D/g, ""), e164(WPK), true);
    if (r.hard) hard["f-wanum"] = r.hard; else if (r.soft) soft["f-wanum"] = r.soft;
  }
  $("#wa").addEventListener("input", function () { onPhoneInput(WPK); clearMsg("f-wanum"); acked[waStep] = null; });
  $("#wacc").addEventListener("change", function () { ccFace(WPK); $("#wa").placeholder = ccDigits(WPK) === "966" ? "5X XXX XXXX" : ""; clearMsg("f-wanum"); });

  /* ── The emergency contact (the owner, 2026-10-07: "make the emergency contact obligatory only the
     first one not the second and unskippable for all the customers"): someone to call if the rider
     needs help at an event, as the booking site asks it (_emRead, _emFieldsHtml) and in its words.
     The first is required on the account step (saved the moment the account exists) and, for an
     account handed over without one, on step 2; a second is optional, behind "Add a second contact":
     all three boxes or none. The database's rules (customer_set_emergency / customer_set_emergency2):
     a name of 2 to 80 letters, spaces and periods, every part two letters or more; a number of 8 to
     15 digits; one of the eight relations; never the rider's own number ('em_self', the last nine
     digits) nor the other contact's ('em_same'). ─────────────────────────────────────────────── */
  var EM_RELS = SH.EM_RELS || ["spouse", "parent", "sibling", "child", "relative", "friend", "colleague", "other"];
  var CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
  function emFields(p) {
    return '<div id="f-' + p + '-name" class="field"><label for="' + p + '-name" data-site="emName"></label>' +
      '<input id="' + p + '-name" type="text" autocomplete="off" autocapitalize="words" maxlength="80"><p class="err" aria-live="polite"></p></div>' +
      '<div id="f-' + p + '-phone" class="field"><label for="' + p + '-phone" data-site="emPhone"></label><div class="phone-row" dir="ltr">' +
      '<label class="cc-wrap"><span class="cc-face" aria-hidden="true"><span id="' + p + '-cc-code">+966</span></span>' +
      '<select id="' + p + '-cc" class="cc" aria-label="Country code" data-t-aria="Country code"></select>' + CHEVRON + '</label>' +
      '<input id="' + p + '-phone" type="tel" inputmode="tel" autocomplete="off" placeholder="5X XXX XXXX"></div><p class="err" aria-live="polite"></p></div>' +
      '<div id="f-' + p + '-rel" class="field"><label for="' + p + '-rel" data-site="emRelation"></label>' +
      '<span class="sel-wrap wide"><select id="' + p + '-rel"></select></span><p class="err" aria-live="polite"></p></div>';
  }
  // pre "em" (the account step) or "xem" (step 2); its second contact is pre + "2".
  function emBlock(pre, hidden) {
    return '<div id="' + pre + '-block" class="em-block"' + (hidden ? " hidden" : "") + '>' +
      '<p class="em-h"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg><span data-site="emTitle"></span></p>' +
      '<p class="hint em-sub" data-site="emSubAcc"></p>' + emFields(pre) +
      '<button type="button" id="' + pre + '2-add" class="em-add"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span data-site="em2Add"></span></button>' +
      '<div id="' + pre + '2-box" class="em2" hidden><p class="em-h"><span data-site="em2Title"></span> <span class="em-opt">(<span data-site="optionalLabel"></span>)</span></p>' +
      '<p class="hint em-sub" data-site="em2Sub"></p>' + emFields(pre + "2") + '</div></div>';
  }
  $("#em-slot").outerHTML = emBlock("em", false);
  $("#xem-slot").outerHTML = emBlock("xem", true);
  var EM_PRE = ["em", "em2", "xem", "xem2"];
  function emCcDigits(p) { var o = $("#" + p + "-cc").selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function emCcFace(p) { $("#" + p + "-cc-code").textContent = "+" + emCcDigits(p); $("#" + p + "-phone").placeholder = emCcDigits(p) === "966" ? "5X XXX XXXX" : ""; }
  // The same list as the rider's own number (Saudi Arabia first, again in its place, no Israel), by
  // country name and code: the box shows the code alone.
  function buildEmCc(p) {
    var sel = $("#" + p + "-cc"), cur = sel.value || "SA+966";
    var gulf = SH.COUNTRY_CODES.slice(0, 6), rest = SH.COUNTRY_CODES.slice(6).concat(SH.COUNTRY_CODES.filter(function (x) { return x[1] === "SA"; })).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, lang); }); } catch (e) {}
    var on = selOnce(cur);
    sel.innerHTML = gulf.map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest).map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
    if (!sel.value) sel.value = "SA+966";
    emCcFace(p);
  }
  function buildEmRel(p) {
    var sel = $("#" + p + "-rel"), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(site("emPick")) + "</option>" + EM_RELS.map(function (c) { return '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + esc(site("emRel_" + c)) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  function buildEm() { EM_PRE.forEach(function (p) { buildEmCc(p); buildEmRel(p); }); }
  EM_PRE.forEach(function (p) {
    // a dash is not a name character: typed, it becomes a space (the booking site does the same)
    $("#" + p + "-name").addEventListener("input", function () { var v = this.value.replace(DASHES, " "); if (v !== this.value) this.value = v; clearMsg("f-" + p + "-name"); });
    $("#" + p + "-phone").addEventListener("input", function () { clearMsg("f-" + p + "-phone"); });
    $("#" + p + "-cc").addEventListener("change", function () { emCcFace(p); clearMsg("f-" + p + "-phone"); });
    $("#" + p + "-rel").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-" + p + "-rel"); });
  });
  ["em", "xem"].forEach(function (pre) {
    $("#" + pre + "2-add").addEventListener("click", function () { emOpen2(pre, true); $("#" + pre + "2-name").focus(); });
  });
  function emOpen2(pre, on) { $("#" + pre + "2-box").hidden = !on; $("#" + pre + "2-add").hidden = on; }
  var EM_FIELDS = function (pre) { return ["name", "phone", "rel"].map(function (k) { return "f-" + pre + "-" + k; }).concat(["name", "phone", "rel"].map(function (k) { return "f-" + pre + "2-" + k; })); };
  function last9(v) { return String(v || "").replace(/\D/g, "").slice(-9); }
  // One contact as typed: {name, phone, rel}; null for a second one left wholly empty; or
  // {err: [field id, the site's message key]}.
  function emRead(p, own, other, optional) {
    var raw = $("#" + p + "-phone").value.replace(/[^\d+]/g, "");
    var n = clean($("#" + p + "-name").value.replace(DASHES, " ")), rel = $("#" + p + "-rel").value;
    if (optional && !n && !toAscii(raw) && !rel) return null;
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
  // Both contacts of a block checked into `hard` (the step's problems); what to save, or null.
  function emCheck(pre, own, hard) {
    var one = emRead(pre, own, "", false);
    if (one.err) { hard[one.err[0]] = [one.err[1], null, true]; return null; }
    if ($("#" + pre + "2-box").hidden) return { one: one, two: null };
    var two = emRead(pre + "2", own, one.phone, true);
    if (two && two.err) { hard[two.err[0]] = [two.err[1], null, true]; return null; }
    return { one: one, two: two };
  }
  function emAbsent(e) { return !!e && (e.code === "PGRST202" || /could not find the function/i.test(String(e.message || ""))); }
  // The database's refusal of a contact, as the field and the site's message ("em_self" ...).
  var EM_DETAIL = { em_name: ["name", "errEmName"], em_phone: ["phone", "errEmPhone"], em_relation: ["rel", "errEmRelation"], em_self: ["phone", "errEmSelf"], em_same: ["phone", "errEmSame"], em_required: ["name", "errEmName"] };
  // Saves a block's contacts on the signed-in account: {ok:true}, or {field, key} for a refused box, or
  // {banner, signIn} for the rest. A database without the functions lets the rider through (as the
  // booking site does): customer_set_emergency missing skips both, customer_set_emergency2 missing the second.
  async function emSave(pre) {
    var c = emCheck(pre, acct.phone, {});
    if (!c) { var h = {}; emCheck(pre, acct.phone, h); var k = Object.keys(h)[0]; return { field: k, key: h[k][0] }; }
    var steps = [["customer_set_emergency", c.one, pre]];
    if (c.two) steps.push(["customer_set_emergency2", c.two, pre + "2"]);
    for (var i = 0; i < steps.length; i++) {
      var x = steps[i][1];
      var r = await rpc(steps[i][0], { p_id: acct.id, p_token: acct.token, p_name: x.name, p_phone: x.phone, p_relation: x.rel });
      if (r.error) {
        if (emAbsent(r.error)) { if (i === 0) return { ok: true }; continue; }
        var d = EM_DETAIL[String(r.error.details || "")];
        if (d) return { field: "f-" + steps[i][2] + "-" + d[0], key: d[1] };
        if (/RATE_LIMITED/.test(String(r.error.message || ""))) return { banner: SITE_TOO_MANY };
        return { banner: "Could not reach the server. Please try again." };
      }
      if (r.data === false) return { banner: "You were signed out. Sign in again to send your application.", signIn: true };
    }
    return { ok: true };
  }

  /* ── Email: the staff check's rules (misspelt providers, fake and throwaway domains,
     endings that do not exist) ─────────────────────────────────────────────────────── */
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
  // {hard:[key,args], soft:[key,args], fix:'domain'} for an email; {} when it looks right.
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
  $("#email").addEventListener("input", function () { emailFix = null; clearMsg("f-email"); acked[2] = null; });

  /* ── Name: the staff check's rules, as errors for the rider ─────────────────────────── */
  // Letters of any script and their marks, spaces and periods ("Md. Rahman"): the database's own
  // rule (_name_chars_ok), so a symbol is refused here rather than by the server. A dash is not a
  // name character there either: one typed becomes a space, as on the booking site. A period comes
  // right after a letter; one that would start the name or a word, or follow another, is dropped.
  var NAME_BAD = /[^\p{L}\p{M}\s.]/u;
  var DASHES = /[-\u2010-\u2015\u2212]/g;
  function nameDots(v) { return v.replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1"); }
  function titleCase(v) { return clean(v).replace(/(^|[\s\-'\u2019.])(\p{L})/gu, function (m, sep, ch) { return sep + ch.toLocaleUpperCase(); }); }
  function checkName(s) {
    if (!s) return { hard: ["Enter your first and last name"] };
    if (NAME_BAD.test(s) || /(^|[\s.])\./.test(s)) return { hard: ["Names can only contain letters, spaces and periods."] };
    var letters = s.replace(/[\u064B-\u0670\u065F]/g, "");
    if (/[A-Za-z]/.test(letters) && /[\u0600-\u06FF]/.test(letters)) return { hard: ["Write your name in one alphabet"] };
    var parts = letters.replace(/[^\p{L}\p{M}\s'\u2019.-]/gu, " ").split(/\s+/).filter(function (p) { return p.replace(/[.'\u2019\p{M}-]/gu, ""); });
    var bare = function (p) { return p.replace(/[.'\u2019-]/g, ""); };
    var cjk = parts.length === 1 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(parts[0]);
    if (parts.length < 2 && !cjk) return { hard: ["Enter your first and last name"] };
    // Every word has at least two letters, the middle one too (the site's rule since 2026-09-25). A
    // period ends a word as a space does: "J.R." is two initials, "Md." a word.
    if (parts.length > 1 && parts.some(function (p) { return p.split(".").some(function (w) { w = bare(w); return w && Array.from(w).length < 2; }); })) return { hard: ["Write your first and last name in full, not initials"] };
    if (parts.some(function (p) { return /^(test|asdf|qwerty|user|admin|none|null|name|x{2,}|abc|unknown|other|guest)$/i.test(bare(p)); })) return { hard: ["Please enter your real name"] };
    if (/(\p{L})\1\1/iu.test(letters)) return { soft: ["Please check the spelling of your name."] };
    return {};
  }
  // The sign-up's two boxes, first and last name, read as one name. As the rider types, anything
  // outside the rule is dropped on the spot (the site does the same): a dash turns into a space and
  // a stray period just goes, quietly; any other sign says why.
  function nameInput() {
    var el = this, raw = el.value, v = raw.replace(DASHES, " "), k = v.replace(/[^\p{L}\p{M}\s.]/gu, ""), c = nameDots(k);
    if (c !== raw) { var at = Math.max(0, (el.selectionStart == null ? c.length : el.selectionStart) - (raw.length - c.length)); el.value = c; try { el.setSelectionRange(at, at); } catch (e) {} }
    if (k !== v) { setErr("f-name", "Names can only contain letters, spaces and periods."); return; }
    clearMsg("f-name"); acked[1] = null;
  }
  $("#first").addEventListener("input", nameInput);
  $("#last").addEventListener("input", nameInput);
  function nameParts() { return { first: clean($("#first").value), last: clean($("#last").value) }; }
  function fullName() { var n = nameParts(); return titleCase(n.first + " " + n.last); }

  /* ── Social handles: a pasted link becomes the bare handle the site stores ─────────── */
  function igNorm(raw) {
    var v = clean(raw).replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "").replace(/[?#].*$/, "").replace(/^[@\/\s]+|[\/\s]+$/g, "");
    return v.slice(0, 100);
  }
  function liNorm(raw) {
    var v = clean(raw).replace(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.|m\.|mobile\.)?linkedin\.com\//i, "").replace(/[?#].*$/, "").replace(/^[@\/\s]+|[\/\s]+$/g, "");
    if (/^in\//i.test(v)) v = v.slice(3);
    try { v = encodeURIComponent(decodeURIComponent(v)).replace(/%2F/gi, "/"); } catch (e) {}
    return v.slice(0, 100);
  }
  $("#ig").addEventListener("input", function () { clearMsg("f-ig"); });
  $("#li").addEventListener("input", function () { clearMsg("f-li"); });
  $("#prof").addEventListener("input", function () { clearMsg("f-prof"); });
  $("#work").addEventListener("input", function () { clearMsg("f-work"); });
  function heightInput(id) { return function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, 3); if (v !== this.value) this.value = v; clearMsg(id); acked[1] = null; }; }
  $("#height").addEventListener("input", heightInput("f-height"));
  $("#xheight").addEventListener("input", heightInput("f-xheight"));
  $("#pwd").addEventListener("input", function () { clearMsg("f-pwd"); });
  $("#pwd2").addEventListener("input", function () { clearMsg("f-pwd2"); });

  /* ── Tiles and tick boxes ───────────────────────────────────────────────── */
  var gender = null, xgender = null, bikeType = null, ownBike = null, ack = false, xack = false, news = false;
  function tiles(groupSel, fieldId, onPick) {
    $(groupSel).addEventListener("click", function (e) {
      var b = e.target.closest(".tile"); if (!b) return;
      $$(".tile", this).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      onPick(b.getAttribute("data-v")); clearMsg(fieldId);
    });
  }
  tiles("#genders", "f-gender", function (v) { gender = v; });
  tiles("#xgenders", "f-xgender", function (v) { xgender = v; });
  tiles("#types", "f-type", function (v) { bikeType = v; });
  tiles("#was", "f-wa", function (v) {
    waSame = v === "yes"; acked[waStep] = null;
    $("#f-wanum").hidden = waSame;
    if (waSame) clearMsg("f-wanum"); else $("#wa").focus({ preventScroll: true });
  });
  // Their own bike, yes or no (the owner, 2026-09-30); sent as own_bike, true or false.
  // A yes picks Bike owner as their bike type, which they may still change; a no takes Bike owner back off
  // (the owner, 2026-10-02: "the bike owning question must put the bike type preference on bike owner on
  // default and make it changeable if the applicant was a bike owner").
  tiles("#owns", "f-own", function (v) {
    ownBike = v === "yes";
    var own = $('#types .tile[data-v="Own"]');
    if (ownBike && own && bikeType !== "Own") own.click();
    else if (!ownBike && bikeType === "Own") { $$("#types .tile").forEach(function (x) { x.setAttribute("aria-checked", "false"); }); bikeType = null; }
  });
  function tick(id, get, set) {
    var el = document.getElementById(id);
    function toggle() { set(!get()); el.setAttribute("aria-checked", String(get())); if (id === "ack" || id === "xack") clearMsg("f-" + id); }
    el.addEventListener("click", function (e) { if (e.target.closest(".pv-link")) return; toggle(); });
    el.addEventListener("keydown", function (e) { if (e.target.closest(".pv-link")) return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
  }
  tick("ack", function () { return ack; }, function (v) { ack = v; });
  tick("xack", function () { return xack; }, function (v) { xack = v; });
  tick("news", function () { return news; }, function (v) { news = v; });

  /* ── Privacy Notice ─────────────────────────────────────────────────────── */
  var pvReturn = null;
  function renderNotice() {
    var full = !!SH.PRIVACY_NOTICE[lang], blocks = SH.PRIVACY_NOTICE[full ? lang : "en"];
    var body = $("#pv-body");
    body.innerHTML = blocks.map(function (b) {
      if (b.h) return "<h3>" + b.h + "</h3>";
      if (b.p) return "<p>" + b.p + "</p>";
      if (b.ul) return "<ul>" + b.ul.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
      if (b.table) return '<div class="pv-tw"><table class="pv-t"><thead><tr>' + b.table.head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
        b.table.rows.map(function (r) { return "<tr>" + r.map(function (x, i) { return '<td data-label="' + esc(b.table.head[i]) + '">' + x + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
      return "";
    }).join("");
    body.dir = full ? "" : "ltr"; if (full) body.removeAttribute("lang"); else body.lang = "en";
    $("#pv-note").hidden = full;
    var d = SH.PRIVACY_VERSION;
    try { d = new Date(SH.PRIVACY_VERSION + "T12:00:00+03:00").toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }); } catch (e) {}
    $("#pv-upd").textContent = site("privacyUpdated").replace("{0}", d);
  }
  function openNotice() { pvReturn = document.activeElement; renderNotice(); $("#pv").hidden = false; document.body.style.overflow = "hidden"; $("#pv-x").focus(); }
  function closeNotice() { $("#pv").hidden = true; document.body.style.overflow = ""; if (pvReturn && pvReturn.focus) pvReturn.focus(); }
  document.addEventListener("click", function (e) { if (e.target.closest("#pv-open, #pv-open-x, #pv-open-foot")) { e.preventDefault(); e.stopPropagation(); openNotice(); } });
  $("#pv-x").addEventListener("click", closeNotice);
  $("#pv").addEventListener("click", function (e) { if (e.target === this) closeNotice(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#pv").hidden) closeNotice(); });

  /* ── Banner ─────────────────────────────────────────────────────────────── */
  var bannerKey = null, bannerSignIn = false;
  // The sign-in link rides along where signing in is the way on (a used link, a session gone).
  function showBanner(k, signIn) {
    bannerKey = k; bannerSignIn = !!signIn;
    $("#banner .banner-text").textContent = k.indexOf("site:") === 0 ? site(k.slice(5)) : tr(k);
    $("#banner-signin").hidden = !signIn; $("#banner").hidden = false;
  }
  function hideBanner() { bannerKey = null; bannerSignIn = false; $("#banner").hidden = true; }
  function signInUrl() { return BOOKING_URL + "?handoff=community&lang=" + lang; }
  $("#banner .banner-close").addEventListener("click", hideBanner);

  /* ── Steps ──────────────────────────────────────────────────────────────── */
  // 1 makes the account; once it exists there is no way back to it (it would make a second one).
  var step = 1, acked = {}; // acked[step] = the soft warnings the rider has already seen there
  var acct = null; // the signed-in applicant: {id, token, name, email, phone, made, needGender, needHeight, needAck}
  function goStep(n) {
    step = n;
    $$("fieldset.step").forEach(function (f) { f.hidden = +f.getAttribute("data-step") !== n; });
    $$(".stepper-item").forEach(function (li) { var s = +li.getAttribute("data-step"); li.classList.toggle("active", s === n); li.classList.toggle("done", s < n); });
    $("#next").hidden = n !== 1; $("#submit").hidden = n !== 2;
    $("#acct-made").hidden = !(n === 2 && acct && acct.made);
    $("#acct-who").hidden = !(n === 2 && acct && !acct.made);
    var card = $("#card"); if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function paintWho() {
    var w = $("#acct-who"); if (!acct || acct.made) { w.textContent = ""; return; }
    w.textContent = tr("Applying as {name}", { name: acct.name || "" }) + (acct.email ? " · ⁦" + acct.email + "⁩" : "");
  }
  function passwordErr(pw) { return pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw); }
  // Every field of a step: {hard:{field:[k,a,site]}, soft:{field:[k,a]}}
  function check(n) {
    var hard = {}, soft = {}, r;
    if (n === 1) {
      var nm = nameParts();
      if (!nm.first || !nm.last) hard["f-name"] = ["Enter your first and last name"];
      else { r = checkName(nm.first + " " + nm.last); if (r.hard) hard["f-name"] = r.hard; else if (r.soft) soft["f-name"] = r.soft; }
      if (!gender) hard["f-gender"] = ["Choose your gender"];
      var em = clean($("#email").value).toLowerCase();
      emailFix = null;
      if (!em) hard["f-email"] = ["Enter your email address"];
      else { r = checkEmail(em); if (r.hard) { hard["f-email"] = r.hard; emailFix = r.fix || null; } else if (r.soft) soft["f-email"] = r.soft; }
      r = checkMobile($("#phone").value.replace(/\D/g, ""), e164(), false);
      if (r.hard) hard["f-phone"] = r.hard; else if (r.soft) soft["f-phone"] = r.soft;
      if (waStep === 1) waCheck(hard, soft);
      // The sign-up's password rule: 8 characters, an upper-case letter and a digit, typed twice.
      var pw = $("#pwd").value;
      if (passwordErr(pw)) hard["f-pwd"] = ["errPasswordLen", null, true];
      else if ($("#pwd2").value !== pw) hard["f-pwd2"] = ["errPasswordMatch", null, true];
      var h = parseInt(toAscii($("#height").value), 10);
      if (!(h >= 100 && h <= 250)) hard["f-height"] = ["Enter your height in cm (100 to 250)"];
      else if (h < 140 || h > 209) soft["f-height"] = ["Is {n} cm right?", { n: h }];
      emCheck("em", e164(), hard); // the emergency contact: required before the account is made
      if (!ack) hard["f-ack"] = ["privacyAckRequired", null, true];
    } else {
      if (acct && acct.needGender && !xgender) hard["f-xgender"] = ["Choose your gender"];
      if (waStep === 2) waCheck(hard, soft);
      if (acct && acct.needHeight) { var xh = parseInt(toAscii($("#xheight").value), 10); if (!(xh >= 100 && xh <= 250)) hard["f-xheight"] = ["Enter your height in cm (100 to 250)"]; }
      var b = qOn("birth_date") ? birthValue() : "";
      if (!b) { if (qReq("birth_date")) hard["f-birth"] = ["Choose your date of birth"]; }
      else if (b > todayKsa()) hard["f-birth"] = ["dobErrFuture", null, true];
      else if (b > dobMax()) hard["f-birth"] = ["dobErrYoung", null, true];
      else if (ageAt(b) > 85) soft["f-birth"] = ["Please check your date of birth."];
      if (!$("#nat").value && qReq("nationality")) hard["f-nat"] = ["Choose your nationality"];
      var ig = igNorm($("#ig").value);
      if (!ig && qReq("instagram")) hard["f-ig"] = ["Your Instagram username, or a link to your profile"];
      if (qOn("instagram") && ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) hard["f-ig"] = ["An Instagram username has only letters, numbers, dots and underscores"];
      var li = liNorm($("#li").value);
      if (!li && qReq("linkedin")) hard["f-li"] = ["Paste the link to your own profile (linkedin.com/in/…)"];
      if (qOn("linkedin") && li && (/\//.test(li) || !/^[A-Za-z0-9\-_.%]{3,100}$/.test(li))) hard["f-li"] = ["Paste the link to your own profile (linkedin.com/in/…)"];
      var prof = clean($("#prof").value);
      if (!prof ? qReq("profession") : qOn("profession") && (prof.length < 2 || prof.length > 80 || !/\p{L}/u.test(prof) || /[<>"`{}]/.test(prof))) hard["f-prof"] = ["Enter your profession"];
      // Their company (the owner, 2026-09-29; sent as workplace), checked as profession is, up to 120.
      var work = clean($("#work").value);
      if (!work ? qReq("workplace") : qOn("workplace") && (Array.from(work).length < 2 || Array.from(work).length > 120 || !/\p{L}/u.test(work) || /[<>"`{}]/.test(work))) hard["f-work"] = ["Enter your company"];
      if (ownBike === null && qReq("own_bike")) hard["f-own"] = ["Tell us whether you have your own bike"];
      if (!bikeType && qReq("bike_type")) hard["f-type"] = ["Choose a bike type"];
      if (!$("#heard").value && qReq("heard_from")) hard["f-heard"] = ["Please tell us how you heard about us."];
      if (acct && acct.needEm) emCheck("xem", acct.phone, hard);
      if (acct && acct.needAck && !xack) hard["f-xack"] = ["privacyAckRequired", null, true];
    }
    return { hard: hard, soft: soft };
  }
  var STEP_FIELDS = { 1: ["f-name", "f-gender", "f-email", "f-phone", "f-wa", "f-wanum", "f-pwd", "f-pwd2", "f-height"].concat(EM_FIELDS("em"), ["f-ack"]), 2: ["f-xgender", "f-xheight", "f-wa", "f-wanum", "f-birth", "f-nat", "f-ig", "f-li", "f-prof", "f-work", "f-own", "f-type", "f-heard"].concat(EM_FIELDS("xem"), ["f-xack"]) };
  // Shows the step's problems; true when the rider may go on.
  function passStep(n) {
    var r = check(n), hk = Object.keys(r.hard), sk = Object.keys(r.soft);
    STEP_FIELDS[n].forEach(function (id) { delete msgs[id]; });
    hk.forEach(function (id) { var h = r.hard[id]; (msgs[id] = msgs[id] || {}).err = { k: h[0], a: h[1], site: !!h[2] }; });
    sk.forEach(function (id) { (msgs[id] = msgs[id] || {}).warn = { k: r.soft[id][0], a: r.soft[id][1] }; });
    STEP_FIELDS[n].forEach(paintField);
    if (hk.length) { focusField(hk[0]); return false; }
    var sig = JSON.stringify(r.soft);
    if (sk.length && acked[n] !== sig) { acked[n] = sig; focusField(sk[0]); return false; }
    return true;
  }
  function focusField(id) {
    var f = document.getElementById(id); if (!f) return;
    var el = $("input, select, .tile, .tick", f); if (el) { el.focus({ preventScroll: true }); f.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  /* ── The database ───────────────────────────────────────────────────────── */
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
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); } // the booking site's own account ids
  function setLoading(btn, on) { busy = on; $(btn).classList.toggle("loading", on); $(btn).disabled = on; }
  var sent = null, busy = false;

  /* ── Step 1: the account ────────────────────────────────────────────────── */
  $("#next").addEventListener("click", function () { hideBanner(); if (busy || step !== 1) return; if (consentsPending()) retryConsents(); else if (passStep(1)) createAccount(); });
  async function createAccount() {
    var email = clean($("#email").value).toLowerCase(), phone = e164(), name = fullName();
    setLoading("#next", true);
    try {
      // Each on its own, so the message says which one is taken (as the sign-up page does).
      var ex = await rpc("customer_exists", { p_email: email, p_phone: "" });
      if (ex.data === true) { setErr("f-email", "An account with this email already exists. Sign in to apply with it."); showBanner("An account with this email already exists. Sign in to apply with it.", true); focusField("f-email"); return; }
      ex = await rpc("customer_exists", { p_email: "", p_phone: phone });
      if (ex.data === true) { setErr("f-phone", "An account with this mobile number already exists. Sign in to apply with it."); showBanner("An account with this mobile number already exists. Sign in to apply with it.", true); focusField("f-phone"); return; }
      var id = uid();
      var r = await rpc("customer_signup", {
        p_id: id, p_name: name, p_email: email, p_phone: phone, p_pwd: $("#pwd").value,
        p_height: parseInt(toAscii($("#height").value), 10), p_type_preference: "Any", p_gender: gender
      });
      if (r.error) { signupRefused(r.error); return; }
      var tok = r.data && r.data[0] && r.data[0].session_token;
      if (!tok) { showBanner("Could not reach the server. Please try again."); return; }
      acct = { id: id, token: tok, name: name, email: email, phone: phone, made: true, needGender: false, needHeight: false, consented: false, news: news };
      $("#pwd").value = ""; $("#pwd2").value = "";
      await saveConsents();
    } finally { setLoading("#next", false); }
  }
  // The notice they confirmed and their ride-news answer, recorded the moment the account exists.
  // Step 2 opens only once that is saved: a failure says so, and Continue tries the save again
  // (the account is made by then, so it is never made twice).
  async function saveConsents() {
    var body = { p_id: acct.id, p_token: acct.token, p_privacy: SH.PRIVACY_VERSION, p_ride_news: acct.news };
    var c = await rpc("customer_consents", body);
    if (c.error) c = await rpc("customer_consents", body);
    if (c.error) { showBanner("Could not reach the server. Please try again."); return; }
    acct.consented = true;
    // Then the emergency contact typed on this step. Should it not save, the account stays made:
    // step 2 asks for it again, with what was typed and why, and saves it before the application.
    var e = await emSave("em");
    if (!e.ok) emCarry();
    enterStepTwo(null);
    if (!e.ok) { if (e.field) { setErr(e.field.replace("f-em", "f-xem"), e.key, null, true); focusField(e.field.replace("f-em", "f-xem")); } else showBanner(e.banner, e.signIn); }
  }
  // The account step's contacts, copied into step 2's boxes, which then ask for them.
  function emCarry() {
    acct.needEm = true; acct.emTwo = true;
    ["name", "cc", "phone", "rel"].forEach(function (k) { ["", "2"].forEach(function (n) { $("#xem" + n + "-" + k).value = $("#em" + n + "-" + k).value; }); });
    ["xem", "xem2"].forEach(function (p) { emCcFace(p); $("#" + p + "-rel").classList.toggle("ph", !$("#" + p + "-rel").value); });
    emOpen2("xem", !$("#em2-box").hidden);
  }
  async function retryConsents() { setLoading("#next", true); try { await saveConsents(); } finally { setLoading("#next", false); } }
  function consentsPending() { return !!(acct && acct.made && !acct.consented); }
  var SITE_TOO_MANY = "site:errTooManyTries"; // the sign-up page's own words
  function signupRefused(e) {
    var m = String((e.code || "") + " " + (e.message || "") + " " + (e.details || "") + " " + (e.hint || ""));
    if (/name_chars/.test(m)) { setErr("f-name", "Names can only contain letters, spaces and periods."); focusField("f-name"); }
    else if (/name_short/.test(m)) { setErr("f-name", "Write your first and last name in full, not initials"); focusField("f-name"); }
    else if (/23505|DUPLICATE/i.test(m)) { setErr("f-email", "An account with this email already exists. Sign in to apply with it."); showBanner("An account with this email already exists. Sign in to apply with it.", true); focusField("f-email"); }
    else if (/RATE_LIMITED/.test(m)) showBanner(SITE_TOO_MANY);
    else if (/BAD_INPUT/.test(m) && /phone/.test(m)) { setErr("f-phone", "Enter a valid mobile number"); focusField("f-phone"); }
    else if (/BAD_INPUT/.test(m) && /height/.test(m)) { setErr("f-height", "Enter your height in cm (100 to 250)"); focusField("f-height"); }
    else showBanner("Could not reach the server. Please try again.");
  }

  /* ── Step 2: the community questions ────────────────────────────────────── */
  // The answers to start from: a waiting application's, else what the account already holds.
  function prefill(me) {
    if (!me) return;
    if (me.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(me.birth_date)) {
      var b = me.birth_date.split("-").map(Number);
      $("#birth-y").value = String(b[0]); buildDob(); $("#birth-m").value = String(b[1]); buildDob(); $("#birth-d").value = String(b[2]); buildDob();
    }
    if (me.nationality && $$("#nat option").some(function (o) { return o.value === me.nationality; })) { $("#nat").value = me.nationality; $("#nat").classList.remove("ph"); }
    if (me.instagram) $("#ig").value = me.instagram;
    if (me.linkedin) $("#li").value = me.linkedin;
    if (me.profession) $("#prof").value = me.profession;
    if (me.workplace) $("#work").value = me.workplace;
    if (typeof me.own_bike === "boolean") { var o = $('#owns .tile[data-v="' + (me.own_bike ? "yes" : "no") + '"]'); if (o) o.click(); }
    if (me.bike_type) { var t = $('#types .tile[data-v="' + me.bike_type + '"]'); if (t) t.click(); }
    if (typeof me.whatsapp_same === "boolean") {
      var w = $('#was .tile[data-v="' + (me.whatsapp_same ? "yes" : "no") + '"]'); if (w) w.click();
      var wd = String(me.whatsapp || "").replace(/\D/g, ""), wk = ccOf(wd);
      if (!me.whatsapp_same && wk) { setCcDigits(wk, WPK); $("#wa").value = wd.slice(wk.length); onPhoneInput(WPK); }
    }
    if (me.heard_from && SH.HEARD_OPTS.indexOf(me.heard_from) >= 0) { $("#heard").value = me.heard_from; $("#heard").classList.remove("ph"); }
  }
  function enterStepTwo(me) {
    // Step 1 skipped (handed over signed in): the WhatsApp question goes to the top of step 2.
    if (!acct.made && waStep === 1) {
      var at = $("#f-birth"); at.parentNode.insertBefore($("#f-wa"), at); at.parentNode.insertBefore($("#f-wanum"), at);
      waStep = 2;
    }
    paintWa();
    $("#f-xgender").hidden = !acct.needGender; $("#f-xheight").hidden = !acct.needHeight; $("#f-xack").hidden = !acct.needAck;
    $("#xem-block").hidden = !acct.needEm; $("#xem2-add").hidden = !acct.emTwo || !$("#xem2-box").hidden;
    $("#acct-pending").hidden = !(me && me.pending);
    prefill(me); paintWho();
    goStep(2);
    if (acct.made) $("#acct-made").focus({ preventScroll: true });
  }
  var FIELD_OF = { gender: ["f-xgender", "Choose your gender"], height: ["f-xheight", "Enter your height in cm (100 to 250)"], birth_date: ["f-birth", "Choose your date of birth"], nationality: ["f-nat", "Choose your nationality"], instagram: ["f-ig", "An Instagram username has only letters, numbers, dots and underscores"], linkedin: ["f-li", "Paste the link to your own profile (linkedin.com/in/…)"], profession: ["f-prof", "Enter your profession"], workplace: ["f-work", "Enter your company"], own_bike: ["f-own", "Tell us whether you have your own bike"], bike_type: ["f-type", "Choose a bike type"], heard_from: ["f-heard", "Please tell us how you heard about us."] };
  $("#form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (busy) return;
    hideBanner();
    if (step === 1) { if (consentsPending()) retryConsents(); else if (passStep(1)) createAccount(); return; }
    if (!acct || !passStep(2)) return;
    // An account without an emergency contact gives it here, saved before the application goes.
    if (acct.needEm) {
      setLoading("#submit", true);
      var e = await emSave("xem");
      setLoading("#submit", false);
      if (!e.ok) { if (e.field) { setErr(e.field, e.key, null, true); focusField(e.field); } else showBanner(e.banner, e.signIn); return; }
      acct.needEm = false; $("#xem-block").hidden = true;
    }
    var payload = {
      birth_date: birthValue(), nationality: $("#nat").value, bike_type: bikeType, own_bike: ownBike, instagram: igNorm($("#ig").value), linkedin: liNorm($("#li").value),
      profession: clean($("#prof").value), workplace: clean($("#work").value), heard_from: $("#heard").value, lang: lang,
      whatsapp_same: waSame
    };
    // A question turned off is sent empty; their own bike, unanswered, is left out (the server takes no null).
    Object.keys(CF_FIELD).forEach(function (k) { if (!qOn(k) && k !== "own_bike") payload[k] = ""; });
    if (!qOn("own_bike") || ownBike === null) delete payload.own_bike;
    if (!qOn("birth_date")) payload.birth_date = "";
    if (waSame === false) payload.whatsapp = e164(WPK);
    // The notice is recorded as confirmed only when this form showed its box and the box was ticked:
    // the account step's (an account made here), or step 2's for a signed-in account the database
    // has none for. An account handed over signed in otherwise sends none: it never saw the box here.
    if (acct.made ? ack : (acct.needAck && xack)) { payload.privacy_version = SH.PRIVACY_VERSION; payload.privacy_ack = true; }
    if (acct.needGender) payload.gender = xgender;
    if (acct.needHeight) payload.height = parseInt(toAscii($("#xheight").value), 10);
    setLoading("#submit", true);
    var r = await rpc("customer_community_apply", { p_id: acct.id, p_token: acct.token, p: payload });
    setLoading("#submit", false);
    var res = r.data;
    if (!res || typeof res !== "object") { showBanner("Could not reach the server. Please try again."); return; }
    if (!res.ok) {
      if (res.error === "throttled") { showBanner("Too many applications from this network. Please try again in a few minutes."); return; }
      if (res.error === "member") { showMember(); return; }
      if (res.error === "signed_out") { showBanner("You were signed out. Sign in again to send your application.", true); return; }
      if (res.error === "account") { showBanner("Your account has no email or mobile number yet. Add them on the booking site, then apply."); return; }
      // An account without a confirmed notice: its box, on this step, before the application goes.
      if (res.error === "privacy") { acct.needAck = true; $("#f-xack").hidden = false; setErr("f-xack", "privacyAckRequired", null, true); focusField("f-xack"); return; }
      // The WhatsApp answer refused: said on its own field while it is on this step.
      if (res.error === "whatsapp" && waStep === 2) { var wf = waSame === false ? "f-wanum" : "f-wa"; setErr(wf, wf === "f-wa" ? "Tell us whether this is your WhatsApp number" : "Enter a valid mobile number"); focusField(wf); return; }
      var f = FIELD_OF[res.error];
      if (f) { if (res.error === "gender" || res.error === "height") { $("#" + f[0]).hidden = false; acct["need" + (res.error === "gender" ? "Gender" : "Height")] = true; } setErr(f[0], f[1]); focusField(f[0]); return; }
      showBanner("Could not reach the server. Please try again."); return;
    }
    showSuccess({ name: acct.name, phone: acct.phone, email: acct.email });
  });
  function showSuccess(p) {
    sent = p;
    $("#card").setAttribute("data-state", "success");
    $("#form").hidden = true; $("#member").hidden = true; $("#success").hidden = false;
    $("#result").textContent = tr("{name}, your application has been received.", { name: String(p.name || "").split(" ")[0] });
    $("#result-contact").textContent = p.phone && p.email ? tr("We will reply on {phone} or {email}.", { phone: "⁦" + p.phone + "⁩", email: "⁦" + p.email + "⁩" }) : "";
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#form")) $("#success").focus();
  }
  function showMember() {
    hideBanner();
    $("#card").setAttribute("data-state", "member");
    $("#form").hidden = true; $("#member").hidden = false;
    $("#member").focus({ preventScroll: true });
  }

  /* ── Arriving signed in ─────────────────────────────────────────────────── */
  // ?code= is a one-time code (two minutes, one use) the booking site made for a signed-in rider:
  // their "Sign in" from here, or the Apply button of its members-only popup. It leaves the
  // address at once; the session it trades for is kept in this page only, never stored.
  async function arrive() {
    var q = new URLSearchParams(location.search), code = q.get("code");
    if (code == null) return;
    q.delete("code");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
    if (!/^[0-9a-f]{48}$/.test(code)) { showBanner("This sign-in link has expired. Sign in again to continue.", true); return; }
    $("#card").setAttribute("data-state", "loading"); $("#loading").hidden = false;
    try {
      var r = await rpc("customer_handoff_redeem", { p_code: code });
      var row = Array.isArray(r.data) ? r.data[0] : null;
      if (!row || !row.id || !row.session_token) { showBanner(r.error && r.error.message === "network" ? "Could not reach the server. Please try again." : "This sign-in link has expired. Sign in again to continue.", true); return; }
      // what the account holds and its emergency contact, asked together
      var both = await Promise.all([rpc("customer_community_me", { p_id: row.id, p_token: row.session_token }), rpc("customer_emergency", { p_id: row.id, p_token: row.session_token })]);
      var m = both[0], em = both[1];
      var me = m.data && typeof m.data === "object" ? m.data : null;
      if (!me) { showBanner("Could not reach the server. Please try again."); return; }
      acct = { id: row.id, token: row.session_token, name: me.name || row.name || "", email: me.email || "", phone: me.phone || "", made: false, needGender: !me.gender, needHeight: !me.height };
      if (me.member) { showMember(); return; }
      // The emergency contact on the account: asked on this step when there is none. A database
      // without customer_emergency asks nothing; one that answers three columns offers no second.
      var er = !em.error && Array.isArray(em.data) ? em.data[0] || null : null;
      acct.needEm = em.error ? !emAbsent(em.error) : !(er && er.emergency_name && er.emergency_phone && er.emergency_relation);
      acct.emTwo = !er || "emergency2_name" in er;
      enterStepTwo(me);
    } finally {
      $("#loading").hidden = true;
      if ($("#card").getAttribute("data-state") === "loading") $("#card").setAttribute("data-state", "form");
    }
  }

  // Test hook: the specs read the payload the form would send without a network.
  window.CommunityForm = { e164: e164, checkEmail: checkEmail, checkName: checkName, liNorm: liNorm, igNorm: igNorm, emRead: emRead };

  setLang(pickLang(), false);
  loadQuestions();
  goStep(1);
  arrive();
})();
