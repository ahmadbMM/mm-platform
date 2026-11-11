// The work page (#work/<session>) and the lead's team (#team/<session>), between the session's start and its cut-off.
// One screen: the header (the event, its counts, I have arrived / I have finished, the team for a lead), the briefing,
// one big Scan that keeps scanning, ONE search box (a name filters the list the session lets volunteers see; a booking
// number, a mobile or a ticket asks volunteer_find), and the rows, each with one main button and a menu for the rest.
// What a volunteer may see and do is the session's caps, decided by the database as before.
//
// Search first (the blood drive, 2026-11-05: 158 searches to 13 scans): the search box is as big as Scan and keeps its
// text after a check-in; a scan that finds someone makes a short sound (an iPhone cannot buzz), and the torch is offered
// where the camera has one. The floating tab bar is hidden here (main.ts), so a stray tap never ends the camera.
//
// Online only (the owner, 2026-11-09): nothing is kept on the phone. A mark that does not reach the database stays on
// its row as "Not sent", in this page's memory only, and is sent again by itself when the connection is back.

import { rpc, type Err } from "./api";
import { append, clear, h } from "./dom";
import { currentLang, sessionName, t, timeLabel, whenLabel, type Key } from "./i18n";
import { icon } from "./icons";
import { parseTicket, startScanner, type Scanner } from "./scan";
import { go, load, lost, myShift, noteErr, reloadMe, render, route, S, say, setNote, setQuiet, unsent, type Mine } from "./state";
import { briefTick } from "./shift";
import { button, chip, dialog, iconButton, link, note, skeleton, telLink } from "./ui";

type Booking = { id: string; name: string; number: number | null; checked_in: boolean; donated: boolean; visitor?: boolean; own: boolean; desk: string | null;
  mine_in: boolean; mine_donated: boolean; phone?: string | null; status?: string; bike?: string | null; size?: string | null; height?: string | null;
  blood_type?: string | null; club?: string | null };
type Entered = { closes_at: string; caps: Record<string, boolean>; briefing: string | null; hours_mode: string; role: string | null; lead?: boolean;
  clock_in?: string | null; clock_out?: string | null; clock_out_by?: string | null; counts: { booked: number; in: number; donated: number; visitors?: number } | null };
type Mate = { shift: number; name: string; role: string | null; status: string; me: boolean; lead: boolean; clock_in: string | null; clock_out: string | null;
  clock_in_by: string | null; clock_out_by: string | null; briefed: boolean };

type Work = {
  id: string; ent: Entered; found: Booking[]; list: Booking[] | null; q: string; show: string; sort: string; msg: string; scanning: boolean;
  team: Mate[] | null; teamMsg: string;
};
let work: Work | null = null;
let agreeTick = false;
let scanner: Scanner | null = null;
let scanBox: HTMLElement | null = null;
let timer = 0;

// ── "Not sent": the marks that did not reach the database, by row ──
type Pending = { key: string; fn: string; args: Record<string, unknown>; label: Key; ok: (data: unknown) => void; undo: () => void };
const pending = new Map<string, Pending>();
let retryTimer = 0;
const isPending = (key: string) => pending.has(key);
// Each mark is its session's: going Home and into another session keeps the first one's marks going out, and they
// never count, close or hold up the page now open.
const sessOf = (p: Pending) => String(p.args.p_session ?? "");
const pendingIn = (id: string) => [...pending.values()].filter((p) => sessOf(p) === id);
const dropSession = (id: string) => { for (const p of pendingIn(id)) pending.delete(p.key); };
window.addEventListener("online", () => void flush());
function armRetry(): void {
  window.clearTimeout(retryTimer);
  if (pending.size) retryTimer = window.setTimeout(() => void flush(), 15000);
}
// One send-again at a time: the connection coming back and the retry timer could each start one, and a mark that landed
// twice was counted twice.
let flushing: Promise<void> | null = null;
function flush(): Promise<void> {
  return flushing ??= flushNow().finally(() => { flushing = null; });
}
async function flushNow(): Promise<void> {
  window.clearTimeout(retryTimer);
  for (const p of [...pending.values()]) {
    if (pending.get(p.key) !== p) continue; // taken back, or its session's marks dropped, while the others went out
    const r = await rpc<Record<string, unknown>>(p.fn, p.args);
    if (!r.ok && unsent(r)) break; // still no way through: try again later
    if (pending.get(p.key) === p) pending.delete(p.key); // not a newer tap on the same row made while this one went out
    if (r.ok) p.ok(r.data);
    else {
      p.undo();
      if (lost(r.code)) {
        dropSession(sessOf(p));
        if (work?.id === sessOf(p)) { await load(); leaveWork(say(r)); return; }
      }
      if (work) { work.msg = `${t(p.label)}: ${say(r)}`; work.teamMsg = work.msg; }
    }
  }
  armRetry();
  paint();
}
/** Sends a mark; when it cannot get through, shows it done with "Not sent" and keeps it for the next try. */
async function send(p: Pending, show: () => void): Promise<void> {
  pending.delete(p.key);
  const r = await rpc<Record<string, unknown>>(p.fn, p.args);
  if (r.ok) { p.ok(r.data); paint(); return; }
  if (unsent(r)) { pending.set(p.key, p); show(); armRetry(); paint(); return; }
  await refused(r);
}
/** Takes back a mark that was never sent: the row goes back to what the database has. */
function cancel(key: string): void {
  const p = pending.get(key);
  if (!p) return;
  pending.delete(key);
  p.undo();
  armRetry();
  paint();
}
async function refused(r: Err): Promise<void> {
  if (lost(r.code)) { await load(); leaveWork(say(r)); return; }
  if (work) { work.msg = say(r); work.teamMsg = work.msg; }
  if (r.code === "VOL_NOT_LEAD" && work) { work.team = null; go(`#work/${encodeURIComponent(work.id)}`); return; }
  paint();
}

