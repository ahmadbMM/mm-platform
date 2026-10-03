// The portal page: sign in, the forced password change, and the signed-in screens
// (#calendar, #bookings, #venue).

import { post, rpc, whenSignedOut } from "./api";
import { app, busy, button, errorNote, field, note, savedLang, setLang, t } from "./app";
import { afterBooking } from "./book";
import { renderBookings } from "./bookings";
import { invalidateCalendar, renderCalendar } from "./calendar";
import { clear, h } from "./dom";
import { icon, type IconName } from "./icons";
import type { Me } from "./model";
import type { Key } from "./strings";
import { passwordForm, renderVenue } from "./venue";

type Screen = "loading" | "signin" | "force" | "app";
let screen: Screen = "loading";
let signedOutNote = false;

const root = () => document.getElementById("app")!;

const VIEWS: { hash: string; key: Key; icon: IconName }[] = [
  { hash: "#calendar", key: "navCalendar", icon: "calendar" },
  { hash: "#bookings", key: "navBookings", icon: "list" },
  { hash: "#venue", key: "navVenue", icon: "store" },
];
const currentView = () => (VIEWS.some((v) => v.hash === location.hash) ? location.hash : "#calendar");

async function loadMe(): Promise<boolean> {
  const r = await rpc<Me>("fnb_me");
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

function brand(): HTMLElement {
  return h("div", { class: "brand" }, h("span", { class: "brand-mark", "aria-hidden": "true" }, "MM"), h("span", { class: "brand-name" }, t("appName")));
}

async function signOut(): Promise<void> {
  await post("/api/logout");
  app.me = null;
  screen = "signin";
  app.render();
}

// --- Sign in -----------------------------------------------------------------------------------

function renderSignIn(): void {
  const r = root();
  clear(r);
  const login = field({ label: t("loginLabel"), name: "login", autocomplete: "username", required: true, maxlength: 200, dir: "ltr" });
  const pw = field({ label: t("passwordLabel"), name: "password", type: "password", autocomplete: "current-password", required: true, maxlength: 200 });
  const eye = h("button", { type: "button", class: "icon-btn reveal", "aria-label": t("showPassword"), "aria-pressed": "false" }, icon("eye"));
  eye.addEventListener("click", () => {
    const show = pw.input.getAttribute("type") === "password";
    pw.input.setAttribute("type", show ? "text" : "password");
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? t("hidePassword") : t("showPassword"));
    eye.replaceChildren(icon(show ? "eyeOff" : "eye"));
  });
  pw.input.after(eye);
  pw.input.parentElement!.classList.add("has-reveal");
  const msg = h("div", { class: "msg" });
  if (signedOutNote) msg.append(note("info", t("errSession")));
  const go = button(t("signInButton"), { kind: "primary", type: "submit" });
  const form = h("form", { class: "card signin", novalidate: true, "aria-labelledby": "signin-title" },
    h("h1", { id: "signin-title" }, t("signInTitle")),
    h("p", { class: "lede" }, t("signInIntro")),
    login.wrap, pw.wrap, msg, h("div", { class: "actions" }, go),
    h("p", { class: "hint contact" }, icon("info"), h("span", {}, t("noAccount"))));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(msg);
    if (!login.input.value.trim() || !pw.input.value) { msg.append(errorNote("BAD_LOGIN")); return; }
    busy(go, true, t("signingIn"));
    const res = await post<{ must_change: boolean }>("/api/login", { login: login.input.value.trim(), password: pw.input.value });
    busy(go, false, t("signInButton"));
    if (!res.ok) { msg.append(errorNote(res.code)); pw.input.select(); return; }
    signedOutNote = false;
    if (!(await loadMe())) { msg.append(errorNote("SERVER")); return; }
    screen = res.data.must_change || app.me!.user.must_change ? "force" : "app";
    app.render();
  });
  r.append(
    h("header", { class: "bar bar-simple" }, brand(), langButton()),
    h("main", { id: "main", class: "narrow" }, form),
  );
  login.input.focus();
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
  r.append(
    h("header", { class: "bar bar-simple" }, brand(), h("div", { class: "bar-tools" }, langButton(), button(t("signOut"), { kind: "ghost", small: true, icon: "signout", onclick: () => void signOut() }))),
    h("main", { id: "main", class: "narrow" }, form),
  );
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
    ...VIEWS.map((v) => h("a", { href: v.hash, class: "tab", "aria-current": v.hash === view ? "page" : null }, icon(v.icon), h("span", {}, t(v.key)))));
  const main = h("main", { id: "main", tabindex: "-1" });
  r.append(
    h("header", { class: "bar" },
      h("div", { class: "bar-id" }, brand(), h("p", { class: "venue-name" }, name)),
      h("div", { class: "bar-tools" }, langButton(), button(t("signOut"), { kind: "ghost", small: true, icon: "signout", onclick: () => void signOut() }))),
    nav,
    main,
  );
  if (view === "#bookings") void renderBookings(main);
  else if (view === "#venue") renderVenue(main, loadMe);
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

afterBooking(() => {
  invalidateCalendar();
  if (screen === "app") app.render();
});

window.addEventListener("hashchange", () => {
  if (screen !== "app") return;
  app.render();
  document.getElementById("main")?.focus();
});

async function boot(): Promise<void> {
  const nav = (navigator.language || "en").toLowerCase();
  setLang(savedLang() || (nav.startsWith("ar") ? "ar" : "en"));
  const r = await rpc<Me>("fnb_me");
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
