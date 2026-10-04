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
    $("#ack-lbl").innerHTML = esc(site("privacyAckOpt")).replace("{0}", '<button type="button" class="pv-link" id="pv-open">' + esc(site("privacyNotice")) + "</button>") + ' <span class="req" aria-hidden="true">*</span>';
    buildNationalities(); buildDob(); buildCc(); buildHeard();
    $$(".field").forEach(function (f) { paintField(f.id); });
    if (!$("#pv").hidden) renderNotice();
    if (sent) showSuccess(sent);
    if (bannerKey) showBanner(bannerKey, bannerSignIn);
  }
  (function buildLangs() {
    var sel = $("#lang");
    sel.innerHTML = SH.LANGS.map(function (l) { return '<option value="' + l.code + '">' + esc(l.label) + "</option>"; }).join("");
    sel.addEventListener("change", function () { setLang(sel.value, true); try { var u = new URL(location.href); u.searchParams.set("lang", sel.value); history.replaceState(null, "", u); } catch (e) {} });
  })();

  /* ── Nationality: every country, labelled in the rider's language, Saudi Arabia first ── */
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
    var rest = SH.NATIONALITIES.map(function (x) { return x[1]; }).filter(function (n) { return n !== "Saudi Arabia"; });
    try { rest.sort(function (a, b) { return lab[a].localeCompare(lab[b], lang); }); } catch (e) { rest.sort(); }
    sel.innerHTML = '<option value="">' + esc(tr("Choose your nationality")) + "</option>" +
      ["Saudi Arabia"].concat(rest).map(function (n) { return '<option value="' + esc(n) + '"' + (n === cur ? " selected" : "") + ">" + esc(lab[n]) + "</option>"; }).join("");
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
  // native select, and the list names every country in the rider's language, the Gulf first.
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
  function buildCc() {
    // Each option is its country AND code ("PS+970", "PS+972"): Palestine answers on two codes,
    // and a value of the country alone made +972 land on +970.
    var sel = $("#cc"), cur = sel.value || "SA+966";
    var gulf = SH.COUNTRY_CODES.slice(0, 6), rest = SH.COUNTRY_CODES.slice(6).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, lang); }); } catch (e) {}
    var list = gulf.map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest);
    sel.innerHTML = list.map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-iso="' + o.x[1] + '" data-cc="' + o.x[0] + '"' + (v === cur ? " selected" : "") + ">" + flagOf(o.x[1]) + " " + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
    if (!sel.value) sel.value = "SA+966";
    ccFace();
  }
  function ccFace() {
    var o = $("#cc").selectedOptions[0]; if (!o) return;
    $("#cc-flag").textContent = flagOf(o.getAttribute("data-iso")); $("#cc-code").textContent = o.getAttribute("data-cc");
  }
  function ccDigits() { var o = $("#cc").selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function setCcDigits(k) { var o = $$("#cc option").filter(function (x) { return x.getAttribute("data-cc") === "+" + k; })[0]; if (o) { $("#cc").value = o.value; ccFace(); } }
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
    var el = $("#phone"), raw = toAscii(el.value).trim(), d = raw.replace(/\D/g, "");
    var ccd = ccDigits(), intl = raw[0] === "+" || d.slice(0, 2) === "00", cut = false, plus = false;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (intl) {
      if (d.indexOf(ccd) !== 0) { var k = ccOf(d); if (k) { setCcDigits(k); ccd = k; } }
      if (d.indexOf(ccd) === 0) { d = d.slice(ccd.length); cut = true; } else plus = true;
    } else if (ccIncluded(d, ccd)) { d = d.slice(ccd.length); cut = true; }
    d = d.slice(0, 15);
    // A Saudi mobile without its 0 reads as the example does: 5X XXX XXXX. Typed with the 0 it keeps 05X XXX XXXX.
    var g = ccd === "966" && d[0] === "5" ? [2, 5] : [3, 6];
    var out = d.length > g[1] ? d.slice(0, g[0]) + " " + d.slice(g[0], g[1]) + " " + d.slice(g[1]) : d.length > g[0] ? d.slice(0, g[0]) + " " + d.slice(g[0]) : d;
    el.value = (plus ? "+" : "") + out;
  }
  function e164() {
    var ccd = ccDigits(), s = toAscii($("#phone").value).trim().replace(/[\s()\-]/g, "");
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
  $("#cc").addEventListener("change", function () { ccFace(); $("#phone").placeholder = ccDigits() === "966" ? "5X XXX XXXX" : ""; clearMsg("f-phone"); });

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
  var gender = null, xgender = null, bikeType = null, ownBike = null, ack = false, news = false;
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
    function toggle() { set(!get()); el.setAttribute("aria-checked", String(get())); if (id === "ack") clearMsg("f-ack"); }
    el.addEventListener("click", function (e) { if (e.target.closest(".pv-link")) return; toggle(); });
    el.addEventListener("keydown", function (e) { if (e.target.closest(".pv-link")) return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
  }
  tick("ack", function () { return ack; }, function (v) { ack = v; });
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
  document.addEventListener("click", function (e) { if (e.target.closest("#pv-open, #pv-open-foot")) { e.preventDefault(); e.stopPropagation(); openNotice(); } });
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
  var acct = null; // the signed-in applicant: {id, token, name, email, phone, made, needGender, needHeight}
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
      var raw = $("#phone").value.replace(/\D/g, "");
      var p = e164(), d = p.replace(/\D/g, "");
      if (!raw) hard["f-phone"] = ["Enter your mobile number"];
      else if (d.indexOf("966") === 0) {
        var nat = d.slice(3);
        if (!/^5\d{8}$/.test(nat) || !mobileOk("966", nat)) hard["f-phone"] = ["Enter a valid Saudi mobile number (5XXXXXXXX)"];
      } else {
        var cc = callingCode(d);
        if (!cc || d.length < 8 || d.length > 15) hard["f-phone"] = ["Enter a valid mobile number"];
        else if (!mobileOk(cc, d.slice(cc.length))) hard["f-phone"] = ["This is not a mobile number for +{c}. Please check it.", { c: cc }];
      }
      if (!hard["f-phone"]) {
        var tail = d.slice(-9);
        if (/(\d)\1{5,}/.test(tail) || /0123456|1234567|2345678|3456789|9876543|8765432/.test(tail)) soft["f-phone"] = ["Please check this number: it does not look like a real one."];
      }
      // The sign-up's password rule: 8 characters, an upper-case letter and a digit, typed twice.
      var pw = $("#pwd").value;
      if (passwordErr(pw)) hard["f-pwd"] = ["errPasswordLen", null, true];
      else if ($("#pwd2").value !== pw) hard["f-pwd2"] = ["errPasswordMatch", null, true];
      var h = parseInt(toAscii($("#height").value), 10);
      if (!(h >= 100 && h <= 250)) hard["f-height"] = ["Enter your height in cm (100 to 250)"];
      else if (h < 140 || h > 209) soft["f-height"] = ["Is {n} cm right?", { n: h }];
      if (!ack) hard["f-ack"] = ["privacyAckRequired", null, true];
    } else {
      if (acct && acct.needGender && !xgender) hard["f-xgender"] = ["Choose your gender"];
      if (acct && acct.needHeight) { var xh = parseInt(toAscii($("#xheight").value), 10); if (!(xh >= 100 && xh <= 250)) hard["f-xheight"] = ["Enter your height in cm (100 to 250)"]; }
      var b = birthValue();
      if (!b) hard["f-birth"] = ["Choose your date of birth"];
      else if (b > todayKsa()) hard["f-birth"] = ["dobErrFuture", null, true];
      else if (b > dobMax()) hard["f-birth"] = ["dobErrYoung", null, true];
      else if (ageAt(b) > 85) soft["f-birth"] = ["Please check your date of birth."];
      if (!$("#nat").value) hard["f-nat"] = ["Choose your nationality"];
      var ig = igNorm($("#ig").value);
      if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) hard["f-ig"] = ["An Instagram username has only letters, numbers, dots and underscores"];
      var li = liNorm($("#li").value);
      if (li && (/\//.test(li) || !/^[A-Za-z0-9\-_.%]{3,100}$/.test(li))) hard["f-li"] = ["Paste the link to your own profile (linkedin.com/in/…)"];
      var prof = clean($("#prof").value);
      if (prof.length < 2 || prof.length > 80 || !/\p{L}/u.test(prof) || /[<>"`{}]/.test(prof)) hard["f-prof"] = ["Enter your profession"];
      // Their company (the owner, 2026-09-29; sent as workplace), checked as profession is, up to 120.
      var work = clean($("#work").value);
      if (Array.from(work).length < 2 || Array.from(work).length > 120 || !/\p{L}/u.test(work) || /[<>"`{}]/.test(work)) hard["f-work"] = ["Enter your company"];
      if (ownBike === null) hard["f-own"] = ["Tell us whether you have your own bike"];
      if (!bikeType) hard["f-type"] = ["Choose a bike type"];
      if (!$("#heard").value) hard["f-heard"] = ["Please tell us how you heard about us."];
    }
    return { hard: hard, soft: soft };
  }
  var STEP_FIELDS = { 1: ["f-name", "f-gender", "f-email", "f-phone", "f-pwd", "f-pwd2", "f-height", "f-ack"], 2: ["f-xgender", "f-xheight", "f-birth", "f-nat", "f-ig", "f-li", "f-prof", "f-work", "f-own", "f-type", "f-heard"] };
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
    enterStepTwo(null);
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
    if (me.heard_from && SH.HEARD_OPTS.indexOf(me.heard_from) >= 0) { $("#heard").value = me.heard_from; $("#heard").classList.remove("ph"); }
  }
  function enterStepTwo(me) {
    $("#f-xgender").hidden = !acct.needGender; $("#f-xheight").hidden = !acct.needHeight;
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
    var payload = {
      birth_date: birthValue(), nationality: $("#nat").value, bike_type: bikeType, own_bike: ownBike, instagram: igNorm($("#ig").value), linkedin: liNorm($("#li").value),
      profession: clean($("#prof").value), workplace: clean($("#work").value), heard_from: $("#heard").value, lang: lang, privacy_version: SH.PRIVACY_VERSION
    };
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
    $("#result").textContent = tr("Thank you, {name}. Our team will review your application and reply to you shortly.", { name: String(p.name || "").split(" ")[0] });
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
      var m = await rpc("customer_community_me", { p_id: row.id, p_token: row.session_token });
      var me = m.data && typeof m.data === "object" ? m.data : null;
      if (!me) { showBanner("Could not reach the server. Please try again."); return; }
      acct = { id: row.id, token: row.session_token, name: me.name || row.name || "", email: me.email || "", phone: me.phone || "", made: false, needGender: !me.gender, needHeight: !me.height };
      if (me.member) { showMember(); return; }
      enterStepTwo(me);
    } finally {
      $("#loading").hidden = true;
      if ($("#card").getAttribute("data-state") === "loading") $("#card").setAttribute("data-state", "form");
    }
  }

  // Test hook: the specs read the payload the form would send without a network.
  window.CommunityForm = { e164: e164, checkEmail: checkEmail, checkName: checkName, liNorm: liNorm, igNorm: igNorm };

  setLang(pickLang(), false);
  goStep(1);
  arrive();
})();