// ── entering ──
export function viewWork(main: HTMLElement, id: string, team = false): void {
  const sh = myShift(id);
  if (!sh?.can_work && !(work && work.id === id)) {
    append(main, backHome(), note(t(sh ? "volClosed" : "vdNotAccepted")));
    return;
  }
  if (!S.me!.agreed) { viewAgree(main); return; }
  if (!work || work.id !== id) {
    append(main, backHome(), skeleton(2, t("loading")));
    void enterWork(id);
    return;
  }
  if (team) viewTeam(main, sh);
  else workPage(main, sh);
}
const backHome = () => h("a", { class: "backlink", href: "#me" }, icon("back", 18, true), h("span", {}, t("navHome")));

function viewAgree(main: HTMLElement): void {
  const go2 = button(t("vdAgreeBtn"), () => agree(), "primary", agreeTick ? {} : { disabled: "" });
  const tick = h("input", { type: "checkbox", id: "agree-tick", checked: agreeTick, onchange: ((e: Event) => { agreeTick = (e.target as HTMLInputElement).checked; go2.disabled = !agreeTick; }) as EventListener });
  append(main, backHome(), h("h1", {}, t("vdAgreeTitle")),
    h("section", { class: "card form" },
      h("p", {}, t("vdAgreeIntro")),
      h("ul", { class: "rules" }, ...(["vdAgree1", "vdAgree2", "vdAgree3", "vdAgree4"] as Key[]).map((k) => h("li", {}, t(k)))),
      h("label", { class: "tick", for: "agree-tick" }, tick, h("span", {}, t("vdAgreeTick"))), go2));
}
async function agree(): Promise<void> {
  const r = await rpc("volunteer_agree");
  if (!r.ok) { noteErr(r); render(); return; }
  await reloadMe();
  render();
}

async function enterWork(id: string): Promise<void> {
  const r = await rpc<Entered>("volunteer_enter", { p_session: id });
  if (!r.ok) { noteErr(r); await reloadMe(); go("#me"); return; }
  work = { id, ent: r.data, found: [], list: null, q: "", show: "all", sort: "number", msg: "", scanning: false, team: null, teamMsg: "" };
  armTick();
  render();
  if (r.data.caps.list) void loadList();
}

// Every minute, and at the cut-off: is the page still theirs, and what the others marked. The server refuses every call
// after the cut-off whatever this page shows.
function armTick(): void {
  window.clearTimeout(timer);
  if (!work) return;
  const left = Date.parse(work.ent.closes_at) - Date.now();
  // Past the cut-off by this phone's clock while the database still says the page is theirs (a phone clock set ahead):
  // asked again every 15 seconds, not every second.
  timer = window.setTimeout(() => void tick(), left > 0 ? Math.max(1000, Math.min(left + 500, 60000)) : 15000);
}
async function tick(): Promise<void> {
  if (!work) return;
  const id = work.id;
  await reloadMe();
  if (!work || work.id !== id) return;
  if (!myShift(id)?.can_work) { await load(); leaveWork(t("volClosed")); return; }
  armTick();
  if (document.querySelector("dialog[open]")) return; // never under a question being answered
  const r = route();
  if (r.name === "team") void loadTeam();
  else if (work.ent.caps.list) void loadList(); // a list whose first read failed too: it said "Loading…" for good
}

/** Leaving the page by itself: the cut-off, or the database saying it is no longer theirs. */
export function leaveWork(text: string, quiet = false): void {
  window.clearTimeout(timer);
  stopScan();
  if (work) dropSession(work.id);
  work = null;
  if (quiet) setQuiet(text); else setNote(text);
  go("#me");
}
/** The page is left for another: the camera goes off. */
export function stopScan(): void {
  if (scanner) { scanner.stop(); scanner = null; }
  scanBox = null;
  torchOn = false;
  if (work) work.scanning = false;
}
/** Forgets the work page altogether, its marks not sent and its timers too: signing out, or signing in, on a phone
 *  people share. Kept, the next volunteer saw the last one's session (their role, arrival and team) and the marks
 *  still waiting went out under the next sign-in. */
