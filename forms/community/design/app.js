/* Community membership application (micromobility.sa/community/registration).
   Two server steps (the owner, 2026-09-30: "let the applicant create an account first with the same sign up
   requirements that is in the sign up landing page then take them to the next step"), each in short screens
   (the rework of 2026-11-10, reports/Community form enhancement.md, the user: "do them all"):
   0. the first question, an account already or not, with what membership gives;
   1. the booking site's own sign-up, which makes the account (customer_signup, customer_consents):
      About you, How we reach you, Emergency contact, Create a password;
   2. the community questions the sign-up does not ask, sent from that account (customer_community_apply):
      Birth date and nationality (and a parent or guardian under 18), Your riding (the bike, the sport), Work and
      socials, and Check your answers.
   Someone who has an account signs in here, or on the booking site, which hands them back signed in (?code=,
   customer_handoff_create) straight onto step 2; so does the "Apply" button of the booking site's members-only
   popup. Every answer is checked the way the booking site's staff "Looks off" check reads accounts, as the
   applicant leaves the box and again on Continue, which names every problem at once at the top of the screen. A
   soft problem ("is 212 cm right?") is said once; the applicant goes on by pressing Continue. */
(function () {
  "use strict";
  // The public anon key (the same one the booking site ships): the RPCs below are SECURITY DEFINER functions that
  // check and throttle on the server. On the website (forms/shared/site-form.mjs) the page hands over its language,
  // the database it talks to itself (staging's on staging) and the booking site that reads that database:
  // window.MM_SITE_FORM = {lang, db: {url, key}, booking}. The page built on its own (?classic=1) uses these.
  var SITE_FORM = window.MM_SITE_FORM || null;
  var SUPABASE_URL = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.url) || "https://qpffkzmsfyilicwcsszz.supabase.co";
  var SUPABASE_KEY = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.key) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmZrem1zZnlpbGljd2Nzc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDQwODAsImV4cCI6MjEwNTgyMDA4MH0.K6qZpK0oR4MXIaFk4DRJGy-H_m6BYnJ-S31swTiHMhQ";
  var LANG_KEY = "mm-community-lang";
  // The booking site: where an existing account signs in (it hands the rider back here signed in). The one the page's
  // database belongs to: a hand-over code or a change link made in one database means nothing in the other.
  var BOOKING_URL = SITE_FORM && /^https:\/\/[^\s"'<>\\?#]+\/$/.test(SITE_FORM.booking || "") ? SITE_FORM.booking : "https://experiences.micromobility.sa/";
  var HELP_WA = "https://wa.me/966566668818";

  var SH = window.SHARED, SPD = window.SPORT_DATA || null;
  // On the website the page carries English only and its reader's language comes as a file (forms/shared/site-form.mjs):
  // its words are laid in here, before anything is painted.
  window.FORM_T = window.FORM_T || {};
  function applyPack(p) {
    if (!p || !p.lang) return;
    window.FORM_T[p.lang] = p.T || {}; SH.SITE_T[p.lang] = p.S || {};
    if (p.N) SH.PRIVACY_NOTICE[p.lang] = p.N;
    if (p.C) SH.COUNTRY_AR = p.C;
  }
  applyPack(window.MM_FORM_PACK);
  var T = window.FORM_T;
  var html = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lang = "en";

  // k(<string>) marks one of the form's own strings (design/i18n.js has it in every language; the build reads them from
  // here). It gives the key back; tr() turns it into the reader's language.
  function k(s) { return s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fill(v, args) { if (args) Object.keys(args).forEach(function (x) { v = v.split("{" + x + "}").join(args[x]); }); return v; }
  function tr(key, args) { return fill((T[lang] && T[lang][key]) || key, args); }
  function site(key) { return (SH.SITE_T[lang] && SH.SITE_T[lang][key]) || SH.SITE_T.en[key] || key; }
  function langInfo(code) { for (var i = 0; i < SH.LANGS.length; i++) if (SH.LANGS[i].code === code) return SH.LANGS[i]; return SH.LANGS[0]; }
  function locale() { return langInfo(lang).locale; }
  function rtl() { return !!langInfo(lang).rtl; }
  function toAscii(s) { return String(s == null ? "" : s).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); }).replace(/[०-९]/g, function (c) { return String(c.charCodeAt(0) - 0x0966); }).replace(/[০-৯]/g, function (c) { return String(c.charCodeAt(0) - 0x09E6); }); }
  function clean(v) { return String(v == null ? "" : v).replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, " ").replace(/\s+/g, " ").trim(); }
  // A list in the reader's language: Arabic and Urdu join with their own comma.
  function listJoin(a) { return a.join(lang === "ar" || lang === "ur" ? "، " : ", "); }
  // A value in its own direction inside the page's text (an email, a number, a handle in an Arabic line).
  function iso(s) { return "⁦" + s + "⁩"; }

  /* ── Messages on fields ──────────────────────────────────────────────────
     Kept as keys, not text, so a language change repaints them in the new language. Where a key comes from:
     the form's own strings (k), the booking site's ("site", shared.js), or the sport question's ("sp"). */
  var msgs = {}; // field id -> {err:{k,a,site}, warn:{k,a}}
  function setErr(id, key, a, from) { (msgs[id] = msgs[id] || {}).err = { k: key, a: a, site: from || false }; delete msgs[id].warn; paintField(id); }
  function clearMsg(id) { if (!msgs[id]) return; delete msgs[id]; paintField(id); refreshSummary(); }
  function msgText(m) { return m.site === "sp" ? fill(spW()[m.k] || m.k, m.a) : m.site ? fill(site(m.k), m.a) : tr(m.k, m.a); }
  function paintField(id) {
    var f = document.getElementById(id); if (!f) return;
    var m = msgs[id] || {};
    f.classList.toggle("invalid", !!m.err);
    f.classList.toggle("warned", !m.err && !!m.warn);
    var e = $(":scope > .err", f) || $(".err", f), w = $(":scope > .warn", f) || $(".warn", f);
    if (e) e.textContent = m.err ? msgText(m.err) : "";
    if (w) w.textContent = !m.err && m.warn ? tr(m.warn.k, m.warn.a) + " " + tr("If it is right, press Continue.") : "";
    // a screen reader hears that the box is wrong and why, not only sees the red line
    if (e && !e.id) e.id = id + "-err";
    $$("input:not([type=hidden]), select, [role=radiogroup], .tick", f).forEach(function (c) {
      if (c.closest(".field") !== f) return;
      if (m.err) { c.setAttribute("aria-invalid", "true"); c.setAttribute("aria-describedby", e ? e.id : ""); }
      else { c.removeAttribute("aria-invalid"); c.removeAttribute("aria-describedby"); }
    });
    if (id === "f-email") paintEmailFix();
  }

  /* ── Language ────────────────────────────────────────────────────────── */
  function pickLang() {
    var codes = SH.LANGS.map(function (l) { return l.code; });
    // on the website the site's language picker decides (it reloads the page in the language chosen)
    if (SITE_FORM && codes.indexOf(SITE_FORM.lang) >= 0) return SITE_FORM.lang;
    var q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (codes.indexOf(q) >= 0) return q;
    try { var s = localStorage.getItem(LANG_KEY); if (codes.indexOf(s) >= 0) return s; } catch (e) {}
    var nav = (navigator.languages || [navigator.language || "en"]);
    // The language subtag whole: "fil" (how phones name Filipino) is Tagalog; "fi" is Finnish.
    for (var i = 0; i < nav.length; i++) { var c = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (c === "fil") c = "tl"; if (codes.indexOf(c) >= 0) return c; }
    return "en";
  }
  /* ── The questions, as the booking site's admins set them (2026-10-07) ─────────────────────────
     site_content 'community.form' = {q:{<question>:{on, req, label:{<lang>:text}}}}: a question turned off is not
     shown or sent, one made optional may be left empty (customer_community_apply reads the same settings,
     20261007230000), and its wording in the reader's language replaces ours. Read once as the page opens; with
     nothing read the form asks what it always asked. Instagram is asked of every applicant since 2026-11-11 (the
     owner's D6: members must give it anyway, 2026-10-09); LinkedIn stays behind "Add LinkedIn" unless made required.
     The bike and their own bike are one question (D9): its box answers both. */
  var CF = {};
  var CF_FIELD = { birth_date: "f-birth", nationality: "f-nat", profession: "f-prof", workplace: "f-work", own_bike: "f-type", bike_type: "f-type", heard_from: "f-heard", instagram: "f-ig", linkedin: "f-li" };
  var CF_REQ = { birth_date: true, nationality: true, profession: true, workplace: true, own_bike: true, bike_type: true, heard_from: true, instagram: true, linkedin: false };
  function qOn(x) { return !(CF[x] && CF[x].on === false); }
  function qReq(x) { return qOn(x) && (CF[x] && typeof CF[x].req === "boolean" ? CF[x].req : CF_REQ[x]); }
  function bikeOn() { return qOn("bike_type") || qOn("own_bike"); }
  function paintQuestions() {
    Object.keys(CF_FIELD).forEach(function (x) {
      var f = document.getElementById(CF_FIELD[x]); if (!f) return;
      if (x === "own_bike") return; // answered by the bike's box
      if (x === "linkedin") { liPaint(); }
      else if (!f.hasAttribute("data-skipped")) f.hidden = x === "bike_type" ? !bikeOn() : !qOn(x);
      var lab = f.querySelector("label:not(.cc-wrap):not(.sub), .label"); if (!lab) return;
      var own = CF[x] && CF[x].label && typeof CF[x].label[lang] === "string" ? CF[x].label[lang].trim() : "";
      if (own) lab.textContent = own;
    });
  }
  async function loadQuestions() {
    try {
      var resp = await fetch(SUPABASE_URL + "/rest/v1/site_content?select=value&key=eq.community.form", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } });
      var rows = resp.ok ? await resp.json() : null;
      var v = rows && rows[0] && rows[0].value;
      CF = v && v.q && typeof v.q === "object" && !Array.isArray(v.q) ? v.q : {};
    } catch (e) { CF = {}; }
    paintQuestions(); paintReq(); paintChrome();
  }
  // A red star on every question that must be answered (as the booking site's sign-up marks them), and
  // aria-required for screen readers. An optional question carries no word saying so (the owner, 2026-09-24).
  function reqFields() {
    var r = ["f-name", "f-gender", "f-height", "f-phone", "f-wa", "f-wanum", "f-email", "f-em-name", "f-em-phone", "f-em-rel", "f-pwd",
      "f-xgender", "f-xheight", "f-gname", "f-grel", "f-gphone", "f-sport", "f-spfeds", "f-spother", "f-xem-name", "f-xem-phone", "f-xem-rel"];
    Object.keys(CF_FIELD).forEach(function (x) { if (qReq(x) && r.indexOf(CF_FIELD[x]) < 0) r.push(CF_FIELD[x]); });
    return r;
  }
  function paintReq() {
    $$(".req-mark").forEach(function (x) { x.remove(); });
    $$("[aria-required]").forEach(function (x) { if (!x.classList.contains("tick")) x.removeAttribute("aria-required"); });
    reqFields().forEach(function (id) {
      var f = document.getElementById(id); if (!f) return;
      $$("label:not(.cc-wrap):not(.sub), .label", f).forEach(function (l) { var s = document.createElement("span"); s.className = "req req-mark"; s.setAttribute("aria-hidden", "true"); s.textContent = "*"; l.appendChild(s); });
      $$("input:not([type=hidden]), select, [role=radiogroup]", f).forEach(function (c) { if (!c.classList.contains("cc")) c.setAttribute("aria-required", "true"); });
    });
  }
  function setLang(code, save) {
    // a language the page does not carry yet (the website's page): its file first
    var P = window.MM_FORM_PACKS;
    if (code !== "en" && !T[code] && P && P.files && P.files[code]) {
      fetch(P.dir + P.files[code]).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) { applyPack(p); if (!T[code]) T[code] = {}; setLang(code, save); }, function () { T[code] = {}; setLang(code, save); });
      return;
    }
    lang = code;
    html.lang = code; html.dir = rtl() ? "rtl" : "ltr";
    if (save) { try { localStorage.setItem(LANG_KEY, code); } catch (e) {} }
    if ($("#lang")) $("#lang").value = code;
    paint();
  }
  function paint() {
    $$("[data-t]").forEach(function (el) { var a = el.getAttribute("data-args"); el.textContent = tr(el.getAttribute("data-t"), a ? JSON.parse(a) : null); });
    $$("[data-t-placeholder]").forEach(function (el) { el.placeholder = tr(el.getAttribute("data-t-placeholder")); });
    $$("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", tr(el.getAttribute("data-t-aria"))); });
    $$("[data-site]").forEach(function (el) { el.textContent = site(el.getAttribute("data-site")); });
    $$("[data-site-aria]").forEach(function (el) { el.setAttribute("aria-label", site(el.getAttribute("data-site-aria"))); });
    $$("[data-site-placeholder]").forEach(function (el) { el.placeholder = site(el.getAttribute("data-site-placeholder")); });
    $$("#signin-link2, #banner-signin, #si-temp-a").forEach(function (a) { a.href = signInUrl() + (a.id === "signin-link2" ? "&auth=forgot" : ""); }); // signin-link2 is Forgot password (no Google or Apple sign-in, 2026-11-09)
    if (TRACK_D) trackPaint(); else if (!$("#track-seen").hidden) paintSeen();
    $("#member-go").href = BOOKING_URL + "?lang=" + lang;
    $("#book-link").href = BOOKING_URL + "?lang=" + lang;
    $("#ack-lbl").innerHTML = ackLabel(site("privacyAckOpt"), "pv-open");
    $("#xack-lbl").innerHTML = ackLabel(site("privacyAckOpt"), "pv-open-x");
    $("#gack-lbl").innerHTML = ackLabel(tr("I am their parent or legal guardian, I agree to this application, and I have read the {0}"), "pv-open-g");
    natBuild(); buildCc(); buildHeard(); buildEm(); paintWa(); spPaint(); paintEyes();
    paintQuestions(); paintReq();
    $$(".field").forEach(function (f) { paintField(f.id); });
    $$(".flag").forEach(function (x) { x.textContent = tr("Please check"); });
    if (!$("#pv").hidden) renderNotice();
    if (sent) showSuccess(sent, true);
    if (bannerKey) showBanner(bannerKey, bannerSignIn);
    paintChrome();
    if (screen === "check") paintCheck();
    refreshSummary();
  }
  // "I have read the {Privacy Notice}", the notice a button that opens it; the tick box itself stands beside the words.
  function ackLabel(text, id) { return esc(text).replace("{0}", '<button type="button" class="pv-link" id="' + id + '">' + esc(site("privacyNotice")) + "</button>"); }
  (function buildLangs() {
    var sel = $("#lang"); if (!sel) return; // on the website the site's own picker is the one
    sel.innerHTML = SH.LANGS.map(function (l) { return '<option value="' + l.code + '">' + esc(l.label) + "</option>"; }).join("");
    sel.addEventListener("change", function () { setLang(sel.value, true); try { var u = new URL(location.href); u.searchParams.set("lang", sel.value); history.replaceState(null, "", u); } catch (e) {} });
  })();

  /* ── Nationality: type to search (the owner's B13, 2026-11-10: 197 countries in a dropdown were slow). Every
     country, labelled in the reader's language, found by that name, its English and Arabic names, its two-letter
     code and the usual other names ("KSA", "Saudi", "Filipino", "سعودي"). Saudi Arabia is first and again in its
     alphabetical place (the owner, 2026-10-05); Israel is in no list (2026-09-21). The value stored is the English
     name, as before. ───────────────────────────────────────────────────────────── */
  var NAT_CODE = {}; SH.NATIONALITIES.forEach(function (x) { NAT_CODE[x[1]] = x[0]; });
  var NAT_SYN = {
    SA: "ksa saudi saudia سعودي", AE: "uae emirates emirati اماراتي", GB: "uk britain british england english scotland wales بريطاني",
    US: "usa us america american امريكي", EG: "egyptian مصري", IN: "indian هندي", PK: "pakistani باكستاني", PH: "filipino filipina pinoy فلبيني",
    BD: "bangladeshi بنغلاديشي", SD: "sudanese سوداني", YE: "yemeni يمني", SY: "syrian سوري", JO: "jordanian اردني", LB: "lebanese لبناني",
    PS: "palestinian فلسطيني", MA: "moroccan مغربي", TN: "tunisian تونسي", DZ: "algerian جزائري", IQ: "iraqi عراقي", KW: "kuwaiti كويتي",
    BH: "bahraini بحريني", QA: "qatari قطري", OM: "omani عماني", LY: "libyan ليبي", MR: "mauritanian موريتاني", ID: "indonesian اندونيسي",
    NP: "nepali nepalese نيبالي", LK: "sri lankan سريلانكي", ET: "ethiopian اثيوبي", ER: "eritrean ارتيري", SO: "somali صومالي", NG: "nigerian",
    KE: "kenyan", TR: "turkish turkiye تركي", IR: "iranian persian ايراني", AF: "afghan افغاني", DE: "german deutschland", FR: "french",
    ES: "spanish", IT: "italian", CA: "canadian", AU: "australian", MY: "malaysian", CN: "chinese", JP: "japanese", RU: "russian",
    BR: "brazilian", KR: "korean", NL: "dutch holland", TD: "chadian تشادي"
  };
  var dn = {};
  function regionName(isoCode, fallback) {
    try {
      if (!(lang in dn)) dn[lang] = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames([lang], { type: "region", fallback: "none" }) : null;
      return (dn[lang] && dn[lang].of(isoCode)) || fallback;
    } catch (e) { return fallback; }
  }
  function natLabel(name) {
    if (!name) return "";
    if (lang === "en") return name;
    if (lang === "ar" && SH.COUNTRY_AR[name]) return SH.COUNTRY_AR[name];
    return NAT_CODE[name] ? regionName(NAT_CODE[name], name) : name; // no data for the language (Chromium has no Nepali): English
  }
  // Text as the search compares it: lower case, no Latin accents or Arabic vowel marks, one form of alef, ya and ta marbuta.
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ًͯ-ٰٟ]/g, "").normalize("NFC").toLowerCase()
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  var NAT = { items: [], byName: {}, shown: [], active: -1 };
  function natBuild() {
    NAT.items = SH.NATIONALITIES.map(function (x) {
      var name = x[1], code = x[0], label = natLabel(name);
      return { name: name, label: label, n: norm(label), keys: [norm(label), norm(name), norm(SH.COUNTRY_AR[name] || ""), code.toLowerCase()].concat(norm(NAT_SYN[code] || "").split(" ")).filter(Boolean) };
    });
    try { NAT.items.sort(function (a, b) { return a.label.localeCompare(b.label, lang); }); } catch (e) {}
    NAT.byName = {}; NAT.items.forEach(function (it) { NAT.byName[it.name] = it; });
    var v = $("#nat").value; if (v && NAT.byName[v]) $("#nat-q").value = NAT.byName[v].label;
    if (!$("#nat-list").hidden) natRender($("#nat-q").value === (NAT.byName[v] || {}).label ? "" : $("#nat-q").value);
  }
  function natMatches(q) {
    q = norm(q);
    var saudi = NAT.byName["Saudi Arabia"];
    if (!q) return (saudi ? [saudi, null] : []).concat(NAT.items); // null: the line between Saudi Arabia and the rest
    var out = [];
    NAT.items.forEach(function (it) {
      var s = 9;
      if (it.n.indexOf(q) === 0) s = 0;
      else it.keys.forEach(function (x) {
        if (x === q) s = Math.min(s, 1);
        else if (x.indexOf(q) === 0) s = Math.min(s, 2);
        else if (x.split(" ").some(function (w) { return w.indexOf(q) === 0; })) s = Math.min(s, 3);
        else if (q.length >= 3 && x.indexOf(q) >= 0) s = Math.min(s, 4);
      });
      if (s < 9) out.push({ it: it, s: s });
    });
    out.sort(function (a, b) { return a.s - b.s || a.it.label.localeCompare(b.it.label, lang); });
    return out.map(function (o) { return o.it; });
  }
  function natRender(q) {
    var list = $("#nat-list");
    NAT.shown = natMatches(q); NAT.active = -1;
    var i = 0;
    list.innerHTML = NAT.shown.length ? NAT.shown.map(function (it) {
      if (!it) return '<li class="combo-sep" role="presentation"></li>';
      var id = "nat-o-" + (i++);
      return '<li role="option" id="' + id + '" data-name="' + esc(it.name) + '" aria-selected="false">' + esc(it.label) + "</li>";
    }).join("") : '<li class="combo-none" role="presentation">' + esc(tr("No country matches")) + "</li>";
    NAT.shown = NAT.shown.filter(Boolean);
    natOpen(true);
  }
  function natOpen(on) { $("#nat-list").hidden = !on; $("#nat-q").setAttribute("aria-expanded", String(on)); if (!on) $("#nat-q").removeAttribute("aria-activedescendant"); }
  function natMove(d) {
    var opts = $$("#nat-list li[role=option]"); if (!opts.length) return;
    NAT.active = (NAT.active + d + opts.length) % opts.length;
    opts.forEach(function (o, i) { o.setAttribute("aria-selected", String(i === NAT.active)); });
    $("#nat-q").setAttribute("aria-activedescendant", opts[NAT.active].id);
    opts[NAT.active].scrollIntoView({ block: "nearest" });
  }
  function natPick(name, quiet) {
    var it = NAT.byName[name]; if (!it) return;
    $("#nat").value = it.name; $("#nat-q").value = it.label;
    natOpen(false); clearMsg("f-nat");
    if (!quiet) { touched["nat-q"] = 1; draftSave(); }
  }
  $("#nat-q").addEventListener("focus", function () { natRender(this.value && $("#nat").value && NAT.byName[$("#nat").value] && this.value === NAT.byName[$("#nat").value].label ? "" : this.value); });
  $("#nat-q").addEventListener("click", function () { if ($("#nat-list").hidden) natRender(""); });
  $("#nat-q").addEventListener("input", function () {
    var cur = NAT.byName[$("#nat").value];
    if (!cur || this.value !== cur.label) $("#nat").value = "";
    natRender(this.value); clearMsg("f-nat");
  });
  $("#nat-q").addEventListener("keydown", function (e) {
    var open = !$("#nat-list").hidden;
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) natRender(this.value); natMove(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (open) natMove(-1); }
    else if (e.key === "Enter") { if (open) { e.preventDefault(); var o = $$("#nat-list li[role=option]")[NAT.active < 0 ? 0 : NAT.active]; if (o && (NAT.active >= 0 || NAT.shown.length === 1 || norm(this.value))) natPick(o.getAttribute("data-name")); } }
    else if (e.key === "Escape") { if (open) { e.preventDefault(); natOpen(false); } }
  });
  // A press on the list keeps the box's focus, so the choice lands before the box is left.
  $("#nat-list").addEventListener("mousedown", function (e) { e.preventDefault(); });
  $("#nat-list").addEventListener("click", function (e) { var o = e.target.closest("li[role=option]"); if (o) natPick(o.getAttribute("data-name")); });
  $("#nat-q").addEventListener("blur", function () {
    natOpen(false);
    if ($("#nat").value) { $("#nat-q").value = NAT.byName[$("#nat").value].label; return; }
    var q = norm(this.value); if (!q) return;
    var m = natMatches(this.value), exact = m.filter(function (it) { return it.keys.indexOf(q) >= 0; });
    if (exact.length === 1) natPick(exact[0].name); else if (m.length === 1) natPick(m[0].name);
    else blurCheck("f-nat");
  });

  /* ── How they heard of us: the booking site's answers (customers.heard_from's codes), in its words ── */
  function buildHeard() {
    var sel = $("#heard"), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(tr("Choose one")) + "</option>" +
      SH.HEARD_OPTS.map(function (c) { return '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + esc(site("heard_" + c)) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  $("#heard").addEventListener("change", function () { this.classList.toggle("ph", !this.value); clearMsg("f-heard"); });

  /* ── Date of birth: day, month and year typed in three boxes (the owner's B12: a 95-year list was slow), the
     site's rule (never in the future, nobody five or younger) in Riyadh's calendar day. Arabic, Persian, Hindi and
     Bengali digits count as typed. ──────────────────────────────────────────────────────────── */
  // Riyadh is UTC+3 all year, so its day is plain arithmetic, not Intl's "en-CA" layout: an iPhone on
  // iOS 17.2 laid that out as 10/27/2026, which left the Year list empty and refused every send (2026-10-27).
  function todayKsa() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
  function dobMax() { var p = todayKsa().split("-"); return (+p[0] - 5) + "-" + p[1] + "-" + p[2]; }
  // "" when nothing is typed, "bad" for a date that is not one, else YYYY-MM-DD.
  function birthValue() {
    var d = $("#birth-d").value.trim(), m = $("#birth-m").value.trim(), y = $("#birth-y").value.trim();
    if (!d && !m && !y) return "";
    if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return "bad";
    var dt = new Date(Date.UTC(+y, +m - 1, +d));
    if (+y < 1900 || dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return "bad";
    return y + "-" + String(+m).padStart(2, "0") + "-" + String(+d).padStart(2, "0");
  }
  function setBirth(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return;
    var p = isoDate.split("-"); $("#birth-d").value = String(+p[2]); $("#birth-m").value = String(+p[1]); $("#birth-y").value = p[0];
  }
  ["#birth-d", "#birth-m", "#birth-y"].forEach(function (s) {
    $(s).addEventListener("input", function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, +this.maxLength || 4); if (v !== this.value) this.value = v; clearMsg("f-birth"); paintMinor(); });
  });
  function ageAt(isoDate) {
    var p = isoDate.split("-").map(Number), t = todayKsa().split("-").map(Number);
    var a = t[0] - p[0]; if (t[1] < p[1] || (t[1] === p[1] && t[2] < p[2])) a--; return a;
  }
  function dayText(v, weekday) {
    var d = /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? new Date(v + "T12:00:00Z") : new Date(v);
    if (isNaN(d)) return "";
    var o = { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }; if (weekday) o.weekday = "long";
    try { return d.toLocaleDateString(locale(), o); } catch (e) { return d.toISOString().slice(0, 10); } // Gregorian, Latin digits where the site uses them
  }

  /* ── Phone: country code + number, E.164 out, Google's libphonenumber mobile patterns (the
     same rules file the staff check reads). ──────────────────────────────────────────── */
  var RULES = SH.PHONE_RULES, reCache = {};
  var CC_DIGITS = {}; SH.COUNTRY_CODES.forEach(function (x) { CC_DIGITS[x[0].slice(1)] = true; });
  function ccName(x) {
    if (lang === "en") return x[2];
    if (x[1] === "US") return regionName("US", "USA") + " / " + regionName("CA", "Canada"); // +1 is both
    if (lang === "ar" && SH.COUNTRY_AR[x[2]]) return SH.COUNTRY_AR[x[2]];
    return regionName(x[1], x[2]);
  }
  // The pickers: the closed box shows the code alone (no flags: the owner's no-emoji rule, and Windows draws them as
  // letters), over a see-through native select whose list names every country in the reader's language, the Gulf
  // first and Saudi Arabia again in its alphabetical place (the owner, 2026-10-05). Each option is its country AND code
  // ("PS+970", "PS+972"): Palestine answers on two codes, and a value of the country alone made +972 land on +970.
  var PK = { sel: "#cc", code: "#cc-code", input: "#phone" };
  var WPK = { sel: "#wacc", code: "#wacc-code", input: "#wa" };
  var GPK = { sel: "#gcc", code: "#gcc-code", input: "#gphone" };
  function ccOptions(cur) {
    var gulf = SH.COUNTRY_CODES.slice(0, 6), rest = SH.COUNTRY_CODES.slice(6).concat(SH.COUNTRY_CODES.filter(function (x) { return x[1] === "SA"; })).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, lang); }); } catch (e) {}
    var on = selOnce(cur);
    return gulf.map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest).map(function (o) { var v = o.x[1] + o.x[0]; return '<option value="' + v + '" data-cc="' + o.x[0] + '"' + (on(v) ? " selected" : "") + ">" + esc(o.n) + " (" + o.x[0] + ")</option>"; }).join("");
  }
  function selOnce(cur) { var done = false; return function (v) { if (done || v !== cur) return false; return (done = true); }; }
  function buildCc() { [PK, WPK, GPK].forEach(function (pk) { var sel = $(pk.sel), cur = sel.value || "SA+966"; sel.innerHTML = ccOptions(cur); if (!sel.value) sel.value = "SA+966"; ccFace(pk); }); }
  function ccFace(pk) {
    pk = pk || PK;
    var o = $(pk.sel).selectedOptions[0]; if (!o) return;
    $(pk.code).textContent = o.getAttribute("data-cc");
    $(pk.input).placeholder = o.getAttribute("data-cc") === "+966" ? "5X XXX XXXX" : "";
  }
  function ccDigits(pk) { var o = $((pk || PK).sel).selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function setCcDigits(d, pk) { pk = pk || PK; var o = $$(pk.sel + " option").filter(function (x) { return x.getAttribute("data-cc") === "+" + d; })[0]; if (o) { $(pk.sel).value = o.value; ccFace(pk); } }
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
  // A number grouped for reading: 5X XXX XXXX for a Saudi mobile without its 0, else 3 3 and the rest.
  function groupNat(ccd, d) {
    var g = ccd === "966" && d[0] === "5" ? [2, 5] : [3, 6];
    return d.length > g[1] ? d.slice(0, g[0]) + " " + d.slice(g[0], g[1]) + " " + d.slice(g[1]) : d.length > g[0] ? d.slice(0, g[0]) + " " + d.slice(g[0]) : d;
  }
  function onPhoneInput(pk) {
    pk = pk || PK;
    var el = $(pk.input), raw = toAscii(el.value).trim(), d = raw.replace(/\D/g, "");
    var ccd = ccDigits(pk), intl = raw[0] === "+" || d.slice(0, 2) === "00", plus = false;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (intl) {
      if (d.indexOf(ccd) !== 0) { var x = ccOf(d); if (x) { setCcDigits(x, pk); ccd = x; } }
      if (d.indexOf(ccd) === 0) d = d.slice(ccd.length); else plus = true;
    } else if (ccIncluded(d, ccd)) d = d.slice(ccd.length);
    el.value = (plus ? "+" : "") + groupNat(ccd, d.slice(0, 15));
  }
  function e164(pk) { pk = pk || PK; return toE164(ccDigits(pk), $(pk.input).value); }
  // A number typed under the dial code `ccd` (its digits), as the database stores it: the rider's
  // mobile, their WhatsApp number, the emergency contacts and a parent or guardian alike.
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
  // +966551234567 as people read it: +966 55 123 4567.
  function fmtPhone(e) { var d = String(e || "").replace(/\D/g, ""), c = callingCode(d); return c ? "+" + c + " " + groupNat(c, d.slice(c.length)) : String(e || ""); }
  $("#phone").addEventListener("input", function () { onPhoneInput(); clearMsg("f-phone"); paintWa(); });
  $("#cc").addEventListener("change", function () {
    ccFace(); clearMsg("f-phone"); paintWa();
    // the other numbers start from the applicant's own country code until someone changes them
    [WPK, GPK].forEach(function (pk) { if (!$(pk.input).value && !touched[pk.sel.slice(1)]) { $(pk.sel).value = $("#cc").value; ccFace(pk); } });
    EM_PRE.forEach(function (p) { if (!$("#" + p + "-phone").value && !touched[p + "-cc"]) { $("#" + p + "-cc").value = $("#cc").value; emCcFace(p); } });
  });
  // A mobile number's problems, for the mobile and the WhatsApp number alike: {hard} or {soft} or {}.
  function checkMobile(raw, p, wa) {
    var d = p.replace(/\D/g, "");
    if (!raw) return wa ? { hard: [k("Enter your WhatsApp number")] } : { hard: [k("Enter your mobile number")] };
    if (d.indexOf("966") === 0) {
      var nat = d.slice(3);
      if (!/^5\d{8}$/.test(nat) || !mobileOk("966", nat)) return { hard: [k("Enter a valid Saudi mobile number (5XXXXXXXX)")] };
    } else {
      var cc = callingCode(d);
      if (!cc || d.length < 8 || d.length > 15) return { hard: [k("Enter a valid mobile number")] };
      if (!mobileOk(cc, d.slice(cc.length))) return { hard: [k("This is not a mobile number for +{c}. Please check it."), { c: cc }] };
    }
    var tail = d.slice(-9);
    if (/(\d)\1{5,}/.test(tail) || /0123456|1234567|2345678|3456789|9876543|8765432/.test(tail)) return { soft: [k("Please check this number: it does not look like a real one.")] };
    return {};
  }

  /* ── WhatsApp: is the mobile their WhatsApp number too, or which number is (the owner, 2026-10-07).
     Asked under the mobile on step 1; an applicant handed over signed in skips step 1, so it moves to
     step 2 for them, naming the account's mobile. Sent as whatsapp_same (+ whatsapp). ── */
  var waSame = null, waStep = 1;
  function waPhone() { return waStep === 2 ? (acct && acct.phone) || "" : ($("#phone").value.replace(/\D/g, "") ? e164() : ""); }
  function paintWa() {
    var p = waPhone();
    $("#wa-label").textContent = p ? tr("Is {phone} your WhatsApp number too?", { phone: iso(fmtPhone(p)) }) : tr("Is this mobile number your WhatsApp number too?");
    if ($("#wa-label .req-mark") == null && reqFields().indexOf("f-wa") >= 0) { var s = document.createElement("span"); s.className = "req req-mark"; s.setAttribute("aria-hidden", "true"); s.textContent = "*"; $("#wa-label").appendChild(s); }
  }
  function vWa(H, S) {
    if (waSame === null) { H["f-wa"] = [k("Tell us whether this is your WhatsApp number")]; return; }
    if (waSame) return;
    var r = checkMobile($("#wa").value.replace(/\D/g, ""), e164(WPK), true);
    if (r.hard) H["f-wanum"] = r.hard; else if (r.soft) S["f-wanum"] = r.soft;
  }
  $("#wa").addEventListener("input", function () { onPhoneInput(WPK); clearMsg("f-wanum"); });
  $("#wacc").addEventListener("change", function () { ccFace(WPK); clearMsg("f-wanum"); });

  /* ── The emergency contact (the owner, 2026-10-07: "make the emergency contact obligatory only the
     first one not the second and unskippable for all the customers"): someone to call if the rider
     needs help at an event, as the booking site asks it (_emRead, _emFieldsHtml) and in its words.
     The first is required on the account step (saved the moment the account exists) and, for an
     account handed over without one, on step 2; a second may be added, behind "Add a second contact":
     all three boxes or none. The database's rules (customer_set_emergency / customer_set_emergency2):
     a name of 2 to 80 letters, spaces and periods, every part two letters or more; a number of 8 to
     15 digits; one of the eight relations; never the rider's own number ('em_self', the last nine
     digits) nor the other contact's ('em_same'). ─────────────────────────────────────────────── */
  var EM_RELS = SH.EM_RELS || ["spouse", "parent", "sibling", "child", "relative", "friend", "colleague", "other"];
  var CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
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
  // pre "em" (the account step) or "xem" (step 2); its second contact is pre + "2". The screen's title names it.
  function emBlock(pre, hidden) {
    return '<div id="' + pre + '-block" class="em-block"' + (hidden ? " hidden" : "") + '>' + emFields(pre) +
      '<button type="button" id="' + pre + '2-add" class="em-add">' + PLUS + '<span data-site="em2Add"></span></button>' +
      '<div id="' + pre + '2-box" class="em2" hidden><p class="em-h" data-site="em2Title"></p>' + emFields(pre + "2") + '</div></div>';
  }
  $("#em-slot").outerHTML = emBlock("em", false);
  $("#xem-slot").outerHTML = emBlock("xem", false);
  var EM_PRE = ["em", "em2", "xem", "xem2"];
  function emCcDigits(p) { var o = $("#" + p + "-cc").selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function emCcFace(p) { $("#" + p + "-cc-code").textContent = "+" + emCcDigits(p); $("#" + p + "-phone").placeholder = emCcDigits(p) === "966" ? "5X XXX XXXX" : ""; }
  function buildEmRel(p) {
    var sel = $("#" + p + "-rel"), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(site("emPick")) + "</option>" + EM_RELS.map(function (c) { return '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + esc(site("emRel_" + c)) + "</option>"; }).join("");
    sel.classList.toggle("ph", !sel.value);
  }
  function buildEm() { EM_PRE.forEach(function (p) { var sel = $("#" + p + "-cc"), cur = sel.value || "SA+966"; sel.innerHTML = ccOptions(cur); if (!sel.value) sel.value = "SA+966"; emCcFace(p); buildEmRel(p); }); }
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
  var EM_FIELDS = function (pre) { return ["name", "phone", "rel"].map(function (x) { return "f-" + pre + "-" + x; }).concat(["name", "phone", "rel"].map(function (x) { return "f-" + pre + "2-" + x; })); };
  function last9(v) { return String(v || "").replace(/\D/g, "").slice(-9); }
  // One contact as typed: {name, phone, rel}; null for a second one left wholly empty; or {errs: [[field id, the
  // site's message key], ...]}, every problem of the contact at once.
  function emRead(p, own, other, optional) {
    var raw = toAscii($("#" + p + "-phone").value).replace(/[^\d+]/g, ""); // Arabic or Hindi digits count as typed
    var n = clean($("#" + p + "-name").value.replace(DASHES, " ")), rel = $("#" + p + "-rel").value;
    if (optional && !n && !raw && !rel) return null;
    var errs = [], nm = nameDots(n);
    if (Array.from(nm).length < 2 || Array.from(nm).length > 80) errs.push(["f-" + p + "-name", "errEmName"]);
    else if (NAME_BAD.test(n) || n !== nm || !/\p{L}/u.test(nm)) errs.push(["f-" + p + "-name", "errNameChars"]);
    else if (nm.split(/[\s.]+/).some(function (w) { return w && Array.from(w).length < 2; })) errs.push(["f-" + p + "-name", "errNameShort"]);
    var ph = toAscii($("#" + p + "-phone").value).trim() ? toE164(emCcDigits(p), $("#" + p + "-phone").value) : "";
    if (!/^\+?[0-9]{8,15}$/.test(ph)) errs.push(["f-" + p + "-phone", "errEmPhone"]);
    else if (last9(own).length === 9 && last9(ph) === last9(own)) errs.push(["f-" + p + "-phone", "errEmSelf"]);
    else if (last9(other).length === 9 && last9(ph) === last9(other)) errs.push(["f-" + p + "-phone", "errEmSame"]);
    if (EM_RELS.indexOf(rel) < 0) errs.push(["f-" + p + "-rel", "errEmRelation"]);
    return errs.length ? { errs: errs } : { name: nm, phone: ph, rel: rel };
  }
  // Both contacts of a block checked into H (the screen's problems); what to save, or null.
  function emCheck(pre, own, H) {
    var one = emRead(pre, own, "", false), two = null;
    if (one.errs) one.errs.forEach(function (x) { H[x[0]] = [x[1], null, true]; });
    if (!$("#" + pre + "2-box").hidden) {
      two = emRead(pre + "2", own, one.errs ? "" : one.phone, true);
      if (two && two.errs) two.errs.forEach(function (x) { H[x[0]] = [x[1], null, true]; });
    }
    return one.errs || (two && two.errs) ? null : { one: one, two: two };
  }
  function absent(e) { return !!e && (e.code === "PGRST202" || /could not find the function/i.test(String(e.message || ""))); }
  // The database's refusal of a contact, as the field and the site's message ("em_self" ...).
  var EM_DETAIL = { em_name: ["name", "errEmName"], em_phone: ["phone", "errEmPhone"], em_relation: ["rel", "errEmRelation"], em_self: ["phone", "errEmSelf"], em_same: ["phone", "errEmSame"], em_required: ["name", "errEmName"] };
  // Saves a block's contacts on the signed-in account: {ok:true}, or {field, key} for a refused box, or
  // {banner, signIn} for the rest. A database without the functions lets the rider through (as the
  // booking site does): customer_set_emergency missing skips both, customer_set_emergency2 missing the second.
  async function emSave(pre) {
    var h = {}, c = emCheck(pre, acct.phone, h);
    if (!c) { var x = Object.keys(h)[0]; return { field: x, key: h[x][0] }; }
    var steps = [["customer_set_emergency", c.one, pre]];
    if (c.two) steps.push(["customer_set_emergency2", c.two, pre + "2"]);
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i][1];
      var r = await rpc(steps[i][0], { p_id: acct.id, p_token: acct.token, p_name: s.name, p_phone: s.phone, p_relation: s.rel });
      if (r.error) {
        if (absent(r.error)) { if (i === 0) return { ok: true }; continue; }
        var d = EM_DETAIL[String(r.error.details || "")];
        if (d) return { field: "f-" + steps[i][2] + "-" + d[0], key: d[1] };
        if (/RATE_LIMITED/.test(String(r.error.message || ""))) return { banner: SITE_TOO_MANY };
        return { banner: k("Could not reach the server. Please try again.") };
      }
      if (r.data === false) return { banner: k("You were signed out. Sign in again to send your application."), signIn: true };
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
    if (at.length !== 2 || !at[0] || !/^[a-z0-9._%+'-]+$/.test(at[0]) || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(at[1]) || em.length > 254) return { hard: [k("Enter a valid email address")] };
    var dom = at[1], labels = dom.split("."), tld = labels[labels.length - 1], root = labels[0];
    if (/(^|\.)privaterelay\.appleid\.com$/.test(dom)) return { hard: [k("Please use your own email address, not an Apple hidden (relay) address")] };
    if (FAKE_DOMAINS.indexOf(dom) >= 0 || /^(test|asdf|qwerty|abc|x{2,}|none|null|noemail|nomail|na|no)\d*$/.test(at[0])) return { hard: [k("Please use your own, permanent email address")] };
    var fix = null;
    if (PROVIDERS.indexOf(root) >= 0) {
      if (COM_ONLY.indexOf(root) >= 0 && dom !== root + ".com") fix = root + ".com";
      else if (TLD_TYPO.indexOf(tld) >= 0 || (tld === "co" && labels.length === 2)) fix = root + ".com";
    } else if (REAL_NEAR.indexOf(root) < 0) {
      var p = PROVIDERS.filter(function (x) { return dist(root, x) <= (x.length >= 6 ? 2 : 1) || (root.indexOf(x) >= 0 && root.length <= x.length + 4); })[0];
      if (p) fix = p + "." + ((COM_ONLY.indexOf(p) >= 0 || TLD_TYPO.indexOf(tld) >= 0) ? "com" : labels.slice(1).join("."));
    }
    if (!fix && TLD_TYPO.indexOf(tld) >= 0) fix = labels.slice(0, -1).join(".") + ".com";
    if (fix && fix !== dom) return { hard: [k("Did you mean {s}?"), { s: at[0] + "@" + fix }], fix: at[0] + "@" + fix };
    if (tld.length === 2 && !CCTLD[tld]) return { soft: [k("Please check the ending of your email address ({t})."), { t: "." + tld }] };
    return {};
  }
  function paintEmailFix() {
    var b = $("#email-fix"); b.hidden = !emailFix;
    if (emailFix) b.textContent = tr("Use {s}", { s: emailFix });
  }
  $("#email-fix").addEventListener("click", function () { if (!emailFix) return; $("#email").value = emailFix; emailFix = null; clearMsg("f-email"); $("#email").focus(); });
  $("#email").addEventListener("input", function () { emailFix = null; clearMsg("f-email"); });

  /* ── Name: the staff check's rules, as errors for the rider ─────────────────────────── */
  // Letters of any script and their marks, spaces and periods ("Md. Rahman"): the database's own
  // rule (_name_chars_ok), so a symbol is refused here rather than by the server. A dash is not a
  // name character there either: one typed becomes a space, as on the booking site. A period comes
  // right after a letter; one that would start the name or a word, or follow another, is dropped.
  var NAME_BAD = /[^\p{L}\p{M}\s.]/u;
  var DASHES = /[-‐-―−]/g;
  function nameDots(v) { return v.replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1"); }
  function titleCase(v) { return clean(v).replace(/(^|[\s\-'’.])(\p{L})/gu, function (m, sep, ch) { return sep + ch.toLocaleUpperCase(); }); }
  function checkName(s) {
    if (!s) return { hard: [k("Enter your first and last name")] };
    if (NAME_BAD.test(s) || /(^|[\s.])\./.test(s)) return { hard: [k("Names can only contain letters, spaces and periods.")] };
    var letters = s.replace(/[ً-ٰٟ]/g, "");
    if (/[A-Za-z]/.test(letters) && /[؀-ۿ]/.test(letters)) return { hard: [k("Write your name in one alphabet")] };
    var parts = letters.replace(/[^\p{L}\p{M}\s'’.-]/gu, " ").split(/\s+/).filter(function (p) { return p.replace(/[.'’\p{M}-]/gu, ""); });
    var bare = function (p) { return p.replace(/[.'’-]/g, ""); };
    var cjk = parts.length === 1 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(parts[0]);
    if (parts.length < 2 && !cjk) return { hard: [k("Enter your first and last name")] };
    // Every word has at least two letters, the middle one too (the site's rule since 2026-09-25). A
    // period ends a word as a space does: "J.R." is two initials, "Md." a word.
    if (parts.length > 1 && parts.some(function (p) { return p.split(".").some(function (w) { w = bare(w); return w && Array.from(w).length < 2; }); })) return { hard: [k("Write your first and last name in full, not initials")] };
    if (parts.some(function (p) { return /^(test|asdf|qwerty|user|admin|none|null|name|x{2,}|abc|unknown|other|guest)$/i.test(bare(p)); })) return { hard: [k("Please enter your real name")] };
    if (/(\p{L})\1\1/iu.test(letters)) return { soft: [k("Please check the spelling of your name.")] };
    return {};
  }
  // As the rider types, anything outside the rule is dropped on the spot (the site does the same): a dash turns
  // into a space and a stray period just goes, quietly; any other sign says why.
  function nameInput(fieldId) {
    return function () {
      var el = this, raw = el.value, v = raw.replace(DASHES, " "), x = v.replace(/[^\p{L}\p{M}\s.]/gu, ""), c = nameDots(x);
      if (c !== raw) { var at = Math.max(0, (el.selectionStart == null ? c.length : el.selectionStart) - (raw.length - c.length)); el.value = c; try { el.setSelectionRange(at, at); } catch (e) {} }
      if (x !== v) { setErr(fieldId, k("Names can only contain letters, spaces and periods.")); return; }
      clearMsg(fieldId);
    };
  }
  $("#first").addEventListener("input", nameInput("f-name"));
  $("#last").addEventListener("input", nameInput("f-name"));
  $("#gname").addEventListener("input", nameInput("f-gname"));
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
  // A pasted profile link or an @handle reads as the handle as soon as the box is left.
  $("#ig").addEventListener("input", function () { clearMsg("f-ig"); });
  $("#ig").addEventListener("change", function () { var v = igNorm(this.value); if (v && v !== this.value) this.value = v; });
  $("#li").addEventListener("input", function () { clearMsg("f-li"); });
  $("#prof").addEventListener("input", function () { clearMsg("f-prof"); });
  $("#work").addEventListener("input", function () { clearMsg("f-work"); });
  // LinkedIn behind "Add LinkedIn" (the owner's D7): shown at once when the admins made it required or it has an answer.
  var liOpen = false;
  function liPaint() {
    var f = $("#f-li"), skipped = f.hasAttribute("data-skipped");
    var show = qOn("linkedin") && (qReq("linkedin") || liOpen || !!$("#li").value.trim());
    if (!skipped) f.hidden = !show;
    $("#li-add").hidden = skipped || show || !qOn("linkedin");
  }
  $("#li-add").addEventListener("click", function () { liOpen = true; liPaint(); $("#li").focus(); paintChrome(); });
  function heightInput(id) { return function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, 3); if (v !== this.value) this.value = v; clearMsg(id); }; }
  $("#height").addEventListener("input", heightInput("f-height"));
  $("#xheight").addEventListener("input", heightInput("f-xheight"));

  /* ── Password: 8 or more characters and not one of the common ones (the owner's B10, 2026-11-10: NIST advises
     against the old upper-case-and-digit rule, and the password is the box people give up on most), typed once with
     a show/hide eye. The list is the database's own (_pwd_common, migration 20261111130000). ───────────── */
  var PWD_COMMON = ["password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword", "pa$$word",
    "12345678", "123456789", "1234567890", "0123456789", "87654321", "987654321", "9876543210", "12344321", "12341234",
    "11223344", "12121212", "11112222", "13579246", "147258369", "159753456", "741852963", "123123123", "123456123",
    "00000000", "11111111", "12345612", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "q1w2e3r4", "q1w2e3r4t5", "zaq12wsx",
    "qwerty12", "qwerty123", "qwerty1234", "qwertyui", "qwertyuiop", "qwer1234", "1234qwer", "asdf1234", "asdfghjk",
    "asdfghjkl", "zxcvbnm1", "zxcvbnmm", "abc12345", "abcd1234", "abcdefgh", "abcdefg1", "a1234567", "a12345678",
    "aa123456", "123456aa", "123456ab", "123qweasd", "1234abcd", "iloveyou", "iloveyou1", "iloveyou2", "letmein1",
    "welcome1", "welcome123", "sunshine", "sunshine1", "princess", "princess1", "football", "football1", "baseball",
    "superman", "starwars", "trustno1", "monkey123", "dragon123", "master123", "admin123", "administrator", "changeme",
    "secret123", "computer", "internet", "whatever", "mustang1", "shadow123", "michael1", "jennifer", "liverpool",
    "chelsea1", "arsenal1", "barcelona", "realmadrid", "alhilal1", "alnassr1", "alittihad", "alahli123", "ronaldo7",
    "cristiano", "messi123", "mohammed", "mohammed1", "mohamed1", "muhammad", "muhammad1", "ahmed123", "ahmad123",
    "abdullah", "abdullah1", "saudi123", "saudiarabia", "ksa12345", "jeddah123", "riyadh123", "makkah123", "966966966",
    "micromobility", "micromobility1", "micromobility123", "bicycle1", "cycling1", "bike1234", "helloworld",
    "hello123", "test1234", "testtest", "guest123", "user1234"];
  function pwdBad(p) {
    if (Array.from(p).length < 8) return "len";
    if (/^([\s\S])\1*$/u.test(p) || PWD_COMMON.indexOf(p.toLowerCase()) >= 0) return "common";
    return "";
  }
  $("#pwd").addEventListener("input", function () { clearMsg("f-pwd"); });
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7c1.6 0 3 .4 4.2 1M22 12s-3.6 7-10 7c-1.6 0-3-.4-4.2-1"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>';
  function paintEyes() { $$(".pw-eye").forEach(function (b) { var on = b.getAttribute("aria-pressed") === "true"; b.innerHTML = on ? EYE_OFF : EYE; b.setAttribute("aria-label", on ? tr("Hide password") : tr("Show password")); }); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".pw-eye"); if (!b) return;
    var i = document.getElementById(b.getAttribute("aria-controls")), on = i.type === "password";
    i.type = on ? "text" : "password"; b.setAttribute("aria-pressed", String(on)); paintEyes();
  });

  /* ── Tiles and tick boxes ───────────────────────────────────────────────── */
  var gender = null, xgender = null, bikeType = null, grel = null, ack = false, xack = false, gack = false, news = false;
  // A group of tiles is one radio group: one Tab stop (the picked tile, or the first), the arrow keys move and pick.
  function tiles(groupSel, fieldId, onPick) {
    var g = $(groupSel);
    function rove() { var b = $$(".tile", g), on = b.filter(function (x) { return x.getAttribute("aria-checked") === "true"; })[0] || b[0]; b.forEach(function (x) { x.tabIndex = x === on ? 0 : -1; }); }
    g.addEventListener("click", function (e) {
      var b = e.target.closest(".tile"); if (!b) return;
      $$(".tile", g).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      rove(); onPick(b.getAttribute("data-v")); clearMsg(fieldId);
    });
    g.addEventListener("keydown", function (e) {
      var keys = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl() ? -1 : 1, ArrowLeft: rtl() ? 1 : -1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      var b = $$(".tile", g), i = b.indexOf(document.activeElement), n = b[(i + keys[e.key] + b.length) % b.length];
      n.focus(); n.click();
    });
    g.rove = rove; rove();
  }
  function tileSet(groupSel, v) { var g = $(groupSel); $$(".tile", g).forEach(function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-v") === v)); }); if (g.rove) g.rove(); }
  tiles("#genders", "f-gender", function (v) { gender = v; });
  tiles("#xgenders", "f-xgender", function (v) { xgender = v; });
  tiles("#types", "f-type", function (v) { bikeType = v; });
  tiles("#grels", "f-grel", function (v) { grel = v; });
  tiles("#was", "f-wa", function (v) {
    waSame = v === "yes";
    $("#f-wanum").hidden = waSame;
    // the rider's own No opens the number box for typing; a saved answer put back on arrival does not
    if (waSame) clearMsg("f-wanum"); else if (!prefilling) $("#wa").focus({ preventScroll: true });
  });
  // A tick box beside its words: the row toggles it (its Privacy Notice link opens the notice instead).
  function tick(id, get, set) {
    var el = document.getElementById(id), row = el.closest(".tick-row");
    function toggle() { set(!get()); el.setAttribute("aria-checked", String(get())); clearMsg("f-" + id); }
    row.addEventListener("click", function (e) { if (e.target.closest(".pv-link")) return; toggle(); if (e.target !== el) el.focus({ preventScroll: true }); });
    el.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
  }
  tick("ack", function () { return ack; }, function (v) { ack = v; });
  tick("xack", function () { return xack; }, function (v) { xack = v; });
  tick("gack", function () { return gack; }, function (v) { gack = v; });
  tick("news", function () { return news; }, function (v) { news = v; });

  /* ── Whether they compete in a sport (the booking app's question of 2026-11-10, forced on Community members:
     asked here so a new member never meets it as a pop-up at their first booking, the owner's D8). The website's
     words and lists (Sport.words.ts, lib/sport.ts; SPORT_DATA from the build): Yes or No, after a yes what they
     compete in as chips and a list that adds one more (the user's ten groups, the sports staff added, Other on
     its own line), and Other opens a box for their own. Saved on the account (customer_set_sport) before the
     application goes. A database without the functions asks nothing. ─────────────────────────────── */
  var sp = { competes: null, feds: [], other: "" }, spAdded = [], SPORT_ON = !!SPD, spHeld = false;
  function spW() { return (SPD && (SPD.words[lang] || SPD.words.en)) || {}; }
  function spName(code) {
    if (code === "other") return spW().other || "Other";
    for (var i = 0; SPD && i < SPD.groups.length; i++) { var f = SPD.groups[i][2].filter(function (x) { return x[0] === code; })[0]; if (f) return lang === "ar" ? f[2] : f[1]; }
    var o = spAdded.filter(function (x) { return x.code === code; })[0];
    return o ? (lang === "ar" && o.ar) || o.en : code;
  }
  function spCodes() { var a = []; (SPD ? SPD.groups : []).forEach(function (g) { g[2].forEach(function (f) { a.push(f[0]); }); }); return a.concat(spAdded.map(function (o) { return o.code; }), ["other"]); }
  function spClean(feds) { var on = {}; feds.forEach(function (c) { on[c] = 1; }); return spCodes().filter(function (c) { return on[c]; }); }
  function spPaint() {
    if (!SPD) { $("#f-sport").hidden = true; return; }
    var w = spW();
    // the words once a language (setting them again would take off the red star paintReq puts after them)
    if ($("#sport-label").getAttribute("data-l") !== lang) {
      $("#sport-label").textContent = w.ask; $("#sport-yes").textContent = w.yes; $("#sport-no").textContent = w.no;
      $("#sp-feds-lbl").textContent = w.fedsLabel; $("#sp-other-lbl").textContent = w.otherLabel;
      $("#sport-label").setAttribute("data-l", lang); paintReq();
    }
    tileSet("#sports", sp.competes === true ? "yes" : sp.competes === false ? "no" : "");
    var skipped = $("#f-sport").hasAttribute("data-skipped");
    if (!skipped) $("#f-sport").hidden = !SPORT_ON;
    $("#f-spfeds").hidden = skipped || !SPORT_ON || sp.competes !== true;
    $("#f-spother").hidden = skipped || !SPORT_ON || sp.competes !== true || sp.feds.indexOf("other") < 0;
    $("#sp-chips").innerHTML = sp.feds.map(function (c) {
      return '<li class="chip"><span>' + esc(spName(c)) + '</span><button type="button" class="chip-x" data-code="' + esc(c) + '" aria-label="' + esc(fill(w.remove || "Remove {0}", { 0: spName(c) })) + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>';
    }).join("");
    var on = {}; sp.feds.forEach(function (c) { on[c] = 1; });
    var opts = '<option value="">' + esc(w.add) + "</option>";
    SPD.groups.forEach(function (g) {
      var left = g[2].filter(function (f) { return !on[f[0]]; });
      if (left.length) opts += '<optgroup label="' + esc(lang === "ar" ? g[1] : g[0]) + '">' + left.map(function (f) { return '<option value="' + f[0] + '">' + esc(lang === "ar" ? f[2] : f[1]) + "</option>"; }).join("") + "</optgroup>";
    });
    var addedLeft = spAdded.filter(function (o) { return !on[o.code]; });
    if (addedLeft.length) opts += '<optgroup label="' + esc(w.added) + '">' + addedLeft.map(function (o) { return '<option value="' + esc(o.code) + '">' + esc(spName(o.code)) + "</option>"; }).join("") + "</optgroup>";
    if (!on.other) opts += '<option value="other">' + esc(w.other) + "</option>";
    $("#sp-add").innerHTML = opts; $("#sp-add").value = ""; $("#sp-add").classList.add("ph");
  }
  tiles("#sports", "f-sport", function (v) {
    sp.competes = v === "yes"; if (!sp.competes) { sp.feds = []; sp.other = ""; $("#sp-other").value = ""; }
    clearMsg("f-spfeds"); clearMsg("f-spother"); spPaint();
  });
  $("#sp-add").addEventListener("change", function () {
    var c = this.value; if (!c) return;
    sp.feds = spClean(sp.feds.concat([c])); clearMsg("f-spfeds"); spPaint();
    if (c === "other") $("#sp-other").focus(); else $("#sp-add").focus();
    touched["sp"] = 1; draftSave();
  });
  $("#sp-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip-x"); if (!b) return;
    var c = b.getAttribute("data-code"); sp.feds = sp.feds.filter(function (x) { return x !== c; });
    if (c === "other") { sp.other = ""; $("#sp-other").value = ""; }
    spPaint(); $("#sp-add").focus(); touched["sp"] = 1; draftSave();
  });
  $("#sp-other").addEventListener("input", function () { sp.other = this.value; clearMsg("f-spother"); });
  function spOtherClean(v) { var s = String(v || "").trim().replace(/\s+/g, " "), n = Array.from(s).length; return n >= 2 && n <= 60 && !/[<>"`{}\\]/.test(s) ? s : null; }
  function vSport(H) {
    if (sp.competes === null) { H["f-sport"] = ["errPick", null, "sp"]; return; }
    if (!sp.competes) return;
    if (!sp.feds.length) H["f-spfeds"] = ["errFeds", null, "sp"];
    else if (sp.feds.indexOf("other") >= 0 && !spOtherClean(sp.other)) H["f-spother"] = ["errOther", null, "sp"];
  }
  function spRefusal(e) {
    var d = String((e && e.details) || ""), m = String((e && e.message) || "");
    var c = /^sport(_feds|_other)?$/.test(d) ? d : ((/\bsport(_feds|_other)?\b/.exec(m) || [])[0] || "");
    return c === "sport" ? "f-sport" : c === "sport_feds" ? "f-spfeds" : c === "sport_other" ? "f-spother" : null;
  }
  async function spLoadOptions() {
    if (!SPD) return;
    var r = await rpc("sport_option_list", {});
    if (r.error && absent(r.error)) { SPORT_ON = false; spPaint(); paintChrome(); return; }
    spAdded = Array.isArray(r.data) ? r.data.filter(function (o) { return o && /^x_[a-z0-9_]{1,40}$/.test(o.code || "") && typeof o.name_en === "string" && o.name_en.trim(); })
      .map(function (o) { return { code: o.code, en: o.name_en.trim(), ar: typeof o.name_ar === "string" && o.name_ar.trim() ? o.name_ar.trim() : null }; }) : [];
    spPaint();
  }

  /* ── A parent or guardian, for an applicant under 18 (the owner's B23, 2026-11-10: Saudi Arabia's data law
     asks a guardian's consent for a minor). Shown on the birth date's screen once the date says under 18; an
     emergency contact who is a parent fills it in to start with. ────────────────────────────── */
  function minorNow() { var b = birthValue(); return /^\d{4}/.test(b) && b <= todayKsa() && b <= dobMax() && ageAt(b) < 18; }
  function paintMinor() {
    var on = minorNow(), was = !$("#g-block").hidden;
    $("#g-block").hidden = !on;
    if (on && !was && !$("#gname").value && $("#em-rel").value === "parent" && $("#em-name").value) {
      $("#gname").value = clean($("#em-name").value);
      $("#gcc").value = $("#em-cc").value; ccFace(GPK); $("#gphone").value = $("#em-phone").value; onPhoneInput(GPK);
      grel = "parent"; tileSet("#grels", "parent");
    }
  }
  $("#gphone").addEventListener("input", function () { onPhoneInput(GPK); clearMsg("f-gphone"); });
  $("#gcc").addEventListener("change", function () { ccFace(GPK); clearMsg("f-gphone"); });
  function vGuardian(H) {
    if (!minorNow()) return;
    var n = clean($("#gname").value.replace(DASHES, " "));
    if (!n || n.split(" ").length < 2) H["f-gname"] = [k("Enter their full name")];
    else if (NAME_BAD.test(n) || /(^|[\s.])\./.test(n)) H["f-gname"] = [k("Names can only contain letters, spaces and periods.")];
    else if (n.split(/[\s.]+/).some(function (w) { return w && Array.from(w).length < 2; })) H["f-gname"] = [k("Write their full name, not initials")];
    if (!grel) H["f-grel"] = [k("Choose how they are related to you")];
    if (!/^\+[0-9]{8,15}$/.test(e164(GPK))) H["f-gphone"] = [k("Enter their mobile number")];
    if (!gack) H["f-gack"] = [k("Their confirmation is needed. Ask them to tick this box.")];
  }

  /* ── Privacy Notice: a centred dialog on every screen ─────────────────── */
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
  document.addEventListener("click", function (e) { if (e.target.closest("#pv-open, #pv-open-x, #pv-open-g, #pv-open-foot")) { e.preventDefault(); e.stopPropagation(); openNotice(); } });
  $("#pv-x").addEventListener("click", closeNotice);
  $("#pv").addEventListener("click", function (e) { if (e.target === this) closeNotice(); });
  document.addEventListener("keydown", function (e) {
    if ($("#pv").hidden) return;
    if (e.key === "Escape") { closeNotice(); return; }
    // Tab stays inside the open notice (aria-modal): from the last link back to Close, and the other way
    if (e.key === "Tab") {
      var els = $$("button, a[href]", $("#pv .pv-box")), first = els[0], last = els[els.length - 1];
      if (!first) return;
      if (!$("#pv .pv-box").contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── Banner: the server's answers that belong to no question ──────────── */
  var bannerKey = null, bannerSignIn = false;
  function showBanner(key, signIn) {
    bannerKey = key; bannerSignIn = !!signIn;
    $("#banner .banner-text").textContent = key.indexOf("site:") === 0 ? site(key.slice(5)) : tr(key);
    $("#banner-signin").hidden = !signIn; $("#banner").hidden = false;
    var c = $("#card"); if (c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: "start" });
  }
  function hideBanner() { bannerKey = null; bannerSignIn = false; $("#banner").hidden = true; }
  function signInUrl() { return BOOKING_URL + "?handoff=community&lang=" + lang; }
  $("#banner .banner-close").addEventListener("click", hideBanner);
  var SITE_TOO_MANY = "site:errTooManyTries"; // the sign-up page's own words

  /* ── Screens ────────────────────────────────────────────────────────────── */
  var STEP1 = ["about", "reach", "emergency", "password"], STEP2 = ["birth", "riding", "work", "xem", "check"];
  var SCREEN_STEP = { gate: 0, about: 1, reach: 1, emergency: 1, password: 1, birth: 2, riding: 2, work: 2, xem: 2, check: 2 };
  var screen = "gate", step = 0, backToCheck = false, busy = false, sent = null;
  var acct = null; // the signed-in applicant: {id, token, name, email, phone, made, needGender, needHeight, needEm, needAck}
  // A signed-in account's flagged questions (customer_community_me's flags) and what it holds for them, in
  // MMAccount.same's names (customer_community_me's, the emergency contacts as {name, phone, relation}).
  var fixed = [], held = {}, noEm2 = false;
  function scrEl(id) { return $('.screen[data-screen="' + id + '"]'); }
  function screenOf(fieldId) { var f = document.getElementById(fieldId), s = f && f.closest(".screen"); return s ? s.getAttribute("data-screen") : null; }
  // A question this path asks: nothing between it and its screen is hidden, except an answer the account holds
  // (data-skipped: hidden, still sent from its box, and checked like any other).
  function asked(el) { for (var n = el; n && !n.classList.contains("screen"); n = n.parentElement) if (n.hidden && !n.hasAttribute("data-skipped")) return false; return true; }
  function shown(el) { for (var n = el; n && !n.classList.contains("screen"); n = n.parentElement) if (n.hidden) return false; return true; }
  function screenFields(s) { return $$(".field", scrEl(s)).filter(function (f) { return f.id && asked(f); }).map(function (f) { return f.id; }); }
  function wanted(s) {
    if (s === "xem") return !!(acct && acct.needEm);
    if (s === "check") return true;
    if (s === "birth" && minorNow()) return true;
    return $$(".field", scrEl(s)).some(function (f) { return shown(f); });
  }
  // The screens of this path, in order: an account made here counts its four account screens as done.
  function flowAll() { var two = STEP2.filter(wanted); return acct && !acct.made ? two : STEP1.concat(two); }
  function titleOf(s) {
    switch (s) {
      case "gate": return tr("Join the MicroMobility community");
      case "about": return tr("About you");
      case "reach": return tr("How we reach you");
      case "emergency": case "xem": return site("emTitle");
      case "password": return tr("Create a password");
      case "birth": return birthAbout() ? tr("About you") : tr("Birth date and nationality");
      case "riding": return tr("Your riding");
      case "work": return tr("Work and socials");
      default: return tr("Check your answers");
    }
  }
  function birthAbout() { return ["f-xgender", "f-xheight", "f-wa"].some(function (id) { var f = document.getElementById(id); return f && f.closest('[data-screen="birth"]') && shown(f); }); }
  function goScreen(id, o) {
    o = o || {};
    screen = id; step = SCREEN_STEP[id];
    $$("fieldset.step").forEach(function (f) { f.hidden = +f.getAttribute("data-step") !== step; });
    $$(".screen").forEach(function (s) { s.hidden = s.getAttribute("data-screen") !== id; });
    if (id !== "gate") $("#track-seen").hidden = true;
    hideSummary();
    if (id === "birth") paintMinor();
    if (id === "check") paintCheck();
    paintChrome();
    var c = $("#card"); if (!o.keepScroll && c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: "start" });
    if (!o.noFocus) { var h = $(".screen-title, .title", scrEl(id)); if (h) h.focus({ preventScroll: true }); }
    ev("screen", { screen: id }); evFlush();
    if (!o.noDraft) draftSave();
  }
  // The progress bar, the buttons and the page's title for the screen on show.
  function paintChrome() {
    var f = flowAll(), i = f.indexOf(screen), gate = screen === "gate";
    $("#progress").hidden = gate || i < 0; $("#actions").hidden = gate;
    if (!gate && i >= 0) {
      $("#prog-bar").innerHTML = f.map(function (s, j) { return '<li class="' + (j < i ? "done" : j === i ? "now" : "") + '"></li>'; }).join("");
      $("#prog-txt").textContent = tr("Step {n} of {total}", { n: i + 1, total: f.length }) + ": " + titleOf(screen);
    }
    var two = f.filter(function (s) { return SCREEN_STEP[s] === 2; });
    // No way back from the first membership screen: the account exists by then (going back would make a second).
    $("#back").hidden = gate || (step === 2 && screen === two[0]);
    var last = screen === "password" ? [site("authSignupBtn"), tr("Creating your account...")] : screen === "check" ? [tr("Send application"), tr("Sending...")]
      : screen === "reach" && !acct ? [tr("Continue"), tr("Checking...")] : [tr("Continue"), tr("Loading...")];
    $("#next-label").textContent = last[0]; $("#next-busy").textContent = last[1];
    $("#birth-title").textContent = titleOf("birth");
    // what the account step left: said once, on the first membership screen
    var first2 = step === 2 && screen === two[0];
    $("#acct-made").hidden = !(first2 && acct && acct.made);
    $("#acct-pending").hidden = !(first2 && acct && acct.pending);
    $("#acct-skip").hidden = !(first2 && $$("[data-skipped]").length);
    document.title = (errsumOn ? tr("Error:") + " " : "") + titleOf(screen) + " | " + tr("Community membership") + " | MicroMobility";
  }
  $("#back").addEventListener("click", function () {
    if (busy) return;
    hideBanner(); backToCheck = false;
    var f = flowAll(), i = f.indexOf(screen);
    if (screen === "about" || i <= 0) { goScreen("gate"); return; }
    goScreen(f[i - 1]);
  });

  /* ── Checking answers: as each box is left, and every question of the screen on Continue ── */
  // [the questions a check answers for, the check]; H and S gather hard and soft problems: {field: [key, args, from]}.
  var VALID = [
    [["f-name"], function (H, S) { var n = nameParts(); if (!n.first || !n.last) { H["f-name"] = [k("Enter your first and last name")]; return; } var r = checkName(n.first + " " + n.last); if (r.hard) H["f-name"] = r.hard; else if (r.soft) S["f-name"] = r.soft; }],
    [["f-gender"], function (H) { if (!gender) H["f-gender"] = [k("Choose your gender")]; }],
    [["f-height"], function (H, S) { var h = parseInt(toAscii($("#height").value), 10); if (!(h >= 100 && h <= 250)) H["f-height"] = [k("Enter your height in cm (100 to 250)")]; else if (h < 140 || h > 209) S["f-height"] = [k("Is {n} cm right?"), { n: h }]; }],
    [["f-phone"], function (H, S) { var r = checkMobile($("#phone").value.replace(/\D/g, ""), e164(), false); if (r.hard) H["f-phone"] = r.hard; else if (r.soft) S["f-phone"] = r.soft; }],
    [["f-wa", "f-wanum"], vWa],
    [["f-email"], function (H, S) {
      var em = clean($("#email").value).toLowerCase(); emailFix = null;
      if (!em) { H["f-email"] = [k("Enter your email address")]; return; }
      var r = checkEmail(em); if (r.hard) { H["f-email"] = r.hard; emailFix = r.fix || null; } else if (r.soft) S["f-email"] = r.soft;
    }],
    [EM_FIELDS("em"), function (H) { emCheck("em", e164(), H); }],
    [["f-pwd"], function (H) { var b = pwdBad($("#pwd").value); if (b) H["f-pwd"] = [b === "len" ? k("Use at least 8 characters.") : k("This password is too easy to guess. Choose another.")]; }],
    [["f-ack"], function (H) { if (!ack) H["f-ack"] = ["privacyAckRequired", null, true]; }],
    [["f-xgender"], function (H) { if (!xgender) H["f-xgender"] = [k("Choose your gender")]; }],
    [["f-xheight"], function (H) { var h = parseInt(toAscii($("#xheight").value), 10); if (!(h >= 100 && h <= 250)) H["f-xheight"] = [k("Enter your height in cm (100 to 250)")]; }],
    [["f-birth"], function (H, S) {
      if (!qOn("birth_date")) return;
      var b = birthValue();
      if (!b) { if (qReq("birth_date")) H["f-birth"] = [k("Enter your date of birth")]; }
      else if (b === "bad") H["f-birth"] = [k("Enter a real date of birth")];
      else if (b > todayKsa()) H["f-birth"] = ["dobErrFuture", null, true];
      else if (b > dobMax()) H["f-birth"] = ["dobErrYoung", null, true];
      else if (ageAt(b) > 85) S["f-birth"] = [k("Please check your date of birth.")];
    }],
    [["f-nat"], function (H) { if (!$("#nat").value && qReq("nationality")) H["f-nat"] = [$("#nat-q").value.trim() ? k("Choose your nationality from the list") : k("Choose your nationality")]; }],
    [["f-gname", "f-grel", "f-gphone", "f-gack"], vGuardian],
    [["f-type"], function (H) { if (!bikeType && (qReq("bike_type") || qReq("own_bike"))) H["f-type"] = [k("Choose the bike you will ride")]; }],
    [["f-sport", "f-spfeds", "f-spother"], vSport],
    [["f-prof"], function (H) { var p = clean($("#prof").value); if (!p ? qReq("profession") : qOn("profession") && (p.length < 2 || p.length > 80 || !/\p{L}/u.test(p) || /[<>"`{}]/.test(p))) H["f-prof"] = [k("Enter your profession")]; }],
    // Their company (the owner, 2026-09-29; sent as workplace), checked as profession is, up to 120.
    [["f-work"], function (H) { var w = clean($("#work").value); if (!w ? qReq("workplace") : qOn("workplace") && (Array.from(w).length < 2 || Array.from(w).length > 120 || !/\p{L}/u.test(w) || /[<>"`{}]/.test(w))) H["f-work"] = [k("Enter your company")]; }],
    [["f-ig"], function (H) {
      var ig = igNorm($("#ig").value);
      if (!ig) { if (qReq("instagram")) H["f-ig"] = [k("Enter your Instagram username")]; }
      else if (qOn("instagram") && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) H["f-ig"] = [k("An Instagram username has only letters, numbers, dots and underscores")];
    }],
    [["f-li"], function (H) { var li = liNorm($("#li").value); if (!li ? qReq("linkedin") : qOn("linkedin") && (/\//.test(li) || !/^[A-Za-z0-9\-_.%]{3,100}$/.test(li))) H["f-li"] = [k("Paste the link to your own profile (linkedin.com/in/…)")]; }],
    [["f-heard"], function (H) { if (!$("#heard").value && qReq("heard_from")) H["f-heard"] = [k("Please tell us how you heard about us.")]; }],
    [EM_FIELDS("xem"), function (H) { emCheck("xem", acct ? acct.phone : "", H); }],
    [["f-xack"], function (H) { if (!xack) H["f-xack"] = ["privacyAckRequired", null, true]; }]
  ];
  function runChecks(ids) {
    var H = {}, S = {};
    VALID.forEach(function (v) { if (v[0].some(function (id) { return ids.indexOf(id) >= 0; })) v[1](H, S); });
    if (step === 2 && acct && !acct.made) sameAgain(H);
    Object.keys(H).forEach(function (id) { if (ids.indexOf(id) < 0) delete H[id]; });
    Object.keys(S).forEach(function (id) { if (ids.indexOf(id) < 0 || H[id]) delete S[id]; });
    return { hard: H, soft: S };
  }
  // A question staff flagged takes another answer than the one the account holds (the owner, 2026-11-09: "don't allow
  // a flagged account field to type in the same info in the field again"), as the booking app's check-up refuses it;
  // MMAccount.same is the rule. Said on the question once its answer passes the other checks.
  var SAME_FIELD = { birth_date: "f-birth", nationality: "f-nat", instagram: "f-ig", linkedin: "f-li", profession: "f-prof", workplace: "f-work",
    heard_from: "f-heard", height: "f-xheight", emergency: "f-xem-name", emergency2: "f-xem2-name", type_preference: "f-type" };
  function sameAgain(H) {
    var ans = {}, em = function (x) { return { name: x.name, phone: x.phone, relation: x.rel }; };
    ans.birth_date = qOn("birth_date") ? birthValue() : "";
    ans.nationality = qOn("nationality") ? $("#nat").value : "";
    ans.instagram = qOn("instagram") ? igNorm($("#ig").value) : "";
    ans.linkedin = qOn("linkedin") ? liNorm($("#li").value) : "";
    ans.profession = qOn("profession") ? clean($("#prof").value) : "";
    ans.workplace = qOn("workplace") ? clean($("#work").value) : "";
    ans.heard_from = qOn("heard_from") ? $("#heard").value : "";
    ans.type_preference = bikeOn() ? bikeType || "" : "";
    if (acct.needHeight) ans.height = String(parseInt(toAscii($("#xheight").value), 10));
    if (waStep === 2 && waSame !== null) ans.whatsapp = waSame ? { same: true } : { same: false, phone: e164(WPK) };
    if (acct.needEm) { var ec = emCheck("xem", acct.phone, {}); if (ec && ec.one) ans.emergency = em(ec.one); if (ec && ec.two) ans.emergency2 = em(ec.two); }
    Object.keys(ans).forEach(function (x) {
      if (fixed.indexOf(x) < 0) return;
      var id = x === "whatsapp" ? (ans[x].same ? "f-wa" : "f-wanum") : SAME_FIELD[x];
      if (!H[id] && MMAccount.same(x, ans[x], held)) H[id] = [k("This is the same as what is on your account. Please correct it.")];
    });
  }
  var softSeen = {}; // field -> the soft problem the applicant has already been shown there
  function setMsgs(ids, r) {
    ids.forEach(function (id) { delete msgs[id]; });
    Object.keys(r.hard).forEach(function (id) { var h = r.hard[id]; msgs[id] = { err: { k: h[0], a: h[1], site: h[2] || false } }; });
    Object.keys(r.soft).forEach(function (id) { msgs[id] = { warn: { k: r.soft[id][0], a: r.soft[id][1] } }; });
    // an answer the account holds comes back into view when it does not pass
    Object.keys(r.hard).concat(Object.keys(r.soft)).forEach(function (id) { var el = document.getElementById(id); var sk = el && (el.hasAttribute("data-skipped") ? el : el.closest("[data-skipped]")); if (sk) { sk.hidden = false; sk.removeAttribute("data-skipped"); } });
    ids.forEach(paintField);
  }
  // True when the screen's questions pass; else every problem is shown, and summed up at the top.
  function passScreen(s) {
    var ids = screenFields(s), r = runChecks(ids);
    setMsgs(ids, r);
    var hk = Object.keys(r.hard);
    if (hk.length) {
      hk.forEach(function (id) { ev("error", { screen: s, field: evField(id), code: evCode(r.hard[id][0]) }); });
      showSummary(hk); evFlush(); return false;
    }
    var fresh = Object.keys(r.soft).filter(function (id) { return softSeen[id] !== JSON.stringify(r.soft[id]); });
    Object.keys(r.soft).forEach(function (id) { softSeen[id] = JSON.stringify(r.soft[id]); });
    if (fresh.length) { showSummary(fresh, true); return false; }
    hideSummary(); return true;
  }
  // Every screen in the list checked in turn; the first that does not pass is shown with its problems.
  function passScreens(list) {
    for (var i = 0; i < list.length; i++) {
      var s = list[i], r = runChecks(screenFields(s));
      if (Object.keys(r.hard).length || Object.keys(r.soft).some(function (id) { return softSeen[id] !== JSON.stringify(r.soft[id]); })) {
        if (s !== screen) goScreen(s, { noFocus: true, noDraft: true });
        passScreen(s); return false;
      }
    }
    return true;
  }
  // As a box is left: its own problem shown at once (an empty box waits for Continue).
  function hasValue(id) { var f = document.getElementById(id); return !!f && $$("input:not([type=hidden]), select", f).some(function (c) { return !c.classList.contains("cc") && c.value.trim(); }); }
  function blurCheck(id) {
    if (!hasValue(id) || busy) return;
    var r = runChecks([id]);
    delete msgs[id];
    if (r.hard[id]) msgs[id] = { err: { k: r.hard[id][0], a: r.hard[id][1], site: r.hard[id][2] || false } };
    else if (r.soft[id]) { msgs[id] = { warn: { k: r.soft[id][0], a: r.soft[id][1] } }; softSeen[id] = JSON.stringify(r.soft[id]); }
    paintField(id); refreshSummary();
  }
  $("#form").addEventListener("focusout", function (e) {
    var t = e.target; if (!t.matches || !t.matches("input:not([type=hidden]), select") || t.id === "nat-q" || t.classList.contains("cc")) return;
    var f = t.closest(".field"); if (!f || !f.id) return;
    setTimeout(function () { if (!f.contains(document.activeElement)) blurCheck(f.id); }, 0);
  });

  /* ── The summary of a refused Continue ───────────────────────────────────── */
  var errsumOn = false, sumIds = [], sumSoft = false, sumSignIn = null;
  function showSummary(ids, soft, signIn) {
    sumIds = ids.slice(); sumSoft = !!soft; sumSignIn = signIn || null; errsumOn = !soft;
    paintSummary();
    $("#errsum").hidden = false; paintChrome();
    $("#errsum").focus({ preventScroll: true });
    var c = $("#card"); if (c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: "start" });
  }
  function paintSummary() {
    $(".errsum-h").textContent = sumSoft ? tr("Please check") : tr("There is a problem");
    $("#errsum-list").innerHTML = sumIds.map(function (id) {
      var m = msgs[id]; if (!m) return "";
      var txt = m.err ? msgText(m.err) : tr(m.warn.k, m.warn.a);
      return '<li><a href="#' + id + '" data-f="' + id + '">' + esc(txt) + "</a></li>";
    }).join("") + (sumSoft ? '<li class="errsum-soft">' + esc(tr("If it is right, press Continue.")) + "</li>" : "") +
      (sumSignIn ? '<li><button type="button" class="pv-link" id="errsum-signin">' + esc(tr("Sign in instead")) + "</button></li>" : "");
  }
  function refreshSummary() {
    if ($("#errsum").hidden) return;
    sumIds = sumIds.filter(function (id) { return msgs[id] && (sumSoft ? msgs[id].warn : msgs[id].err); });
    if (!sumIds.length) { hideSummary(); return; }
    paintSummary();
  }
  function hideSummary() { var was = errsumOn; $("#errsum").hidden = true; sumIds = []; errsumOn = false; sumSignIn = null; if (was) paintChrome(); }
  $("#errsum").addEventListener("click", function (e) {
    var a = e.target.closest("a[data-f]");
    if (a) { e.preventDefault(); focusField(a.getAttribute("data-f")); return; }
    if (e.target.closest("#errsum-signin")) { var who = sumSignIn; hideSummary(); toLogin(who); }
  });
  function focusField(id) {
    var f = document.getElementById(id); if (!f) return;
    var el = $("input:not([type=hidden]), select, .tile[tabindex='0'], .tile, .tick", f);
    if (el) { el.focus({ preventScroll: true }); f.scrollIntoView({ block: "center" }); }
  }
  // A problem the server found, said on its question and in the summary, its screen brought up if it is another.
  function showFieldError(id, key, a, from, signIn) {
    var s = screenOf(id); if (s && s !== screen) goScreen(s, { noFocus: true, noDraft: true });
    var el = document.getElementById(id), sk = el && (el.hasAttribute("data-skipped") ? el : el.closest("[data-skipped]")); if (sk) { sk.hidden = false; sk.removeAttribute("data-skipped"); }
    setErr(id, key, a, from); showSummary([id], false, signIn);
    ev("error", { screen: s || screen, field: evField(id), code: evCode(key) }); evFlush();
  }
  // The bar at the foot of the card never hides the box being typed in (WCAG 2.4.11).
  $("#form").addEventListener("focusin", function (e) {
    var f = e.target.closest && e.target.closest(".field"); if (f && f.id) lastField = f.id;
    if ($("#actions").hidden || e.target.closest("#actions")) return;
    setTimeout(function () {
      var r = e.target.getBoundingClientRect(), bar = $("#actions").getBoundingClientRect(), vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      var limit = Math.min(bar.top, vh) - 12;
      if (r.bottom > limit && r.top > 0) window.scrollBy({ top: r.bottom - limit, behavior: "smooth" });
    }, 60);
  });

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

  /* ── Forward: Continue, Create account, Send application ─────────────────── */
  $("#form").addEventListener("submit", function (e) { e.preventDefault(); if (screen === "gate") { if (!$("#login-box").hidden) doLogin(); return; } forward(); });
  async function forward() {
    if (busy) return;
    hideBanner();
    if (step === 1 && consentsPending()) { retryConsents(); return; }
    if (!passScreen(screen)) return;
    if (screen === "reach" && !acct && !(await takenCheck())) return;
    if (screen === "password") { if (!passScreens(STEP1)) return; ev("done", { screen: screen }); createAccount(); return; }
    if (screen === "check") { if (!passScreens(flowAll().filter(function (s) { return SCREEN_STEP[s] === 2; }))) return; ev("done", { screen: screen }); send(); return; }
    ev("done", { screen: screen });
    var f = flowAll(), nx = backToCheck ? "check" : f[f.indexOf(screen) + 1];
    backToCheck = false;
    goScreen(nx || "check");
  }
  // Leaving "How we reach you": an email or mobile that already has an account is said there, with a way to sign in.
  async function takenCheck() {
    var email = clean($("#email").value).toLowerCase(), phone = e164();
    setLoading("#next", true);
    try {
      var ex = await rpc("customer_exists", { p_email: email, p_phone: "" });
      if (ex.data === true) { showFieldError("f-email", k("An account with this email already exists. Sign in to apply with it."), null, false, email); return false; }
      ex = await rpc("customer_exists", { p_email: "", p_phone: phone });
      if (ex.data === true) { showFieldError("f-phone", k("An account with this mobile number already exists. Sign in to apply with it."), null, false, phone); return false; }
      return true; // the lookups not answering: Create account asks again
    } finally { setLoading("#next", false); }
  }

  /* ── Step 1: the account ────────────────────────────────────────────────── */
  async function createAccount() {
    var email = clean($("#email").value).toLowerCase(), phone = e164(), name = fullName();
    setLoading("#next", true);
    try {
      // Each on its own, so the message says which one is taken (as the sign-up page does).
      var ex = await rpc("customer_exists", { p_email: email, p_phone: "" });
      if (ex.data === true) { showFieldError("f-email", k("An account with this email already exists. Sign in to apply with it."), null, false, email); return; }
      ex = await rpc("customer_exists", { p_email: "", p_phone: phone });
      if (ex.data === true) { showFieldError("f-phone", k("An account with this mobile number already exists. Sign in to apply with it."), null, false, phone); return; }
      var id = uid();
      var r = await rpc("customer_signup", {
        p_id: id, p_name: name, p_email: email, p_phone: phone, p_pwd: $("#pwd").value,
        p_height: parseInt(toAscii($("#height").value), 10), p_type_preference: "Any", p_gender: gender
      });
      if (r.error) { signupRefused(r.error); return; }
      var tok = r.data && r.data[0] && r.data[0].session_token;
      if (!tok) { showBanner(k("Could not reach the server. Please try again.")); return; }
      acct = { id: id, token: tok, name: name, email: email, phone: phone, made: true, needGender: false, needHeight: false, consented: false, news: news };
      $("#pwd").value = "";
      ev("made");
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
    if (c.error) { showBanner(k("Could not reach the server. Please try again.")); return; }
    acct.consented = true;
    // Then the emergency contact typed on this step. Should it not save, the account stays made:
    // step 2 asks for it again, with what was typed and why, and saves it before the application.
    var e = await emSave("em");
    if (!e.ok) emCarry();
    enterStepTwo(null);
    // the refusal waits on its question, on the contact's own screen after Work and socials (jumping there first skipped
    // the membership screens in between)
    if (!e.ok) { if (e.field) setErr(e.field.replace("f-em", "f-xem"), e.key, null, true); else showBanner(e.banner, e.signIn); }
  }
  // The account step's contacts, copied into step 2's boxes, which then ask for them.
  function emCarry() {
    acct.needEm = true;
    ["name", "cc", "phone", "rel"].forEach(function (x) { ["", "2"].forEach(function (n) { $("#xem" + n + "-" + x).value = $("#em" + n + "-" + x).value; }); });
    ["xem", "xem2"].forEach(function (p) { emCcFace(p); $("#" + p + "-rel").classList.toggle("ph", !$("#" + p + "-rel").value); });
    emOpen2("xem", !$("#em2-box").hidden);
  }
  async function retryConsents() { setLoading("#next", true); try { await saveConsents(); } finally { setLoading("#next", false); } }
  function consentsPending() { return !!(acct && acct.made && !acct.consented); }
  function signupRefused(e) {
    var m = String((e.code || "") + " " + (e.message || "") + " " + (e.details || "") + " " + (e.hint || ""));
    if (/name_chars/.test(m)) showFieldError("f-name", k("Names can only contain letters, spaces and periods."));
    else if (/name_short/.test(m)) showFieldError("f-name", k("Write your first and last name in full, not initials"));
    // customer_signup refuses a taken email and a taken mobile alike: the checks before it name which one, but they
    // answer "not taken" once the network's lookups run out, so here either can be the taken one.
    else if (/23505|DUPLICATE/i.test(m)) { setErr("f-phone", k("An account with this email or mobile number already exists. Sign in to apply with it.")); showFieldError("f-email", k("An account with this email or mobile number already exists. Sign in to apply with it."), null, false, clean($("#email").value)); }
    else if (/RATE_LIMITED/.test(m)) showBanner(SITE_TOO_MANY);
    // A database from before 2026-11-11 still asks for an upper-case letter and a digit; the new one refuses a common password.
    else if (/WEAK_PASSWORD/.test(m)) { var p = $("#pwd").value; showFieldError("f-pwd", !/[A-Z]/.test(p) || !/[0-9]/.test(p) ? k("Use at least 8 characters, with an upper-case letter and a number.") : k("This password is too easy to guess. Choose another.")); }
    else if (/BAD_INPUT/.test(m) && /phone/.test(m)) showFieldError("f-phone", k("Enter a valid mobile number"));
    else if (/BAD_INPUT/.test(m) && /height/.test(m)) showFieldError("f-height", k("Enter your height in cm (100 to 250)"));
    else showBanner(k("Could not reach the server. Please try again."));
  }

  /* ── Step 2: the community questions ────────────────────────────────────── */
  // The answers to start from: a waiting application's, else what the account already holds.
  var prefilling = false;
  function prefill(me) {
    if (!me) return;
    prefilling = true;
    try { prefillAll(me); } finally { prefilling = false; }
  }
  function prefillAll(me) {
    setBirth(me.birth_date);
    if (me.nationality && NAT.byName[me.nationality]) natPick(me.nationality, true);
    if (me.instagram) $("#ig").value = me.instagram;
    if (me.linkedin) { $("#li").value = me.linkedin; liPaint(); }
    if (me.profession) $("#prof").value = me.profession;
    if (me.workplace) $("#work").value = me.workplace;
    // One bike question: their own bike, or the bike type they ride (a type of "Any" is no answer).
    var bt = me.own_bike === true || me.bike_type === "Own" ? "Own" : ["Road", "Hybrid", "Mountain"].indexOf(me.bike_type) >= 0 ? me.bike_type : null;
    if (bt) { bikeType = bt; tileSet("#types", bt); }
    if (typeof me.whatsapp_same === "boolean") {
      var w = $('#was .tile[data-v="' + (me.whatsapp_same ? "yes" : "no") + '"]'); if (w) w.click();
      var wd = String(me.whatsapp || "").replace(/\D/g, ""), wk = ccOf(wd);
      if (!me.whatsapp_same && wk) { setCcDigits(wk, WPK); $("#wa").value = wd.slice(wk.length); onPhoneInput(WPK); }
    }
    if (me.heard_from && SH.HEARD_OPTS.indexOf(me.heard_from) >= 0) { $("#heard").value = me.heard_from; $("#heard").classList.remove("ph"); }
  }
  function enterStepTwo(me) {
    // Step 1 skipped (handed over signed in): the WhatsApp question goes to step 2, after what the account lacks.
    if (!acct.made && waStep === 1) {
      var at = $("#wa-slot2"); at.parentNode.insertBefore($("#f-wa"), at); at.parentNode.insertBefore($("#f-wanum"), at);
      waStep = 2;
    }
    paintWa();
    $("#f-xgender").hidden = !acct.needGender; $("#f-xheight").hidden = !acct.needHeight; $("#f-xack").hidden = !acct.needAck;
    $("#xem2-add").hidden = noEm2 || !$("#xem2-box").hidden;
    acct.pending = !!(me && me.pending);
    $("#acct-pending-a").hidden = !(me && me.pending && /^[0-9a-f]{48}$/.test(me.track || ""));
    if (me && me.track) $("#acct-pending-a").href = trackUrl(me.track);
    prefill(me); skipKnown(me);
    // A draft typed for another account (a shared phone or tablet) never fills this one's: it is dropped, with what of
    // it was still waiting, so the other person's answers are neither shown nor sent nor kept in this one's draft.
    if (DR && !draftMine(DR)) { clearTimeout(draftT); draftT = 0; DRAFT.clear(); DR = null; pend = null; $("#draft-note").hidden = true; }
    if (DR) draftPut(DR, 2); // what was typed here before wins over the account's answers, in the questions still asked
    paintReq();
    var two = flowAll().filter(function (s) { return SCREEN_STEP[s] === 2; });
    goScreen(two[0]);
  }
  // An account signed in (not one made here) is asked only what it does not hold yet, or what staff flagged
  // on it (customers.fix_fields, customer_community_me's 'flags'; the owner, 2026-10-25). What is skipped is
  // still sent from the prefilled boxes, named on the Check your answers screen, and comes back into view by
  // itself when its saved value does not pass the checks. A screen with nothing left to ask is not shown.
  // Which questions: MMAccount.plan (forms/shared/account.js), the rule every account form shares.
  var SKIP = [["f-wa", "whatsapp"], ["f-birth", "birth_date"], ["f-nat", "nationality"], ["f-ig", "instagram"], ["f-li", "linkedin"],
    ["f-prof", "profession"], ["f-work", "workplace"], ["f-type", "bike_type"], ["f-heard", "heard_from"]];
  function fieldLabel(id) { var l = $("#" + id + " label:not(.cc-wrap):not(.sub), #" + id + " .label"); return l ? clean(l.textContent.replace(/\*$/, "")) : ""; }
  function skipKnown(me) {
    $$("[data-skipped]").forEach(function (el) { el.removeAttribute("data-skipped"); el.hidden = false; });
    $$(".flag").forEach(function (el) { el.remove(); });
    if (!acct || acct.made || !me) { liPaint(); return; }
    var pl = MMAccount.plan(me, SKIP.map(function (x) { return x[1]; }));
    SKIP.forEach(function (x) {
      var el = $("#" + x[0]); if (!el || (el.hidden && x[0] !== "f-li")) return;
      if (pl.flagged.indexOf(x[1]) >= 0) { var l = $("label:not(.cc-wrap):not(.sub), .label", el); if (l) { var n = document.createElement("span"); n.className = "flag"; n.textContent = tr("Please check"); l.appendChild(n); } return; }
      if (pl.skip.indexOf(x[1]) < 0) return;
      if (Object.keys(runChecks([x[0]]).hard).length) return; // a saved answer that would not pass is asked again
      el.hidden = true; el.setAttribute("data-skipped", "");
      if (x[0] === "f-wa") { $("#f-wanum").hidden = true; $("#f-wanum").setAttribute("data-skipped", ""); }
    });
    // the sport question, answered on the account already and not flagged: not asked again
    if (spHeld && fixed.indexOf("sport") < 0 && !Object.keys(runChecks(["f-sport", "f-spfeds", "f-spother"]).hard).length) { $("#f-sport").hidden = true; $("#f-sport").setAttribute("data-skipped", ""); }
    liPaint(); spPaint();
  }
  $("#acct-skip-show").addEventListener("click", function () {
    $$("[data-skipped]").forEach(function (el) { el.removeAttribute("data-skipped"); if (el.id !== "f-wanum" || waSame === false) el.hidden = false; });
    liPaint(); spPaint(); paintChrome();
    var two = flowAll().filter(function (s) { return SCREEN_STEP[s] === 2; });
    goScreen(two[0]);
  });

  /* ── Check your answers: every answer this application sends, each with a way to change it ── */
  function tileText(groupSel, v) { var b = $(groupSel + ' .tile[data-v="' + v + '"]'); return b ? clean(b.textContent) : ""; }
  function paintCheck() {
    var rows = [];
    function row(label, value, id, ltr) { if (value) rows.push({ label: label, value: value, id: id, ltr: !!ltr }); }
    var asks = function (id) { var f = document.getElementById(id); return !!f && asked(f); };
    if (asks("f-xgender")) row(tr("Gender"), tileText("#xgenders", xgender), "f-xgender");
    if (asks("f-xheight")) row(tr("Height in cm"), $("#xheight").value, "f-xheight");
    if (waStep === 2 && asks("f-wa")) row(tr("WhatsApp number"), waSame === true ? fmtPhone(acct && acct.phone) : waSame === false ? fmtPhone(e164(WPK)) : "", "f-wa", true);
    var b = birthValue(); if (asks("f-birth") && /^\d/.test(b)) row(tr("Date of birth"), dayText(b), "f-birth");
    if (asks("f-nat")) row(tr("Nationality"), natLabel($("#nat").value), "f-nat");
    if (minorNow()) row(tr("A parent or guardian"), [clean($("#gname").value), tileText("#grels", grel), iso(fmtPhone(e164(GPK)))].filter(Boolean).join(" · "), "f-gname");
    if (asks("f-type")) row(tr("Which bike will you ride?"), tileText("#types", bikeType), "f-type");
    if (SPD && asks("f-sport")) row(spW().title || "Sport", sp.competes === false ? spW().no : sp.competes ? listJoin(sp.feds.map(function (c) { return c === "other" && spOtherClean(sp.other) ? spOtherClean(sp.other) : spName(c); })) : "", "f-sport");
    if (asks("f-prof")) row(tr("Profession"), clean($("#prof").value), "f-prof");
    if (asks("f-work")) row(tr("Company"), clean($("#work").value), "f-work");
    if (asks("f-ig")) row(tr("Instagram"), igNorm($("#ig").value) ? "@" + igNorm($("#ig").value) : "", "f-ig", true);
    if (asks("f-li")) row(tr("LinkedIn"), liNorm($("#li").value), "f-li", true);
    if (asks("f-heard") && $("#heard").value) row(site("heardLabel"), site("heard_" + $("#heard").value), "f-heard");
    if (acct && acct.needEm) { var ec = emCheck("xem", acct.phone, {}); if (ec) row(site("emTitle"), [ec.one.name, iso(fmtPhone(ec.one.phone))].join(" · "), "f-xem-name"); }
    var dl = $("#check-list"); dl.innerHTML = "";
    rows.forEach(function (r) {
      var d = document.createElement("div"); d.className = "ck-row";
      var dt = document.createElement("dt"); dt.textContent = r.label;
      var dd = document.createElement("dd"); if (r.ltr) { var bdi = document.createElement("bdi"); bdi.textContent = r.value; dd.appendChild(bdi); } else dd.textContent = r.value;
      var bt = document.createElement("button"); bt.type = "button"; bt.className = "ck-change"; bt.setAttribute("data-f", r.id);
      bt.textContent = tr("Change"); var vh = document.createElement("span"); vh.className = "vh"; vh.textContent = " " + r.label; bt.appendChild(vh);
      d.appendChild(dt); d.appendChild(dd); d.appendChild(bt); dl.appendChild(d);
    });
  }
  $("#check-list").addEventListener("click", function (e) {
    var b = e.target.closest(".ck-change"); if (!b) return;
    var id = b.getAttribute("data-f"), el = document.getElementById(id);
    var sk = el && (el.hasAttribute("data-skipped") ? el : el.closest("[data-skipped]")); if (sk) { sk.hidden = false; sk.removeAttribute("data-skipped"); if (id === "f-wa" && waSame === false) { $("#f-wanum").hidden = false; $("#f-wanum").removeAttribute("data-skipped"); } }
    backToCheck = true; goScreen(screenOf(id), { noFocus: true }); focusField(id);
  });

  /* ── Sending ───────────────────────────────────────────────────────────── */
  var FIELD_OF = { gender: ["f-xgender", k("Choose your gender")], height: ["f-xheight", k("Enter your height in cm (100 to 250)")], birth_date: ["f-birth", k("Enter your date of birth")], nationality: ["f-nat", k("Choose your nationality")], instagram: ["f-ig", k("An Instagram username has only letters, numbers, dots and underscores")], linkedin: ["f-li", k("Paste the link to your own profile (linkedin.com/in/…)")], profession: ["f-prof", k("Enter your profession")], workplace: ["f-work", k("Enter your company")], own_bike: ["f-type", k("Choose the bike you will ride")], bike_type: ["f-type", k("Choose the bike you will ride")], heard_from: ["f-heard", k("Please tell us how you heard about us.")] };
  async function send() {
    if (!acct) return;
    setLoading("#next", true);
    try {
      // An account without an emergency contact gives it here, saved before the application goes.
      if (acct.needEm) {
        var e = await emSave("xem");
        if (!e.ok) { if (e.field) showFieldError(e.field, e.key, null, true); else showBanner(e.banner, e.signIn); return; }
        acct.needEm = false; acct.emSaved = true;
      }
      // The sport answer is the account's own: saved first, so a refusal is said on its question.
      var spAsk = SPD && SPORT_ON && asked($("#f-sport")) && !$("#f-sport").hasAttribute("data-skipped");
      if (spAsk) {
        var other = sp.feds.indexOf("other") >= 0 ? spOtherClean(sp.other) : null;
        var sr = await rpc("customer_set_sport", { p_id: acct.id, p_token: acct.token, p_competes: sp.competes, p_federations: sp.competes ? spClean(sp.feds) : null, p_other: other });
        if (sr.error && !absent(sr.error)) {
          var which = spRefusal(sr.error);
          if (which) { showFieldError(which, which === "f-sport" ? "errPick" : which === "f-spfeds" ? "errFeds" : "errOther", null, "sp"); return; }
          if (/RATE_LIMITED/.test(String(sr.error.message || ""))) { showBanner(SITE_TOO_MANY); return; }
          showBanner(k("Could not reach the server. Please try again.")); return;
        }
        if (sr.data === false) { showBanner(k("You were signed out. Sign in again to send your application."), true); return; }
      }
      var own = bikeOn() && bikeType ? bikeType === "Own" : null;
      var payload = {
        birth_date: qOn("birth_date") ? birthValue() : "", nationality: $("#nat").value, bike_type: bikeType, own_bike: own, instagram: igNorm($("#ig").value), linkedin: liNorm($("#li").value),
        profession: clean($("#prof").value), workplace: clean($("#work").value), heard_from: $("#heard").value, lang: lang,
        whatsapp_same: waSame
      };
      // A question turned off is sent empty; their own bike, unanswered or turned off, is left out (the server takes no null).
      Object.keys(CF_FIELD).forEach(function (x) { if (!qOn(x) && x !== "own_bike") payload[x] = ""; });
      if (!qOn("own_bike") || own === null) delete payload.own_bike;
      if (!qOn("bike_type")) payload.bike_type = "";
      if (waSame === false) payload.whatsapp = e164(WPK);
      // The notice is recorded as confirmed only when this form showed its box and the box was ticked:
      // the account step's (an account made here), or step 2's for a signed-in account the database
      // has none for. An account handed over signed in otherwise sends none: it never saw the box here.
      if (acct.made ? ack : (acct.needAck && xack)) { payload.privacy_version = SH.PRIVACY_VERSION; payload.privacy_ack = true; }
      if (acct.emSaved) payload.emergency_saved = true;
      if (acct.needGender) payload.gender = xgender;
      if (acct.needHeight) payload.height = parseInt(toAscii($("#xheight").value), 10);
      var r = await rpc("customer_community_apply", { p_id: acct.id, p_token: acct.token, p: payload });
      var res = r.data;
      if (!res || typeof res !== "object") { showBanner(k("Could not reach the server. Please try again.")); return; }
      if (!res.ok) {
        if (res.error === "throttled") { showBanner(k("Too many applications from this network. Please try again in a few minutes.")); return; }
        if (res.error === "member") { showMember(); return; }
        if (res.error === "signed_out") { showBanner(k("You were signed out. Sign in again to send your application."), true); return; }
        if (res.error === "account") { showBanner(k("Your account has no email or mobile number yet. Add them on the booking site, then apply.")); return; }
        // An account without a confirmed notice: its box, on the last screen, before the application goes.
        if (res.error === "privacy") { acct.needAck = true; $("#f-xack").hidden = false; showFieldError("f-xack", "privacyAckRequired", null, true); return; }
        // The WhatsApp answer refused: said on its own question while it is on this step.
        if (res.error === "whatsapp" && waStep === 2) { var wf = waSame === false ? "f-wanum" : "f-wa"; showFieldError(wf, wf === "f-wa" ? k("Tell us whether this is your WhatsApp number") : k("Enter a valid mobile number")); return; }
        var f = FIELD_OF[res.error];
        // a question the admins made required, left empty: the box's own ask, not the username rule
        if (res.error === "instagram" && !igNorm($("#ig").value)) f = ["f-ig", k("Enter your Instagram username")];
        if (f) { if (res.error === "gender" || res.error === "height") { $("#" + f[0]).hidden = false; acct["need" + (res.error === "gender" ? "Gender" : "Height")] = true; } showFieldError(f[0], f[1]); return; }
        showBanner(k("Could not reach the server. Please try again.")); return;
      }
      // A parent or guardian of an applicant under 18, kept on the application just sent (customer_community_guardian).
      // A database without the function yet keeps the application without it.
      if (minorNow()) { try { await rpc("customer_community_guardian", { p_id: acct.id, p_token: acct.token, p_name: clean($("#gname").value), p_relation: grel, p_phone: e164(GPK), p_privacy: SH.PRIVACY_VERSION }); } catch (x) {} }
      // Who invited them, when they came by a member's link (member_invite_code in the booking app). A separate call:
      // the application is already in, so a failure here costs only the "Invited by" line.
      var inv = knownInvite();
      if (inv) { try { await rpc("community_app_invited", { p_id: acct.id, p_token: acct.token, p_code: inv }); } catch (x) {} try { localStorage.removeItem(INV_KEY); } catch (x) {} }
      ev("sent"); evFlush(true);
      showSuccess({ name: acct.name, phone: acct.phone, email: acct.email, track: res.track });
    } finally { setLoading("#next", false); }
  }
  // Sent: the card says it is with the team, what comes next, how they sign in (there is no email from us), and
  // where to go from here: the application's own page, the booking site, and WhatsApp for help.
  function showSuccess(p, repaint) {
    sent = p; DRAFT.clear(); DR = null; $("#draft-note").hidden = true;
    var tok = /^[0-9a-f]{48}$/.test(p.track || "") ? p.track : "";
    $("#track-link").hidden = !tok;
    if (tok) { $("#track-link").href = trackUrl(tok); rememberTrack(tok); }
    $("#card").setAttribute("data-state", "success");
    $("#form").hidden = true; $("#member").hidden = true; $("#success").hidden = false;
    $("#result").textContent = tr("{name}, your application is with our team.", { name: String(p.name || "").split(" ")[0] });
    var who = p.email || (p.phone ? fmtPhone(p.phone) : "");
    $("#result-signin").textContent = who ? tr("You sign in with {id} and your password.", { id: iso(who) }) : "";
    $("#wa-help").href = HELP_WA;
    document.title = tr("Application sent") + " | " + tr("Community membership") + " | MicroMobility";
    if (!repaint) { $("#success-title").focus({ preventScroll: true }); var c = $("#card"); if (c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: "start" }); }
  }
  function showMember() {
    hideBanner(); DRAFT.clear(); DR = null; $("#draft-note").hidden = true;
    $("#card").setAttribute("data-state", "member");
    $("#form").hidden = true; $("#member").hidden = false;
    $("#member-title").focus({ preventScroll: true });
  }

  /* ── Arriving signed in ─────────────────────────────────────────────────── */
  // ?code= is a one-time code (two minutes, one use) the booking site made for a signed-in rider:
  // their "Sign in" from here, or the Apply button of its members-only popup. It leaves the
  // address at once; the session it trades for is kept in this page only, never stored.
  async function arrive() {
    var code = MMAccount.takeCode();
    if (code == null) return;
    $("#card").setAttribute("data-state", "loading"); $("#loading").hidden = false;
    try {
      var r = await MMAccount.redeem(rpc, code);
      if (!r.row) { if (r.error === "network") showBanner(k("Could not reach the server. Please try again."), true); else showBanner(k("This sign-in link has expired. Sign in again to continue."), true); goScreen("gate", { noFocus: true }); return; }
      await signedIn(r.row);
    } finally {
      $("#loading").hidden = true;
      if ($("#card").getAttribute("data-state") === "loading") $("#card").setAttribute("data-state", "form");
    }
  }
  // A signed-in account (handed over, or signed in on the first screen): what it holds, its emergency contact and its
  // sport answer, then step 2.
  async function signedIn(row) {
    var all = await Promise.all([rpc("customer_community_me", { p_id: row.id, p_token: row.session_token }), rpc("customer_emergency", { p_id: row.id, p_token: row.session_token }),
      SPD ? rpc("customer_sport", { p_id: row.id, p_token: row.session_token }) : Promise.resolve({ error: { code: "PGRST202" } })]);
    var m = all[0], em = all[1], spr = all[2];
    var me = m.data && typeof m.data === "object" ? m.data : null;
    if (!me) { showBanner(k("Could not reach the server. Please try again.")); return; }
    var fl = Array.isArray(me.flags) ? me.flags : [];
    acct = { id: row.id, token: row.session_token, name: me.name || row.name || "", email: me.email || "", phone: me.phone || "", made: false, needGender: !me.gender, needHeight: !(me.height >= 100 && me.height <= 250) || fl.indexOf("height") >= 0 }; // a height outside 100-250 cm (0, a typo) is none
    if (me.member) { showMember(); return; }
    // The emergency contact on the account: asked when there is none. A database without customer_emergency asks
    // nothing; one that answers three columns offers no second.
    var er = !em.error && Array.isArray(em.data) ? em.data[0] || null : null;
    acct.needEm = em.error ? !absent(em.error) : !(er && er.emergency_name && er.emergency_phone && er.emergency_relation) || fl.indexOf("emergency") >= 0;
    noEm2 = !!er && !("emergency2_name" in er);
    var emOf = function (n) { return er ? { name: er[n + "_name"], phone: er[n + "_phone"], relation: er[n + "_relation"] } : null; };
    fixed = fl.map(String);
    // the bike as staff flag it (type_preference), in the one bike question's answers
    var heldBike = me.own_bike === true || me.bike_type === "Own" ? "Own" : ["Road", "Hybrid", "Mountain"].indexOf(me.bike_type) >= 0 ? me.bike_type : "";
    held = Object.assign({}, me, { type_preference: heldBike, emergency: emOf("emergency"), emergency2: emOf("emergency2") });
    // The sport answer the account holds (customer_sport): put back, and not asked again unless staff flagged it.
    var srow = !spr.error && Array.isArray(spr.data) ? spr.data[0] : (!spr.error && spr.data && typeof spr.data === "object" ? spr.data : null);
    if (spr.error && absent(spr.error)) SPORT_ON = false;
    if (srow && (srow.competes === true || srow.competes === false)) {
      sp.competes = srow.competes; sp.feds = srow.competes ? spClean(Array.isArray(srow.federations) ? srow.federations : []) : [];
      sp.other = sp.feds.indexOf("other") >= 0 && typeof srow.other === "string" ? srow.other : ""; $("#sp-other").value = sp.other; spHeld = true;
    }
    spPaint();
    ev("done", { screen: "signin" });
    enterStepTwo(me);
    return true;
  }

  /* ── The first screen: an account already? ──────────────────────────────── */
  tiles("#haves", "f-have", function (v) {
    if (v === "no") { $("#login-box").hidden = true; ev("done", { screen: "gate" }); goScreen("about", { noFocus: true }); $("#first").focus({ preventScroll: true }); return; }
    $("#login-box").hidden = false; ev("screen", { screen: "signin" }); $("#lid").focus();
  });
  // From "this email already has an account": the first screen, Yes picked, the email or mobile typed in.
  function toLogin(who) {
    hideBanner(); goScreen("gate", { noFocus: true });
    tileSet("#haves", "yes");
    $("#login-box").hidden = false; if (who) $("#lid").value = String(who).replace(/^\+966/, "0");
    $(who ? "#lpw" : "#lid").focus();
  }
  $("#lid").addEventListener("input", function () { clearMsg("f-lid"); });
  $("#lpw").addEventListener("input", function () { clearMsg("f-lpw"); });
  $("#lpw").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doLogin(); } });
  $("#login").addEventListener("click", function () { doLogin(); });
  // The sign-in every account form shares (MMAccount.signIn: customer_login, then customer_pwd_state), said in
  // the booking site's own words. A temporary password is changed on the booking site first.
  async function doLogin() {
    if (busy) return;
    hideBanner(); $("#si-temp").hidden = true;
    setLoading("#login", true);
    try {
      var r = await MMAccount.signIn(rpc, $("#lid").value, $("#lpw").value);
      if (r.row) { $("#lpw").value = ""; await signedIn(r.row); return; }
      if (r.error === "id") { setErr("f-lid", "errEmailOrPhone", null, true); $("#lid").focus(); }
      else if (r.error === "pwd") { setErr("f-lpw", "errPasswordRequired", null, true); $("#lpw").focus(); }
      else if (r.error === "locked") { setErr("f-lpw", "errLoginLocked", null, true); $("#lpw").focus(); }
      else if (r.error === "wrong") { setErr("f-lpw", r.cc ? "errLoginPhoneCc" : "errInvalidCredentials", null, true); $("#lpw").focus(); }
      else if (r.error === "temp") { $("#si-temp").hidden = false; $("#si-temp").scrollIntoView({ block: "center" }); }
      else if (r.error === "busy") showBanner(SITE_TOO_MANY);
      else showBanner(k("Could not reach the server. Please try again."));
    } finally { setLoading("#login", false); }
  }

  /* ── Where applicants leave the form (the owner's B1, 2026-11-10): anonymous counts, sent to
     community_form_log - the screens reached and passed, the question a refused Continue named and why, the last
     screen and question before the page was left, an account made, a send. Never an answer, a name, an account or
     an address: the visit's id is made here, at random, and kept nowhere. A database without the function drops them. ── */
  var SID = (Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 24);
  var EVQ = [], lastField = "", leftSig = "";
  function evField(id) { return String(id || "").replace(/^f-/, "").slice(0, 32); }
  function evCode(x) { return String(x || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48); }
  function ev(kind, o) {
    if (TRACK != null || sent) return;
    var e = { kind: kind, lang: lang, device: (window.innerWidth || 1024) < 700 ? "phone" : "desktop" };
    if (o) Object.keys(o).forEach(function (x) { if (o[x]) e[x] = o[x]; });
    EVQ.push(e); if (EVQ.length >= 30) evFlush();
  }
  function evFlush(keep) {
    if (!EVQ.length) return;
    var batch = EVQ.splice(0, 40);
    try {
      fetch(SUPABASE_URL + "/rest/v1/rpc/community_form_log", { method: "POST", keepalive: !!keep,
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_session: SID, p_events: batch }) }).catch(function () {});
    } catch (e) {}
  }
  function evLeave() {
    if (sent || TRACK != null) return;
    var sig = screen + "|" + lastField; if (sig === leftSig) { evFlush(true); return; }
    leftSig = sig; ev("leave", { screen: screen, field: evField(lastField) }); evFlush(true);
  }
  window.addEventListener("pagehide", evLeave);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") evLeave(); });

  /* ── Answers kept on this device (the owner, 2026-10-25: "save progress") ─── */
  // MMAccount.draft: three days, never a password or a session. What is typed is put back when the page opens
  // again: the account step's boxes at once, the membership step's once the account is signed in again (an
  // account made here is signed in with what was typed for it). Sent, or Start over, and it is gone.
  var DRAFT = MMAccount.draft("mm-community-draft", 3), DR = null;
  var NO_KEEP = { pwd: 1, lpw: 1, "nat-q": 1 };
  var TILE_GROUPS = ["#genders", "#xgenders", "#was", "#types", "#haves", "#sports", "#grels"];
  // Only what the visitor typed or picked is kept (a country code left as it came is not an answer).
  var touched = {};
  // A draft's answers not put back yet (the membership step's, until the account is signed in again): every save
  // keeps them, or typing the password to sign in again would write a draft without them.
  var pend = null;
  function pendOf(d) { return d ? { v: Object.assign({}, d.v || {}), tiles: Object.assign({}, d.tiles || {}), made: !!d.made, email: d.email || "", id: d.id || "", sp: d.sp || null } : null; }
  // Whose draft it is: the account it was kept for (its id, else its email), so it is put back for that account only.
  function draftMine(d) {
    if (d.id && acct.id) return d.id === acct.id;
    var e = String(acct.email || "").toLowerCase();
    return !!e && String(d.email || "").toLowerCase() === e;
  }
  function draftData() {
    var v = pend ? Object.assign({}, pend.v) : {}, tl = pend ? Object.assign({}, pend.tiles) : {};
    $$("#form input, #form select").forEach(function (el) {
      if (!el.id || !touched[el.id] || NO_KEEP[el.id] || el.type === "password" || el.type === "checkbox" || el.type === "hidden" || el.id === "sp-add") return;
      if (el.value) v[el.id] = el.value;
    });
    if (touched["nat-q"] && $("#nat").value) v.nat = $("#nat").value;
    TILE_GROUPS.forEach(function (g) { var on = $(g + ' .tile[aria-checked="true"]'); if (on && touched[g]) tl[g] = on.getAttribute("data-v"); });
    return { v: v, tiles: tl, news: news, step: step, screen: screen, made: !!(acct && acct.made) || !!(pend && pend.made),
      email: acct && acct.email ? acct.email : (pend && pend.email) || clean($("#email").value).toLowerCase(),
      id: acct ? acct.id : (pend && pend.id) || "",
      em2: !$("#em2-box").hidden, xem2: !$("#xem2-box").hidden, li: liOpen,
      sp: touched.sp || touched["#sports"] ? { competes: sp.competes, feds: sp.feds.slice() } : (pend && pend.sp) || null };
  }
  var draftT = 0;
  function draftWrite() {
    clearTimeout(draftT); draftT = 0;
    if (sent || TRACK != null) return;
    var d = draftData();
    if (!Object.keys(d.v).length && !Object.keys(d.tiles).some(function (g) { return g !== "#haves"; }) && !d.made) return; // nothing answered yet
    DRAFT.save(d); DR = DRAFT.load();
  }
  function draftSave(e) {
    if (sent || TRACK != null || prefilling) return;
    var t = e && e.target;
    if (t && t.id) touched[t.id] = 1;
    var g = t && t.closest && t.closest(".types, [role=radiogroup]");
    if (g && g.id) touched["#" + g.id] = 1;
    clearTimeout(draftT);
    draftT = setTimeout(draftWrite, 300);
  }
  ["input", "change"].forEach(function (x) { $("#form").addEventListener(x, draftSave); });
  $("#form").addEventListener("click", function (e) { if (e.target.closest(".tile, .tick-row")) draftSave(e); });
  // A tab closed (or a phone putting the page away) keeps what was typed in the last moment too.
  window.addEventListener("pagehide", function () { if (draftT) draftWrite(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && draftT) draftWrite(); });
  // The step a box belongs to, as the draft puts it back: the membership step's (and WhatsApp's, which moves
  // there for a signed-in account) wait for the account.
  function stepOf(el) { var f = el.closest("fieldset.step"); var n = f ? +f.getAttribute("data-step") : 0; return el.closest("#f-wa, #f-wanum") ? waStep : n; }
  function draftPut(d, which) {
    if (!d) return;
    prefilling = true;
    try {
      var v = d.v || {};
      Object.keys(v).forEach(function (id) {
        if (id === "nat") return;
        var el = document.getElementById(id); if (!el || stepOf(el) !== which && !(which === 1 && stepOf(el) === 0)) return;
        if (which === 2 && el.closest("[data-skipped]")) return; // the account's answer stands for a question not asked
        touched[id] = 1; if (pend) delete pend.v[id];
        el.value = v[id];
        if (el.tagName === "SELECT") el.classList.toggle("ph", !el.value);
      });
      if (which === 2 && v.nat && !$("#f-nat").hasAttribute("data-skipped")) { natPick(v.nat, true); touched["nat-q"] = 1; if (pend) delete pend.v.nat; }
      TILE_GROUPS.forEach(function (g) {
        var val = (d.tiles || {})[g]; if (!val || g === "#haves") return;
        var b = $(g + ' .tile[data-v="' + val + '"]'); if (!b || stepOf(b) !== which || (which === 2 && b.closest("[data-skipped]"))) return;
        touched[g] = 1; if (pend) delete pend.tiles[g];
        if (b.getAttribute("aria-checked") !== "true") b.click();
      });
      if (which === 1) {
        ccFace(PK); paintWa();
        if (typeof d.news === "boolean") { news = d.news; $("#news").setAttribute("aria-checked", String(news)); }
        if (d.em2) emOpen2("em", true);
      } else {
        ccFace(WPK); ccFace(GPK); if ($("#wa").value) onPhoneInput(WPK); if ($("#gphone").value) onPhoneInput(GPK);
        if (d.xem2) emOpen2("xem", true);
        if (d.li) { liOpen = true; liPaint(); }
        if (d.sp && !$("#f-sport").hasAttribute("data-skipped")) { sp.competes = d.sp.competes; sp.feds = spClean(d.sp.feds || []); sp.other = $("#sp-other").value; touched.sp = 1; if (pend) pend.sp = null; spPaint(); }
        paintMinor();
      }
      EM_PRE.forEach(function (p) { emCcFace(p); $("#" + p + "-rel").classList.toggle("ph", !$("#" + p + "-rel").value); });
    } finally { prefilling = false; }
  }
  // A save still waiting (the last screen change or keystroke) would write the draft back as the page is left.
  $("#draft-clear").addEventListener("click", function () { clearTimeout(draftT); draftT = 0; DRAFT.clear(); location.href = location.pathname + "?lang=" + lang; });
  // Opening with a draft: the account step's boxes filled, and the screen it was on (an account made here, or a
  // signed-in one, signs in again first: the session is never kept).
  function draftOpen() {
    DR = DRAFT.load();
    if (DR && !Object.keys(DR.v || {}).length && !DR.made && !Object.keys(DR.tiles || {}).some(function (g) { return g !== "#haves"; })) { DRAFT.clear(); DR = null; }
    if (!DR) return false;
    if ((DR.tiles || {})["#haves"]) touched["#haves"] = 1;
    pend = pendOf(DR);
    draftPut(DR, 1);
    $("#draft-note").hidden = false;
    var have = (DR.tiles || {})["#haves"];
    if (DR.made || have === "yes") {
      goScreen("gate", { noFocus: true, noDraft: true });
      tileSet("#haves", "yes");
      $("#login-box").hidden = false;
      if (DR.made) { $("#draft-made").hidden = false; if (DR.email) $("#lid").value = DR.email; }
      return true;
    }
    if (have === "no" || DR.step === 1) { goScreen(STEP1.indexOf(DR.screen) >= 0 ? DR.screen : "about", { noFocus: true, noDraft: true }); return true; }
    return false;
  }

  /* ── Where an application is (the owner, 2026-10-25: "track your application") ─── */
  // ?track=<token> (community_applications.track_token, community_track): the page shows the application
  // instead of the form - received, the changes staff asked for, the decision - in the page's language. The
  // link is on the thank-you card and kept on this device, so the form names it the next time it opens.
  var TRACK = new URLSearchParams(location.search).get("track"), TRACK_KEY = "mm-community-track";
  // A friend's invitation (?inv=, the owner 2026-11-02): kept on this device, because signing in on the booking site
  // brings them back here without it; thirty days, then it is forgotten.
  var INV_KEY = "mm-community-inv";
  (function () { var c = new URLSearchParams(location.search).get("inv"); if (/^[0-9a-f]{16}$/.test(c || "")) { try { localStorage.setItem(INV_KEY, JSON.stringify({ c: c, at: Date.now() })); } catch (e) {} } })();
  function knownInvite() { try { var v = JSON.parse(localStorage.getItem(INV_KEY) || "null"); return v && /^[0-9a-f]{16}$/.test(v.c) && Date.now() - v.at < 2592e6 ? v.c : ""; } catch (e) { return ""; } }
  function trackUrl(tok) { return location.origin + location.pathname + "?track=" + tok + "&lang=" + lang; }
  // at: when it was sent (community_track's sent_at), else the day it is first kept; opening its page again keeps that day.
  function rememberTrack(tok, at) {
    try { var was = knownTrack(); localStorage.setItem(TRACK_KEY, JSON.stringify({ t: tok, at: at || (was && was.t === tok && was.at) || Date.now() })); } catch (e) {}
  }
  function knownTrack() { try { var v = JSON.parse(localStorage.getItem(TRACK_KEY) || "null"); return v && /^[0-9a-f]{48}$/.test(v.t || "") ? v : null; } catch (e) { return null; } }
  function fixLabel(x) { return x === "name" ? tr("Name") : tr(FIX_LABEL[x] || x); }
  var FIX_LABEL = { email: k("Email address"), phone: k("Mobile number"), whatsapp: k("WhatsApp number"), birth_date: k("Date of birth"), gender: k("Gender"), nationality: k("Nationality"),
    height: k("Height in cm"), bike_type: k("Which bike will you ride?"), profession: k("Profession"), workplace: k("Company"), instagram: k("Instagram"), linkedin: k("LinkedIn") };
  var TRACK_D = null;
  function trackPaint() {
    var d = TRACK_D; if (!d) return;
    $("#track-title").textContent = d.first ? tr("{name}, your application", { name: d.first }) : tr("Your application");
    document.title = $("#track-title").textContent + " | MicroMobility";
    $("#track-sent").textContent = tr("Sent on {date}", { date: dayText(d.sent_at) }) + (d.updated_at ? " · " + tr("Updated on {date}", { date: dayText(d.updated_at) }) : "");
    var steps = [], acts = [];
    var add = function (state, title, body) { steps.push('<li class="tk-step tk-' + state + '"><span class="tk-dot" aria-hidden="true"></span><div><b>' + esc(title) + "</b>" + (body ? "<p>" + body + "</p>" : "") + "</div></li>"); };
    add("done", tr("Received"), esc(dayText(d.sent_at)));
    // Changes asked are made while the application waits: once it is decided, the link to make them only answers that
    // the application is gone (community_fix_get), so an unanswered request is no longer a step.
    if (d.fix && d.status === "pending") {
      var fs = (Array.isArray(d.fix.fields) ? d.fix.fields : []).map(fixLabel);
      add("now", tr("Changes asked"), esc(tr("Our team asked you to change:")) + " " + esc(listJoin(fs)) + (d.fix.note ? '<span class="tk-note">' + esc(d.fix.note) + "</span>" : ""));
      if (/^[0-9a-f]{36}$/.test(d.fix.token || "")) acts.push('<a class="submit" href="' + esc(BOOKING_URL + "?appfix=" + d.fix.token + "&lang=" + lang) + '">' + esc(tr("Make the changes")) + "</a>");
    } else if (d.fix_done_at) add("done", tr("Changes sent"), esc(dayText(d.fix_done_at)));
    if (d.status === "pending") add(d.fix ? "next" : "now", tr("With our team"), esc(tr("Our team reviews every application and replies on WhatsApp.")));
    else if (d.status === "approved") { add("done", tr("Approved"), esc(dayText(d.decided_at)) + ". " + esc(tr("Welcome to the community. You can now book the community rides on the booking site."))); acts.push(openSite()); }
    else if (d.status === "invited") {
      var rd = d.ride || {}, when = [dayText(rd.date, true), rd.time ? iso(rd.time) : "", rd.title || ""].filter(Boolean).join(" · ");
      add("done", tr("Invited to a ride"), (when ? esc(when) + ". " : "") + esc(rd.cancelled ? tr("That ride was cancelled. Our team will be in touch.") : tr("Your place is in {tab} on the booking site.", { tab: site("tabMyRides") })));
      acts.push(openSite());
    } else if (d.status === "rejected") add("end", tr("Not approved this time"), esc(tr("Thank you for applying. We could not approve your application this time.")));
    $("#track-steps").innerHTML = steps.join("");
    $("#track-acts").innerHTML = acts.join("") + '<a class="submit submit-line" href="' + HELP_WA + '" target="_blank" rel="noopener">' + esc(tr("WhatsApp us")) + "</a>";
  }
  function openSite() { return '<a class="submit submit-line" href="' + esc(BOOKING_URL + "?lang=" + lang) + '">' + esc(tr("Open the booking site")) + "</a>"; }
  async function showTrack(tok) {
    $("#card").setAttribute("data-state", "track");
    $("#form").hidden = true; $("#track").hidden = false; $("#track-err").hidden = true;
    $("#track-steps").innerHTML = '<li class="tk-wait"><span class="spinner-dark" aria-hidden="true"></span> ' + esc(tr("Loading...")) + "</li>";
    var r = /^[0-9a-f]{48}$/.test(tok) ? await rpc("community_track", { p_token: tok }) : { data: { ok: false, error: "gone" } };
    var d = r.data && typeof r.data === "object" ? r.data : null;
    if (!d || !d.ok) {
      $("#track-steps").innerHTML = ""; $("#track-err").hidden = false;
      $("#track-err").textContent = d && d.error === "gone" ? tr("We could not find this application. The link may be incomplete.") : d && d.error === "throttled" ? tr("Too many tries from this network. Please try again in a few minutes.") : tr("Could not reach the server. Please try again.");
      $("#track-title").focus({ preventScroll: true });
      return;
    }
    TRACK_D = d; rememberTrack(tok, d.sent_at); trackPaint();
    $("#track-title").focus({ preventScroll: true });
  }
  // An application sent from this device before: named on the first screen, a tap from its page.
  function paintSeen() {
    var x = knownTrack(), on = !!x && screen === "gate" && !DR;
    $("#track-seen").hidden = !on;
    if (on) { $("#track-seen-txt").textContent = tr("You sent an application on {date}.", { date: dayText(x.at) }); $("#track-seen-a").href = trackUrl(x.t); }
  }

  // Test hook: the specs read the form's rules without a network.
  window.CommunityForm = { setLang: setLang, e164: e164, checkEmail: checkEmail, checkName: checkName, liNorm: liNorm, igNorm: igNorm, emRead: emRead, pwdBad: pwdBad, natMatches: function (q) { return natMatches(q).filter(Boolean).map(function (it) { return it.name; }); }, birthValue: birthValue };

  setLang(pickLang(), false);
  if (TRACK != null) showTrack(TRACK);
  else {
    loadQuestions(); spLoadOptions();
    var handed = new URLSearchParams(location.search).get("code") != null;
    // Handed over: the draft's answers wait in `pend` until the account is in (enterStepTwo puts them back), so a code
    // that fails, and a sign-in typed here after it, never save a draft without them.
    if (handed) { goScreen("gate", { noFocus: true, noDraft: true }); ev("open", { screen: "handoff" }); DR = DRAFT.load(); pend = pendOf(DR); arrive(); }
    else { goScreen("gate", { noFocus: true, noDraft: true }); ev("open", { screen: "gate" }); if (!draftOpen()) paintSeen(); }
    evFlush();
  }
})();
