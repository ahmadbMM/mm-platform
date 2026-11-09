// Profile (#profile; #apply is the old address of the same page). The volunteer's profile: the days usually free (at least
// one), skills, T-shirt size and WhatsApp (volunteer_apply); the account's birth date and emergency contact, shown and
// kept in the booking app; the Arabic name for certificates; notifications; the language; signing out.

import { post, rpc } from "./api";
import { append, clear, h, uid } from "./dom";
import { currentLang, LANGS, longDate, setLang, t } from "./i18n";
import { icon } from "./icons";
import { pushIsOn, pushOff, pushOn, pushSupport } from "./push";
import { BOOKING, go, load, reloadMe, render, S, say, setNote, standing, SUPPORT } from "./state";
import { button, chip, note, toggle } from "./ui";

const SHIRTS = ["XS", "S", "M", "L", "XL", "XXL"];
// Sunday first, as the week runs in Saudi Arabia; 0 = Sunday, as the database keeps them.
function weekday(d: number): string {
  try { return new Date(Date.UTC(2026, 0, 4 + d)).toLocaleDateString(`${currentLang()}-u-ca-gregory-nu-latn`, { weekday: "long", timeZone: "UTC" }); } catch { return String(d); }
}

// The form's picks survive a redraw (a note, the language) until they are saved.
let draft: { days: Set<number>; shirt: string | null } | null = null;

export async function signOut(): Promise<void> {
  await post("/api/logout");
  S.me = null; S.opps = null; S.prof = null; S.updates = null; draft = null;
  go("#");
}

export function viewProfile(main: HTMLElement): void {
  const m = S.me!, p = S.prof, who = standing();
  append(main, h("h1", {}, t("navProfile")),
    h("div", { class: "who" }, h("span", { class: "who-mark" }, icon("person", 22)), h("div", {},
      h("p", { class: "who-name" }, m.name),
      h("div", { class: "chips" },
        who === "active" ? chip(t("profApproved"), "on", "tick") : who === "waiting" ? chip(t("profWaitingChip"), "wait", "clock") : null))));

  if (who === "paused" || who === "ended") main.appendChild(note(t(who === "paused" ? "vdPaused" : "vdExpired")));
  else if (p) main.appendChild(profileForm());

  // The account's own, kept in the booking app (volunteer_profile, 20261109120000).
  if (p) {
    const fix = h("a", { class: "fix", href: `${BOOKING}/account`, rel: "noopener" }, h("span", {}, t("profAddInApp")), icon("go", 16, true));
    const em = p.emergency;
    main.appendChild(h("section", { class: "card facts", "aria-labelledby": "acct-h" },
      h("h2", { class: "sec-in", id: "acct-h" }, t("profAccount")),
      h("div", { class: "fact", id: "fact-dob" }, h("p", { class: "fact-k" }, t("profDob")),
        p.birth_date ? h("p", { class: "fact-v" }, longDate(p.birth_date)) : h("div", { class: "fact-miss" }, chip(t("profMissing"), "warn"), fix.cloneNode(true))),
      h("div", { class: "fact", id: "fact-em" }, h("p", { class: "fact-k" }, t("profEmergency")),
        em ? h("p", { class: "fact-v" }, em.name, h("span", { class: "fact-sub", dir: "ltr" }, em.phone), em.relation ? h("span", { class: "fact-sub" }, em.relation) : null)
          : h("div", { class: "fact-miss" }, chip(t("profMissing"), "warn"), fix.cloneNode(true)))));
  }

  // The Arabic name printed under the name on certificates.
  if (p) {
    const arId = uid("ar");
    const ar = h("input", { id: arId, type: "text", dir: "rtl", lang: "ar", maxlength: 120, autocomplete: "off", value: p.name_ar ?? "" });
    main.appendChild(h("form", { class: "card form", "aria-labelledby": "ar-h", onsubmit: ((e: Event) => { e.preventDefault(); void saveNameAr(ar.value); }) as EventListener },
      h("h2", { class: "sec-in", id: "ar-h" }, t("certNameHead")),
      h("div", { class: "field" }, h("label", { for: arId }, t("certNameAr")), ar),
      h("button", { type: "submit", class: "btn btn-secondary" }, h("span", {}, t("applySave")))));
  }

  main.appendChild(settings());
  append(main, h("div", { class: "foot-links" },
    h("a", { href: "#cert" }, icon("doc", 16), h("span", {}, t("certTitle"))),
    h("a", { href: `${BOOKING}/?privacy`, rel: "noopener" }, h("span", {}, t("footerPrivacy"))),
    h("a", { href: SUPPORT, rel: "noopener" }, h("span", {}, t("footerSupport")))));
}

