// The volunteer portal (volunteer.micromobility.sa), rebuilt on 2026-11-09 for a standing volunteer team (the owner's
// decision sheet): Home (#me, and the bare address), Opportunities (#opps, #o/<session>), Updates (#updates) and Profile
// (#profile, also #apply), with the work page (#work/<session>), the lead's team (#team/<session>) and the certificates
// (#cert) behind them. Signed out every address is the sign-in, except a certificate's check (#check/<code>), open to
// anyone with its code. Tabs float at the bottom on a phone and sit in the top bar on a wide screen; the work and team
// pages hide them on a phone (a stray tap ended the camera). The database decides everything.
//
// Since 2026-11-11 (the report's fixes 1, 3, 14, 15 and 19): every tab change and every return to the app reads the
// page again; a first read that fails says so with Try again (a lost connection and a fault on our side apart); the
// first three calls go at once; a list comes back to where it was scrolled; the service worker keeps the app's shell for
// a clear offline screen (static/sw.js).

import { post } from "./api";
import { viewCert, viewCheck } from "./certs";
import { append, clear, h, uid } from "./dom";
import { viewHome } from "./home";
import { currentLang, LANGS, setLang, startLang, t } from "./i18n";
import { icon } from "./icons";
import { watchInstall } from "./install";
import { viewList, viewOpp } from "./opps";
import { viewProfile } from "./profile";
import { AFTER_KEY, BOOKING, go, load, markRead, onRender, refresh, route, S, say, SUPPORT } from "./state";
import { button, link, note, submitBusy } from "./ui";
import { forgetUpdates, viewUpdates } from "./updates";
import { resetWork, stopScan, viewWork } from "./work";

const app = document.getElementById("app")!;
let signErr = "";
let loginDraft = "";
let lastRoute = "";
let showPwd = false;
let justRead = false; // a sign-in just read everything: the address it lands on need not read it again

// ── the frame ──
const TABS: { hash: string; key: "navHome" | "navOpps" | "navUpdates" | "navProfile"; ic: string; on: string[] }[] = [
  { hash: "#me", key: "navHome", ic: "home", on: ["me", "work", "team", "cert"] },
  { hash: "#opps", key: "navOpps", ic: "hand", on: ["opps", "list", "o"] },
  { hash: "#updates", key: "navUpdates", ic: "bell", on: ["updates"] },
  { hash: "#profile", key: "navProfile", ic: "person", on: ["profile", "apply"] },
];
function header(): HTMLElement {
  const r = route().name;
  const unread = (S.me?.unread ?? 0) > 0;
  return h("header", { class: "top" },
    h("a", { class: "brand", href: S.me ? "#me" : "#", "aria-label": t("appName") },
      h("img", { src: "/site/logo-mark-dark.png", alt: "", width: 40, height: 26 }),
      h("span", { class: "brand-name" }, t("portalName"))),
    S.me ? h("nav", { class: "tabs", "aria-label": t("navLabel") }, ...TABS.map((x) =>
      h("a", { class: "tab", href: x.hash, "aria-current": x.on.includes(r) ? "page" : null },
        h("span", { class: "tab-ic" }, icon(x.ic, 22), x.key === "navUpdates" && unread ? h("span", { class: "dot", id: "unread-dot", "aria-hidden": "true" }) : null),
        h("span", { class: "tab-t" }, t(x.key)),
        x.key === "navUpdates" && unread ? h("span", { class: "sr-only", id: "unread-sr" }, ` (${t("updNew")})`) : null))) : null);
}
/** The Updates dot alone, without drawing the page (the work page draws itself). */
function paintDot(): void {
  const tab = document.querySelector<HTMLElement>('nav.tabs a[href="#updates"]');
  if (!tab) return;
  const unread = (S.me?.unread ?? 0) > 0, dot = document.getElementById("unread-dot");
  if (unread && !dot) {
    tab.querySelector(".tab-ic")?.append(h("span", { class: "dot", id: "unread-dot", "aria-hidden": "true" }));
    tab.append(h("span", { class: "sr-only", id: "unread-sr" }, ` (${t("updNew")})`));
  } else if (!unread && dot) { dot.remove(); document.getElementById("unread-sr")?.remove(); }
}

