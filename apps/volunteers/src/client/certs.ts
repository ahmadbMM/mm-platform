// The certificate. One design for the whole company: certificate/ in the booking site's repo builds the markup and
// the stylesheet, scripts/sync-cert.mjs copies them here, and this fills and prints them. Staff print the very same
// file. Never restyle a certificate here (certificate/SPEC.md), and keep the three rules of README.md: the template
// goes through stripScripts, its window gets /certificate-fonts.css (never /app.css), and fitCert fits the name.
//
// #cert lists the events worked, each with Get certificate (volunteer_cert_issue_session answers the one already made
// for it, the automatic one included); a certificate for other dates is behind one button. #check/<code> is open to
// anyone holding a certificate's code.

import { rpc } from "./api";
import { stripScripts } from "./cert";
import { append, h, uid } from "./dom";
import { dayLabel, ksaToday, sessionName, t } from "./i18n";
import { icon } from "./icons";
import { go, render, route, S, say, setNote, type Reward } from "./state";
import { button, card, chip, note } from "./ui";

export type Cert = { ok: boolean; kind?: string; serial?: string; code?: string; name?: string; name_ar?: string | null; gender?: string | null;
  words?: { lead?: string | null; recognition?: string | null; arabic_line?: string | null } | null;
  initiative?: string | null; event_date?: string | null; from?: string; to?: string; hours?: number;
  sessions?: { title: string | null; ride_kind?: string | null; date: string; hours: number }[]; issued_at?: string; revoked?: boolean };

// The three lines the certificate prints, by gender. The database stamps them onto every certificate it issues
// (_vol_cert_words, rentals migration 20261108220000) and the row is what a reprint uses; this copy is for a row
// issued before that migration. It must say what the booking site's VC_WORDS says.
const CERT_WORDS: Record<string, { lead: string; recognition: string; arabic_line: string }> = {
  male: { lead: "This certificate is proudly presented to", recognition: "in recognition of his time, energy and commitment as a volunteer in", arabic_line: "تقديرًا لعطائه ومشاركته التطوعية في المبادرة" },
  female: { lead: "This certificate is proudly presented to", recognition: "in recognition of her time, energy and commitment as a volunteer in", arabic_line: "تقديرًا لعطائها ومشاركتها التطوعية في المبادرة" },
  "": { lead: "This certificate is proudly presented to", recognition: "in recognition of their time, energy and commitment as a volunteer in", arabic_line: "تقديرًا للعطاء والمشاركة التطوعية في المبادرة" },
};
const certWords = (gender: string | null | undefined) => CERT_WORDS[gender === "male" || gender === "female" ? gender : ""];
const onDay = (ymd: string | null | undefined, lang = "en-GB"): string => {
  if (!ymd) return "";
  try { return new Date(`${ymd.slice(0, 10)}T12:00:00+03:00`).toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { timeZone: "Asia/Riyadh", day: "numeric", month: "long", year: "numeric" }); } catch { return ymd; }
};
const certPeriod = (from: string | null | undefined, to: string | null | undefined): string => {
  const a = onDay(from), b = onDay(to);
  return !a ? b : !b || a === b ? a : `${a} – ${b}`;
};

let certTpl: string | null = null;
async function certTemplate(): Promise<string> {
  if (certTpl) return certTpl;
  const res = await fetch("/certificate.html", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`certificate ${res.status}`);
  certTpl = stripScripts(await res.text()); // whatever the host added to it (cert.ts)
  return certTpl;
}
const certEsc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// The template's Mustache subset: {{key}} escaped, {{#key}}…{{/key}} kept while the key is truthy.
const fillCert = (tpl: string, v: Record<string, string>): string =>
  tpl.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, k: string, body: string) => (v[k] ? body : ""))
     .replace(/\{\{(\w+)\}\}/g, (_m, k: string) => certEsc(v[k]));

// SPEC.md, "Name size": a size from the name's length, then 1px at a time down to 32 until the name is on one line,
// and only then may it wrap. Done here and not by a script in the page, which the portal's policy would refuse; it
// also scales the sheet on a phone, which the stylesheet reads as --fit. Measuring only means something once the
// window's fonts are in (certReady).
function fitCert(doc: Document): void {
  const el = doc.querySelector<HTMLElement>(".name");
  if (el) {
    const n = String(el.textContent ?? "").trim().length;
    let px = n <= 16 ? 66 : n <= 22 ? 56 : n <= 28 ? 48 : 40;
    el.style.fontSize = `${px}px`;
    while (el.scrollWidth > el.clientWidth && px > 32) { px -= 1; el.style.fontSize = `${px}px`; }
    if (el.scrollWidth > el.clientWidth) el.classList.add("wrap");
  }
  const w = doc.documentElement.clientWidth || 1123;
  doc.documentElement.style.setProperty("--fit", w < 1123 ? String(Math.max(0.25, Math.round((w / 1123) * 1000) / 1000)) : "1");
}
// The window's stylesheet, then the fonts and pictures it calls for; never longer than 4 seconds, after which it
// prints with whatever arrived, as a browser would anyway.
function certReady(win: Window): Promise<void> {
  const d = win.document;
  const done = (el: Element) => new Promise<void>((r) => { el.addEventListener("load", () => r(), { once: true }); el.addEventListener("error", () => r(), { once: true }); });
  const sheets = [...d.querySelectorAll('link[rel="stylesheet"]')].filter((l) => !(l as HTMLLinkElement).sheet).map(done);
  const all = Promise.all(sheets)
    .then(() => { void d.body.offsetHeight; return Promise.all([d.fonts.ready, ...[...d.images].filter((i) => !i.complete).map(done)]); })
    .then(() => undefined);
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, 4000))]).catch(() => undefined);
}