function profileForm(): HTMLElement {
  const p = S.prof!, who = standing();
  const d = draft ?? (draft = { days: new Set(p.days ?? []), shirt: p.shirt ?? null });
  const skId = uid("skills"), waId = uid("wa");
  const skills = h("textarea", { id: skId, rows: 3, maxlength: 300 }, p.skills ?? "");
  const wa = h("input", { id: waId, type: "tel", dir: "ltr", maxlength: 20, autocomplete: "tel", value: p.whatsapp ?? "" });
  // Sunday first; each a toggle chip.
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const b = h("button", { type: "button", class: "tog", "aria-pressed": d.days.has(n) ? "true" : "false", "data-day": n,
      onclick: (() => { if (d.days.has(n)) d.days.delete(n); else d.days.add(n); b.setAttribute("aria-pressed", d.days.has(n) ? "true" : "false"); }) as EventListener }, weekday(n));
    return b;
  });
  const shirts = SHIRTS.map((s) => {
    const b = h("button", { type: "button", class: "tog tog-sm", "aria-pressed": d.shirt === s ? "true" : "false",
      onclick: (() => { d.shirt = d.shirt === s ? null : s; for (const x of shirts) x.setAttribute("aria-pressed", x.textContent === d.shirt ? "true" : "false"); }) as EventListener }, s);
    return b;
  });
  const first = !p.profile_at && who !== "active";
  const send = async () => {
    if (!d.days.size) { setNote(t("profDaysNeeded")); render(); return; }
    const r = await rpc<{ status: string }>("volunteer_apply", { p_skills: skills.value, p_days: [...d.days].sort(), p_shirt: d.shirt, p_whatsapp: wa.value.trim() || null });
    if (!r.ok) { setNote(say(r)); render(); return; }
    draft = null;
    setNote(t(first ? "applySent" : "applySaved"));
    await reloadMe();
    if (first) { await load(); go("#me"); } else render();
  };
  return h("form", { class: "card form", id: "prof-form", "aria-labelledby": "prof-h", onsubmit: ((e: Event) => { e.preventDefault(); void send(); }) as EventListener },
    h("h2", { class: "sec-in", id: "prof-h" }, t("profVolunteer")),
    h("fieldset", { class: "pick" }, h("legend", {}, t("applyDays")), h("div", { class: "chips" }, ...days)),
    h("div", { class: "field" }, h("label", { for: skId }, t("applySkills")), skills),
    h("fieldset", { class: "pick" }, h("legend", {}, t("applyShirt")), h("div", { class: "chips" }, ...shirts)),
    h("div", { class: "field" }, h("label", { for: waId }, t("applyWa")), wa),
    h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, t(first ? "applyBtn" : "applySave"))));
}

async function saveNameAr(value: string): Promise<void> {
  const r = await rpc<{ ok: boolean; name_ar: string | null }>("volunteer_name_ar_save", { p_name_ar: value.trim() });
  if (!r.ok) { setNote(say(r)); render(); return; }
  if (S.prof) S.prof.name_ar = r.data?.name_ar ?? null;
  setNote(t("applySaved"));
  render();
}

function settings(): HTMLElement {
  const box = h("section", { class: "card settings", "aria-labelledby": "set-h" }, h("h2", { class: "sec-in", id: "set-h" }, t("profSettings")));
  // Notifications: a switch where the browser can take a push; on an iPhone, the Home Screen first.
  const sup = pushSupport();
  if (sup === "home") box.appendChild(h("div", { class: "set-row", id: "push-row" }, h("span", { class: "set-k" }, icon("bell", 18), h("span", {}, t("pushTitle"))), h("p", { class: "set-v" }, t("pushIos"))));
  else if (sup === "ok") {
    const host = h("div", { id: "push-row" });
    box.appendChild(host);
    const paint = (on: boolean, busy = false) => {
      clear(host);
      host.appendChild(toggle(t("pushTitle"), on, (want) => {
        paint(want, true);
        void (want ? pushOn() : pushOff().then(() => "off" as const)).then((res) => {
          if (res === "denied") setNote(t("pushBlocked"));
          else if (res === "failed") setNote(t("pushFailed"));
          else setNote(t(res === "on" ? "pushOnNote" : "pushOffNote"));
          render();
        });
      }, busy ? { disabled: "" } : {}, "bell"));
    };
    paint(false, true);
    void pushIsOn().then((on) => paint(on));
  }
  const langId = uid("lang");
  box.appendChild(h("div", { class: "set-row" }, h("label", { class: "set-k", for: langId }, icon("globe", 18), h("span", {}, t("language"))),
    h("select", { id: langId, class: "lang", onchange: ((e: Event) => void setLang((e.target as HTMLSelectElement).value).then(render)) as EventListener },
      ...LANGS.map((l) => h("option", { value: l.code, selected: l.code === currentLang() }, l.label)))));
  box.appendChild(button(t("signOut"), () => void signOut(), "quiet", { id: "sign-out" }, "out"));
  return box;
}

