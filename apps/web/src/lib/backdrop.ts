import type { MouseEvent } from "react";

/** A tap on a modal dialog's backdrop: the click is the dialog's own AND lands outside its box. A dialog with padding
 *  is its own target in that padding and in the gaps between its parts too, and a tap there is not one outside
 *  (bug hunt 2026-11-18: the share picture's pop-up closed under a thumb aiming at its button). */
export function onBackdrop(e: MouseEvent<HTMLDialogElement>): boolean {
  if (e.target !== e.currentTarget) return false;
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
