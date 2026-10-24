import { describe, expect, it } from "vitest";
import { ibanGroups, receiptOk, VL_BANK, vlBankWords, vlTicketAmount, vlTicketBody, vlTicketView } from "../vl-ticket";
import { ticketRow, ticketSession } from "../tickets";
import { T as TICKET } from "@/components/booking/tickets.text";
import { serverLocalize } from "@/i18n/dicts";
import { LOCALE_CODES } from "@/i18n/locales";

// Victory Lap: a ticket, or buy one (the owner, 2026-10-23; the booking app's _vtTkHtml / customer_vl_ticket).
describe("Victory Lap ticket question", () => {
  const row = (o: Record<string, unknown>) => ticketRow({ id: "vl1", session_id: "s1", session_date: "2099-10-26", status: "waiting", price: 150, paid: false, ...o })!;

  it("reads the answer from my_bookings, and nothing on a database without the column", () => {
    expect(row({}).vlTicket).toBeUndefined();
    expect(row({ vl_ticket: null }).vlTicket).toBeNull();
    expect(row({ vl_ticket: "have" }).vlTicket).toBe("have");
    expect(row({ vl_ticket: "buy", vl_receipt_at: "2099-10-21T10:00:00Z" })).toMatchObject({ vlTicket: "buy", vlReceiptAt: "2099-10-21T10:00:00Z" });
    expect(row({ vl_ticket: "maybe" }).vlTicket).toBeNull();
  });

  it("shows the question, the answer, the receipt to send or the receipt received - and nothing where the app shows nothing", () => {
    expect(vlTicketView(row({ vl_ticket: null }), false)).toBe("ask");
    expect(vlTicketView(row({ vl_ticket: "have" }), false)).toBe("have");
    expect(vlTicketView(row({ vl_ticket: "buy" }), false)).toBe("buy");
    expect(vlTicketView(row({ vl_ticket: "buy", vl_receipt_at: "2099-10-21T10:00:00Z", paid: true }), false)).toBe("paid");
    // staff confirm each receipt (2026-10-24): until they do, it is sent, not paid
    expect(vlTicketView(row({ vl_ticket: "buy", vl_receipt_at: "2099-10-21T10:00:00Z" }), false)).toBe("sent");
    // staff marked it paid with no answer: nothing asked; with an answer, the answer stays
    expect(vlTicketView(row({ vl_ticket: null, paid: true }), false)).toBe("none");
    expect(vlTicketView(row({ vl_ticket: "buy", paid: true }), false)).toBe("buy");
    // waitlist, done, a past card, a database without the column
    expect(vlTicketView(row({ vl_ticket: null, status: "waitlist" }), false)).toBe("none");
    expect(vlTicketView(row({ vl_ticket: null, status: "done" }), false)).toBe("none");
    expect(vlTicketView(row({ vl_ticket: null }), true)).toBe("none");
    expect(vlTicketView(row({}), false)).toBe("none");
    expect(vlTicketView(undefined, false)).toBe("none");
  });

  it("reads the answer a ticket posts: have, or buy with or without a receipt picture", () => {
    const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect(vlTicketBody({ entryId: "vl1", answer: "have" })).toEqual({ entryId: "vl1", answer: "have", img: null });
    expect(vlTicketBody({ entryId: "vl1", answer: " BUY " })).toEqual({ entryId: "vl1", answer: "buy", img: null });
    expect(vlTicketBody({ entryId: "vl1", answer: "buy", img: jpg })).toEqual({ entryId: "vl1", answer: "buy", img: jpg });
    expect(vlTicketBody({ entryId: "vl1", answer: "have", img: jpg })).toBeNull(); // a picture only with buy
    expect(vlTicketBody({ entryId: "vl1", answer: "buy", img: "data:image/gif;base64,R0lGOD==" })).toBeNull();
    expect(vlTicketBody({ entryId: "vl1", answer: "buy", img: "https://example.test/x.jpg" })).toBeNull();
    expect(vlTicketBody({ entryId: "../x", answer: "have" })).toBeNull();
    expect(vlTicketBody({ entryId: "vl1", answer: "yes" })).toBeNull();
    expect(vlTicketBody(null)).toBeNull();
    expect(receiptOk(`data:image/png;base64,${"A".repeat(3_000_001)}`)).toBe(false);
    expect(receiptOk("data:image/webp;base64,UklGRg==")).toBe(true);
  });

  it("gives the organiser's account as the booking app does", () => {
    expect(ibanGroups(VL_BANK.iban)).toBe("SA73 2000 0003 0002 7515 9940");
    expect(VL_BANK.acct).toBe("3000275159940");
    expect(vlBankWords("en")).toEqual({ name: "Sports Fitness Unit Company", bank: "Riyad Bank" });
    expect(vlBankWords("ar")).toEqual({ name: "شركة وحدة اللياقة الرياضية", bank: "بنك الرياض" });
    expect(vlBankWords("ur").bank).toBe("بنك الرياض");
    expect(vlBankWords("fr").name).toBe("Sports Fitness Unit Company");
    expect(VL_BANK.pdf).toBe("/site/victory-lap-bank-letter.pdf");
    // the amount: the session's price, else the row's, else 150 SAR
    expect(vlTicketAmount(150, 0)).toBe(150);
    expect(vlTicketAmount(null, 175)).toBe(175);
    expect(vlTicketAmount(undefined, 0)).toBe(150);
    expect(ticketSession({ id: "s1", session_date: "2099-10-26", ride_kind: "vlap", price: 150 })?.price).toBe(150);
  });

  it("has its words in every language, never about cycling", () => {
    const keys = Object.keys(TICKET.en).filter((k) => k.startsWith("vt")) as (keyof typeof TICKET.en)[];
    expect(keys.length).toBe(28); // vtSentNote (2026-10-24): a receipt waits for staff
    expect(Object.keys(TICKET.ar).filter((k) => k.startsWith("vt")).sort()).toEqual([...keys].sort());
    for (const l of LOCALE_CODES) {
      const t = serverLocalize(TICKET, l);
      for (const k of keys) {
        const v = t[k] as string;
        expect(v, `${l} ${k}`).toBeTruthy();
        if (l !== "en" && !["vtIban", "vtBank"].includes(k)) expect(v, `${l} ${k} is translated`).not.toBe(TICKET.en[k]);
        expect(v, `${l} ${k}`).not.toMatch(/\b(?:bike|bicycle|cycling|ride|riding)\b/i);
      }
    }
    // the booking app's own words in its languages
    expect(serverLocalize(TICKET, "fr").vtQ).toBe("Avez-vous déjà un billet, ou souhaitez-vous en acheter un ?");
    expect(serverLocalize(TICKET, "ur").vtHave).toBe("میرے پاس پہلے سے ٹکٹ ہے");
    expect(TICKET.ar.vtBuy).toBe("أريد شراء تذكرة");
  });
});
