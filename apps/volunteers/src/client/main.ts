// The volunteer portal (volunteer.micromobility.sa), rebuilt on 2026-11-09 for a standing volunteer team (the owner's
// decision sheet): Home (#me), Opportunities (#, #o/<session>), Updates (#updates) and Profile (#profile, also #apply),
// with the work page (#work/<session>), the lead's team (#team/<session>) and the certificates (#cert) behind them.
// Signed out every address is the sign-in, except a certificate's check (#check/<code>), open to anyone with its code.
// Tabs float at the bottom on a phone and sit in the top bar on a wide screen. The database decides everything.

import { post } from "./api";
import { viewCert, viewCheck } from "./certs";
import { append, clear, h, uid } from "./dom";
import { viewHome } from "./home";
import { currentLang, LANGS, setLang, startLang, t } from "./i18n";
import { icon } from "./icons";
import { viewList, viewOpp } from "./opps";
import { viewProfile } from "./profile";
import { AFTER_KEY, BOOKING, go, load, onRender, route, S, say, SUPPORT } from "./state";
import { note } from "./ui";
import { forgetUpdates, viewUpdates } from "./updates";
import { resetWork, stopScan, viewWork } from "./work";

const app = document.getElementById("app")!;
let signErr = "";
let loginDraft = "";
let lastRoute = "";

// ── the frame ──
const TABS: { hash: string; key: "navHome" | "navOpps" | "navUpdates" | "navProfile"; ic: string; on: string[] }[] = [
  { hash: "#me", key: "navHome", ic: "home", on: ["me", "work", "team", "cert"] },
  { hash: "#", key: "navOpps", ic: "hand", on: ["list", "o"] },
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
        x.key === "navUpdates" && unread ? h("span", { class: "sr-only" }, ` (${t("updNew")})`) : null))) : null);
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
  lastRoute = r.name;
  document.title = t("appName");
  clear(app);
  const main = h("main", { id: "main", class: `page page-${r.name}` });
  // A note outlives a redraw (leaving a page draws twice: the leaver, then the address changing), for as long as it takes to read.
  if (S.note && Date.now() - S.noteAt < 12000) main.appendChild(note(S.note)); else S.note = "";
  // Nobody enters signed out (the owner, 2026-11-05): every address is the sign-in, and the opportunity it named is
  // where they land after it.
  if (r.name === "check") viewCheck(main, r.id);
  else if (!S.me) {
    if ((r.name === "o" || r.name === "work") && r.id) { try { localStorage.setItem(AFTER_KEY, r.id); } catch { /* blocked storage: they find it again */ } }
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
  append(app, h("a", { class: "skip", href: "#main", onclick: skipToMain }, t("skipToContent")), header(), main);
}
onRender(render);

// ── signing in ──
function viewSignIn(main: HTMLElement): void {
  const idId = uid("id"), pwId = uid("pw"), langId = uid("lang");
  const who = h("input", { id: idId, type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", value: loginDraft });
  const pwd = h("input", { id: pwId, type: "password", autocomplete: "current-password" });
  main.classList.add("page-signin");
  append(main,
    h("form", { class: "card form signin", novalidate: true, onsubmit: ((e: Event) => { e.preventDefault(); void signIn(who.value, pwd.value); }) as EventListener },
      h("span", { class: "signin-mark", "aria-hidden": "true" }, icon("hand", 28)),
      h("h1", {}, t("vdSignTitle")),
      h("div", { class: "field" }, h("label", { for: idId }, t("vdSignId")), who),
      h("div", { class: "field" }, h("label", { for: pwId }, t("password")), pwd),
      signErr ? h("p", { class: "err", role: "alert" }, signErr) : null,
      h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, t("vdSignBtn"))),
      h("div", { class: "alt" },
        h("a", { href: `${BOOKING}/?handoff=volunteer&auth=forgot` }, t("signForgot")),
        h("a", { href: `${BOOKING}/signup?handoff=volunteer` }, t("signCreate")))),
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
  signErr = ""; loginDraft = "";
  resetWork(); // whoever had this phone before: their work page is not this volunteer's
  await load();
  afterSignIn();
}

/** Back to the opportunity they were on, else Home. */
function afterSignIn(): void {
  let after: string | null = null;
  try { after = localStorage.getItem(AFTER_KEY); localStorage.removeItem(AFTER_KEY); } catch { /* blocked storage */ }
  go(after ? `#o/${encodeURIComponent(after)}` : "#me");
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
  window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });
  if (handed) { afterSignIn(); return; }
  render();
}
void start();
