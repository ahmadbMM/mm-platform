"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import MkIcon from "../MkIcon";
import { T as W } from "../w1.text";

// "Share" on a listing's page: the phone's own share sheet where the browser has one, else the page's address is
// copied and the button says so for a moment (and a screen reader is told). The address shared is the plain one, with
// no language in it, so whoever opens it reads the page in their own.
//   path    the page's address on the site ("/marketplace/123")
//   title   what is shared with it (the listing's title)
export default function ShareButton({ path, title, className = "" }: { path: string; title: string; className?: string }) {
  const w = useLocalize(W);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, url }); return; } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // the visitor closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch { /* a browser that will not copy: nothing is claimed */ }
  }

  return (
    <>
      <button type="button" className={`mk-link${className ? ` ${className}` : ""}`} onClick={share}>
        <MkIcon name={copied ? "tick" : "share"} size={16} />{copied ? w.copied : w.share}
      </button>
      <span className="mm-sr" role="status">{copied ? w.copied : ""}</span>
    </>
  );
}
