// Profile (#profile; #apply is the old address of the same page). The volunteer's profile: the days usually free (at least
// one), skills, T-shirt size and WhatsApp (volunteer_apply); what they most want from volunteering (volunteer_motive);
// the account's birth date and emergency contact, shown and kept in the booking app, and asked for in a centred pop-up
// BEFORE the form when one is missing (fix 7); the Arabic name for certificates; the certificates; notifications; the
// language; signing out. A saved form says so on its own button, never in a bar.

import { post, rpc } from "./api";
import { append, clear, h, uid } from "./dom";
import { currentLang, LANGS, longDate, setLang, t, type Key } from "./i18n";
import { icon } from "./icons";
import { PUSH_SWITCH, pushIsOn, pushOff, pushOn, pushSupport } from "./push";
import { ACCOUNT, BOOKING, go, load, noteErr, owed, reloadMe, render, S, setNote, setQuiet, standing, SUPPORT } from "./state";
import { reasonWord } from "./shift";
import { button, chip, dialog, fmtPhone, link, note, submitBusy, toggle } from "./ui";
import { resetWork } from "./work";

const SHIRTS = ["XS", "S", "M", "L", "XL", "XXL"];
// Sunday first, as the week runs in Saudi Arabia; 0 = Sunday, as the database keeps them.
function weekday(d: number): string {
  try { return new Date(Date.UTC(2026, 0, 4 + d)).toLocaleDateString(`${currentLang()}-u-ca-gregory-nu-latn`, { weekday: "long", timeZone: "UTC" }); } catch { return String(d); }
}

// The form's picks and what was typed survive a redraw (a note, a refusal, the language) until they are saved.
let draft: { days: Set<number>; shirt: string | null; skills: string; wa: string } | null = null;
// Which Save just went through: its button says Saved until the next change.
let saved: "" | "prof" | "ar" = "";

export async function signOut(): Promise<void> {
  await post("/api/logout");
  S.me = null; S.opps = null; S.prof = null; S.updates = null; draft = null; saved = "";
  resetWork(); // the work page's state, marks not sent and timers are this volunteer's, not the next one's
  go("#");
}

/** The details the account owes, asked for before the form: a centred pop-up whose only ways on are adding them in the
 *  booking app, or leaving for Home (the owner, 2026-11-10: details asked for are an unskippable pop-up with a button to
 *  where they are filled). */
function askOwed(miss: ("dob" | "emergency")[]): void {
  if (document.querySelector("dialog.ask-owed")) return;
  const box: HTMLDialogElement = dialog(t("stepDetails"), [h("div", { class: "chips" }, ...miss.map((k) => chip(t(k === "dob" ? "profDob" : "profEmergency"), "warn")))],
    [link(t("addDetails"), ACCOUNT, "primary", "go", { rel: "noopener", id: "owed-go" }),
      button(t("navHome"), () => { box.close(); go("#me"); }, "quiet", { id: "owed-home" })], "ask-owed", true);
}