// What the page prints: the certificate that was made, with what it was issued with, never what this page says today.
function certView(c: Cert): Record<string, string> {
  const sess = c.kind === "session" || c.kind === "custom";
  const hours = Number(c.hours) || 0;
  const d = certWords(c.gender ?? S.prof?.gender), cw = c.words ?? {};
  return {
    css: "/certificate.css",
    fonts: "/certificate-fonts.css", // the certificate's two families alone: app.css has a .page of its own, which would fight the certificate's
    doc_title: `Certificate of Volunteering${c.serial ? ` ${c.serial}` : ""}`,
    print_label: t("certPrint"),
    volunteer_name: c.name ?? S.me?.name ?? "",
    volunteer_name_ar: c.name_ar ?? "",
    lead: cw.lead || d.lead,
    recognition: cw.recognition || d.recognition,
    arabic_line: cw.arabic_line || d.arabic_line,
    initiative_name: sess ? (c.initiative ?? "") : certPeriod(c.from, c.to),
    event_date: onDay(sess ? c.event_date : String(c.issued_at ?? "").slice(0, 10)),
    hours: hours > 0 ? String(hours) : "",
    certificate_no: c.serial ?? "",
    check_code: c.code ?? "",
  };
}
async function printCert(c: Cert): Promise<void> {
  let tpl: string;
  try { tpl = await certTemplate(); } catch { setNote(t("certOpenErr")); render(); return; }
  const win = window.open("", "_blank", "width=1180,height=880");
  if (!win) { setNote(t("certOpenErr")); render(); return; }
  win.document.write(fillCert(tpl, certView(c)));
  win.document.close();
  win.focus();
  // The page's own Print button, wired from here: no script runs in that window.
  for (const b of win.document.querySelectorAll(".rep-print")) b.addEventListener("click", () => { try { win.print(); } catch { /* the viewer prints it */ } });
  void certReady(win).then(() => { fitCert(win.document); try { win.print(); } catch { /* the viewer prints it */ } });
}

/** The events this volunteer worked: one certificate and one free ride each. From the hours (the database refuses a
 *  certificate for an event with none) and from what each shift says it gave. */
export type Worked = { id: string; label: string; hours: number; on: string; reward: Reward | null; serial: string | null };
export function eventsWorked(): Worked[] {
  const by = new Map<string, Worked>();
  for (const r of S.me?.record ?? []) {
    if (!r.session_id || !(Number(r.hours) > 0)) continue;
    const cur = by.get(r.session_id) ?? { id: r.session_id, label: sessionName(r), hours: 0, on: r.on, reward: null, serial: null };
    cur.hours += Number(r.hours) || 0;
    if (r.on < cur.on) cur.on = r.on;
    by.set(r.session_id, cur);
  }
  for (const m of S.me?.mine ?? []) {
    if (!m.reward && !m.cert) continue;
    const cur = by.get(m.id) ?? { id: m.id, label: sessionName(m), hours: Number(m.cert?.hours) || 0, on: m.date, reward: null, serial: null };
    cur.reward = m.reward ?? null;
    cur.serial = m.cert?.serial ?? null;
    by.set(m.id, cur);
  }
  return [...by.values()].map((x) => ({ ...x, hours: Math.round(x.hours * 100) / 100 })).sort((a, b) => b.on.localeCompare(a.on));
}

let busy = false;
/** Get certificate: the one made for the event (or made now), printed. */
export async function getCert(session: string, label: string): Promise<void> {
  if (busy) return;
  busy = true;
  const r = await rpc<Cert>("volunteer_cert_issue_session", { p_session: session, p_initiative: label });
  busy = false;
  if (!r.ok) { setNote(say(r)); render(); return; }
  if (r.data && r.data.ok) void printCert(r.data); else { setNote(t("certEmpty")); render(); }
}