// "Skip to content" goes to the page's main area, not by its href: the hash is this page's router, and "#main" drew the
// Opportunities list whatever was on the screen, closing the work page and its camera (the vendor portal's fix).
const skipToMain = ((e: Event) => {
  e.preventDefault();
  const main = document.getElementById("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
}) as EventListener;

function render(): void {
  const r = route();
  if (r.name !== "work" || !S.me) stopScan(); // the camera is off everywhere but the work page
  if (r.name !== "updates" && lastRoute === "updates") forgetUpdates();
  // the owed-details pop-up belongs to Profile: leaving it (the browser's back too) closes it
  if (r.name !== "profile" && r.name !== "apply") document.querySelector<HTMLDialogElement>("dialog.ask-owed")?.close();
  lastRoute = r.name;
  document.title = t("appName");
  clear(app);
  const main = h("main", { id: "main", class: `page page-${r.name}` });
  // A note outlives a redraw (leaving a page draws twice: the leaver, then the address changing), for as long as it takes
  // to read. A refusal is seen; what went right is said to a screen reader only (no bar after an action).
  if (S.note && Date.now() - S.noteAt < 12000) {
    const n = note(S.note, "alert");
    if (S.noteAct) n.append(" ", link(S.noteAct.label, S.noteAct.href, "secondary", "go", { rel: "noopener", class: "btn btn-secondary note-act" }));
    main.appendChild(n);
  } else { S.note = ""; S.noteAct = null; }
  if (S.quiet && Date.now() - S.quietAt < 5000) main.appendChild(h("p", { class: "sr-only", role: "status" }, S.quiet)); else S.quiet = "";
  // Nobody enters signed out (the owner, 2026-11-05): every address is the sign-in, and the opportunity or work page it
  // named is where they land after it.
  if (r.name === "check") viewCheck(main, r.id);
  else if (!S.me && S.boot) viewBootErr(main);
  else if (!S.me) {
    if ((r.name === "o" || r.name === "work") && r.id) { try { localStorage.setItem(AFTER_KEY, `${r.name}/${r.id}`); } catch { /* blocked storage: they find it again */ } }
    viewSignIn(main);
  } else if (r.name === "signin") { go("#me"); return; }
  else if (r.name === "me") viewHome(main);
  else if (r.name === "o") viewOpp(main, r.id);
  else if (r.name === "work") viewWork(main, r.id);
  else if (r.name === "team") viewWork(main, r.id, true);
  else if (r.name === "cert") viewCert(main);
  else if (r.name === "updates") viewUpdates(main);
  else if (r.name === "profile" || r.name === "apply") viewProfile(main);
  else viewList(main);
  document.body.classList.toggle("signed-in", !!S.me);
  // the floating tab bar stays off the work and team pages on a phone: one stray tap left the page and ended the camera
  document.body.classList.toggle("no-tabs", !!S.me && (r.name === "work" || r.name === "team"));
  append(app, h("a", { class: "skip", href: "#main", onclick: skipToMain }, t("skipToContent")), header(), main);
}
onRender(render);

/** Draws the page again after a read behind it, unless that would get in the way: the work page draws itself, and a
 *  field being typed in or a question being answered is never wiped. */
function redrawIfSafe(): void {
  const r = route().name;
  const busy = document.querySelector("dialog[open]") || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  if (r === "work" || r === "team" || r === "check" || busy) { paintDot(); return; }
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}
const readAgain = (force = false) => { void refresh(force).then((changed) => { if (changed) redrawIfSafe(); else paintDot(); }); };

// The first read failed, and nobody is known yet: a lost connection is not a sign-in form (fix 3).
function viewBootErr(main: HTMLElement): void {
  const off = S.boot === "offline";
  append(main, h("section", { class: "card boot-err", id: "boot-err" },
    h("span", { class: "boot-ic", "aria-hidden": "true" }, icon(off ? "offline" : "again", 28)),
    h("h1", {}, t(off ? "offTitle" : "srvTitle")),
    h("p", {}, t(off ? "errConnection" : "errServer")),
    button(t("retry"), () => load().then(render), "primary", { id: "boot-retry" }, "again")));
}

// ── signing in ──
function viewSignIn(main: HTMLElement): void {
  const idId = uid("id"), pwId = uid("pw"), langId = uid("lang");
  // The names password managers look for, and nothing that stops a paste (fix 19; WCAG 3.3.8).
  const who = h("input", { id: idId, name: "username", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", value: loginDraft });
  const pwd = h("input", { id: pwId, name: "password", type: showPwd ? "text" : "password", autocomplete: "current-password", autocapitalize: "none", spellcheck: "false" });
  const eye = h("button", { type: "button", class: "btn btn-icon pwd-eye", id: "pwd-eye", "aria-pressed": showPwd ? "true" : "false", "aria-controls": pwId,
    "aria-label": t(showPwd ? "pwdHide" : "pwdShow"), title: t(showPwd ? "pwdHide" : "pwdShow"),
    onclick: (() => {
      showPwd = !showPwd;
      pwd.type = showPwd ? "text" : "password";
      eye.setAttribute("aria-pressed", showPwd ? "true" : "false");
      eye.setAttribute("aria-label", t(showPwd ? "pwdHide" : "pwdShow"));
      eye.title = t(showPwd ? "pwdHide" : "pwdShow");
      eye.replaceChildren(icon(showPwd ? "eyeOff" : "eye", 20));
      pwd.focus();
    }) as EventListener }, icon(showPwd ? "eyeOff" : "eye", 20));
  main.classList.add("page-signin");
  const form: HTMLFormElement = h("form", { class: "card form signin", novalidate: true, method: "post", action: "#",
    onsubmit: ((e: Event) => { e.preventDefault(); submitBusy(form, () => signIn(who.value, pwd.value)); }) as EventListener },
    h("span", { class: "signin-mark", "aria-hidden": "true" }, icon("hand", 28)),
    h("h1", {}, t("vdSignTitle")),
    h("div", { class: "field" }, h("label", { for: idId }, t("vdSignId")), who),
    h("div", { class: "field" }, h("label", { for: pwId }, t("password")), h("div", { class: "pwd" }, pwd, eye)),
    signErr ? h("p", { class: "err", role: "alert" }, signErr) : null,
    h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, t("vdSignBtn"))),
    h("div", { class: "alt" },
      h("a", { href: `${BOOKING}/?handoff=volunteer&auth=forgot` }, t("signForgot")),
      h("a", { href: `${BOOKING}/signup?handoff=volunteer` }, t("signCreate"))));
  append(main, form,
    h("div", { class: "signin-foot" },
      h("label", { class: "lang-pick", for: langId }, icon("globe", 18), h("span", { class: "sr-only" }, t("language"))),
      h("select", { id: langId, class: "lang", onchange: ((e: Event) => void setLang((e.target as HTMLSelectElement).value).then(render)) as EventListener },
        ...LANGS.map((l) => h("option", { value: l.code, selected: l.code === currentLang() }, l.label))),
      h("a", { href: `${BOOKING}/?privacy`, rel: "noopener" }, t("footerPrivacy")),
      h("a", { href: SUPPORT, rel: "noopener" }, t("footerSupport"))));
  window.setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) (who.value ? pwd : who).focus(); }, 0);
}

