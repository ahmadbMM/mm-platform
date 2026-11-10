// The certificate. One design for the whole company: certificate/ in the booking site's repo builds the markup and
// the stylesheet, scripts/sync-cert.mjs copies them here, and this fills and prints them. Staff print the very same
// file. Never restyle a certificate here (certificate/SPEC.md), and keep the three rules of README.md: the template
// goes through stripScripts, its window gets /certificate-fonts.css (never /app.css), and fitCert fits the name.
//
// #cert lists the events worked, each with Get certificate (volunteer_cert_issue_session answers the one already made
// for it, the automatic one included) and Share (its check link, LinkedIn's Add to profile); under them the volunteer
// record, every hour with its day, and a certificate for any stretch of dates. #check/<code> is open to anyone holding a
// certificate's code. Since 2026-11-11 a certificate also carries the role, the skills, a partner, its issue date and a
// QR code to its check page (the template's new placeholders; rentals 20261111140000).

import { rpc } from "./api";
import { stripScripts } from "./cert";
import { append, h, uid } from "./dom";
import { dayLabel, hoursN, ksaDay, ksaToday, sessionName, sessionNameEn, t } from "./i18n";
import { icon } from "./icons";
import { checkUrl, qrPng } from "./qr";
import { go, noteErr, render, route, S, say, setNote, type Reward } from "./state";
import { button, card, chip, copyText, dialog, link, note } from "./ui";

export type Cert = { ok: boolean; kind?: string; serial?: string; code?: string; name?: string; name_ar?: string | null; gender?: string | null;
  words?: { lead?: string | null; recognition?: string | null; arabic_line?: string | null } | null;
  initiative?: string | null; event_date?: string | null; from?: string; to?: string; hours?: number;
  sessions?: { title: string | null; ride_kind?: string | null; date: string; hours: number }[]; issued_at?: string; revoked?: boolean;
  // stamped at issue since 20261111140000 (a period's certificate and an older one have none)
  role?: string | null; skills?: string | null; skills_ar?: string | null; partner?: string | null; partner_ar?: string | null };

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

// One fetch, shared: Get certificate starts it on the tap and printCert waits on the same one. A failed one is
// forgotten, so the next try fetches again.
let certTpl: Promise<string> | null = null;
function certTemplate(): Promise<string> {
  certTpl ??= fetch("/certificate.html", { credentials: "same-origin" }).then(async (res) => {
    if (!res.ok) throw new Error(`certificate ${res.status}`);
    return stripScripts(await res.text()); // whatever the host added to it (cert.ts)
  });
  certTpl.catch(() => { certTpl = null; });
  return certTpl;
}
const certEsc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// The template's Mustache subset: {{key}} escaped, {{#key}}…{{/key}} kept while the key is truthy (an empty value leaves
// no gap: the template wraps each optional line in its own section).
export const fillCert = (tpl: string, v: Record<string, string>): string =>
  tpl.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, k: string, body: string) => (v[k] ? body : ""))
     .replace(/\{\{(\w+)\}\}/g, (_m, k: string) => certEsc(v[k]));

