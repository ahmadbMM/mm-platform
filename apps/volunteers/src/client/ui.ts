// The pieces every page is built from, in the rider "Liquid" look (static/app.css): pill buttons for the one main
// action, rounded controls for the rest, chips, the date block and the centred dialog (the owner: every pop-up in
// the middle of the screen, never a sheet from the bottom).
//
// A button whose action returns a promise is busy until it settles (fix 2, 2026-11-11): it cannot be tapped again and
// shows a small spinner, so a slow event network never gets the same action twice.

import { h, type Child } from "./dom";
import { dateParts, dayLabel } from "./i18n";
import { icon } from "./icons";

type Kind = "primary" | "secondary" | "ghost" | "quiet" | "danger" | "soft";
type Run = () => void | Promise<unknown>;

/** Marks a button busy while the promise runs: disabled, a spinner before its words, aria-busy. */
export function busyWhile(b: HTMLButtonElement, p: Promise<unknown>): Promise<unknown> {
  if (b.classList.contains("is-busy")) return p;
  b.classList.add("is-busy");
  b.disabled = true;
  b.setAttribute("aria-busy", "true");
  const spin = h("span", { class: "spin", "aria-hidden": "true" });
  b.prepend(spin);
  const done = () => { b.classList.remove("is-busy"); b.disabled = false; b.removeAttribute("aria-busy"); spin.remove(); };
  return p.then((v) => { done(); return v; }, (e: unknown) => { done(); throw e; });
}
const runOn = (b: HTMLButtonElement, run: Run) => () => {
  if (b.classList.contains("is-busy")) return;
  const r = run();
  if (r && typeof (r as Promise<unknown>).then === "function") void busyWhile(b, r as Promise<unknown>).catch(() => undefined);
};

export function button(label: Child, onclick: Run, kind: Kind = "secondary", attrs: Record<string, string> = {}, ic?: string): HTMLButtonElement {
  const b = h("button", { type: "button", class: `btn btn-${kind}`, ...attrs }, ic ? icon(ic, 18) : null, h("span", {}, label));
  b.addEventListener("click", runOn(b, onclick));
  return b;
}
/** A form's submit button, busy while what it sends is on its way. */
export function submitBusy(form: HTMLFormElement, send: () => Promise<unknown>): void {
  const b = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (b?.classList.contains("is-busy")) return;
  const p = send();
  if (b) void busyWhile(b, p).catch(() => undefined);
}
export function link(label: Child, href: string, kind: Kind = "secondary", ic?: string, attrs: Record<string, string> = {}): HTMLAnchorElement {
  return h("a", { class: `btn btn-${kind}`, href, ...attrs }, ic ? icon(ic, 18) : null, h("span", {}, label));
}
/** A button that is only its mark (its name is said to screen readers). */
export function iconButton(ic: string, label: string, onclick: Run, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = h("button", { type: "button", class: "btn btn-icon", "aria-label": label, title: label, ...attrs }, icon(ic, 20));
  b.addEventListener("click", runOn(b, onclick));
  return b;
}

/** Copies text, and the button says so in place for a moment (never a bar). False when the phone would not copy. */
export async function copyText(text: string, b?: HTMLButtonElement, copiedLabel?: string): Promise<boolean> {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
  if (ok && b) {
    // the button's own mark turns into a tick and its words into "Copied", then back
    const span = b.classList.contains("btn-icon") ? null : b.querySelector("span:not(.spin)");
    const mark = b.querySelector("svg"), tick = icon("tick", mark ? Number(mark.getAttribute("width")) || 18 : 18);
    const was = span?.textContent ?? "", wasLabel = b.getAttribute("aria-label");
    b.classList.add("is-done");
    mark?.replaceWith(tick);
    if (span && copiedLabel) span.textContent = copiedLabel;
    if (copiedLabel && wasLabel) b.setAttribute("aria-label", copiedLabel);
    window.setTimeout(() => {
      b.classList.remove("is-done");
      if (mark) tick.replaceWith(mark);
      if (span) span.textContent = was;
      if (wasLabel) b.setAttribute("aria-label", wasLabel);
    }, 2400);
  }
  return ok;
}

export const chip = (text: Child, tone = "", ic?: string) => h("span", { class: `chip${tone ? ` chip-${tone}` : ""}` }, ic ? icon(ic, 14) : null, text);
export const note = (text: string, role = "status", tone = "") => h("p", { class: `note${tone ? ` note-${tone}` : ""}`, role }, text);
export const sec = (text: string, id?: string) => h("h2", { class: "sec", id }, text);
export const card = (cls: string, ...children: Child[]) => h("section", { class: `card ${cls}`.trim() }, ...children);