let showOther = false;
export function viewCert(main: HTMLElement): void {
  const list = eventsWorked();
  append(main, h("h1", {}, t("certTitle")));
  main.appendChild(list.length
    ? h("div", { class: "list" }, ...list.map((x) => h("div", { class: "card ev-row" },
        h("div", { class: "ev-main" }, h("p", { class: "ev-name" }, x.label), h("p", { class: "meta" }, `${dayLabel(x.on)} · ${t("oppHours", String(x.hours))}`)),
        button(t("certGet"), () => void getCert(x.id, x.label), "secondary", {}, "doc"))))
    : note(t("certNoEvents")));
  if (!S.prof) return; // a database without the profile (20261107131000) makes no certificate for other dates
  if (!showOther) { main.appendChild(h("div", { class: "row-end" }, button(t("certOther"), () => { showOther = true; render(); }, "quiet", { id: "cert-other" }))); return; }
  const today = ksaToday();
  const fromId = uid("from"), toId = uid("to"), spanId = uid("span");
  const from = h("input", { id: fromId, type: "date", max: today, value: S.me?.first_on ?? today });
  const to = h("input", { id: toId, type: "date", max: today, value: today });
  // One day or a stretch of them (the owner, 2026-11-08): one day is the same certificate with the two dates the same.
  const fromBox = h("div", { class: "field" }, h("label", { for: fromId }, t("certFrom")), from);
  const toLabel = h("label", { for: toId }, t("certTo"));
  const span = h("select", { id: spanId, onchange: () => {
    const day = span.value === "day";
    fromBox.classList.toggle("is-hidden", day);
    toLabel.textContent = day ? t("certDayOne") : t("certTo");
  } }, h("option", { value: "period" }, t("certSpanPeriod")), h("option", { value: "day" }, t("certSpanDay")));
  main.appendChild(card("form cert-period",
    h("h2", { class: "sec-in" }, t("certOther")),
    h("div", { class: "field" }, h("label", { for: spanId }, t("certSpan")), span),
    fromBox, h("div", { class: "field" }, toLabel, to),
    button(t("certMake"), () => void makeCert(span.value === "day" ? to.value : from.value, to.value), "primary")));
}
async function makeCert(from: string, to: string): Promise<void> {
  if (!from || !to || to < from) { setNote(t("errBadDates")); render(); return; }
  const r = await rpc<Cert>("volunteer_cert_issue", { p_from: from, p_to: to });
  if (!r.ok) { setNote(r.status === 400 && r.code === "BAD_INPUT" ? t("errBadDates") : say(r)); render(); return; }
  if (r.data && r.data.ok) void printCert(r.data);
}

// ── a certificate's check (#check/<code>): anyone, signed in or not ──
let check: { code: string; res: Cert | null; err: string; busy: boolean } | null = null;
export function viewCheck(main: HTMLElement, code: string): void {
  const C = check && check.code === code ? check : (check = { code, res: null, err: "", busy: false });
  const id = uid("code");
  const box = h("input", { id, type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: 12, dir: "ltr", value: code });
  append(main, h("h1", {}, t("checkTitle")),
    h("form", { class: "card form", onsubmit: ((e: Event) => { e.preventDefault(); go(`#check/${encodeURIComponent(box.value.trim().toUpperCase())}`); }) as EventListener },
      h("div", { class: "field" }, h("label", { for: id }, t("checkCode")), box), h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, t("checkBtn")))));
  if (!code) return;
  if (C.err) { main.appendChild(note(C.err, "alert", "bad")); C.err = ""; check = null; return; } // asked again on the next visit
  if (!C.res) {
    main.appendChild(note(t("loading")));
    if (!C.busy) {
      C.busy = true;
      void rpc<Cert>("volunteer_cert_check", { p_code: code }).then((r) => {
        C.busy = false;
        // too many checks from this network, or no connection, is said as such: it is not "no certificate"
        if (r.ok) C.res = r.data ?? { ok: false }; else C.err = say(r);
        if (route().name === "check") render();
      });
    }
    return;
  }
  const c = C.res;
  if (!c.ok) { main.appendChild(note(t("checkNone"), "alert", "bad")); return; }
  main.appendChild(h("section", { class: `card check-res${c.revoked ? " check-bad" : ""}`, id: "check-res" },
    h("p", { class: "check-state" }, icon(c.revoked ? "close" : "tick", 20), h("span", {}, t(c.revoked ? "checkRevoked" : "checkValid"))),
    h("h2", { class: "check-name" }, c.name ?? ""),
    h("p", { class: "big-n" }, h("b", {}, String(+(c.hours ?? 0))), h("span", {}, t("homeHours"))),
    // A certificate for one event names it and the day it was held; one for a period, its period.
    h("p", { class: "meta" }, c.kind === "session" ? `${c.initiative ?? ""} · ${dayLabel(c.event_date ?? c.from)}` : t("checkPeriod", dayLabel(c.from), dayLabel(c.to))),
    c.sessions?.length ? h("ul", { class: "rec" }, ...c.sessions.map((x) => h("li", {}, `${sessionName(x)} · ${dayLabel(x.date)} · `, h("b", { dir: "ltr" }, String(+x.hours))))) : null,
    h("div", { class: "chips" }, chip(h("span", { dir: "ltr" }, c.serial ?? "")), chip(t("checkIssued", dayLabel((c.issued_at ?? "").slice(0, 10)))))));
}
