"use client";

// PLACEHOLDER (the foundation's): the contact builder (W3) replaces this file and keeps its props. A shop's contact
// buttons on its page (phone, WhatsApp, map), for signed-in accounts: the two numbers are asked for only when the
// visitor taps (/api/market/contact/shop), never sent with the page. Until it is built it draws nothing.
//   slug       the shop's slug
//   name       the shop's trade name in the page's language (a WhatsApp message names it)
//   signedIn   whether the page was drawn for a signed-in account (a visitor is sent to sign in)
//   mapUrl     the shop's map link, which anyone may open (the shop's map_url), or null
export type ShopContactProps = { slug: string; name: string; signedIn: boolean; mapUrl: string | null; className?: string };

export default function ShopContact(props: ShopContactProps) {
  void props;
  return null;
}
