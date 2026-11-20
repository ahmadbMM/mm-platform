"use client";

import { useState } from "react";
import { listingHref } from "@/lib/market/core";
import MkIcon from "../MkIcon";

// "Share" on one of the seller's own listings: the phone's own share sheet with the listing's address (so it goes to
// the seller's groups with the listing page's own preview), or, where a browser has none, the address copied, the
// button saying "Link copied" for a moment. Nothing is shared but the address and the title the seller wrote.
export default function ShareButton({ id, title, label, copied, className, iconOnly = false }: { id: number; title: string; label: string; copied: string; className: string; iconOnly?: boolean }) {
  const [said, setSaid] = useState(false);
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSaid(true);
      window.setTimeout(() => setSaid(false), 2400);
    } catch { /* no clipboard here: nothing to say */ }
  }
  async function share() {
    const url = `${window.location.origin}${listingHref(id)}`;
    if (typeof navigator.share !== "function") return copy(url);
    try { await navigator.share({ title, url }); } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy(url); // closed without sharing is not a failure
    }
  }
  return (
    <button type="button" className={className} onClick={() => void share()} aria-label={iconOnly ? (said ? copied : label) : undefined} title={iconOnly ? label : undefined}>
      <MkIcon name={said ? "tick" : "share"} size={18} />
      {iconOnly ? <span className="mm-sr" role="status">{said ? copied : ""}</span> : <span role="status">{said ? copied : label}</span>}
    </button>
  );
}