/** Grey shapes where a list will be, while it is read (fix 15: a skeleton, not "Loading…"). */
export function skeleton(n = 2, label = ""): HTMLElement {
  return h("div", { class: "skel", role: "status", "aria-busy": "true" }, label ? h("span", { class: "sr-only" }, label) : null,
    ...Array.from({ length: n }, () => h("div", { class: "skel-card", "aria-hidden": "true" }, h("span", { class: "skel-line w60" }), h("span", { class: "skel-line w40" }))));
}

/** A session's date at a glance: the month, the day, the weekday; the whole date for a screen reader. */
export function dateBlock(ymd: string | null | undefined, big = false): HTMLElement | null {
  const p = dateParts(ymd);
  if (!p) return null;
  return h("div", { class: `dblock${big ? " dblock-big" : ""}` },
    h("span", { class: "sr-only" }, dayLabel(ymd)),
    h("span", { class: "dblock-m", "aria-hidden": "true" }, p.month), h("span", { class: "dblock-d", "aria-hidden": "true" }, p.day),
    h("span", { class: "dblock-w", "aria-hidden": "true" }, p.weekday));
}

/** One line with a mark before it (a time, a place, a role). */
export const metaLine = (ic: string, text: Child, cls = "") => h("p", { class: `meta ${cls}`.trim() }, icon(ic, 16), h("span", {}, text));
/** A fact staff wrote: its mark, what it is, and what they wrote (or a link). */
export const fact = (ic: string, label: string, ...value: Child[]) => h("div", { class: "fact-row" }, icon(ic, 18),
  h("div", { class: "fact-row-t" }, h("p", { class: "fact-k" }, label), h("p", { class: "fact-v" }, ...value)));

/** A Saudi mobile as people write it (+966 5x xxx xxxx); anything else as it came, with its plus. */
export function fmtPhone(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  let l = d;
  if (l.startsWith("966")) l = l.slice(3); else if (l.startsWith("00966")) l = l.slice(5);
  if (l.startsWith("0")) l = l.slice(1);
  if (/^5\d{8}$/.test(l)) return `+966 ${l.slice(0, 2)} ${l.slice(2, 5)} ${l.slice(5)}`;
  return String(raw).trim().startsWith("+") ? `+${d}` : d;
}
/** A phone number as a quiet link, kept left to right inside Arabic and Urdu text. */
export function telLink(raw: string, label?: string, cls = "tel"): HTMLElement {
  const shown = fmtPhone(raw);
  const digits = shown.replace(/[^\d+]/g, "");
  return h("a", { class: cls, href: `tel:${digits}`, dir: "ltr", "aria-label": label ?? null }, h("bdi", {}, shown));
}

/** A centred dialog. Closing it removes it; the page under it stays as it was. Firm: Escape does not close it (a
 *  detail the account owes; the owner, 2026-11-10: an unskippable pop-up), and only closeAsk() does: a second Escape or
 *  back gesture, which the browser no longer lets a page refuse, opens it again. */
export function dialog(title: string, body: Child[], actions: HTMLElement[], cls = "", firm = false): HTMLDialogElement {
  const box = h("dialog", { class: `ask ${cls}`.trim(), "aria-labelledby": "ask-q" },
    h("h2", { class: "ask-q", id: "ask-q" }, title), ...body, h("div", { class: "ask-acts" }, ...actions));
  box.addEventListener("close", () => {
    if (firm && !box.dataset.done && box.isConnected) { try { box.showModal(); return; } catch { /* could not open again: let it go */ } }
    box.remove();
  });
  if (firm) box.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(box);
  box.showModal();
  return box;
}

/** Closes a dialog on purpose (a firm one included). */
export function closeAsk(box: HTMLDialogElement | null | undefined): void {
  if (!box) return;
  box.dataset.done = "1";
  box.close();
}

/** A switch, as a checkbox with the switch role. */
export function toggle(label: string, on: boolean, onchange: (on: boolean) => void, attrs: Record<string, string> = {}, ic?: string): HTMLElement {
  const id = `sw-${Math.random().toString(36).slice(2, 8)}`;
  const box = h("input", { id, type: "checkbox", role: "switch", class: "switch", checked: on, ...attrs,
    onchange: ((e: Event) => onchange((e.target as HTMLInputElement).checked)) as EventListener });
  return h("label", { class: "switch-row", for: id }, h("span", { class: "set-k" }, ic ? icon(ic, 18) : null, h("span", {}, label)), box);
}

/** One choice of a few, as pills (radio buttons under them). */
export function pills(name: string, legend: string, options: { value: string; label: string }[], cur: string | null, onpick: (v: string) => void, cls = ""): HTMLElement {
  return h("fieldset", { class: `pick ${cls}`.trim() }, h("legend", {}, legend),
    h("div", { class: "chips" }, ...options.map((o) => {
      const id = `${name}-${o.value}-${Math.random().toString(36).slice(2, 6)}`;
      return h("span", { class: "pick-one" },
        h("input", { type: "radio", name, id, value: o.value, checked: o.value === cur, onchange: (() => onpick(o.value)) as EventListener }),
        h("label", { for: id }, o.label));
    })));
}
