// The Marketplace's contact side (W3): the plain rules of the Contact button, the first-message pop-up, the inbox, a
// thread, a report, a shop's contact buttons and the unread number, kept apart from their components so they can be
// tested. Browser-safe: it imports nothing only a server has. The shapes are lib/market/core.ts's, with the database's
// own field names; the words are components/market/w3.text.ts and Market.text.ts.
import { SIGNIN_PATH, withNext } from "../signup";
import {
  MK_MESSAGE_MAX, MK_REPORT_REASONS, inboxHref, isMkError, listingHref, mkClean, mkHasLink, mkHasPhone, mkPick, mkWaHref,
  type MkError, type MkMessage, type MkOther, type MkReportReason, type MkReportTarget, type MkSellerKind, type MkStatus, type MkThreadListing,
} from "./core";

/* ------------------------------------------------------------------ a route's answer, read in the browser */

export type MkFail = { ok: false; error: MkError; detail: string };
/** What a Marketplace route answered: its own fields with ok true, or the error id and the detail word. */
export type MkReply<T> = ({ ok: true } & T) | MkFail;
/** A route's JSON read safely: anything that is not {ok: true, ...} is a refusal, and one with no known error id is
 *  "generic". */
export function mkReply<T>(raw: unknown): MkReply<T> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const b = raw as Record<string, unknown>;
    if (b.ok === true) return b as { ok: true } & T;
    if (isMkError(b.error)) return { ok: false, error: b.error, detail: typeof b.detail === "string" ? b.detail : "" };
  }
  return { ok: false, error: "generic", detail: "" };
}

/* ------------------------------------------------------------------ signing in and coming back */

/** The mark a listing's address carries back from the sign-in: the first-message pop-up opens at once. */
export const MK_CONTACT_HASH = "#mk-contact";
/** The sign-in page, coming back to `next` (a path on this site) once signed in. */
export const signInHref = (next: string): string => withNext(SIGNIN_PATH, next);

/* ------------------------------------------------------------------ the Contact button */

export type ContactMode = "mine" | "company" | "thread" | "signin" | "write" | "none";
/** What the Contact button is on a listing's page.
 *   mine      the reader's own listing: a link to My listings
 *   company   MicroMobility's own listing: a WhatsApp link to MicroMobility's number (nothing when staff set none)
 *   thread    the reader already wrote about it: a link to that conversation (it stays readable once the listing is gone)
 *   signin    a visitor with no account: a link to the sign-in, which comes back with the pop-up open
 *   write     the first-message pop-up
 *   none      nothing to show (it is no longer on sale, or one of the two blocked the other) */
export function contactMode(p: { kind: MkSellerKind; signedIn: boolean; threadId: number | null; canMessage: boolean; companyWa?: string | null; mine?: boolean }): ContactMode {
  if (p.mine) return "mine";
  if (p.kind === "company") return mkWaHref(p.companyWa ?? "") ? "company" : "none";
  if (p.threadId) return "thread";
  if (!p.canMessage) return "none";
  return p.signedIn ? "write" : "signin";
}
/** The WhatsApp link of one of MicroMobility's own listings: the message names the item and gives its address, as the
 *  site's other WhatsApp links carry what they are about (lib/ride-help.ts). `hello` is the first line, already written
 *  with the title in it; `site` the site's own address (lib/seo.ts SITE_URL). */
export function companyWaHref(digits: string | null | undefined, hello: string, listingId: number, site: string): string | null {
  return mkWaHref(digits ?? "", `${hello}\n${site.replace(/\/+$/, "")}${listingHref(listingId)}`);
}

/* ------------------------------------------------------------------ names */

/** How a buyer may be named in a thread: "first name and last initial" only when the account has a name to show. */
export const nameModes = (short: string | null | undefined): ("short" | "none")[] => (short && short.trim() ? ["short", "none"] : ["none"]);
/** The other person of a thread as the reader sees them: a shop by its trade name, a person by the name they chose,
 *  and with no name "Buyer" or "Private seller". Nothing else about them is ever known here. */
