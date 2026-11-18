"use client";

import { useSyncExternalStore } from "react";
import { keyboardUp } from "@/lib/sx-b6";

// Whether the phone's keyboard is up (EM04-B, 2026-11-18): the booking's one fixed bar steps aside while a field is
// being typed in, so it never covers the field or the keyboard's own row. iOS shrinks only the visual viewport when the
// keyboard opens, so the gap between the two viewports says it; a focused text field must be there too (a pinch zoom
// shrinks the visual viewport as well).
const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';

function read(): boolean {
  if (typeof window === "undefined") return false;
  const vv = window.visualViewport;
  const el = document.activeElement;
  return keyboardUp(window.innerHeight, vv ? vv.height : window.innerHeight, !!el && el instanceof HTMLElement && el.matches(FIELD));
}

function subscribe(cb: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", cb);
  document.addEventListener("focusin", cb);
  document.addEventListener("focusout", cb);
  return () => {
    vv?.removeEventListener("resize", cb);
    document.removeEventListener("focusin", cb);
    document.removeEventListener("focusout", cb);
  };
}

export function useKeyboardUp(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