// SPEC.md, "Name size": a size from the name's length, then 1px at a time down to 32 until the name is on one line,
// and only then may it wrap. Amendment 7 (2026-11-11): then long skills get smaller type, half a pixel at a time down to
// 11px, until the body ends 16px above the footer (measured before --fit scales the sheet), as the booking app's _vcFit. Done here and not by a script in the page, which the portal's policy would refuse; it
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
  const body = doc.querySelector(".body"), foot = doc.querySelector(".footer"), sk = [...doc.querySelectorAll<HTMLElement>(".skills")];
  let fs = 14;
  while (sk.length && body && foot && foot.getBoundingClientRect().top - body.getBoundingClientRect().bottom < 16 && fs > 11) {
    fs -= 0.5;
    for (const e of sk) e.style.fontSize = `${fs}px`;
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

/** What the page prints: the certificate that was made, with what it was issued with, never what this page says today.
 *  qr: the code to its check page, a PNG data URL drawn here (qr.ts); "" leaves the template's QR out. */
export function certView(c: Cert, qr = ""): Record<string, string> {
  const sess = c.kind === "session" || c.kind === "custom";
  const hours = Number(c.hours) || 0;
  const d = certWords(c.gender ?? S.prof?.gender), cw = c.words ?? {};
  // the footer's date: the event's day, or for a period the Riyadh day it was issued (issued_at comes in UTC: before 3 a.m.
  // it was the day before); the issue date under the QR code says nothing when it is the same day (SPEC.md, amendment 7)
  const footer = onDay(sess ? c.event_date : ksaDay(c.issued_at)), issued = c.issued_at ? onDay(ksaDay(c.issued_at)) : "";
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
    event_date: footer,
    hours: hours > 0 ? String(hours) : "",
    certificate_no: c.serial ?? "",
    check_code: c.code ?? "",
    // the Saudi set of fields (the report's Tier 2; SPEC.md, amendment 7): the role, the skills, a co-issuing partner, the
    // issue date, the QR code to its check page
    role: c.role ?? "",
    skills: c.skills ?? "",
    skills_ar: c.skills_ar ?? "",
    partner: c.partner ?? "",
    partner_ar: c.partner_ar ?? "",
    issued: issued && issued !== footer ? issued : "",
    qr,
  };
}
// The window opens on the tap, before anything is asked: iPhone Safari refuses a window opened after a wait (a volunteer
// got "could not be opened" on every Get certificate, 2026-11-10), and the certificate takes the database's answer and
// the template first. It stays blank until printCert writes into it; whatever stops the certificate closes it again.
// The booking app opens its windows the same way.
function openCertWin(): Window | null {
  try { return window.open("", "_blank", "width=1180,height=880"); } catch { return null; }
}
function dropCertWin(win: Window, msg: string): void {
  try { win.close(); } catch { /* already gone */ }
  setNote(msg);
  render();
}
async function printCert(win: Window, c: Cert): Promise<void> {
  let tpl: string;
  try { tpl = await certTemplate(); } catch { dropCertWin(win, t("certOpenErr")); return; }
  const qr = c.code ? await qrPng(checkUrl(c.code)) : "";
  if (win.closed) return; // the volunteer closed it while it was on its way
  win.document.write(fillCert(tpl, certView(c, qr)));
  win.document.close();
  win.focus();
  // The page's own Print button, wired from here: no script runs in that window.
  for (const b of win.document.querySelectorAll(".rep-print")) b.addEventListener("click", () => { try { win.print(); } catch { /* the viewer prints it */ } });
  void certReady(win).then(() => { fitCert(win.document); try { win.print(); } catch { /* the viewer prints it */ } });
}

/** The events this volunteer worked: one certificate and one free ride each. From the hours (the database refuses a
 *  certificate for an event with none) and from what each shift says it gave. label is the event's name in the page's
 *  language; initiative, in English, is what its certificate is issued with. */
