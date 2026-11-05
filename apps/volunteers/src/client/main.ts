// The portal page. Anyone: the opportunities (#, #o/<session>). With a MicroMobility account: register
// interest, My volunteering (#me) with hours and the certificate (#cert). Once accepted: the work page
// (#work/<session>), between the session's start and cut-off. The database decides all of that
// (rentals migration 20261105120000); this page only asks and says what it was told.

import { post, rpc } from "./api";
import { append, clear, h, uid } from "./dom";
import { currentLang, dayLabel, LANGS, sessionName, setLang, startLang, t, timesLabel, whenLabel, type Key } from "./i18n";
import { parseTicket, startScanner, type Scanner } from "./scan";

const BOOKING = "https://micromobilityrentals.pages.dev";
const SUPPORT = "https://wa.me/966579543997";
const AFTER_KEY = "mm_vol_after"; // the opportunity to come back to, across a sign-in on the booking app

type Opp = { id: string; title: string | null; ride_kind: string | null; date: string; time: string | null; location: string | null; about: string | null;
  needed: number | null; roles: string[] | null; min_age: number | null; hours_mode: string; fixed_hours: number | null; signup_open: boolean;
  opens_at: string | null; closes_at: string; accepted: number };
type Mine = { id: string; title: string | null; ride_kind: string | null; date: string; time: string | null; location: string | null; status: string; role: string | null;
  clock_in: string | null; clock_out: string | null; opens_at: string | null; closes_at: string; briefing: string | null; can_work: boolean };
type RecordRow = { id: number; hours: number; on: string; note: string | null; session_id: string | null; title: string | null; ride_kind: string | null };
type Me = { signedIn?: false; id: string; name: string; hours: number; account: string | null; status: string | null; agreed: boolean; mine: Mine[]; record: RecordRow[];
  first_on: string | null; last_on: string | null; sessions: number; cert_signer: string | null; cert_title: string | null };
type Booking = { id: string; name: string; number: number | null; checked_in: boolean; donated: boolean; visitor?: boolean; own: boolean; desk: string | null; mine_in: boolean; mine_donated: boolean;
  phone?: string | null; status?: string; bike?: string | null; size?: string | null; height?: string | null; blood_type?: string | null; club?: string | null };
type Entered = { closes_at: string; caps: Record<string, boolean>; briefing: string | null; hours_mode: string; role: string | null; counts: { booked: number; in: number; donated: number; visitors?: number } | null };

const app = document.getElementById("app")!;
const S: {
  opps: Opp[] | null; me: Me | null; err: string; note: string; noteAt: number; signErr: string; loginDraft: string; agreeTick: boolean;
  work: { id: string; ent: Entered; rows: Booking[] | null; list: Booking[] | null; listQ: string; listShow: string; listSort: string; msg: string; scanning: boolean } | null;
} = { opps: null, me: null, err: "", note: "", noteAt: 0, signErr: "", loginDraft: "", agreeTick: false, work: null };
let scanner: Scanner | null = null;
const setNote = (text: string) => { S.note = text; S.noteAt = Date.now(); };
let timer = 0;