export function viewProfile(main: HTMLElement): void {
  const m = S.me!, p = S.prof, who = standing();
  append(main, h("h1", {}, t("navProfile")),
    h("div", { class: "who" }, h("span", { class: "who-mark" }, icon("person", 22)), h("div", {},
      h("p", { class: "who-name" }, m.name),
      h("div", { class: "chips" },
        who === "active" ? chip(t("profApproved"), "on", "tick") : who === "waiting" ? chip(t("profWaitingChip"), "wait", "clock") : null))));

  if (who === "paused" || who === "ended") {
    main.appendChild(note(t(who === "paused" ? "vdPaused" : "vdExpired")));
    // why staff said no, when they gave a reason (decision 9)
    if (p?.reason) main.appendChild(h("p", { class: "reason", id: "prof-reason" }, reasonWord(p.reason)));
  } else if (p) {
    const miss = owed();
    if (miss.length) queueMicrotask(() => askOwed(miss));
    main.appendChild(profileForm());
  }
  if (p && "motive" in p && who !== "paused" && who !== "ended") main.appendChild(motiveCard());

  // The account's own, kept in the booking app (volunteer_profile, 20261109120000).
  if (p) {
    const fix = h("a", { class: "fix", href: ACCOUNT, rel: "noopener" }, h("span", {}, t("profAddInApp")), icon("go", 16, true));
    const em = p.emergency;
    main.appendChild(h("section", { class: "card facts", "aria-labelledby": "acct-h" },
      h("h2", { class: "sec-in", id: "acct-h" }, t("profAccount")),
      h("div", { class: "fact", id: "fact-dob" }, h("p", { class: "fact-k" }, t("profDob")),
        p.birth_date ? h("p", { class: "fact-v" }, longDate(p.birth_date)) : h("div", { class: "fact-miss" }, chip(t("profMissing"), "warn"), fix.cloneNode(true))),
      h("div", { class: "fact", id: "fact-em" }, h("p", { class: "fact-k" }, t("profEmergency")),
        em ? h("p", { class: "fact-v" }, em.name, h("bdi", { class: "fact-sub", dir: "ltr" }, fmtPhone(em.phone)), em.relation ? h("span", { class: "fact-sub" }, em.relation) : null)
          : h("div", { class: "fact-miss" }, chip(t("profMissing"), "warn"), fix.cloneNode(true)))));
  }

  // The Arabic name printed under the name on certificates.
  if (p) {
    const arId = uid("ar");
    const ar = h("input", { id: arId, type: "text", dir: "rtl", lang: "ar", maxlength: 120, autocomplete: "off", value: p.name_ar ?? "",
      oninput: (() => { if (saved === "ar") { saved = ""; paintSaved(form); } }) as EventListener });
    const form: HTMLFormElement = h("form", { class: "card form", "aria-labelledby": "ar-h", onsubmit: ((e: Event) => { e.preventDefault(); submitBusy(form, () => saveNameAr(ar.value)); }) as EventListener },
      h("h2", { class: "sec-in", id: "ar-h" }, t("certNameHead")),
      h("div", { class: "field" }, h("label", { for: arId }, t("certNameAr")), ar),
      saveButton("ar", "secondary"));
    main.appendChild(form);
  }

  // The certificates have a fixed place here and on Home (fix 14).
  main.appendChild(h("a", { class: "card hl hl-link", href: "#cert", id: "prof-certs" }, icon("doc", 20), h("div", { class: "hl-t" }, h("p", { class: "hl-k" }, t("certTitle"))), icon("go", 18, true)));
  main.appendChild(settings());
  append(main, h("div", { class: "foot-links" },
    h("a", { href: `${BOOKING}/?privacy`, rel: "noopener" }, h("span", {}, t("footerPrivacy"))),
    h("a", { href: SUPPORT, rel: "noopener" }, h("span", {}, t("footerSupport")))));
}

/** A form's Save, which says Saved (with a tick) once it went through, until something changes. */
function saveButton(which: "prof" | "ar", kind: "primary" | "secondary", label: Key = "applySave"): HTMLButtonElement {
  const done = saved === which;
  return h("button", { type: "submit", class: `btn btn-${kind}${done ? " is-done" : ""}`, "data-save": which },
    done ? icon("tick", 18) : null, h("span", {}, t(done ? "savedBtn" : label)));
}
function paintSaved(form: HTMLFormElement): void {
  const b = form.querySelector<HTMLButtonElement>("button[data-save]");
  if (!b) return;
  b.classList.remove("is-done");
  b.querySelector("svg")?.remove();
  const s = b.querySelector("span:not(.spin)");
  if (s) s.textContent = t(b.dataset.label as Key || "applySave");
}

