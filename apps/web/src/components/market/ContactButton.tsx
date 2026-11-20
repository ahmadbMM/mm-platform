"use client";

import { useLocalize } from "@/i18n/TxProvider";
import type { MkSellerKind } from "@/lib/market/core";
import MkIcon from "./MkIcon";
import { T } from "./Market.text";

// PLACEHOLDER (the foundation's): the contact builder (W3) replaces this file and keeps its props. The button a listing
// page shows to reach the seller, worded by who is selling: "Contact seller" opens the first-message pop-up (or the
// reader's own thread when they have one), "Contact shop" the same for a shop, and a MicroMobility listing opens
// WhatsApp to MicroMobility's own number with the item named. Until it is built it draws the button, switched off.
//   listingId   the listing's number
//   title       the listing's title (the WhatsApp message names it; the pop-up shows it)
//   kind        the listing's seller.kind
//   city        the listing's city key (Jeddah offers "Can we meet at the MicroMobility hub?")
//   signedIn    whether the page was drawn for a signed-in account
//   threadId    the reader's own thread on this listing, or null (the listing's thread_id)
//   canMessage  the listing's can_message: false draws no button for a private seller's or a shop's listing
//   companyWa   MicroMobility's own WhatsApp number (digits, country code first), for its own listings
export type ContactButtonProps = {
  listingId: number; title: string; kind: MkSellerKind; city: string; signedIn: boolean;
  threadId: number | null; canMessage: boolean; companyWa?: string | null; className?: string;
};

export default function ContactButton({ kind, canMessage, className = "" }: ContactButtonProps) {
  const t = useLocalize(T);
  if (kind !== "company" && !canMessage) return null;
  return (
    <button type="button" className={`mk-btn${className ? ` ${className}` : ""}`} disabled data-mk-placeholder="contact">
      <MkIcon name={kind === "company" ? "whatsapp" : "chat"} size={18} />
      {kind === "company" ? t.contactCompany : kind === "shop" ? t.contactShop : t.contactSeller}
    </button>
  );
}
