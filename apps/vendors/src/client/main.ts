// The portal page: sign in, the forced password change, and the signed-in screens
// (#calendar, #bookings, #insights, #venue, #team for owners), plus #privacy, open to everyone.

import { post, rpc, whenMustChange, whenSignedOut } from "./api";
import { app, busy, button, errorNote, field, note, savedLang, setLang, t } from "./app";
import { afterBooking } from "./book";
import { renderBookings } from "./bookings";
import { invalidateCalendar, renderCalendar } from "./calendar";
import { mailLink, MM_EMAIL, waLink } from "./contact";
import { clear, h } from "./dom";
import { icon, type IconName } from "./icons";
import { renderInsights } from "./insights";
import type { Me } from "./model";
import { renderPrivacy } from "./privacy";
import type { Key } from "./strings";
import { renderTeam } from "./team";
import { passwordForm, renderVenue } from "./venue";

type Screen = "loading" | "signin" | "force" | "app";
let screen: Screen = "loading";
let signedOutNote = false;

const root = () => document.getElementById("app")!;

const VIEWS: { hash: string; key: Key; icon: IconName; owner?: boolean }[] = [
  { hash: "#calendar", key: "navCalendar", icon: "calendar" },
  { hash: "#bookings", key: "navBookings", icon: "list" },
  { hash: "#insights", key: "navInsights", icon: "chart" },
  { hash: "#venue", key: "navVenue", icon: "store" },
  { hash: "#team", key: "navTeam", icon: "users", owner: true },
];
const myViews = () => VIEWS.filter((v) => !v.owner || app.me?.user.role === "owner");
const currentView = () => (location.hash === "#privacy" ? "#privacy" : myViews().some((v) => v.hash === location.hash) ? location.hash : "#calendar");

/** What was typed on the sign-in form, kept while the page redraws (a language switch). */
const draft = { login: "", password: "" };

async function loadMe(): Promise<boolean> {
  const r = await rpc<Me>("vendor_me");
  if (!r.ok) return false;
  app.me = r.data;
  return true;
}

function langButton(): HTMLButtonElement {
  const b = h("button", { type: "button", class: "btn btn-ghost btn-small lang", lang: app.lang === "ar" ? "en" : "ar", "aria-label": t("langSwitchLabel") },
    icon("globe"), h("span", {}, t("langSwitch")));
  b.addEventListener("click", () => {
    setLang(app.lang === "ar" ? "en" : "ar");
    app.render();
    document.querySelector<HTMLButtonElement>("button.lang")?.focus();
  });
  return b;
}

/** The website's header (SiteNav): the MicroMobility mark on a white bar, then the portal's name. */
function brand(): HTMLElement {
  return h("a", { class: "brand", href: "/", "aria-label": t("homeLink") },
    h("img", { src: "/site/logo-mark-dark.png", alt: "", width: 40, height: 26 }),
    h("span", { class: "brand-name", "aria-hidden": "true" }, t("portalName")));
}

/** The header: the mark on the start side; the venue, the language and sign-out on the end. */
function header(opts: { venue?: string; signOut?: boolean }): HTMLElement {
  return h("header", { class: "bar" }, brand(),
    h("div", { class: "bar-tools" },
      opts.venue ? h("p", { class: "venue-name" }, opts.venue) : null,
      langButton(),
      opts.signOut ? button(t("signOut"), { kind: "ghost", small: true, icon: "signout", onclick: () => void signOut() }) : null));
}

/** The website's footer (SiteFooter), kept to the mark, a contact line and the rights line. */
function footer(): HTMLElement {
  const year = (app.me?.today || new Date().toISOString()).slice(0, 4);
  return h("footer", { class: "foot" },
    h("div", { class: "foot-in" },
      h("div", { class: "foot-brand" },
        h("span", { class: "foot-mark", role: "img", "aria-label": "MicroMobility" }),
        h("p", {}, t("appTagline"))),
      h("ul", { class: "foot-links" },
        h("li", {}, h("span", {}, `${t("footerEmail")}: `), h("a", { href: `mailto:${MM_EMAIL}`, dir: "ltr" }, icon("mail"), h("span", {}, MM_EMAIL))),
        h("li", {}, h("span", {}, `${t("footerWebsite")}: `), h("a", { href: "https://micromobility.sa", dir: "ltr", rel: "noopener" }, h("span", {}, "micromobility.sa"), icon("external"))),
        h("li", {}, h("a", { href: "#privacy", class: "foot-privacy" }, h("span", {}, t("privacyLink")))))),
    h("p", { class: "foot-bottom" }, `© ${year} ${app.lang === "ar" ? "مايكروموبيليتي" : "MicroMobility"}. ${t("footerRights")}`));
}