export function otherName(o: MkOther, locale: string, words: { buyer: string; seller: string }): string {
  if (o.kind === "shop" && o.shop) return mkPick(locale, o.shop.name_en, o.shop.name_ar) || words.seller;
  const name = (o.name ?? "").trim();
  return name || (o.kind === "buyer" ? words.buyer : words.seller);
}

/* ------------------------------------------------------------------ quick replies */

/** The pre-written messages a person can tap (keys of w3.text.ts): a buyer's questions, a seller's answers, and on a
 *  Jeddah listing "Can we meet at the MicroMobility hub?" for either. A tap puts the text in the box; nothing is sent
 *  until Send. */
export type QuickKey = "q_available" | "q_see" | "q_price" | "q_yes" | "q_when" | "q_sold" | "q_hub";
export function quickReplies(role: "buyer" | "seller", hub: boolean): QuickKey[] {
  const own: QuickKey[] = role === "buyer" ? ["q_available", "q_see", "q_price"] : ["q_yes", "q_when", "q_sold"];
  return hub ? [...own, "q_hub"] : own;
}

/* ------------------------------------------------------------------ a message before it is sent */

export type BodyProblem = "empty" | "long" | "link" | "phone";
/** What is wrong with a message as typed, by the database's own tests (cleaned first, as it cleans): nothing to send,
 *  over 1,000 characters, a link, a phone number; null when it can go. The database decides; this saves a round trip. */
export function bodyProblem(text: string): BodyProblem | null {
  const s = mkClean(text);
  if (!s) return "empty";
  if (s.length > MK_MESSAGE_MAX) return "long";
  if (mkHasLink(s)) return "link";
  if (mkHasPhone(s)) return "phone";
  return null;
}

/** What the page does with a message the route refused.
 *   edit    the words themselves were refused (a link, a phone number, too long): they go back in the box to be changed
 *   retry   it may go through later as it is (no connection, too many requests, a cap): it stays, marked not sent, with
 *           Try again
 *   closed  nothing more can be sent here (a block, the listing's state, a paused or under-age account, a session that
 *           ended): it stays, marked not sent, and the box gives way */
export type SendOutcome = "edit" | "retry" | "closed";
export function sendOutcome(error: MkError): SendOutcome {
  if (error === "link" || error === "phone" || error === "input" || error === "too_big") return "edit";
  if (error === "blocked" || error === "state" || error === "gone" || error === "suspended" || error === "adult" || error === "birth" || error === "signin" || error === "own") return "closed";
  return "retry";
}

/* ------------------------------------------------------------------ a thread's messages */

/** A message the reader sent that the database has not answered for yet, or refused. */
export type MkPending = { key: string; body: string; state: "sending" | "failed"; error?: MkError; detail?: string; retry?: boolean };

/** Two readings of a thread's messages as one list: each message once (the newer reading's copy), oldest first. A poll
 *  answers the latest hundred, "load earlier" the hundred before; both are merged into what the page already shows. */