export function resetWork(): void {
  window.clearTimeout(timer);
  window.clearTimeout(retryTimer);
  stopScan();
  pending.clear();
  work = null;
  agreeTick = false;
}

// ── the page ──
function workPage(main: HTMLElement, sh: Mine | null): void {
  const w = work!;
  const head = h("section", { class: "card whead", id: "w-head" });
  const brief = w.ent.briefing ? h("details", { class: "card brief-card", open: !(S.prof?.briefed[w.id]) },
    h("summary", {}, icon("doc", 18), h("span", {}, t("vdBriefing"))), h("p", { class: "brief-t" }, w.ent.briefing), briefTick(w.id)) : null;
  const scanHost = h("div", { id: "w-scan" });
  const q = h("input", { id: "w-q", type: "search", enterkeyhint: "search", autocomplete: "off", maxlength: 40, value: w.q,
    placeholder: t(w.ent.caps.list ? "workSearchPhList" : "workSearchPh"), "aria-label": t(w.ent.caps.list ? "workSearchPhList" : "workSearchPh"),
    oninput: ((e: Event) => { w.q = (e.target as HTMLInputElement).value; paintList(); }) as EventListener });
  const findBtn = h("button", { type: "submit", class: "btn btn-secondary", id: "w-find" }, h("span", {}, t("volFindBtn")));
  const form: HTMLFormElement = h("form", { class: "find", role: "search", onsubmit: ((e: Event) => { e.preventDefault(); if (!findBtn.disabled) void busyFind(findBtn, search(q.value)); }) as EventListener },
    h("span", { class: "find-ic" }, icon("search", 22)), q, findBtn);
  // the search as big as Scan, and first: it is what the desk uses most
  append(main, backHome(), head, brief, h("div", { class: "desk" }, form, scanHost),
    h("p", { class: "msg", id: "w-msg", role: "status" }),
    h("div", { class: "rows", id: "w-found" }),
    w.ent.caps.list ? listPanel(sh) : null);
  // once the page is in the document: these find their places by id
  queueMicrotask(() => { paintScan(); paint(); });
}

/** Redraws what marks change, and leaves the search box and the camera alone. */
function paint(): void {
  if (!work) return;
  const r = route();
  if (r.name === "team") { paintTeam(); return; }
  const blood = myShift(work.id)?.ride_kind === "blood";
  const head = document.getElementById("w-head");
  if (head) { clear(head); append(head, ...headParts(blood)); }
  const msg = document.getElementById("w-msg");
  if (msg) msg.textContent = work.msg;
  const found = document.getElementById("w-found");
  if (found) { clear(found); append(found, ...work.found.map((b) => row(b, blood))); }
  paintList();
}

function headParts(blood: boolean): Node[] {
  const w = work!, e = w.ent, sh = myShift(w.id);
  const c = e.counts;
  const out: Node[] = [
    h("div", { class: "whead-top" },
      h("div", {}, h("h1", {}, sh ? sessionName(sh) : ""),
        h("p", { class: "meta" }, icon("clock", 16), h("span", {}, t("vdOpenUntil", whenLabel(e.closes_at))))),
      e.lead || sh?.lead ? link(t("teamBtn"), `#team/${encodeURIComponent(w.id)}`, "secondary", "people", { id: "w-team" }) : null),
  ];
  if (c) out.push(h("div", { class: "counts", id: "w-counts" },
    h("p", { class: "count" }, h("b", {}, h("span", { class: "n" }, String(c.in)), h("span", { class: "of" }, ` / ${c.booked}`)), h("span", {}, t("volStIn"))),
    blood ? h("p", { class: "count" }, h("b", {}, String(c.donated)), h("span", {}, t("donated"))) : null,
    blood && c.visitors != null ? h("p", { class: "count" }, h("b", {}, String(c.visitors)), h("span", {}, t("visitors"))) : null));
  // Opening this page does not start the clock hours early, and never undoes a check-out the team made (rentals
  // 20261107130000): the volunteer says when they are there. Someone who finished by themselves can come back.
  const chips = h("div", { class: "chips" }, e.role ? chip(e.role, "", "person") : null, e.lead || sh?.lead ? chip(t("leadMark"), "lead", "flag") : null);
  if (e.clock_out && e.clock_out_by !== "self") out.push(chips, note(t("vdCheckedOut")));
  else if (e.clock_in && !e.clock_out) {
    chips.appendChild(chip(t("vdArrivedAt", timeLabel(e.clock_in)), "on", "tick"));
    out.push(chips);
    if (e.hours_mode !== "none") out.push(button(t("vdFinish"), () => finish(), "secondary", { id: "w-finish" }));
  } else out.push(chips, button(t("vdArrive"), () => arrive(), "primary", { id: "w-arrive" }, "tick"));
  return out;
}

