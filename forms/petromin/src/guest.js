
  /* ── An invited guest's account and booking (the owner, 2026-11-13: guests "create an account and go through the whole
     process", on this page). The build puts this file after live-submit.js, inside the same function.

     The account step is the booking site's own sign-in and sign-up, as the Saturday ride's page asks them
     (forms/saturday; the sign-in itself is forms/shared/account.js, MMAccount): customer_login, or customer_exists,
     customer_signup, customer_consents and customer_set_emergency. Signed in, the step asks the company the guest is
     from and whatever the account still owes that this page can ask (customer_fix_fields: a height, the emergency
     contact, the nationality, the date of birth); anything else is finished in the booking app. The booking is the
     account's own (petromin_guest_book: the name, mobile and height are the account's), with an I- number.
     The session is kept in memory only: a reload, or Register another, forgets it. ── */
  var BOOKING_URL = (SITE_FORM && SITE_FORM.booking) || "https://experiences.micromobility.sa/";
  document.querySelectorAll(".ac-app").forEach(function (a) { a.href = BOOKING_URL; });
  var acct = null;   // {id, token, name, email, phone, made}
  var prof = null, owe = { height: false, em: false, nat: false, birth: false }, blocked = false, fixed = [], held = {}, emRetry = false;
  var acPanel = "ask", acBusy = false;
  var ASKABLE = ["height", "emergency", "nationality", "birth_date"];
  var NET = "Could not reach the server", TOO_MANY = "Too many tries from this network. Wait a few minutes and try again.";

  function acClean(v) { return String(v == null ? "" : v).replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, " ").replace(/\s+/g, " ").trim(); }
  function errText(e) { return e ? String((e.code || "") + " " + (e.message || "") + " " + (e.details || "") + " " + (e.hint || "")) : ""; }
  function absent(e) { return !!e && (e.code === "PGRST202" || /could not find the function/i.test(String(e.message || ""))); }
  // The form's own call, as the shared account step asks for it: {data} or {error: {message, code...}}, never thrown;
  // no answer at all is the message "network".
  function arpc(fn, body) {
    return rpcFetch(fn, body).then(function (r) {
      if (!r.error) return { data: r.data };
      if (!r.status) return { error: { message: "network" } };
      if (r.status >= 500) return { error: { message: "HTTP " + r.status, code: r.error.code, details: r.error.details, hint: r.error.hint } };
      return { error: r.error };
    });
  }
  function acLoading(sel, on) { acBusy = !!on; var b = $(sel); b.classList.toggle("loading", !!on); b.disabled = !!on; $("#back").disabled = !!on; }

  /* The panels of the step: the question, sign in, create, and (signed in) what the booking needs. Continue belongs to
     the last one alone; the others have their own button. */
  function acShow(p) {
    acPanel = p;
    ["ask", "signin", "create", "details"].forEach(function (k) { $("#ac-" + k).hidden = k !== p; });
    paintAcctNav();
  }
  function paintAcctNav() { if (paneAt(step) === "account") $("#next").hidden = acPanel !== "details"; }
  stepHooks.push(function (n, was) {
    if (paneAt(n) !== "account") return;
    if (acct && acPanel !== "details") acShow("details");
    else if (!acct && acPanel === "details") acShow("ask");
    paintAcctNav();
  });
  function acFocus(sel) { var el = $(sel); if (el && booted) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
  $("#ac-yes").addEventListener("click", function () { acShow("signin"); acFocus("#ac-ident"); });
  $("#ac-no").addEventListener("click", function () { acShow("create"); acFocus("#ac-first"); });
  document.querySelectorAll(".ac-to-signin").forEach(function (b) { b.addEventListener("click", function () { acShow("signin"); acFocus("#ac-ident"); }); });
  document.querySelectorAll(".ac-to-create").forEach(function (b) { b.addEventListener("click", function () { acShow("create"); acFocus("#ac-first"); }); });
  // Back from signing in or creating goes to the question again; Continue (and Enter) is the panel's own button.
  var _backBase = back;
  back = function () {
    if (paneAt(step) === "account" && !acct && (acPanel === "signin" || acPanel === "create") && !editing) { hideBanner(); acShow("ask"); return; }
    _backBase();
  };
  var _nextBase = next;
  next = function () {
    if (paneAt(step) !== "account") { _nextBase(); return; }
    if (acPanel === "signin") doSignIn();
    else if (acPanel === "create") createAccount();
    else if (acPanel === "details" && acct) accountNext();
  };
  $("#ac-signin-btn").addEventListener("click", function () { doSignIn(); });
  $("#ac-create-btn").addEventListener("click", function () { createAccount(); });

  /* ── The lists the account's questions choose from (the booking site's own, put here by the build) ── */
  var RULES = ACCT.PHONE_RULES, reCache = {}, CC_DIGITS = {};
  ACCT.COUNTRY_CODES.forEach(function (x) { CC_DIGITS[x[0].slice(1)] = true; });
  var dn = {};
  function regionName(iso, fallback) {
    var l = html.lang;
    try {
      if (!(l in dn)) dn[l] = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames([l], { type: "region", fallback: "none" }) : null;
      return (dn[l] && dn[l].of(iso)) || fallback;
    } catch (e) { return fallback; }
  }
  function ccName(x) {
    if (html.lang === "en") return x[2];
    if (x[1] === "US") return regionName("US", "USA") + " / " + regionName("CA", "Canada");
    if (html.lang === "ar" && ACCT.COUNTRY_AR[x[2]]) return ACCT.COUNTRY_AR[x[2]];
    return regionName(x[1], x[2]);
  }
  // The Gulf first, then every country by name, Saudi Arabia again in its place (the owner, 2026-10-05).
  function ccList() {
    var all = ACCT.COUNTRY_CODES, rest = all.slice(6).concat(all.filter(function (x) { return x[1] === "SA"; })).map(function (x) { return { x: x, n: ccName(x) }; });
    try { rest.sort(function (a, b) { return a.n.localeCompare(b.n, html.lang); }); } catch (e) {}
    return all.slice(0, 6).map(function (x) { return { x: x, n: ccName(x) }; }).concat(rest);
  }
  function ccDigitsOf(sel) { var o = sel.selectedOptions[0]; return o ? o.getAttribute("data-cc").slice(1) : "966"; }
  function ccFace(sel) {
    var f = sel.parentNode.querySelector(".cc-face"); if (f) f.textContent = "+" + ccDigitsOf(sel);
    var inp = sel.closest(".phone-row").querySelector("input"); if (inp) inp.placeholder = ccDigitsOf(sel) === "966" ? "5X XXX XXXX" : "";
  }
  function buildCc(sel) {
    var cur = sel.value || "SA+966", done = false;
    sel.innerHTML = ccList().map(function (o) {
      var v = o.x[1] + o.x[0], on = !done && v === cur; if (on) done = true;
      return '<option value="' + v + '" data-cc="' + o.x[0] + '"' + (on ? " selected" : "") + ">" + esc(o.n) + " (" + o.x[0] + ")</option>";
    }).join("");
    if (!sel.value) sel.value = "SA+966";
    ccFace(sel);
  }
  function setCcDigits(sel, k) {
    var o = Array.prototype.filter.call(sel.options, function (x) { return x.getAttribute("data-cc") === "+" + k; })[0];
    if (o) { sel.value = o.value; ccFace(sel); }
  }
  function ccOf(d) { for (var n = 1; n <= 3 && n <= d.length; n++) if (CC_DIGITS[d.slice(0, n)]) return d.slice(0, n); return ""; }
  function callingCode(d) { for (var n = 3; n >= 1; n--) if (RULES[d.slice(0, n)] || CC_DIGITS[d.slice(0, n)]) return d.slice(0, n); return ""; }
  // Google's libphonenumber mobile patterns, the rules file the booking site's staff check reads.
  function mobileOk(code, nat) {
    var list = RULES[code]; if (!list) return true;
    return list.some(function (r) { var re = reCache[r[0]] || (reCache[r[0]] = new RegExp("^(?:" + r[1] + ")$")); return r[2].indexOf(nat.length) >= 0 && re.test(nat); });
  }
  function ccIncluded(d, ccd) {
    if (!ccd || d.indexOf(ccd) !== 0) return false;
    var nat = d.slice(ccd.length);
    if (RULES[ccd]) { if (mobileOk(ccd, d)) return false; if (mobileOk(ccd, nat)) return true; }
    return d.length >= 11 && nat.length >= 8;
  }
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
  // A number typed with its + or 00 code names its country: the picker follows it.
  function followCode(sel, inp) {
    var raw = toAscii(inp.value).trim(), d = raw.replace(/\D/g, "");
    if (!(raw[0] === "+" || d.slice(0, 2) === "00")) return;
    if (d.slice(0, 2) === "00") d = d.slice(2);
    if (d.indexOf(ccDigitsOf(sel)) !== 0) { var k = ccOf(d); if (k) setCcDigits(sel, k); }
  }
  // What is wrong with a mobile number, as [message, its values], or null.
  function mobileFault(raw, p) {
    var d = p.replace(/\D/g, "");
    if (!toAscii(raw).replace(/\D/g, "")) return ["Enter your mobile number"];
    if (d.indexOf("966") === 0) {
      var nat = d.slice(3);
      if (!/^5\d{8}$/.test(nat) || !mobileOk("966", nat)) return ["Enter a valid Saudi mobile number (5XXXXXXXX)"];
    } else {
      var code = callingCode(d);
      if (!code || d.length < 8 || d.length > 15) return ["Enter a valid mobile number"];
      if (!mobileOk(code, d.slice(code.length))) return ["This is not a mobile number for +{c}. Please check it.", { c: code }];
    }
    return null;
  }

  /* ── The emergency contact (the owner, 2026-10-07: the first is required of every account), as the booking site asks
     it and in its words: "em" on the sign-up, "xem" for a signed-in account without one. ── */
  var EM_RELS = ACCT.EM_RELS;
  var REL_WORD = { spouse: "Spouse", parent: "Parent", sibling: "Brother or sister", child: "Son or daughter", relative: "Relative", friend: "Friend", colleague: "Colleague", other: "Other" };
  var CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
  function emBlock(p, hidden) {
    return '<fieldset id="' + p + '-block" class="em-block"' + (hidden ? " hidden" : "") + '><legend data-t="Emergency contact"></legend>' +
      '<div id="f-' + p + '-name" class="field"><label for="' + p + '-name" data-t="Contact’s name"></label>' +
      '<input id="' + p + '-name" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="80" enterkeyhint="next"><p class="err" aria-live="polite" data-t="Enter your contact’s name."></p></div>' +
      '<div id="f-' + p + '-phone" class="field"><label for="' + p + '-phone" data-t="Contact’s mobile number"></label><div class="phone-row" dir="ltr">' +
      '<label class="cc-wrap cc-over" data-t-label="Country code"><span class="cc-face" aria-hidden="true">+966</span><select id="' + p + '-cc" class="cc"></select>' + CHEVRON + "</label>" +
      '<input id="' + p + '-phone" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="5X XXX XXXX"></div><p class="err" aria-live="polite" data-t="Enter your contact’s mobile number."></p></div>' +
      '<div id="f-' + p + '-rel" class="field"><label for="' + p + '-rel" data-t="Relationship to you"></label>' +
      '<span class="sel-wrap"><select id="' + p + '-rel" class="sel"></select></span><p class="err" aria-live="polite" data-t="Choose how they are related to you."></p></div></fieldset>';
  }
  $("#em-slot").outerHTML = emBlock("em", false);
  $("#xem-slot").outerHTML = emBlock("xem", true);
  var EM_PRE = ["em", "xem"];
  function last9(v) { return String(v || "").replace(/\D/g, "").slice(-9); }
  // A contact's three answers: {name, phone, rel}, or {err: [its box, the message]}.
  function emRead(p, own) {
    var n = tidyName($("#" + p + "-name").value), rel = $("#" + p + "-rel").value;
    $("#" + p + "-name").value = n;
    if (Array.from(n).length < 2 || Array.from(n).length > 80) return { err: ["f-" + p + "-name", "Enter your contact’s name."] };
    if (!/\p{L}/u.test(n)) return { err: ["f-" + p + "-name", NAME_CHARS] };
    if (nameShort(n)) return { err: ["f-" + p + "-name", "Enter your contact’s name."] }; // an initial is not a name; the box's own words (they are not a rider)
    var ph = toAscii($("#" + p + "-phone").value).trim() ? toE164(ccDigitsOf($("#" + p + "-cc")), $("#" + p + "-phone").value) : "";
    if (!/^\+?[0-9]{8,15}$/.test(ph)) return { err: ["f-" + p + "-phone", "Enter your contact’s mobile number."] };
    if (last9(own).length === 9 && last9(ph) === last9(own)) return { err: ["f-" + p + "-phone", "Your contact’s number can’t be your own."] };
    if (EM_RELS.indexOf(rel) < 0) return { err: ["f-" + p + "-rel", "Choose how they are related to you."] };
    return { name: n, phone: ph, rel: rel };
  }
  var EM_DETAIL = { em_name: ["name", "Enter your contact’s name."], em_phone: ["phone", "Enter your contact’s mobile number."], em_relation: ["rel", "Choose how they are related to you."], em_self: ["phone", "Your contact’s number can’t be your own."], em_required: ["name", "Enter your contact’s name."] };
  // Saves a block's contact on the signed-in account: {ok:true}, {field, key} for a refused box, {signedOut:true} or {banner}.
  async function emSave(p) {
    var c = emRead(p, acct.phone);
    if (c.err) return { field: c.err[0], key: c.err[1] };
    var r = await arpc("customer_set_emergency", { p_id: acct.id, p_token: acct.token, p_name: c.name, p_phone: c.phone, p_relation: c.rel });
    if (r.error) {
      if (absent(r.error)) return { ok: true };
      var d = EM_DETAIL[String(r.error.details || "")];
      if (d) return { field: "f-" + p + "-" + d[0], key: d[1] };
      return { banner: /RATE_LIMITED/.test(errText(r.error)) ? TOO_MANY : NET };
    }
    if (r.data === false) return { signedOut: true };
    return { ok: true };
  }
  function fillEm(p, name, phone, rel) {
    $("#" + p + "-name").value = name || "";
    var d = String(phone || "").replace(/\D/g, ""), k = ccOf(d);
    if (k) { setCcDigits($("#" + p + "-cc"), k); $("#" + p + "-phone").value = d.slice(k.length); }
    if (rel && EM_RELS.indexOf(rel) >= 0) $("#" + p + "-rel").value = rel;
  }

  /* ── Nationality and date of birth, asked only of an account that owes them (the booking site's own rule: the
     nationality from the second booking, the birth date from the fifth). Saudi Arabia first and again in its
     alphabetical place; nobody under five, no date in the future. ── */
  function natLabel(x) { return html.lang === "en" ? x[1] : (html.lang === "ar" && ACCT.COUNTRY_AR[x[1]]) || regionName(x[0], x[1]); }
  function buildNat() {
    var sel = $("#ac-nat"), cur = sel.value, done = false;
    var all = ACCT.NATIONALITIES.map(function (x) { return { v: x[1], n: natLabel(x) }; });
    try { all.sort(function (a, b) { return a.n.localeCompare(b.n, html.lang); }); } catch (e) {}
    var sa = all.filter(function (o) { return o.v === "Saudi Arabia"; });
    sel.innerHTML = '<option value="">' + esc(t("Choose your nationality")) + "</option>" + sa.concat(all).map(function (o) {
      var on = !done && o.v === cur; if (on) done = true;
      return '<option value="' + esc(o.v) + '"' + (on ? " selected" : "") + ">" + esc(o.n) + "</option>";
    }).join("");
  }
  // Riyadh is UTC+3 all year, so its day is plain arithmetic, not Intl's "en-CA" layout (an iPhone on iOS 17.2 laid
  // that out as 10/27/2026).
  function todayKsa() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
  function dobMax() { var p = todayKsa().split("-"); return (+p[0] - 5) + "-" + p[1] + "-" + p[2]; }
  function monthNames() {
    try { var f = new Intl.DateTimeFormat(html.lang + "-u-ca-gregory-nu-latn", { month: "long" }); var out = []; for (var i = 0; i < 12; i++) out.push(f.format(new Date(2000, i, 1))); return out; }
    catch (e) { return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]; }
  }
  function buildDob() {
    var ds = $("#ac-birth-d"), ms = $("#ac-birth-m"), ys = $("#ac-birth-y");
    var d = +ds.value || 0, m = +ms.value || 0, y = +ys.value || 0;
    var mx = dobMax().split("-").map(Number), yMax = mx[0], yMin = mx[0] - 94, mMax = y === mx[0] ? mx[1] : 12;
    if (m > mMax) m = 0;
    var dim = y && m ? new Date(y, m, 0).getDate() : 31, dMax = (y === mx[0] && m === mx[1]) ? mx[2] : 31;
    // a day the month does not have is cleared, never moved to the month's last day: the check then asks for it again
    if (d > dim || d > dMax) d = 0;
    var yrs = '<option value="">' + esc(t("Year")) + "</option>";
    for (var yy = yMax; yy >= yMin; yy--) yrs += '<option value="' + yy + '"' + (yy === y ? " selected" : "") + ">" + yy + "</option>";
    ys.innerHTML = yrs;
    ms.innerHTML = '<option value="">' + esc(t("Month")) + "</option>" + monthNames().map(function (n, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === m ? " selected" : "") + (i + 1 > mMax ? " disabled" : "") + ">" + esc(n) + "</option>"; }).join("");
    var days = '<option value="">' + esc(t("Day")) + "</option>";
    for (var dd = 1; dd <= dim; dd++) days += '<option value="' + dd + '"' + (dd === d ? " selected" : "") + (dd > dMax ? " disabled" : "") + ">" + dd + "</option>";
    ds.innerHTML = days;
  }
  function birthValue() {
    var d = +$("#ac-birth-d").value, m = +$("#ac-birth-m").value, y = +$("#ac-birth-y").value;
    return d && m && y ? y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0") : "";
  }
  function setBirth(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return;
    var b = iso.split("-").map(Number);
    $("#ac-birth-y").value = String(b[0]); buildDob(); $("#ac-birth-m").value = String(b[1]); buildDob(); $("#ac-birth-d").value = String(b[2]); buildDob();
  }
  ["#ac-birth-d", "#ac-birth-m", "#ac-birth-y"].forEach(function (s) { $(s).addEventListener("change", function () { buildDob(); setError("f-ac-birth", false); }); });
  $("#ac-nat").addEventListener("change", function () { setError("f-ac-nat", false); });

  // The lists are drawn in the page's language, and again when it changes.
  function buildLists() {
    buildCc($("#ac-cc"));
    EM_PRE.forEach(function (p) {
      buildCc($("#" + p + "-cc"));
      var rs = $("#" + p + "-rel"), rc = rs.value;
      rs.innerHTML = '<option value="">' + esc(t("Choose")) + "</option>" + EM_RELS.map(function (c) { return '<option value="' + c + '"' + (c === rc ? " selected" : "") + ">" + esc(t(REL_WORD[c] || c)) + "</option>"; }).join("");
    });
    buildNat(); buildDob();
    document.querySelectorAll(".em-block [data-t]").forEach(render);
    document.querySelectorAll(".em-block [data-t-label], .dob [data-t-label]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-t-label"))); });
    $("#ac-cc").setAttribute("aria-label", t("Country code"));
    paintWho();
  }
  langHooks.push(buildLists);

  /* ── The boxes: what is dropped as it is typed, and messages that clear when the box is touched ── */
  ["ac-first", "ac-last"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () { onNameInput(this); if (!this._nameHintUntil || this._nameHintUntil < Date.now()) setError("f-ac-name", false); });
    $("#" + id).addEventListener("blur", function () { onNameBlur(this); });
  });
  EM_PRE.forEach(function (p) {
    $("#" + p + "-name").addEventListener("input", function () { onNameInput(this); if (!this._nameHintUntil || this._nameHintUntil < Date.now()) setError("f-" + p + "-name", false); });
    $("#" + p + "-name").addEventListener("blur", function () { onNameBlur(this); });
    $("#" + p + "-phone").addEventListener("input", function () { followCode($("#" + p + "-cc"), this); setError("f-" + p + "-phone", false); });
    $("#" + p + "-cc").addEventListener("change", function () { ccFace(this); setError("f-" + p + "-phone", false); });
    $("#" + p + "-rel").addEventListener("change", function () { setError("f-" + p + "-rel", false); });
  });
  $("#ac-phone").addEventListener("input", function () { followCode($("#ac-cc"), this); setError("f-ac-phone", false); });
  $("#ac-cc").addEventListener("change", function () { ccFace(this); setError("f-ac-phone", false); });
  function digitsOnly(id, field) { $("#" + id).addEventListener("input", function () { var v = toAscii(this.value).replace(/\D/g, "").slice(0, 3); if (v !== this.value) this.value = v; setError(field, false); }); }
  digitsOnly("ac-height", "f-ac-height"); digitsOnly("ac-xheight", "f-ac-xheight");
  [["ac-ident", "f-ac-ident"], ["ac-spwd", "f-ac-spwd"], ["ac-pwd", "f-ac-pwd"], ["ac-pwd2", "f-ac-pwd2"], ["ac-company", "f-ac-company"]].forEach(function (x) {
    $("#" + x[0]).addEventListener("input", function () { setError(x[1], false); });
  });
  $("#ac-ack").addEventListener("change", function () { setError("f-ac-ack", false); });
  var acGender = null, acGenders = $("#ac-genders");
  acGenders.addEventListener("click", function (e) {
    var b = e.target.closest(".tile"); if (!b) return;
    acGender = b.getAttribute("data-v");
    acGenders.querySelectorAll(".tile").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
    syncRoving(acGenders); setError("f-ac-gender", false);
  });
  radioKeys(acGenders); syncRoving(acGenders);

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
  // What is wrong with an email address: {hard: [message, values], fix: the address meant}, or {}.
  function checkEmail(em) {
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
      var p = PROVIDERS.filter(function (q) { return dist(root, q) <= (q.length >= 6 ? 2 : 1) || (root.indexOf(q) >= 0 && root.length <= q.length + 4); })[0];
      if (p) fix = p + "." + ((COM_ONLY.indexOf(p) >= 0 || TLD_TYPO.indexOf(tld) >= 0) ? "com" : labels.slice(1).join("."));
    }
    if (!fix && TLD_TYPO.indexOf(tld) >= 0) fix = labels.slice(0, -1).join(".") + ".com";
    if (fix && fix !== dom) return { hard: ["Did you mean {s}?", { s: at[0] + "@" + fix }], fix: at[0] + "@" + fix };
    return {};
  }
  var emailFix = null;
  function paintEmailFix() { var b = $("#ac-email-fix"); b.hidden = !emailFix; if (emailFix) b.textContent = t("Use {s}", { s: emailFix }); }
  langHooks.push(paintEmailFix);
  $("#ac-email-fix").addEventListener("click", function () { if (!emailFix) return; $("#ac-email").value = emailFix; emailFix = null; paintEmailFix(); setError("f-ac-email", false); $("#ac-email").focus(); });
  $("#ac-email").addEventListener("input", function () { emailFix = null; paintEmailFix(); setError("f-ac-email", false); });

  /* ── Names: letters, spaces and periods, first and last in full, in one alphabet ── */
  function titleCase(v) { return acClean(v).replace(/(^|[\s'’.])(\p{L})/gu, function (m, sep, ch) { return sep + ch.toLocaleUpperCase(); }); }
  function fullName() { return titleCase(tidyName($("#ac-first").value) + " " + tidyName($("#ac-last").value)); }
  function nameFault(s) {
    if (!s) return "Enter your first and last name";
    if (/[^\p{L}\p{M}\s.]/u.test(s) || /(^|[\s.])\./.test(s)) return NAME_CHARS;
    var letters = s.replace(/[ً-ٰٟ]/g, "");
    if (/[A-Za-z]/.test(letters) && /[؀-ۿ]/.test(letters)) return "Write your name in one alphabet";
    var parts = letters.split(/\s+/).filter(function (p) { return p.replace(/[.\p{M}]/gu, ""); });
    var cjk = parts.length === 1 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(parts[0]);
    if (parts.length < 2 && !cjk) return "Enter your first and last name";
    if (parts.length > 1 && nameShort(letters)) return NAME_SHORT;
    if (parts.some(function (p) { return /^(test|asdf|qwerty|user|admin|none|null|name|x{2,}|abc|unknown|other|guest)$/i.test(p.replace(/\./g, "")); })) return "Please enter your real name";
    return "";
  }
  // A rider password (the booking app's rule since 2026-11-11): 8 or more characters, not one character over and over.
  // The database refuses the common ones (WEAK_PASSWORD), said on the same box.
  function passwordFault(pw) { if (Array.from(pw).length < 8) return "Use at least 8 characters."; if (/^([\s\S])\1*$/u.test(pw)) return "This password is too easy to guess. Choose another."; return ""; }

  /* ── Sign in ── */
  async function doSignIn() {
    if (acBusy) return;
    hideBanner(); $("#ac-temp").hidden = true;
    var ok = true;
    if (!acClean($("#ac-ident").value)) { setError("f-ac-ident", true); ok = false; }
    if (!$("#ac-spwd").value) { setError("f-ac-spwd", true, "Enter your password."); ok = false; }
    if (!ok) { focusInvalid(); return; }
    acLoading("#ac-signin-btn", true);
    try {
      var r = await MMAccount.signIn(arpc, $("#ac-ident").value, $("#ac-spwd").value);
      if (r.row) {
        acct = { id: r.row.id, token: r.row.session_token, name: r.row.name || "", email: r.row.email || "", phone: r.row.phone || "", made: false };
        $("#ac-spwd").value = "";
        await enterDetails();
        return;
      }
      track(step, "error", "signin");
      if (r.error === "locked") setError("f-ac-spwd", true, "Too many failed attempts. Wait about 15 minutes and try again, or reset your password.");
      else if (r.error === "busy") showBanner(TOO_MANY);
      else if (r.error === "network") showBanner(NET);
      else if (r.error === "temp") { $("#ac-temp").hidden = false; try { $("#ac-temp").scrollIntoView({ block: "center" }); } catch (e) {} }
      else if (r.error === "id") setError("f-ac-ident", true);
      else if (r.error === "pwd") setError("f-ac-spwd", true, "Enter your password.");
      else setError("f-ac-spwd", true, r.cc ? "No account has that number as a Saudi number. If your number is from another country, type it with its country code, like +20 1012345678." : "Those sign-in details aren’t right. Try again.");
      focusInvalid();
    } finally { acLoading("#ac-signin-btn", false); }
  }

  /* ── Create account: every box judged at once, each message under its box ── */
  function createCheck() {
    var bad = [], fail = function (id, msg, args) { setError(id, true, msg, args); bad.push(id); };
    ["f-ac-name", "f-ac-gender", "f-ac-email", "f-ac-phone", "f-ac-pwd", "f-ac-pwd2", "f-ac-height", "f-em-name", "f-em-phone", "f-em-rel", "f-ac-ack"].forEach(function (id) { setError(id, false); });
    $("#ac-first").value = tidyName($("#ac-first").value); $("#ac-last").value = tidyName($("#ac-last").value);
    var first = $("#ac-first").value, last = $("#ac-last").value;
    var nf = !first || !last ? "Enter your first and last name" : nameFault(first + " " + last);
    if (nf) { $("#ac-first")._nameHintUntil = 0; $("#ac-last")._nameHintUntil = 0; fail("f-ac-name", nf); }
    if (!acGender) fail("f-ac-gender");
    var em = acClean($("#ac-email").value).toLowerCase(); emailFix = null;
    if (!em) fail("f-ac-email", "Enter your email address");
    else { var ce = checkEmail(em); if (ce.hard) { fail("f-ac-email", ce.hard[0], ce.hard[1]); emailFix = ce.fix || null; } }
    paintEmailFix();
    var phone = toE164(ccDigitsOf($("#ac-cc")), $("#ac-phone").value), mf = mobileFault($("#ac-phone").value, phone);
    if (mf) fail("f-ac-phone", mf[0], mf[1]);
    var pw = $("#ac-pwd").value, pf = passwordFault(pw);
    if (pf) fail("f-ac-pwd", pf);
    else if ($("#ac-pwd2").value !== pw) fail("f-ac-pwd2", "Passwords do not match.");
    if (!heightOk($("#ac-height").value)) fail("f-ac-height");
    var ec = emRead("em", phone);
    if (ec.err) fail(ec.err[0], ec.err[1]);
    if (!$("#ac-ack").checked) fail("f-ac-ack");
    bad.forEach(function (id) { track(step, "error", id.replace(/^f-(ac-)?/, "").replace(/-/g, "_")); });
    return bad.length ? null : { name: fullName(), email: em, phone: phone, pwd: pw, height: heightOf($("#ac-height").value) };
  }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); } // the booking site's own ids
  async function createAccount() {
    if (acBusy) return;
    hideBanner();
    // The account is made already (reading it back did not answer): the button goes on with it.
    if (acct && acct.made) { acLoading("#ac-create-btn", true); try { await enterDetails(); } finally { acLoading("#ac-create-btn", false); } return; }
    var v = createCheck();
    if (!v) { focusInvalid(); return; }
    acLoading("#ac-create-btn", true);
    try {
      // Each on its own, so the message says which one is taken (as the sign-up page does); a check that got no answer
      // is asked once more.
      var exists = async function (b) { var x = await arpc("customer_exists", b); return x.error ? arpc("customer_exists", b) : x; };
      var ex = await exists({ p_email: v.email, p_phone: "" });
      if (ex.data === true) { setError("f-ac-email", true, "An account with this email already exists. Sign in to book with it."); focusInvalid(); return; }
      ex = await exists({ p_email: "", p_phone: v.phone });
      if (ex.data === true) { setError("f-ac-phone", true, "An account with this mobile number already exists. Sign in to book with it."); focusInvalid(); return; }
      var id = uid();
      var r = await arpc("customer_signup", { p_id: id, p_name: v.name, p_email: v.email, p_phone: v.phone, p_pwd: v.pwd, p_height: v.height, p_type_preference: "Any", p_gender: acGender });
      if (r.error) { signupRefused(r.error); return; }
      var tok = r.data && r.data[0] && r.data[0].session_token;
      if (!tok) { showBanner(NET); return; }
      acct = { id: id, token: tok, name: v.name, email: v.email, phone: v.phone, made: true };
      $("#ac-pwd").value = ""; $("#ac-pwd2").value = "";
      // The notice they confirmed and their ride-news answer, recorded the moment the account exists.
      var body = { p_id: id, p_token: tok, p_privacy: ACCT.PRIVACY_VERSION, p_ride_news: $("#ac-news").checked };
      var c = await arpc("customer_consents", body);
      if (c.error) await arpc("customer_consents", body);
      // Then the emergency contact typed with it. Should it not save, the next panel asks for it again.
      var em = await emSave("em");
      if (!em.ok) { emRetry = true; ["name", "cc", "phone", "rel"].forEach(function (k) { $("#xem-" + k).value = $("#em-" + k).value; }); ccFace($("#xem-cc")); }
      await enterDetails();
      if (acct) setNotice("Your account has been created");
      if (!em.ok && em.field) setError(em.field.replace("f-em-", "f-xem-"), true, em.key);
    } finally { acLoading("#ac-create-btn", false); }
  }
  function signupRefused(e) {
    var m = errText(e);
    if (/name_chars/.test(m)) setError("f-ac-name", true, NAME_CHARS);
    else if (/name_short/.test(m)) setError("f-ac-name", true, NAME_SHORT);
    // customer_signup's DUPLICATE names neither the email nor the mobile, and the checks before it found neither: both are named.
    else if (/23505|DUPLICATE/i.test(m)) setError("f-ac-email", true, "An account with this email or mobile number already exists. Sign in to book with it.");
    else if (/RATE_LIMITED/.test(m)) { showBanner(TOO_MANY); return; }
    else if (/WEAK_PASSWORD/.test(m)) { var wp = $("#ac-pwd").value; setError("f-ac-pwd", true, !/[A-Z]/.test(wp) || !/[0-9]/.test(wp) ? "Use at least 8 characters, with an upper-case letter and a number." : "This password is too easy to guess. Choose another."); }
    else if (/BAD_INPUT/.test(m) && /phone/.test(m)) setError("f-ac-phone", true, "Enter a valid mobile number");
    else if (/BAD_INPUT/.test(m) && /height/.test(m)) setError("f-ac-height", true);
    else { showBanner(NET); return; }
    focusInvalid();
  }

  /* ── Signed in: who is booking, the company they are from, and what the account still owes ── */
  function paintWho() { $("#ac-who").textContent = acct ? t("Booking as {name}", { name: acct.name || "" }) + (acct.email ? " · " + acct.email : "") : ""; }
  function guestSignedOut() {
    acct = null; prof = null; emRetry = false;
    if (paneAt(step) !== "account") { returnTo = step; goStep(stepOf("account")); }
    acShow("signin"); paintWho();
    showBanner("You were signed out. Sign in again to book.");
  }
  async function readAccount() {
    var who = { p_id: acct.id, p_token: acct.token };
    var all = await Promise.all([arpc("customer_profile", who), arpc("customer_emergency", who), arpc("customer_fix_fields", who), arpc("customer_about", who)]);
    var p = all[0], em = all[1], fx = all[2], ab = all[3];
    if (p.error) return { error: p.error };
    var row = Array.isArray(p.data) ? p.data[0] : null;
    if (!row || row.id !== acct.id) return { signedOut: true };
    return {
      prof: row,
      em: em.error ? (absent(em.error) ? "absent" : null) : (Array.isArray(em.data) ? em.data[0] || null : null),
      fix: !fx.error && Array.isArray(fx.data) ? fx.data.map(String) : [],
      about: !ab.error && Array.isArray(ab.data) ? ab.data[0] || null : null
    };
  }
  async function enterDetails() {
    var a = await readAccount();
    if (a.signedOut) { guestSignedOut(); return; }
    if (a.error) { showBanner(NET); return; }
    prof = a.prof;
    acct.name = prof.name || acct.name; acct.email = prof.email || acct.email; acct.phone = prof.phone || acct.phone;
    var fix = a.fix, flag = function (k) { return fix.indexOf(k) >= 0; };
    var hasEm = a.em === "absent" || !!(a.em && a.em.emergency_name && a.em.emergency_phone && a.em.emergency_relation);
    var hasHeight = Number(prof.height) >= 100 && Number(prof.height) <= 250;
    owe = { height: !hasHeight || flag("height"), em: !hasEm || flag("emergency") || emRetry, nat: flag("nationality"), birth: flag("birth_date") };
    blocked = fix.some(function (k) { return ASKABLE.indexOf(k) < 0; });
    fixed = fix;
    held = { phone: acct.phone, birth_date: prof.birth_date, nationality: prof.nationality, height: prof.height,
      emergency: a.em && a.em !== "absent" ? { name: a.em.emergency_name, phone: a.em.emergency_phone, relation: a.em.emergency_relation } : null };
    // What the account holds goes into the boxes it asks again; the company the booking or the account already names.
    if (!acClean($("#ac-company").value) && a.about && acClean(a.about.workplace)) $("#ac-company").value = acClean(a.about.workplace).slice(0, 120);
    if (prof.birth_date) setBirth(prof.birth_date);
    if (prof.nationality && Array.prototype.some.call($("#ac-nat").options, function (o) { return o.value === prof.nationality; })) $("#ac-nat").value = prof.nationality;
    if (hasHeight && !$("#ac-xheight").value) $("#ac-xheight").value = String(prof.height);
    if (a.em && a.em !== "absent" && $("#xem-name").value === "") fillEm("xem", a.em.emergency_name, a.em.emergency_phone, a.em.emergency_relation);
    paintDetails();
    acShow("details");
    acFocus(blocked ? "#ac-who" : "#ac-company");
  }
  function paintDetails() {
    $("#f-ac-xheight").hidden = !owe.height;
    $("#xem-block").hidden = !owe.em;
    $("#f-ac-nat").hidden = !owe.nat;
    $("#f-ac-birth").hidden = !owe.birth;
    $("#ac-blocked").hidden = !blocked;
    paintWho();
  }
  function companyTyped() { return acClean($("#ac-company").value); }
  function companyOk() { var n = Array.from(companyTyped()).length; return n >= 2 && n <= 120; }
  // The answers this panel gives to the questions staff flagged, in customer_fix_save's names.
  function flaggedAnswers(ec) {
    var out = {}, put = function (k, v) { if (fixed.indexOf(k) >= 0) out[k] = v; };
    if (owe.birth) put("birth_date", birthValue());
    if (owe.nat) put("nationality", $("#ac-nat").value);
    if (owe.height) put("height", String(heightOf($("#ac-xheight").value)));
    if (ec && !ec.err) put("emergency", { name: ec.name, phone: ec.phone, relation: ec.rel });
    return out;
  }
  var SAME_AGAIN = "This is the same as what is on your account. Please correct it.";
  var SAME_FIELD = { birth_date: "f-ac-birth", nationality: "f-ac-nat", height: "f-ac-xheight", emergency: "f-xem-name" };
  function detailsCheck() {
    var bad = [], fail = function (id, msg, args) { setError(id, true, msg, args); bad.push(id); };
    ["f-ac-company", "f-ac-xheight", "f-xem-name", "f-xem-phone", "f-xem-rel", "f-ac-nat", "f-ac-birth"].forEach(function (id) { setError(id, false); });
    $("#ac-company").value = companyTyped();
    if (!companyOk()) fail("f-ac-company");
    if (owe.height && !heightOk($("#ac-xheight").value)) fail("f-ac-xheight");
    var ec = owe.em ? emRead("xem", acct.phone) : null;
    if (ec && ec.err) fail(ec.err[0], ec.err[1]);
    if (owe.nat && !$("#ac-nat").value) fail("f-ac-nat");
    if (owe.birth) {
      var b = birthValue();
      if (!b) fail("f-ac-birth");
      else if (b > todayKsa()) fail("f-ac-birth", "A birth date can't be in the future.");
      else if (b > dobMax()) fail("f-ac-birth", "Riders must be at least 5 years old. Check the birth date.");
    }
    // A flagged question takes another answer than the one the account holds (the owner, 2026-11-09), as the booking
    // app's check-up refuses it; MMAccount.same is the rule.
    var ans = flaggedAnswers(ec);
    Object.keys(ans).forEach(function (k) { if (bad.indexOf(SAME_FIELD[k]) < 0 && MMAccount.same(k, ans[k], held)) fail(SAME_FIELD[k], SAME_AGAIN); });
    bad.forEach(function (id) { track(step, "error", id.replace(/^f-(ac-)?/, "").replace(/-/g, "_")); });
    return !bad.length;
  }
  // Saves what the account owed. True when the booking can go on.
  async function saveDetails() {
    var saved = [], r, gone = function (x) { return x && x.data === false; };
    var busy = function (x) { showBanner(/RATE_LIMITED/.test(errText(x.error)) ? TOO_MANY : NET); };
    var ec = owe.em ? emRead("xem", acct.phone) : null;
    var fv = flaggedAnswers(ec);
    if (Object.keys(fv).length) {
      r = await arpc("customer_fix_save", { p_id: acct.id, p_token: acct.token, p_values: fv });
      if (r.error && !absent(r.error)) { busy(r); return false; }
    }
    if (owe.em) {
      var em = await emSave("xem");
      if (em.signedOut) { guestSignedOut(); return false; }
      if (!em.ok) { if (em.field) { setError(em.field, true, em.key); focusInvalid(); } else showBanner(em.banner); return false; }
      emRetry = false; saved.push("emergency");
    }
    if (owe.birth || owe.nat) {
      // Both are written together: the one not asked goes back as the account holds it.
      r = await arpc("customer_set_birth_nat", { p_id: acct.id, p_token: acct.token, p_birth_date: owe.birth ? birthValue() : (prof.birth_date || ""), p_nationality: owe.nat ? $("#ac-nat").value : (prof.nationality || "") });
      if (gone(r)) { guestSignedOut(); return false; }
      if (r.error) { if (/dob|birth/i.test(errText(r.error))) { setError("f-ac-birth", true, "Please check your date of birth."); focusInvalid(); } else busy(r); return false; }
      saved.push("birth_date", "nationality");
    }
    if (owe.height) {
      var h = heightOf($("#ac-xheight").value);
      if (h !== Number(prof.height)) {
        r = await arpc("customer_set_height", { p_id: acct.id, p_token: acct.token, p_height: h });
        if (gone(r)) { guestSignedOut(); return false; }
        if (r.error) { if (/height/i.test(errText(r.error))) { setError("f-ac-xheight", true); focusInvalid(); } else busy(r); return false; }
        prof.height = h;
      }
      saved.push("height");
    }
    // What the account still owes, read again: one this page just answered, or one it cannot ask, is finished in the
    // booking app.
    var fx = await arpc("customer_fix_fields", { p_id: acct.id, p_token: acct.token });
    if (fx.error) { busy(fx); return false; }
    if (fx.data == null) { guestSignedOut(); return false; }
    var left = Array.isArray(fx.data) ? fx.data.map(String) : [];
    if (left.some(function (k) { return ASKABLE.indexOf(k) < 0 || saved.indexOf(k) >= 0; })) {
      blocked = true; paintDetails(); try { $("#ac-blocked").scrollIntoView({ block: "center" }); } catch (e) {} return false;
    }
    if (left.length) { await enterDetails(); return false; }
    blocked = false; owe = { height: false, em: false, nat: false, birth: false }; paintDetails();
    return true;
  }
  async function accountNext() {
    if (acBusy) return;
    hideBanner();
    if (!detailsCheck()) { focusInvalid(); return; }
    var ok = false;
    acLoading("#next", true);
    try { ok = await saveDetails(); } finally { acLoading("#next", false); }
    if (!ok) return;
    setNotice(null);
    if (returnTo) { var r = returnTo; returnTo = 0; goStep(r); return; }
    goStep(step + 1);
  }

  /* ── What live-submit.js asks of this file ── */
  // Whether the account step is done, as Check and agree needs it: signed in, a company typed, nothing left to finish.
  function guestReady() {
    if (!acct || blocked || owe.height || owe.em || owe.nat || owe.birth) return false;
    if (!companyOk()) { setError("f-ac-company", true); return false; }
    return true;
  }
  // The booking's answers: the account's own name and mobile, the company typed.
  function guestCollect(d) {
    var e = editing || {};
    d.kind = "guest"; d.badge = ""; d.height = null; d.account = true;
    d.name = acct ? acct.name : e.name || ""; d.phone = acct ? acct.phone : e.phone || "";
    d.company = companyTyped();
  }
  // A booking laid into the form (its company), or a fresh form (null).
  function guestPrefill(d) {
    $("#ac-company").value = d && d.company ? d.company : "";
    setError("f-ac-company", false);
  }
  // The account is forgotten: Register another, or a booking of another kind brought on the screen.
  function guestForget() {
    acct = null; prof = null; emRetry = false; blocked = false; owe = { height: false, em: false, nat: false, birth: false };
    ["ac-ident", "ac-spwd", "ac-first", "ac-last", "ac-email", "ac-phone", "ac-pwd", "ac-pwd2", "ac-height", "ac-company", "ac-xheight", "em-name", "em-phone", "xem-name", "xem-phone"].forEach(function (id) { $("#" + id).value = ""; });
    $("#ac-ack").checked = false; $("#ac-news").checked = false; acGender = null;
    acGenders.querySelectorAll(".tile").forEach(function (x) { x.setAttribute("aria-checked", "false"); }); syncRoving(acGenders);
    $("#ac-temp").hidden = true; emailFix = null; paintEmailFix();
    acShow("ask"); paintDetails();
  }
  /* Edit: the booking as the server holds it now, then the account that made it (signed into again after a reload),
     and the summary. A booking the desk has checked in, or one made on the old page (no account), is not changed here. */
  async function startGuestEdit() {
    var was = current, r = null;
    editAsking = true; $("#edit").disabled = true;
    try { r = await lookupCall(was.bookingNo, was.phone, was.session && was.session.id); } catch (e) { r = null; }
    editAsking = false; $("#edit").disabled = false;
    if (current !== was) return;
    var d = r && !r.error && r.data;
    if (d && d.ok) {
      var live = fromLookup(d, was.phone);
      live.session = Object.assign({}, was.session || {}, d.session || {});
      live.submittedAt = was.submittedAt || live.submittedAt;
      if (live.company == null) live.company = was.company || null;
      if (d.checked_in) { showSuccess(live); setNote("You have already checked in. Ask the desk to change your booking."); return; }
      if (live.account === false) { showSuccess(live); return; }
      current = live; try { localStorage.setItem(STORE, JSON.stringify(live)); } catch (e) {}
    }
    editing = current; another = false; prefill(current); setSubmitLabels(true);
    $("#success").hidden = true; $("#card").setAttribute("data-state", "form");
    hideBanner(); setNotice(null); returnTo = 0;
    if (!acct) { returnTo = STEPS; goStep(stepOf("account")); acShow("signin"); acFocus("#ac-ident"); }
    else goStep(selectedSession ? STEPS : stepOf("session"));
    loadSessions();
  }
  var TYPE_SHUT = "That bike type is closed for this ride. Choose another.";
  // The booking itself: the account's, on the night and bike picked, from the company typed.
  async function guestSubmit(data) {
    if (!acct) { guestSignedOut(); return; }
    var a = { p_id: acct.id, p_token: acct.token, p_session_id: data.session ? data.session.id : null, p_type: data.type, p_company: data.company, p_waiver: WAIVER_VERSION };
    if (editing) { a.p_from_no = editing.bookingNo; a.p_from_session = (editing.session && editing.session.id) || null; }
    setLoading(true);
    var r; try { r = await sbClient().rpc("petromin_guest_book", a); } catch (err) { r = { error: err }; }
    setLoading(false);
    if (/WAIVER_OUTDATED/.test(String((r && r.error && r.error.message) || ""))) { failBanner(WAIVER_OUTDATED); return; }
    if (!r || r.error || !r.data) { track(STEPS, "fail", noAnswer(r) ? "network" : "server"); failBanner(noAnswer(r) ? NET : "We could not save this. Please try again."); return; }
    var d = r.data;
    if (!d.ok) {
      track(STEPS, "fail", d.error);
      if (d.error === "signin") { guestSignedOut(); return; }
      if (d.error === "waiver") { waiverRefused(); return; }
      if (d.error === "throttled") { failBanner("Too many submissions from this network"); return; }
      if (d.error === "company") { returnTo = STEPS; goStep(stepOf("account")); setError("f-ac-company", true); focusInvalid(); return; }
      if (d.error === "type") { returnTo = STEPS; goStep(stepOf("bike")); setError("f-type", true); focusInvalid(); return; }
      if (d.error === "type_closed" || d.error === "type_full") { returnTo = STEPS; goStep(stepOf("bike")); setError("f-type", true, TYPE_SHUT); focusInvalid(); return; }
      if (d.error === "session") { returnTo = STEPS; goStep(stepOf("session")); setError("f-session", true, "This session is no longer open"); loadSessions(); focusInvalid(); return; }
      // The account already rides that night on a booking of its own (a member's, a tag holder's): no guest booking is made.
      if (d.error === "booked") { returnTo = STEPS; goStep(stepOf("session")); setError("f-session", true, "You already have a booking on this ride."); focusInvalid(); return; }
      if (d.error === "checked_in") { failBanner("You have already checked in. Ask the desk to change your booking."); return; }
      if (d.error === "notfound") { editing = null; setSubmitLabels(false); try { localStorage.removeItem(STORE); } catch (err) {} failBanner("We could not find your booking. Please register again."); return; }
      // The account owes an answer (the nationality from its second booking on): asked on the account step, then back here.
      if (d.error === "fix") { await enterDetails(); if (acct) { returnTo = STEPS; goStep(stepOf("account")); showBanner("Your account still needs a few details before it can book."); } return; }
      failBanner("We could not save this. Please try again."); return;
    }
    failures = 0; $("#banner-help").hidden = true;
    var rec = { kind: "guest", name: d.name || acct.name, phone: d.phone || acct.phone, company: d.company || data.company, type: d.type || data.type,
      status: d.status || null, price: d.price != null ? d.price : null, ref: d.ref || null, account: true, bookingNo: d.booking_no || d.invite_no, riders: [],
      session: Object.assign({}, data.session || {}, d.session || {}) };
    var wasEdit = !!editing; editing = null;
    if (!wasEdit) track(STEPS, "done");
    if (another && current && keyOf(current) !== keyOf(rec)) keep(current); // the confirmation before this one stays on the phone
    another = false; setSubmitLabels(false);
    showSuccess(rec);
    setNote(wasEdit ? "Your booking was updated." : d.resubmitted ? "Your details were updated." : null);
  }
  buildLists();
  acShow("ask");