export type Worked = { id: string; label: string; initiative: string; hours: number; on: string; reward: Reward | null; serial: string | null };
export function eventsWorked(): Worked[] {
  const by = new Map<string, Worked>();
  // Every event's hours where volunteer_me sends them (events); else its record, which is only the newest 30 rows, so an
  // older event would lose its Get certificate and one cut across would lose hours.
  const events = S.me?.events;
  const rows: { session_id: string | null; hours: number; on: string; title: string | null; ride_kind: string | null }[] =
    Array.isArray(events) ? events : (S.me?.record ?? []);
  for (const r of rows) {
    if (!r.session_id || !(Number(r.hours) > 0)) continue;
    const cur = by.get(r.session_id) ?? { id: r.session_id, label: sessionName(r), initiative: sessionNameEn(r), hours: 0, on: r.on, reward: null, serial: null };
    cur.hours += Number(r.hours) || 0;
    if (r.on < cur.on) cur.on = r.on;
    by.set(r.session_id, cur);
  }
  for (const m of S.me?.mine ?? []) {
    if (!m.reward && !m.cert) continue;
    const cur = by.get(m.id) ?? { id: m.id, label: sessionName(m), initiative: sessionNameEn(m), hours: Number(m.cert?.hours) || 0, on: m.date, reward: null, serial: null };
    cur.reward = m.reward ?? null;
    cur.serial = m.cert?.serial ?? null;
    by.set(m.id, cur);
  }
  return [...by.values()].map((x) => ({ ...x, hours: Math.round(x.hours * 100) / 100 })).sort((a, b) => b.on.localeCompare(a.on));
}
/** Hours staff added with no session (fix 12): their own rows, so the lists add up to the total. From volunteer_me's
 *  extra_hours; on a database without it, from the record (its newest 30 rows). */
export function extraHours(): { id: number; on: string; hours: number }[] {
  const x = S.me?.extra_hours;
  const rows = Array.isArray(x) ? x : (S.me?.record ?? []).filter((r) => !r.session_id).map((r) => ({ id: r.id, on: r.on, hours: Number(r.hours) || 0 }));
  return rows.filter((r) => Number(r.hours) !== 0).sort((a, b) => String(b.on).localeCompare(String(a.on)));
}

// One certificate on its way at a time: a second tap on a slow phone issued a second one (a new serial and check code).
let busy = false;
// Each event's certificate, once asked for: Share needs its code, and asking again answers the same one anyway.
const certs = new Map<string, Cert>();
async function issueFor(session: string, initiative: string): Promise<Cert | { err: string; code: string }> {
  const have = certs.get(session);
  if (have) return have;
  const r = await rpc<Cert>("volunteer_cert_issue_session", { p_session: session, p_initiative: initiative });
  if (!r.ok) return { err: say(r), code: r.code };
  if (!r.data || !r.data.ok) return { err: t("certEmpty"), code: "VOL_CERT_EMPTY" };
  certs.set(session, r.data);
  return r.data;
}
/** Get certificate: the one made for the event (or made now), printed. The initiative is the event's English name
 *  (Worked.initiative): the certificate prints in English, and a new one keeps what it was issued with for good. */
export async function getCert(session: string, initiative: string): Promise<void> {
  if (busy) return;
  const win = openCertWin(); // on the tap, before the wait
  if (!win) { setNote(t("certOpenErr")); render(); return; }
  busy = true;
  void certTemplate().catch(() => undefined); // fetched while the database answers; printCert waits on the same one
  const c = await issueFor(session, initiative);
  busy = false;
  if ("err" in c) { dropCertWin(win, c.err); return; }
  await printCert(win, c);
}