async function arrive(): Promise<void> {
  const w = work; if (!w) return;
  const r = await rpc<{ clock_in: string | null }>("volunteer_arrive", { p_session: w.id });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return; } w.msg = say(r); paint(); return; }
  w.ent.clock_in = r.data?.clock_in ?? w.ent.clock_in ?? new Date().toISOString();
  w.ent.clock_out = null; w.ent.clock_out_by = null;
  w.msg = "";
  paint();
}
async function finish(): Promise<void> {
  const w = work; if (!w) return;
  const box = dialog(t("finishQ"), [], [
    button(t("donatedNotYet"), () => box.close(), "secondary"),
    button(t("vdFinish"), async () => { await doFinish(); if (box.open) box.close(); }, "primary"),
  ]);
}
async function doFinish(): Promise<void> {
  const w = work; if (!w) return;
  // Marks still "Not sent" go first: leaving the page forgets them, so a check-in the volunteer saw done never reached
  // the database. Ones that still cannot get through, or that the database refuses, are said before anything is left.
  if (pendingIn(w.id).length) {
    w.msg = "";
    await flush();
    if (work !== w) return; // the database said the page is no longer theirs
    if (pendingIn(w.id).length) w.msg = t("finishUnsent");
    if (w.msg) { paint(); return; }
  }
  const r = await rpc("volunteer_clock_out", { p_session: w.id });
  if (!r.ok) { w.msg = say(r); paint(); return; }
  await reloadMe();
  leaveWork(t("vdFinished"), true);
}

/** Find, busy while the database looks (the search box keeps its text). */
async function busyFind(b: HTMLButtonElement, p: Promise<void>): Promise<void> {
  b.disabled = true; b.classList.add("is-busy"); b.setAttribute("aria-busy", "true");
  try { await p; } finally { b.disabled = false; b.classList.remove("is-busy"); b.removeAttribute("aria-busy"); }
}

// ── a short sound when a scan finds someone: web vibration does not exist on an iPhone. The sound is set up on the
// Scan tap itself (a page may only start sound from a tap), and is a soft tone, never a voice. ──
type Ctx = AudioContext;
let audio: Ctx | null = null;
function soundReady(): void {
  try {
    const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return;
    audio ??= new A();
    void audio.resume().catch(() => undefined);
  } catch { audio = null; }
}
function beep(): void {
  if (!audio) return;
  try {
    const at = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.13);
  } catch { /* no sound: the row still comes up */ }
}

// ── Scan: the camera stays on, and every ticket it reads comes up at the top ──
let torchOn = false;
function paintScan(): void {
  const host = document.getElementById("w-scan"), w = work;
  if (!host || !w) return;
  clear(host);
  if (!w.scanning) {
    host.appendChild(button(t("scanTickets"), () => { soundReady(); w.scanning = true; paintScan(); }, "secondary", { id: "w-scan-btn", class: "btn btn-secondary btn-big" }, "scan"));
    return;
  }
  if (!scanBox) {
    const video = h("video", { playsinline: true, muted: true, class: "scan-video" });
    let last = "", lastAt = 0;
    const tools = h("div", { class: "scan-tools", id: "w-scan-tools" },
      button(t("scanStop"), () => { stopScan(); paintScan(); }, "secondary", { id: "w-scan-stop" }, "close"));
    const box = scanBox = h("div", { class: "scan", id: "w-camera" }, video, h("span", { class: "scan-frame", "aria-hidden": "true" }), tools);
    // Each start belongs to its own box: a Stop and a second Scan while the camera was still starting left the first
    // stream running for good, and its late failure closed the scanner in use.
    void startScanner(video, (txt) => {
      if (scanBox !== box) return;
      const now = Date.now();
      if (txt === last && now - lastAt < 2500) return;
      last = txt; lastAt = now;
      void scanned(txt);
    }, () => { if (scanBox !== box) return; stopScan(); if (work) work.msg = t("scanNoCamera"); paintScan(); paint(); })
      .then((sc) => {
        if (!(work?.scanning && scanBox === box)) { sc.stop(); return; }
        if (scanner && scanner !== sc) scanner.stop();
        scanner = sc;
        // the torch, only where the camera says it has one
        if (sc.torch) {
          const tb: HTMLButtonElement = button(t("torch"), async () => {
            const want = !torchOn;
            if (await sc.torch?.(want)) torchOn = want;
            tb.setAttribute("aria-pressed", torchOn ? "true" : "false");
          }, "secondary", { id: "w-torch", "aria-pressed": "false" }, "torch");
          tools.appendChild(tb);
        }
      });
  }
  host.appendChild(scanBox);
  const v = scanBox.querySelector("video");
  if (v && v.paused && v.srcObject) void v.play().catch(() => undefined); // moved back into the page after a redraw
}

async function scanned(txt: string): Promise<void> {
  const w = work; if (!w) return;
  const p = parseTicket(txt);
  if (!p) { w.msg = t("volNotFound"); paint(); return; }
  const hit = await find({ p_ref: p.ref, p_ref_num: p.num }, true);
  if (hit) beep();
  try { navigator.vibrate?.(40); } catch { /* no buzz */ }
}

