"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./sx-B2.text";
import { B2Icon } from "./sx-B2-icons";
import "./sx-B2.css";

// N01 (the "do all" build of 2026-11-18): one drawn Share mark. On a phone or a tablet it opens the device's own share
// sheet (navigator.share: WhatsApp, Messages ...); on a computer it copies the link and says so on the button itself for
// a moment (a tick and "Link copied", read out), no pop-up and no bar. The address is read at the tap, so it carries the
// size and colour picked by then.
const never = () => () => {};
/** A touch device with the share sheet: phones and tablets; a computer copies instead. */
function useSheet(): boolean {
  return useSyncExternalStore(never, () => {
    try { return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
  }, () => false);
}

export default function ShareButton({ url, title, className = "" }: { url: () => string; title: string; className?: string }) {
  const t = useLocalize(T);
  const sheet = useSheet();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function go() {
    const href = url();
    if (sheet) {
      try { await navigator.share({ title, url: href }); return; } catch (e) { if ((e as { name?: string } | null)?.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard here (an old browser, a page not allowed to write it): the share sheet when there is one
      try { if (typeof navigator.share === "function") await navigator.share({ title, url: href }); } catch { /* closed */ }
    }
  }

  const label = copied ? t.copied : sheet ? t.share : t.copyLink;
  return (
    <>
      <button type="button" className={`st-b2-share${copied ? " is-done" : ""} ${className}`.trim()} onClick={go} aria-label={label} title={label}>
        <B2Icon name={copied ? "tick" : "share"} size={20} />
      </button>
      <span className="st-sr" aria-live="polite">{copied ? t.copied : ""}</span>
    </>
  );
}
