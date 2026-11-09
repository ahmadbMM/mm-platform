// The pieces every page is built from, in the rider "Liquid" look (static/app.css): pill buttons for the one main
// action, rounded controls for the rest, chips, the date block and the centred dialog (the owner: every pop-up in
// the middle of the screen, never a sheet from the bottom).

import { h, type Child } from "./dom";
import { dateParts } from "./i18n";
import { icon } from "./icons";

type Kind = "primary" | "secondary" | "ghost" | "quiet" | "danger";

export function button(label: Child, onclick: () => void, kind: Kind = "secondary", attrs: Record<string, string> = {}, ic?: string): HTMLButtonElement {
  return h("button", { type: "button", class: `btn btn-${kind}`, onclick: onclick as EventListener, ...attrs }, ic ? icon(ic, 18) : null, h("span", {}, label));
}
export function link(label: Child, href: string, kind: Kind = "secondary", ic?: string, attrs: Record<string, string> = {}): HTMLAnchorElement {
  return h("a", { class: `btn btn-${kind}`, href, ...attrs }, ic ? icon(ic, 18) : null, h("span", {}, label));
}
/** A button that is only its mark (its name is said to screen readers). */
export const iconButton = (ic: string, label: string, onclick: () => void, attrs: Record<string, string> = {}) =>
  h("button", { type: "button", class: "btn btn-icon", "aria-label": label, title: label, onclick: onclick as EventListener, ...attrs }, icon(ic, 20));

export const chip = (text: Child, tone = "", ic?: string) => h("span", { class: `chip${tone ? ` chip-${tone}` : ""}` }, ic ? icon(ic, 14) : null, text);
export const note = (text: string, role = "status", tone = "") => h("p", { class: `note${tone ? ` note-${tone}` : ""}`, role }, text);
export const sec = (text: string, id?: string) => h("h2", { class: "sec", id }, text);
export const card = (cls: string, ...children: Child[]) => h("section", { class: `card ${cls}`.trim() }, ...children);

/** A session's date at a glance: the month, the day, the weekday. */
export function dateBlock(ymd: string | null | undefined, big = false): HTMLElement | null {
  const p = dateParts(ymd);
  if (!p) return null;
  return h("div", { class: `dblock${big ? " dblock-big" : ""}`, "aria-hidden": "true" },
    h("span", { class: "dblock-m" }, p.month), h("span", { class: "dblock-d" }, p.day), h("span", { class: "dblock-w" }, p.weekday));
}

/** One line with a mark before it (a time, a place, a role). */
export const metaLine = (ic: string, text: Child, cls = "") => h("p", { class: `meta ${cls}`.trim() }, icon(ic, 16), h("span", {}, text));

/** A centred dialog. Closing it removes it; the page under it stays as it was. */
export function dialog(title: string, body: Child[], actions: HTMLElement[], cls = ""): HTMLDialogElement {
  const box = h("dialog", { class: `ask ${cls}`.trim(), "aria-labelledby": "ask-q" },
    h("h2", { class: "ask-q", id: "ask-q" }, title), ...body, h("div", { class: "ask-acts" }, ...actions));
  box.addEventListener("close", () => box.remove());
  document.body.append(box);
  box.showModal();
  return box;
}

/** A switch, as a checkbox with the switch role. */
export function toggle(label: string, on: boolean, onchange: (on: boolean) => void, attrs: Record<string, string> = {}, ic?: string): HTMLElement {
  const id = `sw-${Math.random().toString(36).slice(2, 8)}`;
  const box = h("input", { id, type: "checkbox", role: "switch", class: "switch", checked: on, ...attrs,
    onchange: ((e: Event) => onchange((e.target as HTMLInputElement).checked)) as EventListener });
  return h("label", { class: "switch-row", for: id }, h("span", { class: "set-k" }, ic ? icon(ic, 18) : null, h("span", {}, label)), box);
}
