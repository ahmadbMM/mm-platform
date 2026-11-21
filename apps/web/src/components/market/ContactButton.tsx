"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_MINE, inboxHref, listingHref, type MkSellerKind } from "@/lib/market/core";
import { MK_CONTACT_HASH, companyWaHref, contactMode, signInHref } from "@/lib/market/w3";
import { SITE_URL } from "@/lib/seo";
import MkIcon from "./MkIcon";
import { T as S } from "./Market.text";
import FirstMessage from "./w3/FirstMessage";
import { T } from "./w3.text";
import "./w3.css";

// The button a listing's page shows to reach the seller, worded by who is selling (lib/market/w3.ts contactMode):
//   a private seller's or a shop's listing   "Contact seller" / "Contact shop" opens the first-message pop-up
//                                            (./w3/FirstMessage.tsx); a visitor with no account is sent to sign in
//                                            and comes back to the listing with the pop-up open; a buyer who already
//                                            wrote gets "Open conversation", to their thread in the inbox
//   MicroMobility's own listing              "Ask on WhatsApp": a link to MicroMobility's number with the item named
//                                            and its address, for anyone, with no thread
//   the reader's own listing                 a link to My listings in its place
// It draws nothing when no message can be sent (the listing is no longer on sale, or one of the two blocked the
// other: the page does not say which).
//   listingId   the listing's number
//   title       the listing's title (the WhatsApp message names it; the pop-up shows it)
//   kind        the listing's seller.kind
//   city        the listing's city key (Jeddah offers "Can we meet at the MicroMobility hub?")
//   signedIn    whether the page was drawn for a signed-in account
//   threadId    the reader's own thread on this listing, or null (the listing's thread_id)
//   canMessage  the listing's can_message
//   companyWa   MicroMobility's own WhatsApp number (digits, country code first), for its own listings
//   mine        the listing is the reader's own (the listing's `mine`); left out, an own listing draws nothing
export type ContactButtonProps = {
  listingId: number; title: string; kind: MkSellerKind; city: string; signedIn: boolean;
  threadId: number | null; canMessage: boolean; companyWa?: string | null; mine?: boolean; className?: string;
};

export default function ContactButton({ listingId, title, kind, city, signedIn, threadId, canMessage, companyWa, mine, className = "" }: ContactButtonProps) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const [open, setOpen] = useState(false);
  const mode = contactMode({ kind, signedIn, threadId, canMessage, companyWa, mine });
  // Back from the sign-in with the mark in the address: the pop-up opens by itself, once, in whichever of the page's
  // two buttons gets there first, and the mark leaves the address so a reload does not open it again.
  useEffect(() => {
    if (mode !== "write" || window.location.hash !== MK_CONTACT_HASH) return;
    const id = requestAnimationFrame(() => {
      if (window.location.hash !== MK_CONTACT_HASH) return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const cls = `mk-btn${className ? ` ${className}` : ""}`;
  const label = kind === "shop" ? s.contactShop : s.contactSeller;
  if (mode === "none") return null;
  if (mode === "mine") {
    return <Link className={`mk-btn2${className ? ` ${className}` : ""}`} href={MK_MINE}><MkIcon name="tag" size={18} />{s.myListings}</Link>;
  }
  if (mode === "company") {
    const href = companyWaHref(companyWa, w.waCompany(title), listingId, SITE_URL);
    if (!href) return null;
    return <a className={cls} href={href} target="_blank" rel="noopener noreferrer"><MkIcon name="whatsapp" size={18} />{s.contactCompany}</a>;
  }
  if (mode === "thread") {
    return <Link className={cls} href={inboxHref(threadId)}><MkIcon name="chat" size={18} />{w.openChat}</Link>;
  }
  if (mode === "signin") {
    return <a className={cls} href={signInHref(listingHref(listingId) + MK_CONTACT_HASH)}><MkIcon name="chat" size={18} />{label}</a>;
  }
  return (
    <>
      <button type="button" className={cls} onClick={() => setOpen(true)} aria-haspopup="dialog"><MkIcon name="chat" size={18} />{label}</button>
      {open && <FirstMessage listingId={listingId} title={title} kind={kind} city={city} onClose={() => setOpen(false)} />}
    </>
  );
}
