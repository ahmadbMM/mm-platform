"use client";

// What every page of My Account's menu shares (the user, 2026-11-19; the booking app's _accPgSave, _accLeave): one Save
// per page, which says Saving… and then Saved (with a tick) until the next edit, and says so to a screen reader too -
// no toast, no bar; a refusal under the form; and, while a page holds edits not saved, a centred question before
// anything leaves it (a menu row, Back, the switch, the profile card: Discard / Keep editing), and the browser's own
// before the page is closed. After a Save the page is drawn again from the server (router.refresh), so the menu's row
// says the new value.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { AccWords } from "./AccountMenu.words";
import AccIcon from "./AccIcon";

// ── Unsaved edits ─────────────────────────────────────────────────────────────────────────────────────────────────────
let dirty = false;
const subs = new Set<() => void>();
function setDirty(v: boolean) { if (dirty !== v) { dirty = v; subs.forEach((f) => f()); } }
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** A page reports whether it holds edits not saved; leaving the page forgets them. */
export function useDirty(on: boolean) {
  useEffect(() => { setDirty(on); }, [on]);
  useEffect(() => () => setDirty(false), []);
}
const useIsDirty = () => useSyncExternalStore(sub, () => dirty, () => false);

/** A page opened from the menu, for its heading to take the focus (research rule 10). */
let opened = false;

/** The guard: one per account page. While the page holds edits, a link to anywhere on the site (a menu row, Back, the
 *  switch, the header) asks first; leaving the site or closing the tab is the browser's own question (beforeunload). */
export function AccGuard({ w }: { w: AccWords }) {
  const router = useRouter();
  const isDirty = useIsDirty();
  const box = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // this page itself (a #link)
      if (a.closest(".acm-menu") || a.classList.contains("acm-back")) opened = true;
      if (!dirty) return;
      e.preventDefault();
      e.stopPropagation();
      setTo(url.pathname + url.search + url.hash);
      box.current?.showModal();
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const discard = () => {
    box.current?.close();
    setDirty(false);
    if (to) router.push(to);
  };
  return (
    <dialog ref={box} className="acm-dlg" aria-labelledby="acm-dlg-h" onClick={(e) => { if (e.target === e.currentTarget) box.current?.close(); }}>
      <h2 id="acm-dlg-h">{w.discardQ}</h2>
      <div className="acm-dlg-btns">
        <button type="button" className="acm-btn acm-btn-red" onClick={discard}>{w.discard}</button>
        <button type="button" className="acm-btn acm-btn-line" onClick={() => box.current?.close()}>{w.keepEditing}</button>
      </div>
    </dialog>
  );
}

/** The open page's heading takes the focus when the page was opened from the menu (not on a first load). */
export function AccFocus({ target }: { target: string }) {
  useEffect(() => {
    if (!opened) return;
    opened = false;
    const h = document.getElementById(target);
    if (h) try { h.focus({ preventScroll: true }); } catch { /* an old browser: no focus moved */ }
  }, [target]);
  return null;
}

// ── Save ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type SaveState = "idle" | "busy" | "saved";

/** A page's Save and what it says: Save, Saving…, Saved with a tick (until the next edit). */
export function useSave() {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [err, setErr] = useState("");
  /** An edit: Saved goes back to Save, and a refusal goes. */
  const edited = useCallback(() => { setState((s) => (s === "saved" ? "idle" : s)); setErr(""); }, []);
  /** Runs a save; true once it went through (the page is then drawn again from the server). */
  const run = useCallback(async (job: () => Promise<string | null>) => {
    setErr("");
    setState("busy");
    let problem: string | null;
    try { problem = await job(); } catch { problem = "conn"; }
    if (problem) { setState("idle"); setErr(problem); return false; }
    setState("saved");
    router.refresh();
    return true;
  }, [router]);
  return { state, err, setErr, edited, run };
}

export function SaveRow({ state, err, w, label }: { state: SaveState; err: string; w: AccWords; label?: string }) {
  return (
    <>
      {err && <p className="acm-err" role="alert">{err}</p>}
      <div className="acm-save-row">
        <button type="submit" className={`acm-btn acm-save${state === "saved" ? " is-saved" : ""}`} aria-disabled={state === "busy" || undefined}>
          {state === "saved" ? <><AccIcon name="tick" size={18} /> {w.saved}</> : state === "busy" ? w.saving : label ?? w.save}
        </button>
      </div>
      <p className="acm-sr" aria-live="polite">{state === "saved" ? w.saved : ""}</p>
    </>
  );
}

/** A POST of JSON to one of the account's routes, with its answer ({ok, error}). */
export async function postAcc<T extends Record<string, unknown>>(url: string, body: unknown): Promise<T & { ok?: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "generic" }))) as T & { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "conn" } as T & { ok?: boolean; error?: string };
  }
}

/** The profile route's refusal (lib/account-profile.ts cleanChanges, profileError) in the rider's words. */
export function profileProblem(code: string | undefined, w: AccWords): string {
  switch (code) {
    case "name_chars": return w.errNameChars;
    case "name_short": return w.errNameShort;
    case "name_missing": return w.errName;
    case "email": return w.errEmail;
    case "phone": case "contact": return w.errPhone;
    case "height": return w.errHeight;
    case "birth_future": return w.errDobFuture;
    case "birth_young": return w.errDobYoung;
    case "birth_old": return w.errDobPart;
    case "profession": return w.errProfession;
    case "workplace": return w.errWorkplace;
    case "phone_taken": return w.errPhoneTaken;
    case "email_taken": return w.errEmailTaken;
    case "rate": return w.errBusy;
    case "heard": case "gender": case "type": case "country": case "city": case "nationality": return w.errPick;
    default: return w.errConn;
  }
}
