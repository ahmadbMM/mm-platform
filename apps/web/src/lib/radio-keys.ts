import type { KeyboardEvent } from "react";

// A single choice among several is a radio group (WAI-ARIA APG Radio Group; the research's row 11, 2026-11-10): one
// tab stop (the checked option, else the first that may be chosen), and the arrow keys move between the options:
// Down and the reading direction's forward arrow to the next, Up and the backward arrow to the previous, Home and End
// to the first and last, round the ends. A disabled option is passed over. The caller checks the option the focus
// lands on where checking does nothing else (a pop-up, a new page): radioKey hands it back.

const enabled = (x: HTMLElement) => !x.hasAttribute("disabled") && x.getAttribute("aria-disabled") !== "true";

/** The group's keydown (on the role="radiogroup" element): moves the focus and returns the option it moved to, or null
 *  for any other key (and for a key pressed on something in the group that is not one of its options). */
export function radioKey(e: KeyboardEvent<HTMLElement>, rtl: boolean): HTMLElement | null {
  const k = e.key;
  const next = k === "ArrowDown" || k === (rtl ? "ArrowLeft" : "ArrowRight");
  const prev = k === "ArrowUp" || k === (rtl ? "ArrowRight" : "ArrowLeft");
  if (!next && !prev && k !== "Home" && k !== "End") return null;
  const from = e.target as HTMLElement;
  if (from.getAttribute("role") !== "radio") return null;
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')).filter(enabled);
  if (!all.length) return null;
  const i = all.indexOf(from);
  const n = all.length;
  const to = k === "Home" ? 0 : k === "End" ? n - 1 : next ? (i + 1) % n : (i - 1 + n) % n;
  e.preventDefault();
  all[to].focus();
  return all[to];
}

/** Which option of a group is its tab stop: the checked one, else the first that may be chosen (-1 for none). */
export function tabStop<T>(items: T[], checked: (x: T) => boolean, ok: (x: T) => boolean = () => true): number {
  const c = items.findIndex((x) => checked(x) && ok(x));
  return c >= 0 ? c : items.findIndex(ok);
}