/** One screen: the header, the page and the footer, with the screen named for its background. */
function frame(name: Screen, top: HTMLElement, ...rest: HTMLElement[]): void {
  const r = root();
  r.dataset.screen = name;
  r.append(top, ...rest, footer());
}

async function signOut(): Promise<void> {
  // The Worker ends this session in the database (vendor_logout) and clears the cookie.
  await post("/api/logout");
  app.me = null;
  screen = "signin";
  app.render();
}

// --- Sign in -----------------------------------------------------------------------------------

function renderSignIn(): void {
  const r = root();
  clear(r);
  if (location.hash === "#privacy") {
    const main = h("main", { id: "main", class: "narrow" });
    frame("signin", header({}), main);
    renderPrivacy(main, true);
    return;
  }
  const login = field({ label: t("loginLabel"), name: "login", autocomplete: "username", required: true, maxlength: 200, dir: "ltr", value: draft.login });
  const pw = field({ label: t("passwordLabel"), name: "password", type: "password", autocomplete: "current-password", required: true, maxlength: 200, value: draft.password });
  login.input.addEventListener("input", () => { draft.login = login.input.value; paintForgot(); });
  pw.input.addEventListener("input", () => { draft.password = pw.input.value; });
  const eye = h("button", { type: "button", class: "icon-btn reveal", "aria-label": t("showPassword"), "aria-pressed": "false" }, icon("eye"));
  eye.addEventListener("click", () => {
    const show = pw.input.getAttribute("type") === "password";
    pw.input.setAttribute("type", show ? "text" : "password");
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? t("hidePassword") : t("showPassword"));
    eye.replaceChildren(icon(show ? "eyeOff" : "eye"));
  });
  // The website's password row: the field, and the show button beside it.
  const row = h("div", { class: "pwd" });
  pw.input.replaceWith(row);
  row.append(pw.input, eye);
  const msg = h("div", { class: "msg" });
  if (signedOutNote) msg.append(note("info", t("errSession")));
  const go = button(t("signInButton"), { kind: "primary", type: "submit" });
  // Forgot your password: a WhatsApp or an email to MicroMobility, the login typed in for them.
  const wa = h("a", { class: "btn btn-secondary btn-small", target: "_blank", rel: "noopener" }, h("span", {}, t("forgotWhatsApp")));
  const mail = h("a", { class: "btn btn-secondary btn-small" }, icon("mail"), h("span", {}, t("forgotEmail")));
  function paintForgot(): void {
    const body = t("forgotBody", { login: login.input.value.trim() || "-" });
    wa.setAttribute("href", waLink(body));
    mail.setAttribute("href", mailLink(t("forgotSubject"), body));
  }
  paintForgot();
  const forgot = h("details", { class: "forgot" },
    h("summary", {}, t("forgotPassword")),
    h("p", { class: "hint" }, t("forgotIntro")),
    h("div", { class: "actions start" }, wa, mail));
  const form = h("form", { class: "card signin", novalidate: true, "aria-labelledby": "signin-title" },
    h("img", { class: "signin-logo", src: "/site/logo-dark.png", alt: "MicroMobility", width: 32, height: 34 }),
    h("p", { class: "eyebrow" }, t("portalName")),
    h("h1", { id: "signin-title" }, t("signInTitle")),
    h("p", { class: "lede" }, t("signInIntro")),
    login.wrap, pw.wrap, msg, h("div", { class: "actions" }, go), forgot,
    h("p", { class: "hint contact" }, icon("info"), h("span", {}, t("noAccount"))));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(msg);
    if (!login.input.value.trim() || !pw.input.value) { msg.append(errorNote("BAD_LOGIN")); return; }
    busy(go, true, t("signingIn"));
    const res = await post<{ must_change: boolean }>("/api/login", { login: login.input.value.trim(), password: pw.input.value });
    busy(go, false, t("signInButton"));
    if (!res.ok) {
      msg.append(errorNote(res.code));
      if (res.code === "TEMP_EXPIRED") forgot.open = true;
      pw.input.select();
      return;
    }
    signedOutNote = false;
    draft.password = "";
    if (!(await loadMe())) { msg.append(errorNote("SERVER")); return; }
    screen = res.data.must_change || app.me!.user.must_change ? "force" : "app";
    app.render();
  });
  frame("signin", header({}), h("main", { id: "main", class: "narrow" }, form));
  if (!draft.login) login.input.focus();
}

