import { ENTRY_ID } from "./rating";
import type { TicketRow } from "./tickets";

// Victory Lap: a ticket, or buy one (the owner, 2026-10-23; the booking app's _vtTkHtml / renderVtGate,
// rentals migration 20261023160000). A booked Victory Lap place asks "Do you already have a ticket, or
// would you like to buy one?". Have one: saved, nothing more is asked. Buy one: the organiser's bank
// details and their bank letter (PDF), then a picture of the transfer receipt, which the database keeps
// (vl_receipts) and which marks the booking paid by transfer. The booking app asks it in a pop-up right
// after the place is booked; the site, which books nothing, asks it on the ticket (VlTicket), whose
// buttons open the same pop-up. The answer goes through customer_vl_ticket (app/api/account/vl-ticket).

export type VlTicketAnswer = "have" | "buy";

/** The organiser's account (the booking app's VL_BANK): Sports Fitness Unit Company at Riyad Bank, and
 *  their bank letter, served from the site's own files. */
export const VL_BANK = {
  name: "Sports Fitness Unit Company",
  nameAr: "شركة وحدة اللياقة الرياضية",
  bank: "Riyad Bank",
  bankAr: "بنك الرياض",
  iban: "SA7320000003000275159940",
  acct: "3000275159940",
  pdf: "/site/victory-lap-bank-letter.pdf",
} as const;

/** The account's name and bank in the reader's language: Arabic on the Arabic and Urdu pages, as the booking app does. */
export const vlBankWords = (locale: string): { name: string; bank: string } =>
  locale === "ar" || locale === "ur" ? { name: VL_BANK.nameAr, bank: VL_BANK.bankAr } : { name: VL_BANK.name, bank: VL_BANK.bank };

/** An IBAN as it is read out, in groups of four (_vtIbanFmt). */
export const ibanGroups = (v: string): string => v.replace(/(.{4})/g, "$1 ").trim();

/** The amount to transfer: the session's price, else the row's, else 150 SAR (Victory Lap's price per athlete). */
export const vlTicketAmount = (sessionPrice: number | null | undefined, rowPrice: number | null | undefined): number =>
  sessionPrice != null && sessionPrice > 0 ? sessionPrice : rowPrice != null && rowPrice > 0 ? rowPrice : 150;

/** The receipt picture as the database takes it (vl_receipts_img_chk): a JPEG, PNG or WebP data: URL of 3 MB at most. */
export const RECEIPT_MAX = 3_000_000;
export const receiptOk = (v: unknown): v is string =>
  typeof v === "string" && v.length <= RECEIPT_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

/** The answer a ticket posts, read safely: {entryId, answer, img} with a booking id, 'have' or 'buy', and
 *  a receipt only with 'buy'; else null. */
export function vlTicketBody(body: unknown): { entryId: string; answer: VlTicketAnswer; img: string | null } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const a = typeof b.answer === "string" ? b.answer.trim().toLowerCase() : "";
  if (a !== "have" && a !== "buy") return null;
  const img = b.img == null || b.img === "" ? null : b.img;
  if (img !== null && (a !== "buy" || !receiptOk(img))) return null;
  return { entryId: b.entryId, answer: a, img };
}

/** What the ticket's line shows (_vtTkHtml): nothing (a past, done or waitlisted place; a database
 *  without the question yet; a place staff marked paid with no answer), the question, "You have a
 *  ticket", the receipt still to send, or the receipt received. */
export type VlTicketView = "none" | "ask" | "have" | "buy" | "paid";
export function vlTicketView(r: Pick<TicketRow, "status" | "paid" | "vlTicket" | "vlReceiptAt"> | undefined, past: boolean): VlTicketView {
  if (!r || past || r.vlTicket === undefined || r.status === "done" || r.status === "waitlist") return "none";
  if (r.vlReceiptAt) return "paid";
  if (r.vlTicket === "have") return "have";
  if (r.vlTicket === "buy") return "buy";
  return r.paid ? "none" : "ask";
}