async function signIn(who: string, pwd: string): Promise<void> {
  loginDraft = who;
  if (!who.trim()) { signErr = t("errEmailOrPhone"); render(); return; }
  if (!pwd) { signErr = t("errPassword"); render(); return; }
  const r = await post("/api/login", { login: who, password: pwd });
  if (!r.ok) { signErr = say(r); render(); return; }
  signErr = ""; loginDraft = ""; showPwd = false;
  resetWork(); // whoever had this phone before: their work page is not this volunteer's
  await load();
  markRead();
  afterSignIn();
}

/** Back to the opportunity or the work page they came for, else Home (a work link survives a sign-in: fix 14). */
function afterSignIn(): void {
  let after: string | null = null;
  try { after = localStorage.getItem(AFTER_KEY); localStorage.removeItem(AFTER_KEY); } catch { /* blocked storage */ }
  const m = after ? /^(?:(o|work)\/)?([A-Za-z0-9_-]{1,64})$/.exec(after) : null;
  const to = m ? `#${m[1] ?? "o"}/${encodeURIComponent(m[2])}` : "#me";
  justRead = location.hash !== to;
  go(to);
}

// ── where a list was scrolled: back from an opportunity, the list is where it was (fix 14) ──
const scrolls = new Map<string, number>();
let lastHash = location.hash;
function onHash(): void {
  scrolls.set(lastHash || "#", window.scrollY);
  lastHash = location.hash;
  const r = route().name;
  render();
  const y = r === "opps" || r === "list" || r === "me" ? scrolls.get(location.hash || "#") ?? 0 : 0;
  window.scrollTo(0, y);
  if (S.me && r !== "check" && !justRead) readAgain(true); // every tab change reads the page again (fix 1)
  justRead = false;
}

// ── start ──
async function start(): Promise<void> {
  watchInstall();
  const q = new URLSearchParams(location.search);
  const code = q.get("signin");
  // Handed over from the booking app with a one-time code (My Account, or back from its sign-in): the code first, so the
  // reads after it go with the new cookie; the language meanwhile.
  let handed = false;
  const lang = setLang(startLang());
  if (code) {
    q.delete("signin");
    const rest = q.toString();
    history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
    const r = await post("/api/handoff", { code });
    handed = r.ok;
  }
  await Promise.all([lang, load()]);
  markRead();
  window.addEventListener("hashchange", onHash);
  // back to the front: read again (with push off, opening the app is the only way news arrives)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") readAgain(); });
  window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) readAgain(); });
  window.addEventListener("online", () => { if (!S.me && S.boot) void load().then(render); });
  if (handed) afterSignIn(); else render();
  // The app shell, kept for a clear offline screen (static/sw.js; the owner's decision 11). Push stays off.
  if ("serviceWorker" in navigator) { try { void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); } catch { /* not here */ } }
}
void start();