// --- Forced password change -------------------------------------------------------------------

function renderForce(): void {
  const r = root();
  clear(r);
  const form = passwordForm(true, async () => {
    await loadMe();
    screen = "app";
    location.hash = "#calendar";
    app.render();
  });
  frame("force", header({ signOut: true }), h("main", { id: "main", class: "narrow" }, form));
  form.querySelector<HTMLInputElement>("input")?.focus();
}

// --- Signed in --------------------------------------------------------------------------------

function renderApp(): void {
  const me = app.me!;
  const r = root();
  clear(r);
  const name = app.lang === "ar" && me.venue.name_ar ? me.venue.name_ar : me.venue.name;
  const view = currentView();
  const nav = h("nav", { class: "tabs", "aria-label": t("mainNav") },
    ...myViews().map((v) => h("a", { href: v.hash, class: "tab", "aria-current": v.hash === view ? "page" : null }, icon(v.icon), h("span", {}, t(v.key)))));
  const main = h("main", { id: "main", tabindex: "-1" });
  frame("app", header({ venue: name, signOut: true }), nav, main);
  if (view === "#bookings") void renderBookings(main);
  else if (view === "#insights") void renderInsights(main);
  else if (view === "#venue") renderVenue(main, loadMe);
  else if (view === "#team") void renderTeam(main);
  else if (view === "#privacy") renderPrivacy(main, false);
  else void renderCalendar(main);
}

app.render = () => {
  if (screen === "signin") renderSignIn();
  else if (screen === "force") renderForce();
  else if (screen === "app") renderApp();
};

whenSignedOut(() => {
  if (screen === "signin" || screen === "loading") return;
  app.me = null;
  screen = "signin";
  signedOutNote = true;
  document.querySelectorAll("dialog").forEach((d) => d.close());
  app.render();
});

// A call refused with MUST_CHANGE (the temporary password is still in use): the change comes first.
whenMustChange(() => {
  if (screen !== "app") return;
  screen = "force";
  document.querySelectorAll("dialog").forEach((d) => d.close());
  app.render();
});

afterBooking(() => {
  invalidateCalendar();
  if (screen === "app") app.render();
});

// "Skip to content" (static/index.html) goes to the page's main area. Not by its href: the hash is
// this page's router, and "#main" drew the Calendar whatever was on the screen.
document.querySelector("a.skip")?.addEventListener("click", (e) => {
  e.preventDefault();
  const main = document.getElementById("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
});

window.addEventListener("hashchange", () => {
  if (screen === "signin") { app.render(); return; }
  if (screen !== "app") return;
  app.render();
  document.getElementById("main")?.focus();
});

async function boot(): Promise<void> {
  const nav = (navigator.language || "en").toLowerCase();
  setLang(savedLang() || (nav.startsWith("ar") ? "ar" : "en"));
  const r = await rpc<Me>("vendor_me");
  if (r.ok) {
    app.me = r.data;
    screen = r.data.user.must_change ? "force" : "app";
  } else if (r.code === "BAD_TOKEN") {
    screen = "signin";
  } else {
    // Network or server trouble: say so, with a way to try again.
    clear(root());
    root().append(h("main", { id: "main", class: "narrow" }, h("div", { class: "card" }, h("h1", {}, t("appName")), errorNote(r.code),
      h("div", { class: "actions" }, button(t("retry"), { kind: "primary", onclick: () => void boot() })))));
    return;
  }
  app.render();
}

void boot();
