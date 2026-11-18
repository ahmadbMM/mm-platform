"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T as STORE } from "../Store.text";
import { T } from "../sx-B4.text";
import Modal from "../Modal";
import { AfterIcon } from "./icons";
import "../sx-B4.css";

// Add to Home Screen (N05), a step in the page's flow (the order's page, My Account), never a banner: on a phone that is
// not already running the site from its Home Screen. Chrome and Samsung Internet hand over their own install prompt
// (beforeinstallprompt, kept from the moment this file loads, since it fires once and early) and the button opens it;
// Safari has none, so the button opens a centred pop-up with its two steps. On a computer it is not drawn. The site's
// manifest is app/manifest.ts. An iPhone shows web notifications only for a site added to the Home Screen (N04).
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let held: Prompt | null = null;
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); held = e as Prompt; subs.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { held = null; subs.forEach((f) => f()); });
}
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const useHeld = () => useSyncExternalStore(sub, () => held, () => null);
const never = () => () => {};
type Kind = "ios" | "phone" | null;
// a phone or a tablet, not already standalone; an iPad says it is a Mac, so it is told apart by its touch screen
const kindNow = (): Kind => {
  if (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return null;
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  return /Android|Mobile/.test(ua) ? "phone" : null;
};
const useKind = () => useSyncExternalStore(never, kindNow, () => null);

export default function HomeScreen({ className = "" }: { className?: string }) {
  const t = useLocalize(T);
  const s = useLocalize(STORE);
  const kind = useKind();
  const prompt = useHeld();
  const [steps, setSteps] = useState(false);
  const [gone, setGone] = useState(false);
  // a phone that is not Safari and has no prompt to give (Firefox, or already installed) gets nothing to tap
  if (!kind || gone || (kind === "phone" && !prompt)) return null;

  async function go() {
    if (prompt) {
      try { await prompt.prompt(); const c = await prompt.userChoice; if (c.outcome === "accepted") setGone(true); } catch { /* the browser said no */ }
      held = null; subs.forEach((f) => f());
      return;
    }
    setSteps(true);
  }
  return (
    <>
      <button type="button" className={`bk-btn2 sxb-act ${className}`.trim()} onClick={go}><AfterIcon name="homeAdd" size={18} />{t.homeAdd}</button>
      {steps && (
        <Modal title={t.homeAdd} onClose={() => setSteps(false)} closeLabel={s.close}>
          <ol className="sxb-steps">
            <li><span className="sxb-step-ic"><AfterIcon name="share" size={22} /></span>{t.homeStep1}</li>
            <li><span className="sxb-step-ic"><AfterIcon name="homeAdd" size={22} /></span>{t.homeStep2}</li>
          </ol>
        </Modal>
      )}
    </>
  );
}