export function mergeMessages(have: readonly MkMessage[], got: readonly MkMessage[]): MkMessage[] {
  const byId = new Map<number, MkMessage>();
  for (const m of have) byId.set(m.id, m);
  for (const m of got) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
/** The newest message's number (0 for none): what a poll compares to know something arrived. */
export const lastId = (list: readonly MkMessage[]): number => (list.length ? list[list.length - 1].id : 0);

/** How long to wait before asking again while the thread's page is in view: 15 seconds while the talk is going, 30
 *  after two quiet minutes, a minute after ten. The page asks nothing while it is hidden. */
export function pollDelay(quietMs: number): number {
  if (quietMs < 120_000) return 15_000;
  if (quietMs < 600_000) return 30_000;
  return 60_000;
}
/** The inbox asks again every 45 seconds while in view. */
export const INBOX_POLL_MS = 45_000;
/** The unread number is asked for again every 90 seconds while a page is in view, for a signed-in visitor only. */
export const UNREAD_POLL_MS = 90_000;

/* ------------------------------------------------------------------ when */

const RIYADH_MS = 3 * 3_600_000; // Riyadh keeps UTC+3 all year
/** The Riyadh day of a moment, as YYYY-MM-DD; "" for something that is not a time. */
export function riyadhDay(when: string | number): string {
  const ms = typeof when === "number" ? when : Date.parse(when);
  return Number.isFinite(ms) ? new Date(ms + RIYADH_MS).toISOString().slice(0, 10) : "";
}
/** Whether a moment is on today's Riyadh day: the inbox writes the hour for today's last message and the day otherwise. */
export const isToday = (when: string, now: number = Date.now()): boolean => !!riyadhDay(when) && riyadhDay(when) === riyadhDay(now);
/** The messages a new Riyadh day begins with (their numbers): a thread writes the day above each of them. The list is
 *  oldest first. */
export function dayStarts(list: readonly MkMessage[]): Set<number> {
  const out = new Set<number>();
  let day = "";
  for (const m of list) {
    const d = riyadhDay(m.at);
    if (d && d !== day) { out.add(m.id); day = d; }
  }
  return out;
}

/* ------------------------------------------------------------------ the listing a thread is about */

/** Whether the listing is still on sale; a thread on one that is not stays readable, with its state said. */
export const onSale = (status: MkStatus): boolean => status === "live" || status === "reserved";
/** The words of a thread's listing state (keys of Market.text.ts and w3.text.ts): nothing while it is simply on sale,
 *  "Reserved", "Sold", and "No longer on sale" for every other state, which says nothing of why. */
export function listingMark(status: MkStatus): "status_reserved" | "status_sold" | "offSale" | null {
  if (status === "live") return null;
  if (status === "reserved") return "status_reserved";
  if (status === "sold") return "status_sold";
  return "offSale";
}
/** Where a thread's listing card leads: the listing's page while anyone can open it, and for its seller in every state
 *  but a deleted one; null when the page would not open. */
export function threadListingHref(l: Pick<MkThreadListing, "id" | "status">, role: "buyer" | "seller"): string | null {
  if (onSale(l.status)) return listingHref(l.id);
  if (role === "seller" && l.status !== "deleted" && l.status !== "draft") return listingHref(l.id);
  return null;
}

/* ------------------------------------------------------------------ reports */

/** The reasons a report offers, in the order shown: a listing's are about the item, a conversation's about the person. */
export function reportReasons(target: MkReportTarget): MkReportReason[] {
  const list: MkReportReason[] = target === "listing"
    ? ["prohibited", "counterfeit", "stolen", "misleading", "scam", "spam", "other"]
    : ["scam", "abuse", "spam", "other"];
  return list.filter((r) => (MK_REPORT_REASONS as readonly string[]).includes(r));
}
/** Where a report's sign-in comes back to. */
export const reportBackHref = (target: MkReportTarget, refId: number): string => (target === "listing" ? listingHref(refId) : inboxHref(refId));

/* ------------------------------------------------------------------ numbers and links */

/** A phone number as it is shown (digits, country code first): "+966 50 123 4567" for a Saudi mobile, "+966 12 345 6789"
 *  for a Saudi landline, and "+<digits>" for anything else. Always written left to right. */
export function phoneShown(digits: string | null | undefined): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (!d) return "";
  const sa = /^966(\d{2})(\d{3})(\d{4})$/.exec(d);
  return sa ? `+966 ${sa[1]} ${sa[2]} ${sa[3]}` : `+${d}`;
}
/** A number to call: tel:+<digits>, or null when it is not 8 to 15 digits. */
export function telHref(digits: string | null | undefined): string | null {
  const d = (digits ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? `tel:+${d}` : null;
}
/** A shop's map link as the database takes one (a Google Maps address over https); null for anything else, so a page
 *  never links to an address of another kind. */
export function mapHref(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  return u.length <= 300 && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)[/?]/.test(u) ? u : null;
}
/** A shop's slug as its address carries it. */
export const isShopSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 40;

/** The unread number as the badge writes it: nothing for none, "99+" above 99. */
export function unreadText(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}
