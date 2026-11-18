"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./sx-B6.text";
import "./sx-B6.css";

// A gift's link opened on Experiences (EF20; the user, 2026-11-18: "do all"): above the booking, what the gift is (a gift
// ride, its bike type, the friend's own first name and message) or that it has been used or has expired; its code is
// already filled in for the review. Never who bought it. Nothing when the code is unknown or the database has no gifts.
const never = () => () => {};
const fromUrl = () => { try { const g = new URLSearchParams(window.location.search).get("gift") ?? ""; return /^GF-[A-Z0-9]{8}$/.test(g) ? g : ""; } catch { return ""; } };

export default function GiftNote({ typeName }: { typeName: (ty: string) => string }) {
  const t = useLocalize(T);
  // read from the address in the browser only (the server draws nothing), so the two drawings agree
  const code = useSyncExternalStore(never, fromUrl, () => "");
  const [g, setG] = useState<{ type: string | null; forName: string | null; note: string | null; status: string } | null>(null);
  useEffect(() => {
    if (!code) return;
    let live = true;
    fetch(`/api/xp/gift?code=${encodeURIComponent(code)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((b: { ok?: boolean; gift?: { type: string | null; forName: string | null; note: string | null; status: string } } | null) => { if (live && b?.ok && b.gift) setG(b.gift); }, () => {});
    return () => { live = false; };
  }, [code]);
  if (!g) return null;
  const off = g.status === "used" ? t.giftUsed : g.status === "expired" || g.status === "void" ? t.giftOld : "";
  return (
    <div className="sx6-gift" role="status">
      <p className="sx6-gift-h">{[g.forName, t.giftGot, g.type ? typeName(g.type) : ""].filter(Boolean).join(" · ")}</p>
      {off ? <p className="sx6-gift-n">{off}</p> : g.note && <p className="sx6-gift-n" dir="auto">{g.note}</p>}
    </div>
  );
}