const route = (): { name: string; id: string } => {
  const [name, id] = location.hash.replace(/^#/, "").split("/");
  return { name: name || "list", id: id ? decodeURIComponent(id) : "" };
};
const go = (hash: string) => { if (location.hash === hash) render(); else location.hash = hash; };
const say = (e: { code: string; detail?: string }): string => {
  const map: Record<string, Key> = {
    VOL_CLOSED: "volClosed", VOL_SIGNUP_CLOSED: "vdSignupClosed", VOL_DOB: "errDob", VOL_AGE: "vdTooYoung", VOL_DECLINED: "errDeclined", VOL_NOT_VOLUNTEER: "vdNotVolunteer",
    VOL_NOT_ACCEPTED: "vdNotAccepted", VOL_ACCOUNT: "vdAccountPwd", VOL_ALREADY_IN: "vdAlreadyIn", VOL_CAP: "vdNotAllowed", VOL_OWN_BOOKING: "vdOwn", VOL_NOT_YOURS: "volNotYours",
    BLOOD_VISITOR: "errVisitor", BLOOD_DONATED: "errDonatedFirst", VOL_DONATED_FIRST: "volDonatedFirst", VOL_SLOW: "volSlow", VOL_BAD_SEARCH: "volSearchHint", BOOKING_NOT_FOUND: "volNotFound", BAD_BOOKING_STATE: "volNotFound", VOL_AGREE: "vdAgreeTitle",
    BAD_LOGIN: "errBadLogin", LOCKED: "errLocked", RATE_LIMIT: "errRate", VOL_TOKEN: "vdSessionEnded",
  };
  if (e.code === "VOL_ASK_DESK") {
    const desk: Record<string, Key> = { bike: "vdDeskBike", approval: "vdDeskApproval", share: "vdDeskShare", waiver: "vdDeskWaiver", waitlist: "vdDeskWaitlist" };
    return t(desk[e.detail ?? ""] ?? "vdDeskAsk");
  }
  return t(map[e.code] ?? "errConnection");
};
const lost = (code: string) => /^VOL_(CLOSED|NOT_VOLUNTEER|NOT_ACCEPTED|ACCOUNT|AGREE|TOKEN)$/.test(code);

const button = (label: string, onclick: () => void, kind = "secondary", attrs: Record<string, string> = {}) =>
  h("button", { type: "button", class: `btn btn-${kind}`, onclick: onclick as EventListener, ...attrs }, label);
const link = (label: string, href: string, kind = "secondary") => h("a", { class: `btn btn-${kind}`, href }, label);
const noteBox = (text: string, role = "status") => h("p", { class: "note", role }, text);
const chip = (text: string, on = false) => h("span", { class: `chip${on ? " on" : ""}` }, text);

async function load(): Promise<void> {
  const m = await rpc<Me>("volunteer_me");
  if (m.ok) S.me = m.data && m.data.signedIn !== false ? m.data : null;
  // Signed out there is nothing to read: the server refuses the list too.
  if (!S.me) { S.opps = null; S.err = m.ok ? "" : t("errConnection"); return; }
  const o = await rpc<Opp[]>("volunteer_opportunities");
  S.err = o.ok ? "" : t("errConnection");
  if (o.ok) S.opps = Array.isArray(o.data) ? o.data : [];
}
const reloadMe = async () => {
  const m = await rpc<Me>("volunteer_me");
  if (m.ok) S.me = m.data && m.data.signedIn !== false ? m.data : null;
};

// ── the frame ──
function header(): HTMLElement {
  const r = route().name;
  const lang = h("select", { class: "lang", "aria-label": t("language"), onchange: ((e: Event) => void setLang((e.target as HTMLSelectElement).value).then(render)) as EventListener },
    ...LANGS.map((l) => h("option", { value: l.code, selected: l.code === currentLang() }, l.label)));
  return h("header", { class: "bar" },
    h("a", { class: "brand", href: "#", "aria-label": t("appName") },
      h("img", { src: "/site/logo-mark-dark.png", alt: "", width: 40, height: 26 }),
      h("span", { class: "brand-name" }, t("portalName"))),
    S.me ? h("nav", { class: "tabs" },
      h("a", { href: "#", "aria-current": r === "list" || r === "o" ? "page" : null }, t("navOpps")),
      h("a", { href: "#me", "aria-current": r === "me" || r === "work" || r === "cert" ? "page" : null }, t("navMine"))) : null,
    h("div", { class: "bar-tools" }, lang,
      S.me ? button(t("signOut"), () => void signOut(), "ghost") : null));
}
function footer(): HTMLElement {
  return h("footer", { class: "foot" },
    h("a", { href: `${BOOKING}/?privacy`, rel: "noopener" }, t("footerPrivacy")),
    h("a", { href: SUPPORT, rel: "noopener" }, t("footerSupport")));
}
function render(): void {
  stopScan();
  document.title = t("appName");
  const r = route();
  clear(app);
  const main = h("main", { id: "main", class: `page${r.name === "work" && S.work?.ent.caps.list ? " page-wide" : ""}` });
  // A note outlives a redraw (leaving a page draws twice: the leaver, then the address changing), for as long as it takes to read.
  if (S.note && Date.now() - S.noteAt < 12000) main.appendChild(noteBox(S.note)); else S.note = "";
  // Nobody enters signed out (the owner, 2026-11-05: "dont allow anyone to enter the website unless they are signed in"):
  // every address is the sign-in, and the opportunity it named is where they land after it.
  if (!S.me) {
    if ((r.name === "o" || r.name === "work") && r.id) { try { localStorage.setItem(AFTER_KEY, r.id); } catch { /* blocked storage: they find it again */ } }
    viewSignIn(main);
  } else if (r.name === "signin") viewSignIn(main);
  else if (r.name === "me") viewMe(main);
  else if (r.name === "o") viewOpp(main, r.id);
  else if (r.name === "work") viewWork(main, r.id);
  else if (r.name === "cert") viewCert(main);
  else viewList(main);
  append(app, h("a", { class: "skip", href: "#main" }, t("skipToContent")), header(), main, footer());
}

// ── opportunities ──
const myShift = (id: string) => S.me?.mine.find((x) => x.id === id) ?? null;
const statusWords: Record<string, Key> = { interested: "stInterested", accepted: "stAccepted", declined: "stDeclined", withdrawn: "stWithdrawn", done: "stDone", no_show: "stNoShow" };

function oppMeta(o: Opp): HTMLElement {
  return h("div", { class: "chips" },
    o.needed ? chip(o.accepted ? t("oppFilled", o.accepted, o.needed) : t("oppNeeded", o.needed)) : null,
    o.hours_mode === "fixed" && o.fixed_hours ? chip(t("oppHours", o.fixed_hours)) : null,
    o.min_age ? chip(t("oppMinAge", o.min_age)) : null);
}
const whereWhen = (s: { date: string; time: string | null; location: string | null }) =>
  [dayLabel(s.date), timesLabel(s.time), s.location].filter(Boolean).join(" · ");

function viewList(main: HTMLElement): void {
  append(main, h("h1", {}, t("oppTitle")), h("p", { class: "sub" }, t("oppSub")));
  if (S.err) { append(main, noteBox(S.err, "alert"), button(t("retry"), () => void load().then(render))); return; }
  if (!S.opps) { main.appendChild(noteBox(t("loading"))); return; }
  if (!S.opps.length) { main.appendChild(noteBox(t("oppNone"))); return; }
  main.appendChild(h("div", { class: "cards" }, ...S.opps.map((o) => {
    const sh = myShift(o.id);
    return h("a", { class: "card opp", href: `#o/${encodeURIComponent(o.id)}` },
      h("h2", {}, sessionName(o)),
      h("p", { class: "when" }, whereWhen(o)),
      o.about ? h("p", { class: "about" }, o.about) : null,
      oppMeta(o),
      sh && statusWords[sh.status] ? h("div", { class: "chips" }, chip(t(sh.status === "interested" ? "interestSent" : statusWords[sh.status]), sh.status === "accepted")) : null,
      h("span", { class: "go" }, t("oppDetails")));
  })));
}

function viewOpp(main: HTMLElement, id: string): void {
  if (!S.opps) { main.appendChild(noteBox(S.err || t("loading"), S.err ? "alert" : "status")); return; }
  const o = S.opps.find((x) => x.id === id);
  const sh = myShift(id);
  main.appendChild(h("a", { class: "backlink", href: "#" }, t("back")));
  if (!o) { main.appendChild(noteBox(t("oppGone"))); return; }
  append(main, h("h1", {}, sessionName(o)), h("p", { class: "when" }, whereWhen(o)), oppMeta(o));
  if (o.about) main.appendChild(h("p", { class: "about-long" }, o.about));
  if (o.roles?.length) main.appendChild(h("p", { class: "when" }, `${t("oppRoles")}: ${o.roles.join(" · ")}`));
  main.appendChild(h("p", { class: "when" }, t("oppRegisterBy", whenLabel(o.closes_at))));
  main.appendChild(interestBlock(o, sh));
}

function interestBlock(o: Opp, sh: Mine | null): HTMLElement {
  const box = h("section", { class: "card action" });
  if (!S.me) {
    append(box, h("p", {}, t("interestSignIn")), button(t("interestBtn"), () => {
      try { localStorage.setItem(AFTER_KEY, o.id); } catch { /* blocked storage: they find it again */ }
      go("#signin");
    }, "primary"));
    return box;
  }
  if (S.me.status === "paused" || S.me.status === "removed" || S.me.status === "expired") { box.appendChild(h("p", {}, t(S.me.status === "paused" ? "vdPaused" : "vdExpired"))); return box; }
  if (S.me.account) { box.appendChild(h("p", {}, t(S.me.account === "pwd" ? "vdAccountPwd" : "vdAccountDel"))); return box; }
  const st = sh?.status;
  if (st === "accepted" || st === "done") {
    append(box, h("div", { class: "chips" }, chip(`${t("stAccepted")}${sh?.role ? ` · ${sh.role}` : ""}`, true)));
    if (sh?.briefing) box.appendChild(h("p", { class: "about-long" }, sh.briefing));
    if (sh?.can_work) box.appendChild(link(t("startWork"), `#work/${encodeURIComponent(o.id)}`, "primary"));
    else if (o.opens_at) box.appendChild(h("p", { class: "when" }, t("vdOpensAt", whenLabel(o.opens_at))));
    if (!sh?.clock_in && st === "accepted") box.appendChild(button(t("withdrawBtn"), () => void interest(o.id, false)));
    return box;
  }
  if (st === "interested") { append(box, h("p", {}, t("stInterested")), button(t("withdrawBtn"), () => void interest(o.id, false))); return box; }
  if (st === "declined" || st === "no_show") { box.appendChild(h("p", {}, t(statusWords[st]))); return box; }
  if (!o.signup_open) { box.appendChild(h("p", {}, t("oppClosedSignup"))); return box; }
  const roleId = uid("role"), msgId = uid("msg");
  const role = o.roles?.length ? h("select", { id: roleId }, h("option", { value: "" }, t("interestAny")), ...o.roles.map((r) => h("option", { value: r }, r))) : null;
  const msg = h("textarea", { id: msgId, rows: 3, maxlength: 300 });
  append(box,
    role ? h("label", { for: roleId }, t("interestRole")) : null, role,
    h("label", { for: msgId }, t("interestMsg")), msg,
    button(t("interestBtn"), () => void interest(o.id, true, role ? role.value : null, msg.value), "primary"));
  return box;
}

async function interest(id: string, on: boolean, role: string | null = null, message = ""): Promise<void> {
  const r = await rpc<{ status: string }>("volunteer_interest", { p_session: id, p_on: on, p_role: role, p_message: message || null });
  if (!r.ok) { setNote(say(r)); if (r.code === "VOL_TOKEN") { S.me = null; go("#signin"); return; } render(); return; }
  setNote(on ? t(r.data.status === "accepted" ? "stAccepted" : "interestSent") : t("withdrawn"));
  await load();
  render();
}

// ── signing in ──
function viewSignIn(main: HTMLElement): void {
  if (S.me) { go("#me"); return; }
  const idId = uid("id"), pwId = uid("pw");
  const who = h("input", { id: idId, type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", value: S.loginDraft });
  const pwd = h("input", { id: pwId, type: "password", autocomplete: "current-password" });
  const form = h("form", { class: "card action", novalidate: true, onsubmit: ((e: Event) => { e.preventDefault(); void signIn(who.value, pwd.value); }) as EventListener },
    h("h1", {}, t("vdSignTitle")), h("p", { class: "sub" }, t("signHint")),
    h("label", { for: idId }, t("vdSignId")), who,
    h("label", { for: pwId }, t("password")), pwd,
    S.signErr ? h("p", { class: "err", role: "alert" }, S.signErr) : null,
    h("button", { type: "submit", class: "btn btn-primary" }, t("vdSignBtn")),
    h("div", { class: "alt" },
      h("a", { href: `${BOOKING}/?handoff=volunteer&auth=forgot` }, t("signForgot")),
      h("a", { href: `${BOOKING}/signup?handoff=volunteer` }, t("signCreate")),
      h("a", { href: `${BOOKING}/?handoff=volunteer` }, t("signOther"))));
  main.appendChild(form);
  window.setTimeout(() => (who.value ? pwd : who).focus(), 0);
}

async function signIn(who: string, pwd: string): Promise<void> {
  S.loginDraft = who;
  if (!who.trim()) { S.signErr = t("errEmailOrPhone"); render(); return; }
  if (!pwd) { S.signErr = t("errPassword"); render(); return; }
  const r = await post("/api/login", { login: who, password: pwd });
  if (!r.ok) { S.signErr = say(r); render(); return; }
  S.signErr = ""; S.loginDraft = "";
  await load();
  afterSignIn();
}

/** Back to the opportunity they were on, else My volunteering. */
function afterSignIn(): void {
  let after: string | null = null;
  try { after = localStorage.getItem(AFTER_KEY); localStorage.removeItem(AFTER_KEY); } catch { /* blocked storage */ }
  go(after ? `#o/${encodeURIComponent(after)}` : "#me");
}

async function signOut(): Promise<void> {
  await post("/api/logout");
  S.me = null; S.work = null; S.opps = null;
  go("#");
}

// ── my volunteering ──
function viewMe(main: HTMLElement): void {
  if (!S.me) { go("#signin"); return; }
  const m = S.me;
  append(main, h("h1", {}, m.name || t("navMine")),
    h("p", { class: "hours" }, h("b", {}, String(+m.hours || 0)), ` ${t("meHours")}`));
  if (m.status === "paused") main.appendChild(noteBox(t("vdPaused")));
  if (m.status === "expired" || m.status === "removed") main.appendChild(noteBox(t("vdExpired")));
  if (m.account) main.appendChild(noteBox(t(m.account === "pwd" ? "vdAccountPwd" : "vdAccountDel")));
  if (!m.mine.length) append(main, noteBox(t("meNone")), link(t("meSeeOpps"), "#", "primary"));
  else main.appendChild(h("div", { class: "cards" }, ...m.mine.map((x) => h("div", { class: "card" },
    h("h2", {}, h("a", { href: `#o/${encodeURIComponent(x.id)}` }, sessionName(x))),
    h("p", { class: "when" }, whereWhen(x)),
    h("div", { class: "chips" }, chip(`${t(x.status === "interested" ? "interestSent" : statusWords[x.status] ?? "stDone")}${x.role ? ` · ${x.role}` : ""}`, x.status === "accepted")),
    x.can_work ? link(t("startWork"), `#work/${encodeURIComponent(x.id)}`, "primary")
      : (x.status === "accepted" && x.opens_at && Date.parse(x.opens_at) > Date.now()) ? h("p", { class: "when" }, t("vdOpensAt", whenLabel(x.opens_at))) : null))));
  append(main, h("h2", { class: "sec" }, t("meRecord")));
  main.appendChild(m.record.length
    ? h("ul", { class: "rec" }, ...m.record.map((r) => h("li", {}, h("b", { dir: "ltr" }, String(+r.hours)), ` · ${dayLabel(r.on)}${r.session_id ? ` · ${sessionName(r)}` : ""}${r.note ? ` · ${r.note}` : ""}`)))
    : noteBox(t("meNoHours")));
  if (+m.hours > 0) main.appendChild(link(t("certBtn"), "#cert"));
}

// ── the certificate: both languages on one page ──
function viewCert(main: HTMLElement): void {
  if (!S.me) { go("#signin"); return; }
  const m = S.me, hours = String(+m.hours || 0), n = m.sessions || 0;
  const on = (ymd: string | null, lang: string) => {
    if (!ymd) return "";
    try { return new Date(`${ymd.slice(0, 10)}T12:00:00+03:00`).toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { timeZone: "Asia/Riyadh", day: "numeric", month: "long", year: "numeric" }); } catch { return ymd; }
  };
  const en = `MicroMobility thanks ${m.name} for giving ${hours} hours as a volunteer${m.first_on ? ` between ${on(m.first_on, "en-GB")} and ${on(m.last_on, "en-GB")}` : ""}${n ? ` across ${n} ${n === 1 ? "session" : "sessions"}` : ""}.`;
  const ar = `تشكر مايكروموبيليتي ${m.name} على التطوع لمدة ${hours} ساعة${m.first_on ? ` في الفترة من ${on(m.first_on, "ar")} إلى ${on(m.last_on, "ar")}` : ""}${n ? ` في ${n} من الفعاليات` : ""}.`;
  append(main, h("div", { class: "cert-tools" }, link(t("back"), "#me"), button(t("certPrint"), () => window.print(), "primary")),
    h("section", { class: "cert" },
      h("div", { class: "cert-brand" }, h("img", { src: "/site/logo-mark-dark.png", alt: "", width: 40, height: 26 }), "MicroMobility"),
      h("div", { class: "cert-cols" },
        h("div", { dir: "ltr", lang: "en" }, h("h1", {}, "Certificate of Volunteering"), h("p", {}, en)),
        h("div", { dir: "rtl", lang: "ar" }, h("h1", {}, "شهادة تطوع"), h("p", {}, ar))),
      h("div", { class: "cert-hours" }, h("b", {}, hours), h("span", {}, "Hours · ساعة")),
      h("div", { class: "cert-foot" }, h("span", {}, on(m.last_on, "en-GB")), h("span", { class: "cert-sign" }, m.cert_signer ?? "", m.cert_title ? h("br") : null, m.cert_title ?? ""))));
}

// ── the work page ──
function viewWork(main: HTMLElement, id: string): void {
  if (!S.me) { go("#signin"); return; }
  const sh = myShift(id);
  main.appendChild(h("a", { class: "backlink", href: "#me" }, t("navMine")));
  if (!sh?.can_work && !(S.work && S.work.id === id)) { main.appendChild(noteBox(t(sh ? "volClosed" : "vdNotAccepted"))); return; }
  if (!S.me.agreed) { viewAgree(main); return; }
  if (!S.work || S.work.id !== id) {
    main.appendChild(noteBox(t("loading")));
    void enterWork(id);
    return;
  }
  deskHtml(main, sh);
}

function viewAgree(main: HTMLElement): void {
  const go2 = button(t("vdAgreeBtn"), () => void agree(), "primary", S.agreeTick ? {} : { disabled: "" });
  const tick = h("input", { type: "checkbox", id: "agree-tick", checked: S.agreeTick, onchange: ((e: Event) => { S.agreeTick = (e.target as HTMLInputElement).checked; go2.disabled = !S.agreeTick; }) as EventListener });
  append(main, h("h1", {}, t("vdAgreeTitle")), h("p", { class: "sub" }, t("vdAgreeIntro")),
    h("ul", { class: "rules" }, ...(["vdAgree1", "vdAgree2", "vdAgree3", "vdAgree4"] as Key[]).map((k) => h("li", {}, t(k)))),
    h("label", { class: "tick", for: "agree-tick" }, tick, h("span", {}, t("vdAgreeTick"))), go2);
}
async function agree(): Promise<void> {
  const r = await rpc("volunteer_agree");
  if (!r.ok) { setNote(say(r)); render(); return; }
  await reloadMe();
  render();
}

async function enterWork(id: string): Promise<void> {
  const r = await rpc<Entered>("volunteer_enter", { p_session: id });
  if (!r.ok) { setNote(say(r)); await reloadMe(); go("#me"); return; }
  S.work = { id, ent: r.data, rows: null, list: null, listQ: "", listShow: "all", listSort: "number", msg: "", scanning: false };
  armTimer();
  render();
  if (r.data.caps.list) void loadList();
}

// The cut-off ends the page by itself. The server refuses every call after it whatever this page shows.
function armTimer(): void {
  window.clearTimeout(timer);
  if (!S.work) return;
  const left = Date.parse(S.work.ent.closes_at) - Date.now();
  timer = window.setTimeout(() => void heartbeat(), Math.max(1000, Math.min(left + 500, 120000)));
}
async function heartbeat(): Promise<void> {
  if (!S.work) return;
  const id = S.work.id;
  await load();
  if (!myShift(id)?.can_work) { leaveWork(t("volClosed")); return; }
  armTimer();
  if (S.work?.list && !S.work.scanning) void loadList();
}
function leaveWork(note: string): void {
  window.clearTimeout(timer);
  stopScan();
  S.work = null;
  setNote(note);
  go("#me");
}

function deskHtml(main: HTMLElement, sh: Mine | null): void {
  const w = S.work!;
  const e = w.ent, blood = sh?.ride_kind === "blood";
  const q = h("input", { id: "vol-q", type: "text", inputmode: "tel", dir: "ltr", maxlength: 20, autocomplete: "off", placeholder: t("volSearchPh"), "aria-label": t("volSearchPh"),
    onkeydown: ((ev: KeyboardEvent) => { if (ev.key === "Enter") { ev.preventDefault(); void search(q.value); } }) as unknown as EventListener });
  append(main, h("h1", {}, sh ? sessionName(sh) : ""),
    h("p", { class: "when" }, `${t("vdOpenUntil", whenLabel(e.closes_at))}${e.role ? ` · ${e.role}` : ""}`));
  if (e.counts) main.appendChild(countsBox(e, blood));
  if (e.briefing) main.appendChild(h("details", { class: "brief", open: true }, h("summary", {}, t("vdBriefing")), h("p", {}, e.briefing)));
  append(main,
    w.scanning ? scanPanel() : button(t("volScanBtn"), () => { w.scanning = true; render(); }, "primary", { id: "vol-scan" }),
    h("div", { class: "find" }, q, button(t("volFindBtn"), () => void search(q.value), "secondary", { id: "vol-find" })),
    h("p", { class: "msg", id: "vol-msg", role: "status" }, w.msg),
    h("div", { id: "vol-rows" }, ...(w.rows ?? []).map((r) => bookingRow(r, e, blood))));
  if (e.caps.list) main.appendChild(panel(e, blood));
  if (e.hours_mode !== "none") main.appendChild(h("div", { class: "foot-acts" }, button(t("vdFinish"), () => void finish())));
}

function countsBox(e: Entered, blood: boolean): HTMLElement {
  const c = e.counts!;
  return h("p", { class: "counts", id: "vol-counts" }, h("span", {}, h("b", {}, String(c.in)), ` / ${c.booked} ${t("volStIn")}`), blood ? h("span", {}, h("b", {}, String(c.donated)), ` ${t("donated")}`) : null, blood && c.visitors != null ? h("span", {}, h("b", {}, String(c.visitors)), ` ${t("visitors")}`) : null);
}

// ── the panel: the session's bookings in the staff list's shape. volunteer_list decides who sees it and which columns ──
const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
function panelRows(w: NonNullable<typeof S.work>): Booking[] {
  const raw = latin(w.listQ.trim()).toLowerCase(), digits = raw.replace(/[\s()+-]/g, "");
  const shown = (w.list ?? []).filter((r) => {
    if (raw && !(r.name.toLowerCase().includes(raw) || String(r.number) === raw || (/^\d{3,}$/.test(digits) && (r.phone ?? "").replace(/\D/g, "").includes(digits)))) return false;
    switch (w.listShow) {
      case "out": return !r.checked_in;
      case "in": return r.checked_in;
      case "desk": return !r.checked_in && !!r.desk;
      case "donated": return r.donated;
      case "donors": return !r.visitor;
      case "visitors": return !!r.visitor;
      default: return true;
    }
  });
  const num = (r: Booking) => r.number ?? Number.MAX_SAFE_INTEGER;
  if (w.listSort === "name") shown.sort((a, b) => a.name.localeCompare(b.name, currentLang()));
  else if (w.listSort === "out") shown.sort((a, b) => Number(a.checked_in) - Number(b.checked_in) || num(a) - num(b));
  else shown.sort((a, b) => num(a) - num(b));
  return shown;
}
function paintPanel(): void {
  const w = S.work, b = document.getElementById("vol-list");
  if (!w || !b || !w.list) return;
  const e = w.ent, blood = myShift(w.id)?.ride_kind === "blood", rows = panelRows(w);
  clear(b);
  if (rows.length) append(b, ...rows.map((r) => bookingRow(r, e, blood))); else b.appendChild(noteBox(t("volNotFound")));
  const n = document.getElementById("vol-list-n");
  if (n) n.textContent = `${rows.length} / ${w.list.length}`;
}
function panel(e: Entered, blood: boolean): HTMLElement {
  const w = S.work!;
  const opt = (value: string, label: string, cur: string) => h("option", { value, selected: value === cur }, label);
  const pick = (label: string, onchange: (v: string) => void, ...opts: HTMLElement[]) =>
    h("label", { class: "panel-pick" }, h("span", {}, label), h("select", { onchange: ((ev: Event) => { onchange((ev.target as HTMLSelectElement).value); paintPanel(); }) as EventListener }, ...opts));
  const q = h("input", { id: "vol-list-q", type: "text", autocomplete: "off", placeholder: t("vdPanelSearch"), "aria-label": t("vdPanelSearch"), value: w.listQ,
    oninput: ((ev: Event) => { w.listQ = (ev.target as HTMLInputElement).value; paintPanel(); }) as EventListener });
  const body = h("div", { id: "vol-list" });
  const box = h("section", { class: "panel", "aria-labelledby": "vol-panel-h" },
    h("div", { class: "panel-head" }, h("h2", { id: "vol-panel-h", class: "sec" }, t("vdPanelTitle")), h("span", { class: "num", id: "vol-list-n" }), button(t("vdRefresh"), () => void loadList(), "secondary", { id: "vol-refresh" })),
    h("div", { class: "panel-tools" }, q,
      pick(t("vdFilter"), (v) => { w.listShow = v; },
        opt("all", t("vdFilterAll"), w.listShow), opt("out", t("volStOut"), w.listShow), opt("in", t("volStIn"), w.listShow), opt("desk", t("vdFilterDesk"), w.listShow),
        ...(blood ? [opt("donated", t("donated"), w.listShow), opt("donors", t("roleDonor"), w.listShow), opt("visitors", t("roleVisitor"), w.listShow)] : [])),
      pick(t("vdSort"), (v) => { w.listSort = v; },
        opt("number", t("vdSortNumber"), w.listSort), opt("name", t("vdSortName"), w.listSort), opt("out", t("vdSortOut"), w.listSort))),
    h("div", { class: `panel-cols${e.caps.phone ? " has-phone" : ""}`, "aria-hidden": "true" }, h("span", {}, t("vdColName")), e.caps.phone ? h("span", {}, t("vdColPhone")) : null, h("span", {}, t("vdColStatus")), h("span", {}, t("vdColActions"))),
    body);
  if (!w.list) body.appendChild(noteBox(t("loading")));
  else { const rows = panelRows(w); if (rows.length) append(body, ...rows.map((r) => bookingRow(r, e, blood))); else body.appendChild(noteBox(t("volNotFound"))); }
  return box;
}

function bookingRow(r: Booking, e: Entered, blood: boolean): HTMLElement {
  const deskKey: Record<string, Key> = { bike: "vdDeskBike", approval: "vdDeskApproval", share: "vdDeskShare", waiver: "vdDeskWaiver", waitlist: "vdDeskWaitlist" };
  const acts: HTMLElement[] = [];
  // Donor or visitor (the booking app's blood_role, 20261105140000; the owner, 2026-11-05): told apart on every row, in the
  // booking card's two colours. A visitor has nothing to mark, so the free ride stays with donors; one tap switches
  // them, until the donation is marked (the database refuses it then too).
  const vis = blood && r.visitor === true;
  if (!r.own) {
    if (!r.checked_in) { if (!r.desk && e.caps.checkin) acts.push(button(t("checkIn"), () => void mark("volunteer_checkin", r.id, true), "primary")); }
    else if (blood && r.donated) { if (r.mine_donated && e.caps.undo) acts.push(button(t("volUndoDonated"), () => void mark("volunteer_donated", r.id, false))); }
    else {
      if (blood && !vis && e.caps.donated) acts.push(button(t("markDonated"), () => askDonated(r), "primary"));
      if (r.mine_in && e.caps.undo) acts.push(button(t("undoCheckIn"), () => void mark("volunteer_checkin", r.id, false)));
    }
    if (blood && !r.donated && e.caps.checkin && (r.checked_in || !r.desk)) acts.push(button(t(vis ? "makeDonor" : "makeVisitor"), () => void setRole(r.id, vis ? "donor" : "visitor")));
  }
  const details = [r.bike ? t("vdBike", r.bike) : "", r.size ? t("vdSize", r.size) : "", r.height ? t("vdHeight", r.height) : "", r.blood_type ? t("vdBlood", r.blood_type) : "", r.club ? t("vdClub", r.club) : ""].filter(Boolean);
  return h("div", { class: `card row${e.caps.phone ? " has-phone" : ""}`, "data-id": r.id },
    h("div", { class: "row-who" }, h("p", { class: "name" }, r.name, r.number != null ? h("span", { class: "num" }, ` #${r.number}`) : null),
      details.length ? h("p", { class: "when row-details" }, details.join(" · ")) : null),
    e.caps.phone ? h("div", { class: "row-phone" }, r.phone ? h("a", { class: "tel", dir: "ltr", href: `tel:${r.phone.replace(/[^\d+]/g, "")}`, "aria-label": t("vdCall", r.name) }, r.phone) : null) : null,
    h("div", { class: "row-state" }, h("div", { class: "chips" }, blood ? h("span", { class: `chip ${vis ? "chip-visitor" : "chip-donor"}` }, t(vis ? "roleVisitor" : "roleDonor")) : null, chip(t(r.checked_in ? "volStIn" : "volStOut"), r.checked_in), r.status === "waitlist" && !blood ? chip(t("vdWaitlist")) : null, r.donated ? chip(t("donated"), true) : null),
      r.own ? h("p", { class: "warn" }, t("vdOwn")) : !r.checked_in && r.desk ? h("p", { class: "warn" }, t(deskKey[r.desk] ?? "vdDeskAsk")) : null),
    acts.length ? h("div", { class: "row-acts" }, ...acts) : null);
}

function scanPanel(): HTMLElement {
  const w = S.work!;
  const video = h("video", { playsinline: true, muted: true, class: "scan-video" });
  const hint = h("p", { class: "when" }, t("scanHint"));
  const stop = () => { w.scanning = false; render(); };
  let last = "", lastAt = 0;
  void startScanner(video, (txt) => {
    const now = Date.now();
    if (txt === last && now - lastAt < 2500) return;
    last = txt; lastAt = now;
    void scanned(txt);
  }, () => { w.scanning = false; w.msg = t("scanNoCamera"); render(); }).then((sc) => { if (S.work?.scanning) scanner = sc; else sc.stop(); });
  return h("div", { class: "scan" }, video, hint, button(t("scanStop"), stop));
}
function stopScan(): void { if (scanner) { scanner.stop(); scanner = null; } }

async function scanned(txt: string): Promise<void> {
  const w = S.work; if (!w) return;
  const p = parseTicket(txt);
  if (!p) { w.msg = t("volNotFound"); paintMsg(); return; }
  await find({ p_ref: p.ref, p_ref_num: p.num });
  if (!S.work) return;
  if (w.rows?.length) { w.scanning = false; render(); } else paintMsg();
}
function paintMsg(): void { const m = document.getElementById("vol-msg"); if (m && S.work) m.textContent = S.work.msg; }

async function search(raw: string): Promise<void> {
  const w = S.work; if (!w) return;
  const v = raw.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  const ticket = parseTicket(v), digits = v.replace(/[\s()+-]/g, "");
  let args: Record<string, unknown> | null = null;
  if (ticket) args = { p_ref: ticket.ref, p_ref_num: ticket.num };
  else if (/^\d{1,6}$/.test(digits)) args = { p_number: Number(digits) };
  else if (/^\d{7,15}$/.test(digits)) args = { p_mobile: digits };
  if (!args) { w.rows = null; w.msg = t("volSearchHint"); render(); return; }
  await find(args);
  if (S.work) render();
}
async function find(args: Record<string, unknown>): Promise<void> {
  const w = S.work; if (!w) return;
  const r = await rpc<Booking[]>("volunteer_find", { p_session: w.id, ...args });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return; } w.rows = null; w.msg = say(r); return; }
  w.rows = Array.isArray(r.data) ? r.data : [];
  w.msg = w.rows.length ? "" : t("volNotFound");
}
async function loadList(): Promise<void> {
  const w = S.work; if (!w) return;
  const r = await rpc<Booking[]>("volunteer_list", { p_session: w.id });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return; } w.msg = say(r); paintMsg(); return; }
  w.list = Array.isArray(r.data) ? r.data : [];
  w.msg = "";
  listCounts(w);
  // Only the list and the figures: the search box keeps its text and its place.
  paintMsg();
  paintPanel();
  const c = document.getElementById("vol-counts");
  if (c && w.ent.counts) c.replaceWith(countsBox(w.ent, myShift(w.id)?.ride_kind === "blood"));
}
// The list is newer than the figures from entering, and other people are marking too.
function listCounts(w: NonNullable<typeof S.work>): void {
  const c = w.ent.counts, l = w.list;
  if (!c || !l) return;
  c.booked = l.length; c.in = l.filter((x) => x.checked_in).length; c.donated = l.filter((x) => x.donated).length;
  if (c.visitors != null) c.visitors = l.filter((x) => x.visitor).length;
}
async function mark(fn: "volunteer_checkin" | "volunteer_donated", id: string, on: boolean): Promise<void> {
  const w = S.work; if (!w) return;
  const r = await rpc<{ ok: boolean; noop?: boolean }>(fn, { p_session: w.id, p_entry_id: id, p_on: on });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return; } w.msg = say(r); render(); return; }
  if (!r.data.noop) {
    const c = w.ent.counts;
    let counted = false;
    for (const x of [...(w.rows ?? []), ...(w.list ?? [])]) {
      if (x.id !== id) continue;
      if (fn === "volunteer_checkin") { if (c && !counted) c.in += on ? 1 : -1; x.checked_in = on; x.mine_in = on; }
      else { if (c && !counted) c.donated += on ? 1 : -1; x.donated = on; x.mine_donated = on; }
      counted = true;
    }
  }
  w.msg = "";
  render();
}
// Check-in and the donation are two steps (the owner, 2026-11-05): Mark donated takes Check in's place under the finger, so a
// double tap marked people with no blood given. It always asks first, naming the person. Outside #app: a refresh leaves it open.
function askDonated(r: Booking): void {
  const box = h("dialog", { class: "ask" },
    h("p", { class: "ask-q" }, t("donatedQ", r.name)),
    h("p", {}, t("donatedBody")),
    h("div", { class: "ask-acts" },
      button(t("donatedNotYet"), () => box.close()),
      button(t("markDonated"), () => { box.close(); void mark("volunteer_donated", r.id, true); }, "primary")));
  box.addEventListener("close", () => box.remove());
  document.body.append(box);
  box.showModal();
}
async function setRole(id: string, role: "donor" | "visitor"): Promise<void> {
  const w = S.work; if (!w) return;
  const r = await rpc<{ ok: boolean }>("volunteer_blood_role", { p_session: w.id, p_entry_id: id, p_role: role });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return; } w.msg = say(r); render(); return; }
  const c = w.ent.counts, to = role === "visitor";
  let counted = false;
  for (const x of [...(w.rows ?? []), ...(w.list ?? [])]) {
    if (x.id !== id) continue;
    if (c && c.visitors != null && !counted && !!x.visitor !== to) c.visitors += to ? 1 : -1;
    x.visitor = to;
    counted = true;
  }
  w.msg = "";
  render();
}
async function finish(): Promise<void> {
  const w = S.work; if (!w) return;
  const r = await rpc("volunteer_clock_out", { p_session: w.id });
  if (!r.ok) { w.msg = say(r); render(); return; }
  await reloadMe();
  leaveWork(t("vdFinished"));
}

// ── start ──
async function start(): Promise<void> {
  await setLang(startLang());
  // Handed over from the booking app with a one-time code (My Account, or back from its sign-in).
  const q = new URLSearchParams(location.search);
  const code = q.get("signin");
  let handed = false;
  if (code) {
    q.delete("signin");
    const rest = q.toString();
    history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
    const r = await post("/api/handoff", { code });
    handed = r.ok;
  }
  await load();
  window.addEventListener("hashchange", render);
  if (handed) { afterSignIn(); return; }
  render();
}
void start();