// ── Share: the certificate as a credential the volunteer hands on (the report's Tier 2). The check link, LinkedIn's Add
// to profile (which no longer fills anything in, so the ID and the link are shown to paste), and Copy where the phone
// cannot share. Every button is its own tap, as Safari wants for sharing. ──
const linkedIn = (c: Cert, url: string) => {
  const issued = c.issued_at ? new Date(Date.parse(String(c.issued_at).replace(/(\.\d{3})\d+/, "$1")) + 3 * 3600000) : null;
  const q = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: c.initiative ? `Volunteer, ${c.initiative}` : "Certificate of Volunteering",
    organizationName: "MicroMobility", certUrl: url, certId: c.serial ?? "" });
  if (issued && Number.isFinite(issued.getTime())) { q.set("issueYear", String(issued.getUTCFullYear())); q.set("issueMonth", String(issued.getUTCMonth() + 1)); }
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
};
function shareAsk(c: Cert): void {
  const url = checkUrl(c.code ?? "");
  const idId = uid("cred"), urlId = uid("url");
  const field = h("input", { id: urlId, type: "text", readonly: true, dir: "ltr", value: url, class: "share-url", onfocus: ((e: Event) => (e.target as HTMLInputElement).select()) as EventListener });
  const copy: HTMLButtonElement = button(t("copyLink"), async () => {
    if (!(await copyText(url, copy, t("copied")))) { field.focus(); field.select(); }
  }, "secondary", { id: "share-copy" }, "copy");
  const canShare = typeof navigator.share === "function";
  const box: HTMLDialogElement = dialog(t("shareTitle"), [
    h("div", { class: "field" }, h("label", { for: idId }, t("credId")), h("input", { id: idId, type: "text", readonly: true, dir: "ltr", value: c.serial ?? "", class: "share-url" })),
    h("div", { class: "field" }, h("label", { for: urlId }, t("credUrl")), field),
    h("div", { class: "menu" },
      canShare ? button(t("certShare"), async () => { try { await navigator.share({ title: t("shareTitle"), url }); } catch { /* the volunteer closed the sheet */ } }, "secondary", { id: "share-native" }, "share") : null,
      copy,
      link(t("addLinkedIn"), linkedIn(c, url), "secondary", "link", { id: "share-linkedin", target: "_blank", rel: "noopener" }))],
  [button(t("close"), () => box.close(), "quiet")], "ask-menu ask-share");
}
/** Share: the event's certificate (made now if it was not yet), then its check link, from a centred dialog. */
export async function shareCert(session: string, initiative: string): Promise<void> {
  const c = await issueFor(session, initiative);
  if ("err" in c) { noteErr({ code: c.code }); render(); return; }
  if (c.code) shareAsk(c);
}

