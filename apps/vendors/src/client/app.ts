// Shared page state and small building blocks the views use.

import { h, uid, type Child } from "./dom";
import { icon, type IconName } from "./icons";
import { errorKey, type Me } from "./model";
import { fmt, type Key, type Lang } from "./strings";

export const app = {
  lang: "en" as Lang,
  me: null as Me | null,
  /** Draws the current screen again (after a language switch, or new data). */
  render: () => {},
};

export const t = (k: Key, vars?: Record<string, string | number>) => fmt(app.lang, k, vars);
export const isRtl = () => app.lang === "ar";

const LANG_KEY = "mm_vendor_lang";

export function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ar" ? v : null;
  } catch {
    return null;
  }
}

export function setLang(l: Lang): void {
  app.lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode: the choice lasts this visit */ }
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  document.title = fmt(l, "appName");
}

/** Says a result out loud to screen readers (the page's one polite live region). */
export function announce(msg: string): void {
  const live = document.getElementById("live");
  if (!live) return;
  live.textContent = "";
  window.setTimeout(() => { live.textContent = msg; }, 50);
}

/** A message box: an error (role=alert) or a quiet success/info note (role=status). */
export function note(kind: "error" | "ok" | "info" | "warn", text: string): HTMLElement {
  const ic: IconName = kind === "error" ? "alert" : kind === "ok" ? "check" : kind === "warn" ? "alert" : "info";
  return h("p", { class: `note note-${kind}`, role: kind === "error" ? "alert" : "status" }, icon(ic), h("span", {}, text));
}

export const errorNote = (code: string) => note("error", t(errorKey(code)));

/** A labelled input with an optional hint and its own error line. */
export function field(opts: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  hint?: string;
  autocomplete?: string;
  required?: boolean;
  maxlength?: number;
  inputmode?: string;
  dir?: string;
  multiline?: boolean;
  min?: string;
  max?: string;
}): { wrap: HTMLElement; input: HTMLInputElement | HTMLTextAreaElement; setError: (msg: string) => void } {
  const id = uid(opts.name);
  const hintId = opts.hint ? `${id}-hint` : undefined;
  const errId = `${id}-err`;
  const common = {
    id,
    name: opts.name,
    autocomplete: opts.autocomplete,
    required: opts.required,
    maxlength: opts.maxlength,
    inputmode: opts.inputmode,
    dir: opts.dir,
    "aria-describedby": [hintId, errId].filter(Boolean).join(" "),
  };
  const input = opts.multiline
    ? h("textarea", { ...common, rows: 3 })
    : h("input", { ...common, type: opts.type || "text", min: opts.min, max: opts.max });
  input.value = opts.value ?? "";
  const err = h("p", { class: "field-error", id: errId });
  const wrap = h("div", { class: "field" }, h("label", { for: id }, opts.label), opts.hint ? h("p", { class: "hint", id: hintId }, opts.hint) : null, input, err);
  return {
    wrap,
    input,
    setError(msg: string) {
      err.textContent = msg;
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    },
  };
}

/** A button with an icon and a label. */
export function button(label: string, opts: { kind?: "primary" | "secondary" | "ghost" | "danger"; icon?: IconName; type?: "button" | "submit"; onclick?: EventListener; small?: boolean } = {}): HTMLButtonElement {
  return h(
    "button",
    { type: opts.type || "button", class: `btn btn-${opts.kind || "secondary"}${opts.small ? " btn-small" : ""}`, onclick: opts.onclick },
    opts.icon ? icon(opts.icon) : null,
    h("span", {}, label),
  );
}

/** Puts a button into its busy state with a new label, and back. */
export function busy(btn: HTMLButtonElement, on: boolean, label: string): void {
  btn.disabled = on;
  btn.setAttribute("aria-busy", on ? "true" : "false");
  const span = btn.querySelector("span");
  if (span) span.textContent = label;
}

/** A centred modal dialog (native <dialog>: focus kept inside, Escape closes). */
export function dialog(title: string, ...body: Child[]): { el: HTMLDialogElement; body: HTMLElement; close: () => void } {
  const titleId = uid("dlg");
  const content = h("div", { class: "dialog-body" }, ...body);
  const el = h("dialog", { class: "dialog", "aria-labelledby": titleId });
  const close = () => { el.close(); };
  const x = h("button", { type: "button", class: "icon-btn", "aria-label": t("close"), onclick: close }, icon("close"));
  el.append(h("div", { class: "dialog-head" }, h("h2", { id: titleId }, title), x), content);
  el.addEventListener("close", () => el.remove());
  document.body.appendChild(el);
  el.showModal();
  return { el, body: content, close };
}