function profileForm(): HTMLElement {
  const p = S.prof!, who = standing();
  const d = draft ?? (draft = { days: new Set(p.days ?? []), shirt: p.shirt ?? null, skills: p.skills ?? "", wa: p.whatsapp ?? "" });
  const edited = () => { if (saved === "prof") { saved = ""; paintSaved(form); } };
  const skId = uid("skills"), waId = uid("wa");
  const skills = h("textarea", { id: skId, rows: 3, maxlength: 300, oninput: ((e: Event) => { d.skills = (e.target as HTMLTextAreaElement).value; edited(); }) as EventListener }, d.skills);
  const wa = h("input", { id: waId, type: "tel", dir: "ltr", maxlength: 20, autocomplete: "tel", value: d.wa,
    oninput: ((e: Event) => { d.wa = (e.target as HTMLInputElement).value; edited(); }) as EventListener });
  // Sunday first; each a toggle chip.
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const b = h("button", { type: "button", class: "tog", "aria-pressed": d.days.has(n) ? "true" : "false", "data-day": n,
      onclick: (() => { if (d.days.has(n)) d.days.delete(n); else d.days.add(n); b.setAttribute("aria-pressed", d.days.has(n) ? "true" : "false"); edited(); }) as EventListener }, weekday(n));
    return b;
  });
  const shirts = SHIRTS.map((s) => {
    const b = h("button", { type: "button", class: "tog tog-sm", "aria-pressed": d.shirt === s ? "true" : "false",
      onclick: (() => { d.shirt = d.shirt === s ? null : s; for (const x of shirts) x.setAttribute("aria-pressed", x.textContent === d.shirt ? "true" : "false"); edited(); }) as EventListener }, s);
    return b;
  });
  const first = !p.profile_at && who !== "active";
  const send = async () => {
    if (!d.days.size) { setNote(t("profDaysNeeded")); render(); return; }
    const r = await rpc<{ status: string }>("volunteer_apply", { p_skills: skills.value, p_days: [...d.days].sort(), p_shirt: d.shirt, p_whatsapp: wa.value.trim() || null });
    if (!r.ok) { noteErr(r); render(); return; }
    draft = null;
    setQuiet(t(first ? "applySent" : "applySaved"));
    if (first) { await load(); go("#me"); return; }
    saved = "prof";
    await reloadMe();
    render();
  };
  const sendBtn = saveButton("prof", "primary", first ? "applyBtn" : "applySave");
  sendBtn.dataset.label = first ? "applyBtn" : "applySave";
  const form: HTMLFormElement = h("form", { class: "card form", id: "prof-form", "aria-labelledby": "prof-h", onsubmit: ((e: Event) => { e.preventDefault(); submitBusy(form, send); }) as EventListener },
    h("h2", { class: "sec-in", id: "prof-h" }, t("profVolunteer")),
    h("fieldset", { class: "pick" }, h("legend", {}, t("applyDays")), h("div", { class: "chips" }, ...days)),
    h("div", { class: "field" }, h("label", { for: skId }, t("applySkills")), skills),
    h("fieldset", { class: "pick" }, h("legend", {}, t("applyShirt")), h("div", { class: "chips" }, ...shirts)),
    h("div", { class: "field" }, h("label", { for: waId }, t("applyWa")), wa),
    sendBtn);
  return form;
}

// ── what they most want from volunteering (one optional choice; Home puts the matching reward first) ──
const MOTIVES = ["community", "learn", "cv", "people", "active"] as const;
function motiveCard(): HTMLElement {
  const cur = S.prof?.motive ?? null;
  const pick = async (v: string, b: HTMLButtonElement) => {
    const next = cur === v ? null : v; // a second tap takes the answer back
    b.setAttribute("aria-pressed", next === v ? "true" : "false");
    const r = await rpc<{ motive: string | null }>("volunteer_motive", { p_motive: next });
    if (!r.ok) { noteErr(r); render(); return; }
    if (S.prof) S.prof.motive = r.data?.motive ?? next;
    setQuiet(t("applySaved"));
    render();
  };
  return h("section", { class: "card form motive", id: "motive", "aria-labelledby": "motive-h" },
    h("h2", { class: "sec-in", id: "motive-h" }, t("motiveQ")),
    h("div", { class: "chips", role: "group", "aria-labelledby": "motive-h" }, ...MOTIVES.map((v) => {
      const b: HTMLButtonElement = button(t(`motive_${v}` as Key), () => pick(v, b), "secondary", { class: "tog", "aria-pressed": cur === v ? "true" : "false", "data-motive": v });
      return b;
    })));
}

async function saveNameAr(value: string): Promise<void> {
  const r = await rpc<{ ok: boolean; name_ar: string | null }>("volunteer_name_ar_save", { p_name_ar: value.trim() });
  if (!r.ok) { noteErr(r); render(); return; }
  if (S.prof) S.prof.name_ar = r.data?.name_ar ?? null;
  saved = "ar";
  setQuiet(t("applySaved"));
  render();
}

function settings(): HTMLElement {
  const box = h("section", { class: "card settings", "aria-labelledby": "set-h" }, h("h2", { class: "sec-in", id: "set-h" }, t("profSettings")));
  // Notifications: a switch where the browser can take a push; on an iPhone, the Home Screen first. Hidden while
  // PUSH_SWITCH is off.
  const sup = PUSH_SWITCH ? pushSupport() : "no";
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
          else setQuiet(t(res === "on" ? "pushOnNote" : "pushOffNote"));
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
  box.appendChild(button(t("signOut"), () => signOut(), "quiet", { id: "sign-out" }, "out"));
  return box;
}