/** The search box's Find: a ticket, a booking number or a mobile asks the database; a name only filters the list. */
async function search(raw: string): Promise<void> {
  const w = work; if (!w) return;
  const v = latin(raw.trim());
  const ticket = parseTicket(v), digits = v.replace(/[\s()+-]/g, "");
  let args: Record<string, unknown> | null = null;
  if (ticket) args = { p_ref: ticket.ref, p_ref_num: ticket.num };
  else if (/^\d{1,6}$/.test(digits)) args = { p_number: Number(digits) };
  else if (/^\d{7,15}$/.test(digits)) args = { p_mobile: digits };
  if (!args) {
    if (w.list) { w.msg = ""; paint(); return; } // a name: the list below is already filtered by it
    w.found = []; w.msg = t("volSearchHint"); paint(); return;
  }
  await find(args, false);
}
async function find(args: Record<string, unknown>, add: boolean): Promise<boolean> {
  const w = work; if (!w) return false;
  const r = await rpc<Booking[]>("volunteer_find", { p_session: w.id, ...args });
  if (!r.ok) { if (lost(r.code)) { await load(); leaveWork(say(r)); return false; } w.msg = say(r); paint(); return false; }
  const hits = Array.isArray(r.data) ? r.data : [];
  for (const b of hits) overlay(b);
  // A scan adds its booking at the top and keeps the ones before it; a search shows what it found.
  w.found = add ? [...hits, ...w.found.filter((x) => !hits.some((y) => y.id === x.id))].slice(0, 8) : hits;
  w.msg = hits.length ? "" : t("volNotFound");
  paint();
  return hits.length > 0;
}
async function loadList(): Promise<void> {
  const w = work; if (!w) return;
  const r = await rpc<Booking[]>("volunteer_list", { p_session: w.id });
  if (!r.ok) {
    if (lost(r.code)) { await load(); leaveWork(say(r)); return; }
    if (!unsent(r)) w.msg = say(r);
    else if (work === w && !w.list) {
      // Never read yet: the panel says so instead of "Loading…", and the minute tick reads it again.
      const b = document.getElementById("w-list");
      if (b) { clear(b); b.appendChild(note(t("errConnection"))); }
    }
    paint(); return;
  }
  w.list = Array.isArray(r.data) ? r.data : [];
  // The list is newer than the figures from entering, and other people are marking too. Counted as the database has
  // them, before the marks not sent yet are laid over the rows: each of those is counted once, when it lands (ok()).
  const c = w.ent.counts, l = w.list;
  if (c) {
    c.booked = l.length;
    c.in = l.filter((x) => x.checked_in).length;
    c.donated = l.filter((x) => x.donated).length;
    if (c.visitors != null) c.visitors = l.filter((x) => x.visitor).length;
  }
  for (const b of w.list) overlay(b);
  paint();
}
/** A row read again from the database wears the marks still waiting to be sent. */
function overlay(b: Booking): void {
  const pin = pending.get(`in:${b.id}`), pdo = pending.get(`do:${b.id}`), prole = pending.get(`role:${b.id}`);
  if (pin) { b.checked_in = pin.args.p_on === true; b.mine_in = b.checked_in; }
  if (pdo) { b.donated = pdo.args.p_on === true; b.mine_donated = b.donated; }
  if (prole) b.visitor = prole.args.p_role === "visitor";
}

const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