export function viewCert(main: HTMLElement): void {
  const list = eventsWorked(), extra = extraHours();
  append(main, h("h1", {}, t("certTitle")));
  main.appendChild(list.length
    ? h("div", { class: "list" }, ...list.map((x) => h("div", { class: "card ev-row", "data-session": x.id },
        h("div", { class: "ev-main" }, h("p", { class: "ev-name" }, x.label), h("p", { class: "meta" }, `${dayLabel(x.on)} · ${hoursN(x.hours)}`)),
        h("div", { class: "ev-acts" },
          button(t("certGet"), () => getCert(x.id, x.initiative), "secondary", {}, "doc"),
          button(t("certShare"), () => shareCert(x.id, x.initiative), "quiet", { class: "btn btn-quiet ev-share" }, "share")))))
    : note(t("certNoEvents")));

  // The volunteer record (it was "Other dates"): every hour with its day, the hours staff added with no session among
  // them, then a certificate for any stretch of dates or one day.
  const total = Math.round((Number(S.me?.hours) || 0) * 100) / 100;
  const rows = [
    ...list.map((x) => ({ on: x.on, label: x.label, hours: x.hours })),
    ...extra.map((x) => ({ on: x.on, label: t("extraHours"), hours: Number(x.hours) || 0 })),
  ].sort((a, b) => String(b.on).localeCompare(String(a.on)));
  const rec = card("record", h("h2", { class: "sec-in", id: "record-h" }, t("certRecord")),
    h("p", { class: "big-n" }, h("b", {}, String(total)), h("span", {}, t("homeHours"))),
    rows.length ? h("ul", { class: "rec", id: "record-rows" }, ...rows.map((r) => h("li", {}, `${r.label} · ${dayLabel(r.on)} · `, h("b", {}, hoursN(r.hours))))) : null);
  rec.id = "record";
  rec.setAttribute("aria-labelledby", "record-h");
  main.appendChild(rec);
  if (!S.prof) return; // a database without the profile (20261107131000) makes no certificate for other dates
  const today = ksaToday();
  const fromId = uid("from"), toId = uid("to"), spanId = uid("span");
  const from = h("input", { id: fromId, type: "date", max: today, value: S.me?.first_on ?? today });
  const to = h("input", { id: toId, type: "date", max: today, value: today });
  // One day or a stretch of them (the owner, 2026-11-08): one day is the same certificate with the two dates the same.
  const fromBox = h("div", { class: "field" }, h("label", { for: fromId }, t("certFrom")), from);
  const toLabel = h("label", { for: toId }, t("certTo"));
  const span = h("select", { id: spanId, onchange: () => {
    const one = span.value === "day";
    fromBox.classList.toggle("is-hidden", one);
    toLabel.textContent = one ? t("certDayOne") : t("certTo");
  } }, h("option", { value: "period" }, t("certSpanPeriod")), h("option", { value: "day" }, t("certSpanDay")));
  main.appendChild(card("form cert-period",
    h("h2", { class: "sec-in" }, t("certForDates")),
    h("div", { class: "field" }, h("label", { for: spanId }, t("certSpan")), span),
    fromBox, h("div", { class: "field" }, toLabel, to),
    button(t("certMake"), () => makeCert(span.value === "day" ? to.value : from.value, to.value), "primary", { id: "cert-make" })));
}
async function makeCert(from: string, to: string): Promise<void> {
  if (busy) return; // each call issues a new certificate: a double tap made two
  if (!from || !to || to < from) { setNote(t("errBadDates")); render(); return; }
  const win = openCertWin(); // on the tap, before the wait
  if (!win) { setNote(t("certOpenErr")); render(); return; }
  busy = true;
  void certTemplate().catch(() => undefined);
  const r = await rpc<Cert>("volunteer_cert_issue", { p_from: from, p_to: to });
  busy = false;
  if (!r.ok) { dropCertWin(win, r.status === 400 && r.code === "BAD_INPUT" ? t("errBadDates") : say(r)); return; }
  if (r.data && r.data.ok) await printCert(win, r.data); else dropCertWin(win, t("certEmpty"));
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
  // One event, as the printed certificate has it (certView): staff's own certificate for an initiative (custom) too.
  const sess = c.kind === "session" || c.kind === "custom";
  const hours = +(c.hours ?? 0);
  main.appendChild(h("section", { class: `card check-res${c.revoked ? " check-bad" : ""}`, id: "check-res" },
    h("p", { class: "check-state" }, icon(c.revoked ? "close" : "tick", 20), h("span", {}, t(c.revoked ? "checkRevoked" : "checkValid"))),
    h("h2", { class: "check-name" }, c.name ?? ""),
    // no hours, none said: the printed certificate leaves them out too
    hours > 0 ? h("p", { class: "big-n" }, h("b", {}, String(hours)), h("span", {}, t("homeHours"))) : null,
    // A certificate for one event names it and the day it was held; one for a period, its period.
    h("p", { class: "meta" }, sess ? `${c.initiative ?? ""} · ${dayLabel(c.event_date ?? c.from)}` : t("checkPeriod", dayLabel(c.from), dayLabel(c.to))),
    // the role and the co-issuing partner, where the certificate was stamped with them (20261111140000)
    c.role ? h("p", { class: "meta" }, icon("person", 16), h("span", {}, t("roleIs", c.role))) : null,
    c.partner ? h("p", { class: "meta" }, icon("people", 16), h("span", {}, t("withPartner", c.partner))) : null,
    // each event, its day, then the hours with their word: a bare number read as anything but hours (the owner, 2026-11-09)
    c.sessions?.length ? h("ul", { class: "rec" }, ...c.sessions.map((x) => h("li", {}, `${sessionName(x)} · ${dayLabel(x.date)} · `, h("b", {}, hoursN(x.hours))))) : null,
    h("div", { class: "chips" }, chip(h("span", { dir: "ltr" }, c.serial ?? "")), chip(t("checkIssued", dayLabel(ksaDay(c.issued_at)))))));
}
