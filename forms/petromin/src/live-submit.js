  /* Every word the form shows is in T (design/app.js), in all fifteen languages besides English: the tables this file
     used to merge in were folded into it on 2026-11-11, so the website's copy can carry one language (t/<lang>.json). */
  /* Why a typed character did not appear in a name box - the rentals site's own words. */
  var NAME_CHARS = "Names can only contain letters, spaces and periods.";
  /* Every word of a name has at least two letters, as on the rentals site (since 2026-09-25):
     the employee's (the site's own words) and each companion's. */
  var NAME_SHORT = "Write your first and last name in full, not initials";
  var RIDER_SHORT = "Write the rider's name in full, not initials";
  // A word with fewer than two letters (its marks count, as Hindi and Bengali vowel signs do). A
  // period ends a word as a space does: "Md. Rahman" is fine, "M. Rahman" is an initial.
  function nameShort(v) {
    return String(v || "").split(/[\s.]+/).some(function (w) { return w && Array.from(w).length < 2; });
  }
  /* Ride waiver (owner, 2026-10-03): nobody registers or saves an edit without agreeing to it.
     Title and text are the booking app's (micromobilityrentals app.src.html waiverTitle/waiverBody and
     i18n/<code>.json), copied verbatim; only the agree line is reworded for a registration. Its
     version goes to rider_register / rider_edit as p_waiver, the page's language as p_lang. */
  var WAIVER_VERSION = "2026-10-v3";
  /* Two refusals the database gives since the rentals migration of 2026-10-05: a waiver older than the current one
     (WAIVER_OUTDATED, a page loaded before the waiver changed) and a paid booking moved to a session with another
     price (PAID_MOVE). */
  var WAIVER_OUTDATED = "The ride waiver has changed. Reload this page to read and accept the new one.";
  var PAID_MOVE = "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.";
  /* Names a screen reader hears but nobody sees (aria-label). */
  var ARIA_EL = [["#lang", "Language"], [".lang-wrap", "Language"], ["#cc", "Country code"], [".cc-wrap", "Country code"], ["#fd-cc", "Country code"], ["#stepper", "Progress"], ["#sessions", "Session"], ["#qr", "Booking QR code"]];
  function paintAria() { ARIA_EL.forEach(function (x) { document.querySelectorAll(x[0]).forEach(function (el) { el.setAttribute("aria-label", t(x[1])); }); }); }
  langHooks.push(paintAria);
  paintAria();

  /* Live wiring: sessions and submit go through the rentals Supabase project. The anon key is
     public by design; every RPC is SECURITY DEFINER and validates/throttles on the server. */
  var SUPABASE_URL = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.url) || "https://qpffkzmsfyilicwcsszz.supabase.co";
  var SUPABASE_KEY = (SITE_FORM && SITE_FORM.db && SITE_FORM.db.key) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmZrem1zZnlpbGljd2Nzc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDQwODAsImV4cCI6MjEwNTgyMDA4MH0.K6qZpK0oR4MXIaFk4DRJGy-H_m6BYnJ-S31swTiHMhQ";
  var SOURCE = (location.pathname.split("/").filter(Boolean)[0] || "petromin").toLowerCase(); // 'petromin' on micromobility.sa/petromin
  if (SITE_FORM && LANGS[SOURCE]) SOURCE = (location.pathname.split("/").filter(Boolean)[1] || "petromin").toLowerCase(); // /ar/petromin on the website
  var _sb = null;
  /* The website's page loads no supabase-js (its address is not one the site's scripts may come from): the calls the
     form makes are plain POSTs to the database's /rest/v1/rpc, answered as supabase-js answers them ({data, error},
     a refusal's code and message as PostgREST sends them, a network failure as an error, never thrown). */
  function rpcFetch(fn, args) {
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) })
      .then(function (res) {
        return res.text().then(function (txt) {
          var body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
          if (res.ok) return { data: body, error: null, status: res.status };
          var err = body && typeof body === "object" ? body : { message: String(body || res.statusText) };
          return { data: null, error: { message: err.message || res.statusText, code: err.code || String(res.status), details: err.details || null, hint: err.hint || null }, status: res.status };
        });
      }, function (e) { return { data: null, error: { message: "TypeError: " + (e && e.message || "Failed to fetch"), code: "", details: String(e), hint: "" }, status: 0 }; });
  }
  function sbClient() { if (!_sb) _sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : { rpc: rpcFetch }; return _sb; }
  // A call the database does not know yet (its migration not applied): 404, PGRST202.
  function unknownCall(r) { return !!(r && r.error && (r.error.code === "PGRST202" || r.status === 404)); }
  // No answer at all (the network) rather than a refusal the server gave.
  function noAnswer(r) { var m = String((r && r.error && r.error.message) || ""); return !!(r && r.error && (!r.status || /TypeError|fetch|network/i.test(m) && !r.error.code)); }
  function toAscii(s) { return asciiDigits(s); }

  /* How far riders get, counted per step without anyone in it (form_step, rentals 20261111030000): a step seen once
     per visit, a box refused at Continue, a registration, a refusal by its code. A test browser counts nothing. */
  var seen = {};
  function track(stepNo, ev, field) {
    try {
      if (navigator.webdriver || editing) return;
      if (ev === "view") { if (seen[stepNo]) return; seen[stepNo] = 1; }
      sbClient().rpc("form_step", { p_form: SOURCE, p_step: stepNo, p_event: ev, p_field: String(field || "").toLowerCase().replace(/[^a-z_]/g, "").slice(0, 24), p_lang: html.lang }).then(function () {}, function () {});
    } catch (e) {}
  }
  stepHooks.push(function (n) { if (booted && $("#success").hidden) track(n, "view"); });

  /* Names hold letters, spaces and periods, as on the rentals site: a dash becomes a space
     ("Al-Harbi" is "Al Harbi", not "AlHarbi"), and digits, emoji and other signs are dropped as they
     are typed. Letters of every script and their combining marks stay (Hindi, Nepali and Bengali
     vowel signs). A period comes right after a letter ("Md. Rahman"): one that would start the name
     or a word, or follow another period, is dropped, as the database refuses it. */
  var NAME_DASHES = /[\p{Pd}−]/gu, NAME_BAD = /[^\p{L}\p{M}\s.]/gu;
  function nameSigns(v) { return String(v || "").replace(NAME_DASHES, " ").replace(NAME_BAD, ""); }
  function cleanName(v) { return nameSigns(v).replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1"); }
  function tidyName(v) { return cleanName(v).trim().replace(/\s+/g, " "); }
  // A name box's message: the given one, or back to the box's own ("Enter your full name").
  function nameMsg(f, msg) {
    var err = f && f.querySelector(".err"); if (!err) return;
    if (!err.hasAttribute("data-t0")) err.setAttribute("data-t0", err.getAttribute("data-t"));
    err.setAttribute("data-t", msg || err.getAttribute("data-t0")); render(err);
  }
  // What the rule drops goes on the spot, the caret kept where it was, and the reason stays under the box for three
  // seconds rather than flashing away on the next keystroke. A stray period just goes, without the reason: a period
  // may be typed.
  function onNameInput(el) {
    var f = el.closest(".field"), v = el.value, c = cleanName(v);
    if (c !== v) {
      var at = Math.max(0, (el.selectionStart == null ? c.length : el.selectionStart) - (v.length - c.length));
      el.value = c; try { el.setSelectionRange(at, at); } catch (e) {}
    }
    if (nameSigns(v) !== v) {
      el._nameHintUntil = Date.now() + 3000;
      clearTimeout(el._nameHintTimer);
      el._nameHintTimer = setTimeout(function () { if (el._nameHintUntil) { el._nameHintUntil = 0; f.classList.remove("invalid"); nameMsg(f); } }, 3000);
    }
    if (el._nameHintUntil > Date.now()) { f.classList.add("invalid"); nameMsg(f, NAME_CHARS); }
    else if (!f.classList.contains("invalid")) nameMsg(f);
  }
  // Leaving a name box tidies it as it is sent: no spaces at the ends, one between words.
  function onNameBlur(el) { var v = tidyName(el.value); if (v !== el.value) el.value = v; }
  $("#name").addEventListener("input", function () { onNameInput(this); });
  $("#name").addEventListener("blur", function () { onNameBlur(this); });
  var FIELD_ERR = { badge: "Enter your badge number", name: "Enter your full name", phone: "Enter a valid mobile number", height: "Enter your height in cm (100 to 250)", type: "Choose a bike type", session: "This session is no longer open", company: "Choose your company" };
  var FIELD_STEP = { session: 1, company: 2, badge: 2, name: 2, phone: 2, height: 3, type: 3 };

  /* The second step checks what rider_register checks, so Continue says it there and then: a badge of the characters
     the database takes (letters, digits, space . _ / # ’ -, at least one letter or digit), a name of two words, none
     of them an initial, and a number of 8 to 15 digits with its country code (the database's +E.164 rule). The third
     checks every companion, the fourth the two boxes. */
  var BADGE_OK = /^[A-Za-z0-9 ._\/#’-]{1,40}$/;
  var _phoneValidDesign = phoneValid;
  phoneValid = function () {
    if (!_phoneValidDesign()) return false;
    var all = (cc.value + nationalDigits()).length;
    return cc.value === "966" || (all >= 8 && all <= 15);
  };
  var _validateStepDesign = validateStep;
  validateStep = function (n) {
    var ok = _validateStepDesign(n);
    if (n === 2) {
      var badge = toAscii($("#badge").value).trim();
      if (badge && (!BADGE_OK.test(badge) || !/[A-Za-z0-9]/.test(badge))) { setError("f-badge", true); ok = false; }
      var nm = tidyName($("#name").value);
      if (nm && !/\s/.test(nm)) { $("#name")._nameHintUntil = 0; setError("f-name", true, "Enter your full name"); ok = false; }
      else if (nm && nameShort(nm)) { $("#name")._nameHintUntil = 0; setError("f-name", true, NAME_SHORT); ok = false; }
    }
    if (n === 3) {
      var bad = companions.map(companionFault).indexOf(true);
      if (bad >= 0) { ok = false; if (booted) openRider(bad, true); }
    }
    if (n === 4) {
      if (!editing && !$("#privacy").checked) { setError("f-privacy", true); ok = false; }
      if (!$("#waiver").checked) { setError("f-waiver", true, "Please accept the waiver to continue."); ok = false; }
    }
    if (!ok && booted) document.querySelectorAll('.step[data-step="' + n + '"] .field.invalid').forEach(function (f) { track(n, "error", f.id.replace(/^f-/, "")); });
    if (!ok && booted && n === 3 && bad >= 0) track(3, "error", "rider");
    return ok;
  };
  // The box to focus is on the step on screen: a message left on another step is not jumped to.
  focusInvalid = function () {
    var first = $('.step:not([hidden]) .field.invalid input:not([type=hidden]), .step:not([hidden]) .field.invalid [role=radio]');
    if (first) first.focus();
  };
  // While a registration is on its way, nothing that changes the form underneath it can be pressed.
  var submitting = false;
  var _setLoadingDesign = setLoading;
  setLoading = function (on) {
    submitting = !!on; _setLoadingDesign(on);
    $("#back").disabled = !!on; $("#cancel-edit").disabled = !!on;
  };
  // An edit opened from a saved confirmation knows its night before the calendar answers (or after the night has left
  // the list): the review and the registration use it while it is the one picked.
  var _collectDesign = collect;
  collect = function () {
    var d = _collectDesign();
    if (!d.session && editing && editing.session && editing.session.id === selectedSession) d.session = editing.session;
    d.name = tidyName(d.name);
    d.badge = toAscii(d.badge).trim();
    return d;
  };

  /* Sessions: three grey cards while the calendar answers (nothing reads as "No upcoming sessions" before it has),
     and with no night to offer, the WhatsApp line beside the message. */
  var sessionsLoading = 0, sessionsAsked = 0;
  var _renderSessionsDesign = renderSessions;
  renderSessions = function () {
    var busy = sessionsLoading > 0 && !sessions.length;
    sessionsEl.setAttribute("aria-busy", String(busy));
    if (busy) {
      sessionsEl.innerHTML = '<div class="session skeleton" aria-hidden="true"><span></span><span></span></div>'.repeat(3);
      return;
    }
    _renderSessionsDesign();
    if (!sessions.length) {
      var a = document.createElement("a"); a.className = "pill sessions-help"; a.href = "https://wa.me/966566668818"; a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("data-t", "Need help? WhatsApp us"); render(a); sessionsEl.appendChild(a);
    }
  };
  // Only the latest ask paints: an older, slower answer (boot, then Edit) never replaces a newer one.
  async function loadSessions() {
    var mine = ++sessionsAsked;
    sessionsLoading++; renderSessions();
    try {
      var r = await sbClient().rpc("rider_sessions", { p_source: SOURCE });
      if (r.error) throw r.error;
      if (mine === sessionsAsked) { sessionsLoading = 0; setSessions(Array.isArray(r.data) ? r.data : []); }
    } catch (err) { if (mine === sessionsAsked) { sessionsLoading = 0; setSessions([]); showBanner("Could not reach the server"); } }
  }

  /* Dialogs: every one is centred on the screen (the owner's rule for pop-ups); a tap on the backdrop closes the
     ones that only show text. */
  function openDialog(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute("open", ""); }
  function closeDialog(d) { if (d.close) { if (d.open) d.close(); } else d.removeAttribute("open"); }
  // A question with two answers (remove a rider, cancel a booking): resolves true for yes.
  function ask(text, yes, no, danger) {
    var d = $("#ask-dialog");
    $("#ask-text").textContent = text;
    $("#ask-yes").textContent = t(yes); $("#ask-no").textContent = t(no);
    $("#ask-yes").classList.toggle("danger", !!danger);
    openDialog(d); $("#ask-no").focus();
    return new Promise(function (res) {
      function done(v) { $("#ask-yes").onclick = $("#ask-no").onclick = null; d.onclose = null; closeDialog(d); res(v); }
      $("#ask-yes").onclick = function () { done(true); };
      $("#ask-no").onclick = function () { done(false); };
      d.onclose = function () { done(false); };
    });
  }

  /* Companions: up to four extra riders under the same booking number, each a card on the third step (name, height,
     bike) with Change and Remove. A companion is written in a centred dialog, its three boxes judged together on Save,
     so a party of five stays a short list rather than fifteen boxes (GOV.UK / DWP "add another"). */
  var companions = [];
  var ridersEl = $("#riders");
  function cmOf(h) { return t("{n} cm", { n: h }); }
  function companionFault(c) { var h = heightOf(String(c.height || "")); return !c.name || nameShort(c.name) || !(h >= 100 && h <= 250) || (c.type !== "Hybrid" && c.type !== "Mountain"); }
  function renderCompanions() {
    ridersEl.innerHTML = "";
    companions.forEach(function (c, i) {
      var id = "rider-" + i;
      var row = document.createElement("div"); row.className = "rider"; row.setAttribute("role", "listitem"); row.setAttribute("data-i", String(i));
      row.innerHTML =
        '<div class="rider-main"><b class="rider-head" id="' + id + '-head"></b><span class="rider-name-v" dir="auto"></span><span class="rider-meta"></span></div>' +
        '<div class="rider-acts"><button type="button" class="rider-change" id="' + id + '-change" aria-labelledby="' + id + '-change ' + id + '-head" data-t="Change">Change</button>' +
        '<button type="button" class="rider-remove" id="' + id + '-remove" aria-labelledby="' + id + '-remove ' + id + '-head" data-t="Remove">Remove</button></div>';
      row.querySelector(".rider-head").textContent = t("Rider {n}", { n: i + 2 });
      row.querySelector(".rider-name-v").textContent = c.name || "";
      row.querySelector(".rider-meta").textContent = [c.height ? cmOf(heightOf(String(c.height)) || c.height) : "", c.type ? t(c.type) : ""].filter(Boolean).join(" · ");
      row.classList.toggle("invalid", companionFault(c));
      row.querySelectorAll("[data-t]").forEach(render);
      ridersEl.appendChild(row);
    });
    $("#add-rider").hidden = companions.length >= 4;
    setError("f-riders", false);
  }
  langHooks.push(renderCompanions);
  var riderAt = -1;
  var rdTypes = $("#rd-types"), rdType = null;
  rdTypes.addEventListener("click", function (e) {
    var tile = e.target.closest(".tile"); if (!tile) return;
    rdType = tile.getAttribute("data-v");
    rdTypes.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", String(b === tile)); });
    syncRoving(rdTypes); setError("rd-f-type", false);
  });
  radioKeys(rdTypes);
  // Opens the dialog on companion i (a new one at the end); `judge` shows what is wrong with it straight away (a
  // companion the server refused, or one saved before a rule).
  function openRider(i, judge, serverMsg) {
    var c = companions[i] || { name: "", height: "", type: "" };
    riderAt = i;
    var head = $("#rd-title"); head.setAttribute("data-args", JSON.stringify({ n: i + 2 })); render(head);
    $("#rd-name").value = c.name || ""; $("#rd-height").value = c.height != null ? String(c.height) : "";
    rdType = c.type || null;
    rdTypes.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-v") === rdType)); });
    syncRoving(rdTypes);
    ["rd-f-name", "rd-f-height", "rd-f-type"].forEach(function (id) { setError(id, false); nameMsg($("#" + id)); });
    openDialog($("#rider-dialog"));
    if (judge) { riderCheck(serverMsg); return; }
    $("#rd-name").focus();
  }
  // Every box of the companion judged at once, each message under its box; the first wrong box takes the focus.
  function riderCheck(serverMsg) {
    var nm = tidyName($("#rd-name").value), h = heightOf($("#rd-height").value), first = null;
    $("#rd-name").value = nm;
    function bad(id, msg, el) { setError(id, true, msg); if (!first) first = el; }
    if (!nm) bad("rd-f-name", null, $("#rd-name"));
    else if (nameShort(nm)) bad("rd-f-name", RIDER_SHORT, $("#rd-name"));
    else if (serverMsg && serverMsg.field === "name") bad("rd-f-name", serverMsg.msg, $("#rd-name"));
    if (!(h >= 100 && h <= 250)) bad("rd-f-height", null, $("#rd-height"));
    if (rdType !== "Hybrid" && rdType !== "Mountain") bad("rd-f-type", null, rdTypes.querySelector(".tile"));
    if (first) first.focus();
    return !first;
  }
  $("#rd-name").addEventListener("input", function () { setError("rd-f-name", false); onNameInput(this); });
  $("#rd-name").addEventListener("blur", function () { onNameBlur(this); });
  $("#rd-height").addEventListener("input", function () { if ($("#rd-f-height").classList.contains("invalid") && heightOk(this.value)) setError("rd-f-height", false); });
  $("#rd-height").addEventListener("blur", function () { if (this.value.trim()) setError("rd-f-height", !heightOk(this.value)); });
  $("#rider-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!riderCheck()) return;
    var c = { name: tidyName($("#rd-name").value), height: String(heightOf($("#rd-height").value)), type: rdType };
    var i = riderAt; if (i >= companions.length) { i = companions.length; companions.push(c); } else companions[i] = c;
    riderAt = -1;
    closeDialog($("#rider-dialog"));
    renderCompanions();
    var btn = ridersEl.querySelector('.rider[data-i="' + i + '"] .rider-change'); if (btn) btn.focus();
  });
  $("#rd-cancel").addEventListener("click", function () { riderAt = -1; closeDialog($("#rider-dialog")); $("#add-rider").hidden ? ridersEl.querySelector(".rider-change") && ridersEl.querySelector(".rider-change").focus() : $("#add-rider").focus(); });
  $("#add-rider").addEventListener("click", function () { if (companions.length >= 4) { setError("f-riders", true); return; } openRider(companions.length); });
  ridersEl.addEventListener("click", function (e) {
    var row = e.target.closest(".rider"); if (!row) return;
    var i = Number(row.getAttribute("data-i"));
    if (e.target.closest(".rider-change")) { openRider(i, companionFault(companions[i])); return; }
    if (e.target.closest(".rider-remove")) {
      var who = companions[i] && companions[i].name || t("Rider {n}", { n: i + 2 });
      ask(t("Remove {name} from this booking?", { name: who }), "Remove", "Keep it", true).then(function (yes) {
        if (!yes) return;
        companions.splice(i, 1); renderCompanions();
        var to = ridersEl.querySelector(".rider-change") || $("#add-rider"); if (to && !to.hidden) to.focus();
      });
    }
  });
  function companionArgs() { return companions.map(function (c) { return { name: tidyName(c.name), height: heightOf(String(c.height || "")), type: c.type }; }); }
  function showParty(d) {
    var n = 1 + ((d && d.riders) || []).length;
    $("#chip-riders").hidden = n < 2; $("#chip-riders-value").textContent = String(n);
    var note = $("#riders-note"); note.hidden = n < 2;
    if (n >= 2) { note.setAttribute("data-t", "Riding with: {names}"); note.setAttribute("data-args", JSON.stringify({ names: d.riders.map(function (c) { return c.name; }).join(", ") })); render(note); }
  }

  /* The fourth step: every answer on one page, each part with its Change (GOV.UK "check answers"). A change goes to
     its step, and Continue there comes straight back here. */
  // A row of the summary: what (a label, or a rider's name as it was typed) and the answer.
  function reviewRow(k, v, ltr, asIs) {
    return '<div class="rv-row"><span class="rv-k"' + (asIs ? ' dir="auto"' : "") + ">" + esc(asIs ? k : t(k)) + '</span><span class="rv-v"' + (ltr ? ' dir="ltr"' : ' dir="auto"') + ">" + esc(v) + "</span></div>";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function renderReview() {
    var d = collect(), box = $("#review"), s = d.session;
    var part = function (n, key, rows) {
      return '<section class="rv" aria-labelledby="rv-h' + n + '"><div class="rv-head"><h3 id="rv-h' + n + '">' + esc(t(key)) + '</h3>' +
        '<button type="button" class="rv-change" data-go="' + n + '" id="rv-c' + n + '" aria-labelledby="rv-c' + n + ' rv-h' + n + '">' + esc(t("Change")) + "</button></div>" + rows + "</section>";
    };
    // Each rider is a row of their own: the name, then height and bike.
    var bikes = reviewRow(d.name || t("Name"), [d.height ? cmOf(d.height) : "", d.type ? t(d.type) : ""].filter(Boolean).join(" · "), false, true);
    companions.forEach(function (c) { bikes += reviewRow(tidyName(c.name), [cmOf(heightOf(String(c.height))), t(c.type)].join(" · "), false, true); });
    var c = s && collectIso(s), ph = String(d.phone || ""), code = cc.value;
    if (ph.indexOf("+" + code) === 0) ph = "+" + code + " " + ph.slice(code.length + 1);
    box.innerHTML =
      part(1, "Session", s ? reviewRow("Session", fmtDate(s.start) + ", " + fmtTime(s.start) + (s.end ? " – " + fmtTime(s.end) : "") + (s.title ? " · " + s.title : "")) +
        (c ? reviewRow("Bike pickup", fmtTime(c)) : "") + reviewRow("Where", placeOf(s)) : "") +
      part(2, "Your details", reviewRow("Company", d.company || "") + reviewRow("Badge", d.badge, true) + reviewRow("Name", d.name) + reviewRow("Mobile number", ph, true)) +
      part(3, "Bike", bikes);
  }
  $("#review").addEventListener("click", function (e) {
    var b = e.target.closest(".rv-change"); if (!b) return;
    returnTo = STEPS; goStep(Number(b.getAttribute("data-go")));
  });
  stepHooks.push(function (n) { if (n === STEPS) renderReview(); });
  langHooks.push(function () { if (step === STEPS && $("#success").hidden) renderReview(); });

  /* Booking QR: MMP-<booking number>, the same shape as the rentals tickets (MMC-...), so the
     desk's scanner opens this booking with a Check in button. Drawn whenever the confirmation shows.
     On a canvas, white quiet zone included, as the rentals tickets since 2026-10-05: Samsung
     Internet's dark mode recolours every SVG (the code came out light on dark and did not scan) and
     leaves a canvas alone. The SVG stays as the fallback where a canvas cannot be drawn. */
  function drawQr(d) {
    var box = $("#qr"); if (!box) return;
    box.innerHTML = "";
    if (!d || !d.bookingNo || typeof qrcode !== "function") return;
    var q;
    try { q = qrcode(0, "M"); q.addData("MMP-" + String(d.bookingNo).toUpperCase()); q.make(); } catch (e) { return; }
    try {
      var n = q.getModuleCount(), pad = 3, cell = 8, size = (n + pad * 2) * cell;
      var cv = document.createElement("canvas"), ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      cv.width = size; cv.height = size;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#000";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + pad) * cell, (r + pad) * cell, cell, cell);
      cv.setAttribute("aria-hidden", "true");
      box.appendChild(cv);
    } catch (e) {
      try { box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); } catch (e2) {}
    }
  }
  // The night's facts on the ticket: when bikes are handed out, where, and the way there (the circuit's map link).
  function paintFacts(d) {
    var s = d && d.session, c = collectIso(s);
    $("#tk-pickup").hidden = !c; if (c) $("#tk-pickup-value").textContent = fmtTime(c);
    $("#tk-place").hidden = !s; if (s) $("#tk-place-value").textContent = placeOf(s);
    $("#directions").hidden = !s || !!s.place;
  }
  langHooks.push(function () {
    if (!current) return;
    var rr = $("#result"); rr.setAttribute("data-args", JSON.stringify({ d: sessionLabel(current.session) })); render(rr);
    paintSession(current);
    paintFacts(current);
  });
  // The night on the ticket: its date and its time each kept whole, so a narrow column never leaves "PM" (or the
  // Arabic "م") alone on a line.
  function paintSession(d) {
    var s = d && d.session, el = $("#chip-session-value"); if (!s || !el) return;
    el.innerHTML = '<span class="nw">' + esc(fmtDate(s.start)) + ",</span> " + '<span class="nw">' + esc(fmtTime(s.start)) + "</span>";
  }
  var _showSuccessDesign = showSuccess;
  showSuccess = function (d) {
    _showSuccessDesign(d); drawQr(current); showParty(current); paintFacts(current); paintSession(current);
    var n = $("#tk-name"); if (n) n.textContent = (current && current.name) || "";
    setNote(null); drawOthers(); paintWallet();
  };
  /* The notice's text. Tables carry each column's name on every cell, so a phone can show a row
     as a card (see .pv-body in styles.css). */
  function pvTable(head, rows) {
    return "<table><thead><tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return '<td data-label="' + head[i] + '">' + c + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table>";
  }
  var PV_MAIL = '<a href="mailto:info@micromobility.sa">info@micromobility.sa</a>';
  // The website's own page for the notice (it opens whatever the site's state); a ?privacy query is
  // the booking app's, and the website answered it with its home page.
  var PV_SITE = '<a href="https://micromobility.sa/privacy" target="_blank" rel="noopener">micromobility.sa/privacy</a>';
  // The notice's version: the day it was last updated (its first line below), as 'YYYY-MM-DD', the
  // shape the booking site records its own notice in. A new registration sends it as p_privacy, the
  // box ticked. Change it together with the "Last updated" lines.
  var PRIVACY_VERSION = "2026-09-22";
  var PV = {
    en: '<p class="pv-upd">Last updated: 22 September 2026</p>' +
      "<h3>Who we are</h3>" +
      "<p><b>شركة التنقل الدقيق المحدودة</b> (Micromobility Company Ltd.), unified number 7041881512, Building 7933, Ibn Anuq Al Fedha Street, Al Mansurah District, Riyadh 12692. We run the bike rides your employer arranges. Contact: " + PV_MAIL + ".</p>" +
      "<h3>What this form collects, and why</h3>" +
      pvTable(["Data", "Required?", "Why"], [
        ["Badge number, company", "Required", "To confirm you work for Petromin or Petrolube, and to bill the right company"],
        ["Full name, mobile number", "Required", "To find your booking and reach you at the desk"],
        ["Session", "Required", "To book your place on the ride"],
        ["Height, bike type", "Required", "To give you a bike that fits"],
        ["Companions’ names, heights, bike types", "Optional", "So each companion gets a bike under your booking number. Only add people who are happy for you to."],
        ["Booking number, check-in and return times, price", "Created when you ride", "Running the ride and billing your employer"]
      ]) +
      "<h3>Legal basis</h3>" +
      "<p>Running the ride your employer arranged for you, keeping the billing records the law requires, and, for companions’ details, our legitimate interest in giving each rider a bike. We use the data only for these purposes. Without the required details we cannot register you.</p>" +
      "<h3>Who receives it, and where it is kept</h3>" +
      "<ul><li><b>Our staff</b>, who run the ride.</li>" +
      "<li><b>Your employer</b> (Petromin or Petrolube): the names of the riders on its rides, and nothing else.</li>" +
      "<li><b>Supabase</b>, which hosts our database in <b>Frankfurt, Germany</b>, in the European Union. We transfer your data there only to run the ride, and only what that needs.</li>" +
      "<li><b>Cloudflare</b>, which serves this page.</li></ul>" +
      "<p>We do not sell your data. It is encrypted while it travels, and only our staff can see it.</p>" +
      "<h3>How long we keep it</h3>" +
      "<p>Registrations are kept for the ride and its billing. Billed rides are kept for 10 years, because the law requires financial records, then destroyed or anonymised.</p>" +
      "<h3>Your rights</h3>" +
      "<p>You can ask to see your data, get a copy, have it corrected or completed, or have it destroyed once it is no longer needed. Email " + PV_MAIL + "; we reply within 30 days. You can also complain to the Saudi Data &amp; AI Authority (SDAIA).</p>" +
      "<p>The full Privacy Notice for accounts and bookings on our website is at " + PV_SITE + ".</p>",
    ar: '<p class="pv-upd">آخر تحديث: 22 سبتمبر 2026</p>' +
      "<h3>من نحن</h3>" +
      "<p><b>شركة التنقل الدقيق المحدودة</b>، الرقم الموحد 7041881512، مبنى 7933، شارع ابن عنق الفضة، حي المنصورة، الرياض 12692. ننظّم رحلات الدراجات التي يرتّبها صاحب عملك. للتواصل: " + PV_MAIL + ".</p>" +
      "<h3>ما يجمعه هذا النموذج ولماذا</h3>" +
      pvTable(["البيانات", "إلزامي؟", "الغرض"], [
        ["رقم البطاقة والشركة", "إلزامي", "للتأكد من أنك من موظفي بترومين أو بترولوب، ولإصدار الفاتورة للشركة الصحيحة"],
        ["الاسم الكامل ورقم الجوال", "إلزامي", "للعثور على حجزك والتواصل معك عند المكتب"],
        ["الجلسة", "إلزامي", "لحجز مكانك في الرحلة"],
        ["الطول ونوع الدراجة", "إلزامي", "لتوفير دراجة بمقاس مناسب لك"],
        ["أسماء المرافقين وأطوالهم وأنواع دراجاتهم", "اختياري", "ليحصل كل مرافق على دراجة ضمن رقم حجزك. لا تضف إلا من يوافق على ذلك."],
        ["رقم الحجز وأوقات تسجيل الوصول والإرجاع والسعر", "تُسجَّل عند الركوب", "تشغيل الرحلة وإصدار الفاتورة لصاحب عملك"]
      ]) +
      "<h3>المسوّغ النظامي</h3>" +
      "<p>تنظيم الرحلة التي رتّبها لك صاحب عملك، وحفظ سجلات الفوترة التي يوجبها النظام، ومصلحتنا المشروعة في توفير دراجة لكل راكب فيما يخص بيانات المرافقين. لا نستخدم البيانات إلا لهذه الأغراض، ودون البيانات الإلزامية لا يمكننا تسجيلك.</p>" +
      "<h3>من يتلقاها وأين تُحفظ</h3>" +
      "<ul><li><b>موظفونا</b> الذين يديرون الرحلة.</li>" +
      "<li><b>صاحب عملك</b> (بترومين أو بترولوب): أسماء الراكبين في رحلاته فقط، ولا شيء غير ذلك.</li>" +
      "<li><b>Supabase</b> التي تستضيف قاعدة بياناتنا في <b>فرانكفورت بألمانيا</b>، في الاتحاد الأوروبي، ولا ننقل بياناتك إليها إلا لتشغيل الرحلة وبالقدر الذي تحتاجه فقط.</li>" +
      "<li><b>Cloudflare</b> التي تقدّم هذه الصفحة.</li></ul>" +
      "<p>لا نبيع بياناتك. تُشفَّر أثناء انتقالها، ولا يطّلع عليها إلا موظفونا.</p>" +
      "<h3>مدة الاحتفاظ بها</h3>" +
      "<p>نحتفظ بالتسجيلات لأجل الرحلة وفوترتها، ونحتفظ بالرحلات المفوترة 10 سنوات لأن النظام يوجب حفظ السجلات المالية، ثم نتلفها أو نزيل ما يحدد الهوية منها.</p>" +
      "<h3>حقوقك</h3>" +
      "<p>يحق لك طلب الاطلاع على بياناتك، والحصول على نسخة منها، وتصحيحها أو إكمالها، وإتلافها متى انتهت الحاجة إليها. راسلنا على " + PV_MAIL + "، وسنرد خلال 30 يومًا. ويحق لك أيضًا تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).</p>" +
      "<p>إشعار الخصوصية الكامل للحسابات والحجوزات على موقعنا متاح على " + PV_SITE + ".</p>"
  };
  var pvDialog = $("#privacy-dialog");
  function openPrivacy() {
    var full = PV[html.lang] ? html.lang : null, body = $("#pv-body");
    body.innerHTML = PV[full || "en"];
    if (full) { body.removeAttribute("dir"); body.removeAttribute("lang"); } else { body.setAttribute("dir", "ltr"); body.setAttribute("lang", "en"); }
    $("#pv-note").hidden = !!full;
    if (pvDialog.showModal) pvDialog.showModal(); else pvDialog.setAttribute("open", "");
    body.scrollTop = 0;
  }
  function closePrivacy() { if (pvDialog.close) pvDialog.close(); else pvDialog.removeAttribute("open"); }
  document.querySelectorAll("[data-privacy-open]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openPrivacy(); }); });
  $("#pv-close").addEventListener("click", closePrivacy);
  pvDialog.addEventListener("click", function (e) { if (e.target === pvDialog) closePrivacy(); }); // a tap on the backdrop

  $("#privacy").addEventListener("change", function () { setError("f-privacy", false); });
  $("#waiver").addEventListener("change", function () { setError("f-waiver", false); });
  function waiverRefused() { setError("f-waiver", true, "Please accept the waiver to continue."); goStep(STEPS); $("#waiver").focus(); }
  // A line under the ticket for what just happened (an edit saved, a refusal on the ticket's own buttons), or none.
  function setNote(key, args) {
    var note = $(".done-note"); if (!note) return;
    note.hidden = !key; if (!key) { note.removeAttribute("data-t"); note.textContent = ""; return; }
    note.setAttribute("data-t", key); if (args) note.setAttribute("data-args", JSON.stringify(args)); else note.removeAttribute("data-args"); render(note);
  }
  // A line above the form for what happened to a booking that is no longer on the screen (it was cancelled).
  function setNotice(key) {
    var n = $("#notice"); n.hidden = !key;
    var txt = n.querySelector(".notice-text"); if (key) { txt.setAttribute("data-t", key); render(txt); } else { txt.removeAttribute("data-t"); txt.textContent = ""; }
  }

  /* The ride waiver: its full text in a centred dialog, opened from the line beside its box, rather than a box of
     text in the middle of the step. */
  var wvDialog = $("#waiver-dialog");
  $("#waiver-open").addEventListener("click", function () { openDialog(wvDialog); $("#waiver-text").scrollTop = 0; $("#waiver-text").focus(); });
  $("#waiver-close").addEventListener("click", function () { closeDialog(wvDialog); $("#waiver-open").focus(); });
  wvDialog.addEventListener("click", function (e) { if (e.target === wvDialog) closeDialog(wvDialog); });

  /* Register another: one phone, several people. Edit changes the booking on the screen (its
     session, its people), so a second person needs a fresh form. The confirmation already on this
     phone stays as it is until the new registration goes through (a reload or Cancel shows it
     again), then joins the phone's other registrations, listed under the confirmation and shown
     again with a tap. Each is kept until 6 hours after its session, as the confirmation is. */
  var KEPT = "mm-petromin-kept", another = false;
  function ended(d) { var end = d.session && (d.session.end || d.session.start); return !!end && new Date(end).getTime() + 6 * 3600000 < Date.now(); }
  function keptList() {
    var list = null; try { list = JSON.parse(localStorage.getItem(KEPT) || "[]"); } catch (e) {}
    return (Array.isArray(list) ? list : []).filter(function (d) { return d && d.bookingNo && !ended(d); });
  }
  function saveKept(list) { try { if (list.length) localStorage.setItem(KEPT, JSON.stringify(list.slice(0, 10))); else localStorage.removeItem(KEPT); } catch (e) {} }
  // A registration is its booking number on its night: numbers start again at P-001 every night, so
  // Monday's P-004 and Wednesday's P-004 are two bookings (one dropped the other off the phone).
  function keyOf(d) { return d ? String(d.bookingNo) + "|" + ((d.session && d.session.id) || "") : ""; }
  function keep(d) { if (d && d.bookingNo) saveKept([d].concat(keptList().filter(function (x) { return keyOf(x) !== keyOf(d); }))); }
  function drawOthers() {
    var list = keptList().filter(function (x) { return !current || keyOf(x) !== keyOf(current); }), box = $("#others"), el = $("#others-list");
    el.innerHTML = "";
    list.forEach(function (d) {
      var b = document.createElement("button"); b.type = "button"; b.className = "other";
      b.setAttribute("data-key", keyOf(d)); b.textContent = d.bookingNo + " · " + (d.name || "");
      el.appendChild(b);
    });
    box.hidden = !list.length;
  }
  $("#others-list").addEventListener("click", function (e) {
    var b = e.target.closest(".other"); if (!b) return;
    var key = b.getAttribute("data-key"), pick = keptList().filter(function (x) { return keyOf(x) === key; })[0];
    if (!pick) { drawOthers(); return; }
    saveKept(keptList().filter(function (x) { return keyOf(x) !== key; }));
    keep(current);
    showSuccess(pick); // the phone's confirmation now (saved as it), the one before it kept
  });
  function startAnother() {
    if (!current) return;
    editing = null; another = true;
    prefill({}); setSubmitLabels(false);
    $("#privacy").checked = false; setError("f-privacy", false); // the next person confirms the notice for themselves
    $("#success").hidden = true; $("#card").setAttribute("data-state", "form");
    hideBanner(); setNotice(null); returnTo = 0; goStep(1);
    loadSessions();
  }
  $("#another").addEventListener("click", startAnother);
  /* Edit: the form filled with the saved registration, opened on its summary (each part with its Change), and saved
     through rider_edit, which updates the same rows (booking number kept). The saved booking number and phone prove
     the rows. */
  var editing = null;
  function setSubmitLabels(edit) {
    var l = $("#submit .submit-label"), b = $("#submit .submit-busy"), h = $("#form .title");
    l.setAttribute("data-t", edit ? "Save changes" : "Agree and register"); render(l);
    b.setAttribute("data-t", edit ? "Saving..." : "Registering..."); render(b);
    h.setAttribute("data-t", edit ? "Edit your booking" : "Petromin bike night"); render(h);
    $("#cancel-edit").hidden = !(edit || another); // Cancel goes back to the confirmation on the phone
    $("#f-privacy").hidden = !!edit; // confirmed when they registered; an edit does not ask again
    $("#waiver").checked = false; setError("f-waiver", false); // the waiver is asked again on every save, an edit too
  }
  function prefill(d) {
    selectedSession = d.session ? d.session.id : null; renderSessions();
    selectedCompany = d.company || null;
    companies.querySelectorAll(".company").forEach(function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-v") === selectedCompany)); });
    syncRoving(companies);
    $("#badge").value = d.badge || ""; $("#name").value = tidyName(d.name); // a booking saved before the rule may carry a dash
    var digits = String(d.phone || "").replace(/\D/g, ""), code = null;
    COUNTRIES.forEach(function (x) { if (digits.indexOf(x[1]) === 0 && (!code || x[1].length > code.length)) code = x[1]; });
    if (code) { cc.value = code; phoneIn.value = digits.slice(code.length); } else { cc.value = "966"; phoneIn.value = digits; }
    syncPhone();
    $("#height").value = d.height || "";
    selectedType = d.type || null;
    types.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-v") === selectedType)); });
    syncRoving(types);
    ["f-session", "f-company", "f-badge", "f-name", "f-phone", "f-height", "f-type"].forEach(function (id) { setError(id, false); });
    companions = (d.riders || []).map(function (c) { return { name: tidyName(c.name), height: c.height != null ? String(c.height) : "", type: c.type || "" }; });
    renderCompanions();
  }
  function startEdit() {
    if (!current) return;
    editing = current; another = false; prefill(current); setSubmitLabels(true);
    $("#success").hidden = true; $("#card").setAttribute("data-state", "form");
    hideBanner(); setNotice(null); returnTo = 0;
    goStep(selectedSession ? STEPS : 1);
    loadSessions(); // a restored confirmation never fetched the calendar; the saved session stays selected if it is still offered
  }
  function cancelEdit() { editing = null; another = false; returnTo = 0; setSubmitLabels(false); hideBanner(); if (current) showSuccess(current); }
  $("#edit").addEventListener("click", startEdit);
  $("#cancel-edit").addEventListener("click", cancelEdit);

  /* Saving the booking elsewhere than this browser: Apple Wallet (iPhone and iPad; the website makes the pass through
     the booking app's pass maker, app/api/petromin-pass) and a calendar file with a reminder two hours before bikes
     are handed out. Neither needs an email or a text. */
  var APPLE = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  var walletOff = false;
  function paintWallet() { $("#wallet").hidden = !APPLE || walletOff || !current; }
  $("#wallet").addEventListener("click", async function () {
    var btn = this; if (!current || btn.disabled) return;
    btn.disabled = true;
    try {
      var res = await fetch("/api/petromin-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingNo: current.bookingNo, phone: current.phone, sessionId: current.session && current.session.id, lang: html.lang }) });
      if (!res.ok) { if (res.status === 501 || res.status === 404 && !/json/.test(res.headers.get("content-type") || "")) { walletOff = true; paintWallet(); } setNote(res.status === 404 ? "We could not find your booking. Please register again." : "Could not reach the server"); return; }
      var url = URL.createObjectURL(await res.blob());
      // Opening the .pkpass shows iOS's "Add to Apple Wallet" sheet.
      var a = document.createElement("a"); a.href = url; a.download = "booking-" + current.bookingNo + ".pkpass"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { setNote("Could not reach the server"); }
    finally { btn.disabled = false; }
  });
  function icsText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1"); }
  function icsTime(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  $("#calendar").addEventListener("click", function () {
    var d = current, s = d && d.session; if (!s || !s.start) return;
    var from = collectIso(s) || s.start, to = s.end || new Date(new Date(s.start).getTime() + 2 * 3600000).toISOString();
    var title = t("Petromin bike night") + " · " + d.bookingNo;
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Petromin form//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      "UID:" + String(d.bookingNo).toLowerCase() + "-" + s.id + "@micromobility.sa", "DTSTAMP:" + icsTime(new Date().toISOString()),
      "DTSTART:" + icsTime(from), "DTEND:" + icsTime(to), "SUMMARY:" + icsText(title), "LOCATION:" + icsText(placeOf(s)),
      "DESCRIPTION:" + icsText(t("Booking") + " " + d.bookingNo + "\n" + t("Helmets are required. One comes with every bike.")),
      "URL:https://micromobility.sa/petromin", "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
    var url = URL.createObjectURL(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "petromin-" + d.bookingNo + ".ics"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  /* Cancel my booking (rider_cancel, rentals 20261111030000): the whole party, after a question; the number and the
     phone it was made with prove it. A booking the desk has taken over, or anyone on it checked in, goes to the desk. */
  var CANCEL_ERR = { checked_in: "You have already checked in. Ask the desk to change your booking.", desk: "The desk has this booking. Ask the desk to cancel it.", notfound: "We could not find your booking. Please register again.", session: "This session is no longer open", throttled: "Too many submissions from this network" };
  $("#cancel-booking").addEventListener("click", async function () {
    var d = current; if (!d || !d.session) return;
    var yes = await ask(t("Cancel booking {no}? Every rider on it loses their place.", { no: d.bookingNo }), "Cancel booking", "Keep it", true);
    if (!yes) { $("#cancel-booking").focus(); return; }
    var btn = $("#cancel-booking"); btn.disabled = true;
    var r; try { r = await sbClient().rpc("rider_cancel", { p_booking_no: d.bookingNo, p_proof_phone: d.phone, p_session_id: d.session.id }); } catch (e) { r = { error: e }; }
    btn.disabled = false;
    if (!r || r.error || !r.data) { setNote(noAnswer(r) ? "Could not reach the server" : "We could not save this. Please try again."); return; }
    if (!r.data.ok) { setNote(CANCEL_ERR[r.data.error] || "We could not save this. Please try again."); return; }
    track(4, "cancel");
    try { localStorage.removeItem(STORE); } catch (e) {}
    saveKept(keptList().filter(function (x) { return keyOf(x) !== keyOf(d); }));
    current = null;
    // The phone's next registration shows, if it holds one; otherwise a fresh form.
    if (!restoreKept()) { editing = null; another = false; prefill({}); setSubmitLabels(false); $("#privacy").checked = false; $("#success").hidden = true; $("#card").setAttribute("data-state", "form"); returnTo = 0; goStep(1); loadSessions(); }
    setNotice("Your booking was cancelled.");
  });

  /* Find my booking: the booking number and the mobile number it was made with bring it back on any phone or browser
     (rider_lookup, rentals 20261111030000) - this browser's copy of it is lost when its storage is cleared, and Safari
     clears a site's after seven days away. */
  var fdDialog = $("#find-dialog");
  fillCC($("#fd-cc"));
  function fdNumber() {
    var v = toAscii($("#fd-no").value).toUpperCase().replace(/\s+/g, "");
    var m = v.match(/^([A-Z])?-?(\d{1,4})$/);
    return m ? (m[1] || SOURCE.charAt(0).toUpperCase()) + "-" + ("00" + m[2]).slice(-Math.max(3, m[2].length)) : "";
  }
  function fdPhone() {
    var raw = toAscii($("#fd-phone").value).replace(/[^0-9+]/g, ""), code = $("#fd-cc").value;
    if (raw.charAt(0) === "+") return "+" + raw.replace(/\D/g, "");
    if (raw.indexOf("00") === 0) return "+" + raw.slice(2);
    var n = raw.replace(/\D/g, "").replace(/^0+/, "");
    if (code === "966" && n.indexOf("966") === 0 && n.length > 9) n = n.slice(3);
    return n ? "+" + code + n : "";
  }
  function fdMiss(key) { var m = $("#fd-miss"); m.hidden = !key; if (key) { m.setAttribute("data-t", key); render(m); } }
  $("#find").addEventListener("click", function () {
    $("#fd-no").value = ""; $("#fd-phone").value = ""; $("#fd-cc").value = "966"; fdMiss(null);
    setError("fd-f-no", false); setError("fd-f-phone", false);
    openDialog(fdDialog); $("#fd-no").focus();
  });
  $("#fd-cancel").addEventListener("click", function () { closeDialog(fdDialog); $("#find").focus(); });
  ["fd-no", "fd-phone"].forEach(function (id) { $("#" + id).addEventListener("input", function () { setError(id === "fd-no" ? "fd-f-no" : "fd-f-phone", false); fdMiss(null); }); });
  $("#find-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var no = fdNumber(), ph = fdPhone(), digits = ph.replace(/\D/g, "");
    setError("fd-f-no", !no); setError("fd-f-phone", digits.length < 9);
    if (!no) { $("#fd-no").focus(); return; }
    if (digits.length < 9) { $("#fd-phone").focus(); return; }
    var go = $("#fd-go"); go.disabled = true; go.classList.add("loading");
    var r; try { r = await sbClient().rpc("rider_lookup", { p_booking_no: no, p_phone: ph }); } catch (err) { r = { error: err }; }
    go.disabled = false; go.classList.remove("loading");
    if (!r || r.error || !r.data) { fdMiss("Could not reach the server"); return; }
    var d = r.data;
    if (!d.ok) { fdMiss(d.error === "throttled" ? "Too many submissions from this network" : "We could not find a booking with this number and mobile number."); return; }
    var found = { badge: d.badge || "", name: d.name || "", company: d.company || null, phone: d.phone || ph, height: d.height, type: d.type, session: d.session || null, bookingNo: d.booking_no, riders: d.riders || [], submittedAt: new Date().toISOString() };
    closeDialog(fdDialog);
    if (current && keyOf(current) !== keyOf(found)) keep(current);
    editing = null; another = false; setSubmitLabels(false); setNotice(null);
    track(1, "found");
    showSuccess(found);
  });

  /* Registration. Refusals the form knows go to their box; anything else is said in words that tell a refusal from
     a lost connection, and a second failure in a row offers WhatsApp. */
  var failures = 0;
  function failBanner(msg) {
    failures++;
    $("#banner-help").hidden = failures < 2;
    showBanner(msg);
  }
  $("#form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (submitting) return; // one registration at a time
    // Enter in a box on the earlier steps submits the form (its Register button is only hidden): that is Continue,
    // not a registration that jumps to the last step with its boxes all in red.
    if (step < STEPS) { next(); return; }
    hideBanner();
    if (!validate()) { focusInvalid(); return; }
    var data = collect();
    data.riders = companionArgs();
    var args = {
      p_badge: data.badge,
      p_name: data.name,
      p_height: data.height,
      p_type: data.type,
      p_source: SOURCE,
      p_phone: toAscii(data.phone),
      p_session_id: data.session ? data.session.id : null,
      p_company: data.company || null
    };
    if (data.riders.length) args.p_riders = data.riders;
    args.p_waiver = WAIVER_VERSION; // only reached with the box ticked
    args.p_lang = html.lang; // the language the waiver was read in
    if (!editing && $("#privacy").checked) args.p_privacy = PRIVACY_VERSION; // the notice this registration confirmed
    setLoading(true);
    var r;
    // A database without the newest arguments yet does not know the call with them (404, PGRST202): once more with
    // each of them left out in turn, newest first.
    async function call(fn, a, optional) {
      var res = await sbClient().rpc(fn, a);
      for (var i = 0; i < optional.length && unknownCall(res); i++) {
        if (!(optional[i] in a)) continue;
        var less = {}; Object.keys(a).forEach(function (k) { if (k !== optional[i]) less[k] = a[k]; }); a = less;
        res = await sbClient().rpc(fn, a);
      }
      return res;
    }
    try {
      if (editing) {
        var edit = { p_booking_no: editing.bookingNo, p_proof_phone: editing.phone, p_badge: args.p_badge, p_name: args.p_name, p_height: args.p_height, p_type: args.p_type, p_session_id: args.p_session_id, p_company: args.p_company, p_phone: args.p_phone, p_riders: data.riders, p_waiver: args.p_waiver, p_lang: args.p_lang };
        // Numbers start again at P-001 every night, so the number and phone alone can be another night's booking:
        // the night of the confirmation being edited says which (p_session_id is the night it moves to).
        if (editing.session && editing.session.id) edit.p_from_session = editing.session.id;
        r = await call("rider_edit", edit, ["p_lang", "p_from_session"]);
      } else {
        r = await call("rider_register", args, ["p_lang", "p_privacy"]);
      }
    } catch (err) { r = { error: err }; }
    setLoading(false);
    // Raised by the database (P0001) since rentals' 2026-10-05 migration: said in the page's language.
    var refused = String((r && r.error && r.error.message) || (r && r.data && r.data.error) || "");
    if (/WAIVER_OUTDATED/.test(refused)) { failBanner(WAIVER_OUTDATED); return; }
    if (/PAID_MOVE/.test(refused)) { failBanner(PAID_MOVE); return; }
    if (!r || r.error || !r.data) { track(4, "fail", noAnswer(r) ? "network" : "server"); failBanner(noAnswer(r) ? "Could not reach the server" : "We could not save this. Please try again."); return; }
    var d = r.data;
    if (!d.ok) {
      track(4, "fail", d.error);
      if (d.error === "waiver") { waiverRefused(); return; }
      if (d.error === "throttled") { failBanner("Too many submissions from this network"); return; }
      if (d.error === "notfound") { editing = null; setSubmitLabels(false); try { localStorage.removeItem(STORE); } catch (err) {} failBanner("We could not find your booking. Please register again."); return; }
      if (d.error === "checked_in") { failBanner("You have already checked in. Ask the desk to change your booking."); return; }
      if (d.error === "riders") { goStep(3); setError("f-riders", true); return; }
      // The database refuses a one-letter word with the same code as a wrong character, saying why:
      // "short" (rider_register, rentals 20261004100000). Each gets its own words.
      var short = d.why === "short";
      if (d.error === "name_chars" || d.error === "name_short") { goStep(2); $("#name")._nameHintUntil = 0; setError("f-name", true, (short || d.error === "name_short") ? NAME_SHORT : NAME_CHARS); focusInvalid(); return; }
      var ri = (Number(d.rider) || 2) - 2;
      if ((d.error === "rider_name_chars" || d.error === "rider_name_short") && companions[ri]) { goStep(3); openRider(ri, true, { field: "name", msg: (short || d.error === "rider_name_short") ? RIDER_SHORT : NAME_CHARS }); return; }
      if ((d.error === "rider_name" || d.error === "rider_height" || d.error === "rider_type") && companions[ri]) { goStep(3); openRider(ri, true); return; }
      if (d.error === "duplicate") { goStep(2); setError("f-badge", true, "This badge is already registered for that session"); focusInvalid(); return; }
      if (FIELD_ERR[d.error]) {
        goStep(FIELD_STEP[d.error] || 1);
        setError("f-" + d.error, true, FIELD_ERR[d.error]);
        if (d.error === "session") loadSessions();
        focusInvalid(); return;
      }
      failBanner("We could not save this. Please try again."); return;
    }
    failures = 0; $("#banner-help").hidden = true;
    data.bookingNo = d.booking_no;
    // The night as the form knew it (its hand-out time and place) with what the server says of it.
    if (d.session) data.session = Object.assign({}, data.session || {}, d.session);
    var wasEdit = !!editing; editing = null;
    if (!wasEdit) track(4, "done");
    if (another && current && keyOf(current) !== keyOf(data)) keep(current); // the confirmation before this one stays on the phone
    another = false; setSubmitLabels(false);
    showSuccess(data);
    setNote(wasEdit ? "Your booking was updated." : d.resubmitted ? "Your details were updated." : null);
  });

  /* Boot: restore a saved confirmation on this device (else the latest of its other registrations),
     otherwise start at step 1 with live sessions. */
  function restoreKept() {
    var list = keptList(); if (!list.length) return false;
    saveKept(list.slice(1)); showSuccess(list[0]); return true;
  }
  renderCompanions();
  setSubmitLabels(false);
  goStep(1);
  if (!restore() && !restoreKept()) loadSessions();
  booted = true;
  if ($("#success").hidden) track(1, "view");