// ── the list the session lets volunteers see (caps.list) ──
function listPanel(sh: Mine | null): HTMLElement {
  const w = work!, blood = sh?.ride_kind === "blood";
  const opt = (value: string, label: string, cur: string) => h("option", { value, selected: value === cur }, label);
  const pick = (id: string, label: string, onchange: (v: string) => void, ...opts: HTMLElement[]) =>
    h("label", { class: "list-pick", for: id }, h("span", {}, label), h("select", { id, onchange: ((ev: Event) => { onchange((ev.target as HTMLSelectElement).value); paintList(); }) as EventListener }, ...opts));
  return h("section", { class: "list-panel", "aria-labelledby": "w-list-h" },
    h("div", { class: "list-head" }, h("h2", { class: "sec", id: "w-list-h" }, t("vdPanelTitle")), h("span", { class: "list-n", id: "w-list-n" }),
      iconButton("again", t("vdRefresh"), () => loadList(), { id: "w-refresh" })),
    h("div", { class: "list-tools" },
      pick("w-show", t("vdFilter"), (v) => { w.show = v; },
        opt("all", t("vdFilterAll"), w.show), opt("out", t("volStOut"), w.show), opt("in", t("volStIn"), w.show), opt("desk", t("vdFilterDesk"), w.show),
        ...(blood ? [opt("donated", t("donated"), w.show), opt("donors", t("roleDonor"), w.show), opt("visitors", t("roleVisitor"), w.show)] : [])),
      pick("w-sort", t("vdSort"), (v) => { w.sort = v; },
        opt("number", t("vdSortNumber"), w.sort), opt("name", t("vdSortName"), w.sort), opt("out", t("vdSortOut"), w.sort))),
    h("div", { class: "rows", id: "w-list" }, note(t("loading"))));
}
function listRows(): Booking[] {
  const w = work!;
  const raw = latin(w.q.trim()).toLowerCase(), digits = raw.replace(/[\s()+-]/g, "");
  const ticket = parseTicket(raw);
  const shown = (w.list ?? []).filter((r) => {
    if (raw && !ticket && !(r.name.toLowerCase().includes(raw) || String(r.number) === digits || (/^\d{3,}$/.test(digits) && (r.phone ?? "").replace(/\D/g, "").includes(digits)))) return false;
    if (ticket && !r.id.startsWith(ticket.ref)) return false;
    switch (w.show) {
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
  if (w.sort === "name") shown.sort((a, b) => a.name.localeCompare(b.name, currentLang()));
  else if (w.sort === "out") shown.sort((a, b) => Number(a.checked_in) - Number(b.checked_in) || num(a) - num(b));
  else shown.sort((a, b) => num(a) - num(b));
  return shown;
}
function paintList(): void {
  const w = work, b = document.getElementById("w-list");
  if (!w || !b || !w.list) return;
  const blood = myShift(w.id)?.ride_kind === "blood", rows = listRows();
  clear(b);
  if (rows.length) append(b, ...rows.map((r) => row(r, blood))); else b.appendChild(note(t("volNotFound")));
  const n = document.getElementById("w-list-n");
  if (n) n.textContent = `${rows.length} / ${w.list.length}`;
}

// ── one booking: one main button, the rest in a menu ──
type Act = { label: string; run: () => void | Promise<unknown>; main?: boolean };
function actionsOf(r: Booking, blood: boolean): Act[] {
  const e = work!.ent, vis = blood && r.visitor === true, acts: Act[] = [];
  if (r.own) return acts;
  // Donor or visitor (the booking app's blood_role, 20261105140000): a visitor has nothing to mark, so the free ride
  // stays with donors; one tap switches them until the donation is marked (the database refuses it then too).
  if (!r.checked_in) { if (!r.desk && e.caps.checkin) acts.push({ label: t("checkIn"), run: () => mark("in", r, true), main: true }); }
  else if (blood && r.donated) { if (r.mine_donated && e.caps.undo) acts.push({ label: t("volUndoDonated"), run: () => mark("do", r, false) }); }
  else {
    if (blood && !vis && e.caps.donated) acts.push({ label: t("markDonated"), run: () => askDonated(r), main: true });
    if (r.mine_in && e.caps.undo) acts.push({ label: t("undoCheckIn"), run: () => mark("in", r, false) });
  }
  if (blood && !r.donated && e.caps.checkin && (r.checked_in || !r.desk)) acts.push({ label: t(vis ? "makeDonor" : "makeVisitor"), run: () => setRole(r, vis ? "donor" : "visitor") });
  return acts;
}
function row(r: Booking, blood: boolean): HTMLElement {
  const e = work!.ent;
  const deskKey: Record<string, Key> = { bike: "vdDeskBike", approval: "vdDeskApproval", share: "vdDeskShare", waiver: "vdDeskWaiver", waitlist: "vdDeskWaitlist" };
  const vis = blood && r.visitor === true;
  const waiting = [`in:${r.id}`, `do:${r.id}`, `role:${r.id}`].find(isPending) ?? null;
  // A row with a mark not sent yet takes no other until it is: only taking that one back.
  const acts = waiting ? [{ label: t("notSentCancel"), run: () => cancel(waiting) }] : actionsOf(r, blood);
  const main = acts.find((a: Act) => a.main), rest = acts.filter((a) => a !== main);
  const details = [r.bike ? t("vdBike", r.bike) : "", r.size ? t("vdSize", r.size) : "", r.height ? t("vdHeight", r.height) : "", r.blood_type ? t("vdBlood", r.blood_type) : "", r.club ? t("vdClub", r.club) : ""].filter(Boolean);
  return h("div", { class: `card row${waiting ? " is-unsent" : ""}`, "data-id": r.id },
    h("div", { class: "row-who" },
      h("p", { class: "name" }, r.name, r.number != null ? h("span", { class: "num" }, ` #${r.number}`) : null),
      details.length ? h("p", { class: "meta row-details" }, details.join(" · ")) : null,
      e.caps.phone && r.phone ? telLink(r.phone, t("vdCall", r.name)) : null,
      h("div", { class: "chips" },
        blood ? h("span", { class: `chip ${vis ? "chip-visitor" : "chip-donor"}` }, t(vis ? "roleVisitor" : "roleDonor")) : null,
        chip(t(r.checked_in ? "volStIn" : "volStOut"), r.checked_in ? "on" : ""),
        r.status === "waitlist" && !blood ? chip(t("vdWaitlist")) : null,
        r.donated ? chip(t("donated"), "on") : null,
        waiting ? chip(t("notSent"), "warn", "again") : null),
      r.own ? h("p", { class: "warn" }, t("vdOwn")) : !r.checked_in && r.desk ? h("p", { class: "warn" }, t(deskKey[r.desk] ?? "vdDeskAsk")) : null),
    main || rest.length ? h("div", { class: "row-acts" },
      main ? button(main.label, main.run, "soft", { class: "btn btn-soft row-main" }) : null,
      rest.length ? iconButton("more", t("moreFor", r.name), () => menu(r.name, rest), { class: "btn btn-icon row-more" }) : null) : null);
}
/** The rest of a row's actions, in a centred menu that names the person. */
function menu(name: string, acts: Act[]): void {
  const box: HTMLDialogElement = dialog(name, [h("div", { class: "menu" }, ...acts.map((a) => button(a.label, () => { box.close(); a.run(); }, "secondary")))],
    [button(t("close"), () => box.close(), "quiet")], "ask-menu");
}
// Check-in and the donation are two steps (the owner, 2026-11-05): Mark donated takes Check in's place under the finger,
// so it always asks first, naming the person.
function askDonated(r: Booking): void {
  const box = dialog(t("donatedQ", r.name), [h("p", {}, t("donatedBody"))], [
    button(t("donatedNotYet"), () => box.close(), "secondary"),
    button(t("markDonated"), () => { box.close(); void mark("do", r, true); }, "primary"),
  ]);
}

function each(id: string, fn: (b: Booking) => void): void {
  const w = work; if (!w) return;
  for (const x of [...w.found, ...(w.list ?? [])]) if (x.id === id) fn(x);
}
async function mark(kind: "in" | "do", r: Booking, on: boolean): Promise<void> {
  const w = work; if (!w) return;
  const fn = kind === "in" ? "volunteer_checkin" : "volunteer_donated";
  const was = kind === "in" ? r.checked_in : r.donated;
  const set = (v: boolean) => each(r.id, (x) => { if (kind === "in") { x.checked_in = v; x.mine_in = v; } else { x.donated = v; x.mine_donated = v; } });
  w.msg = "";
  await send({
    key: `${kind}:${r.id}`, fn, args: { p_session: w.id, p_entry_id: r.id, p_on: on }, label: kind === "in" ? (on ? "checkIn" : "undoCheckIn") : (on ? "markDonated" : "volUndoDonated"),
    ok: (data) => {
      const c = work === w ? w.ent.counts : null; // landed after another session was opened: not that page's count
      if (c && !(data && (data as { noop?: boolean }).noop) && was !== on) { if (kind === "in") c.in += on ? 1 : -1; else c.donated += on ? 1 : -1; }
      set(on);
    },
    undo: () => set(was),
  }, () => set(on));
}
async function setRole(r: Booking, role: "donor" | "visitor"): Promise<void> {
  const w = work; if (!w) return;
  const to = role === "visitor", was = !!r.visitor;
  w.msg = "";
  await send({
    key: `role:${r.id}`, fn: "volunteer_blood_role", args: { p_session: w.id, p_entry_id: r.id, p_role: role }, label: to ? "makeVisitor" : "makeDonor",
    ok: (data) => {
      // What the database had before, when it says (the row shown may be stale: someone else switched the person);
      // a switch that changed nothing is not counted.
      const d = (data ?? {}) as { noop?: boolean; prev?: string | null };
      const before = typeof d.prev === "string" ? d.prev === "visitor" : was;
      const c = work === w ? w.ent.counts : null;
      if (c && c.visitors != null && !d.noop && before !== to) c.visitors += to ? 1 : -1;
      each(r.id, (x) => { x.visitor = to; });
    },
    undo: () => each(r.id, (x) => { x.visitor = was; }),
  }, () => each(r.id, (x) => { x.visitor = to; }));
}

// ── the team (lead only; volunteer_team, rentals 20261109120000): names and who has arrived, nothing else ──
function viewTeam(main: HTMLElement, sh: Mine | null): void {
  const w = work!;
  append(main, h("a", { class: "backlink", href: `#work/${encodeURIComponent(w.id)}` }, icon("back", 18, true), h("span", {}, sh ? sessionName(sh) : t("navHome"))),
    h("h1", {}, t("teamTitle")), h("div", { class: "counts", id: "t-counts" }),
    h("p", { class: "msg", id: "t-msg", role: "status" }),
    h("div", { class: "rows", id: "t-list" }, note(t("loading"))));
  // main.ts puts this page in the document only after it is built, and paintTeam finds its places by id: the team
  // already read is drawn once it is there (drawn now, it said "Loading…" until the next tick), and read again behind it.
  if (!w.team) void loadTeam(); else { queueMicrotask(paintTeam); void loadTeam(); }
}
async function loadTeam(): Promise<void> {
  const w = work; if (!w) return;
  const r = await rpc<Mate[]>("volunteer_team", { p_session: w.id });
  if (!r.ok) {
    if (lost(r.code)) { await load(); leaveWork(say(r)); return; }
    if (r.code === "VOL_NOT_LEAD") { setNote(say(r)); w.team = null; go(`#work/${encodeURIComponent(w.id)}`); return; }
    w.teamMsg = say(r); paintTeam(); return;
  }
  w.team = Array.isArray(r.data) ? r.data : [];
  for (const m of w.team) { const p = pending.get(`team:${m.shift}`); if (p) teamApply(m, String(p.args.p_action)); }
  paintTeam();
}
const onDuty = (m: Mate) => !!m.clock_in && !m.clock_out;
function paintTeam(): void {
  const w = work, list = document.getElementById("t-list");
  if (!w || !list) return;
  const msg = document.getElementById("t-msg");
  if (msg) msg.textContent = w.teamMsg;
  if (!w.team) return;
  const team = [...w.team].sort((a, b) => Number(onDuty(b)) - Number(onDuty(a)) || a.name.localeCompare(b.name, currentLang()));
  const counts = document.getElementById("t-counts");
  if (counts) {
    clear(counts);
    append(counts, h("p", { class: "count" }, h("b", {}, h("span", { class: "n" }, String(team.filter(onDuty).length)), h("span", { class: "of" }, ` / ${team.length}`)), h("span", {}, t("teamOnDuty"))));
  }
  clear(list);
  if (!team.length) { list.appendChild(note(t("teamNone"))); return; }
  append(list, ...team.map(mateRow));
}
function mateRow(m: Mate): HTMLElement {
  if (isPending(`team:${m.shift}`)) return mateRowWith(m, [{ label: t("notSentCancel"), run: () => cancel(`team:${m.shift}`) }]);
  const acts: Act[] = [];
  if (!m.me) {
    if (onDuty(m)) acts.push({ label: t("teamCheckOut"), run: () => clock(m, "out"), main: true });
    else if (!(m.clock_out && m.clock_out_by === "staff")) acts.push({ label: t("checkIn"), run: () => clock(m, "in"), main: true });
    if (m.clock_in_by === "lead" && !m.clock_out) acts.push({ label: t("undoCheckIn"), run: () => clock(m, "undo_in") });
    if (m.clock_out_by === "lead") acts.push({ label: t("teamUndoOut"), run: () => clock(m, "undo_out") });
  }
  return mateRowWith(m, acts);
}
function mateRowWith(m: Mate, acts: Act[]): HTMLElement {
  const unsentNow = isPending(`team:${m.shift}`);
  const state = m.clock_out ? chip(t("teamOut", timeLabel(m.clock_out)), "") : m.clock_in ? chip(t("teamIn", timeLabel(m.clock_in)), "on", "tick") : chip(t("teamNotYet"), "wait");
  const main = acts.find((a) => a.main), rest = acts.filter((a) => a !== main);
  const out = onDuty(m); // checking someone out is the quieter of the two
  return h("div", { class: `card row mate${unsentNow ? " is-unsent" : ""}`, "data-shift": m.shift },
    h("div", { class: "row-who" },
      h("p", { class: "name" }, m.name, m.me ? h("span", { class: "num" }, ` · ${t("teamYou")}`) : null),
      h("div", { class: "chips" }, state, m.role ? chip(m.role) : null, m.lead ? chip(t("leadMark"), "lead", "flag") : null, m.briefed ? chip(t("briefDone"), "", "doc") : null,
        unsentNow ? chip(t("notSent"), "warn", "again") : null)),
    main || rest.length ? h("div", { class: "row-acts" },
      main ? button(main.label, main.run, out ? "secondary" : "soft", { class: `btn btn-${out ? "secondary" : "soft"} row-main` }) : null,
      rest.length ? iconButton("more", t("moreFor", m.name), () => menu(m.name, rest), { class: "btn btn-icon row-more" }) : null) : null);
}
function teamApply(m: Mate, action: string): void {
  const now = new Date().toISOString();
  if (action === "in") { if (!m.clock_in || m.clock_out) { m.clock_in = m.clock_out ? m.clock_in : now; m.clock_in_by = m.clock_in_by ?? "lead"; m.clock_out = null; m.clock_out_by = null; } }
  else if (action === "out") { if (m.clock_in && !m.clock_out) { m.clock_out = now; m.clock_out_by = "lead"; } }
  else if (action === "undo_in") { m.clock_in = null; m.clock_in_by = null; }
  else if (action === "undo_out") { m.clock_out = null; m.clock_out_by = null; }
}
async function clock(m: Mate, action: "in" | "out" | "undo_in" | "undo_out"): Promise<void> {
  const w = work; if (!w) return;
  const before = { ...m };
  w.teamMsg = "";
  await send({
    key: `team:${m.shift}`, fn: "volunteer_team_clock", args: { p_session: w.id, p_shift: m.shift, p_action: action }, label: "teamBtn",
    ok: (data) => {
      const d = (data ?? {}) as Partial<Mate> & { noop?: boolean };
      const x = work?.team?.find((y) => y.shift === m.shift);
      if (!x) return;
      if (d.noop) { void loadTeam(); return; }
      x.clock_in = d.clock_in ?? null; x.clock_out = d.clock_out ?? null; x.clock_in_by = d.clock_in_by ?? null; x.clock_out_by = d.clock_out_by ?? null;
    },
    undo: () => { const x = work?.team?.find((y) => y.shift === m.shift); if (x) Object.assign(x, before); },
  }, () => { const x = work?.team?.find((y) => y.shift === m.shift); if (x) teamApply(x, action); });
}
