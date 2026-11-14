// "Pay at the booth" while rides are paid when booking (2026-11-14). The site's default words say payment is collected at
// the circuit's booth; once staff make paid rides paid online when booking (pay.bookings 'required'), those words would
// tell a payer the opposite of the review step and the Terms' Paying online clause, so the pages leave them out. Only
// the words as written by default are matched: a card or a line staff rewrote stays as they wrote it.

/** The Terms' Rides and rentals line (content/pages/terms.ts), in English and Arabic. */
export const BOOTH_TERMS_LINES: ReadonlySet<string> = new Set([
  "- At the Corniche Circuit, payment is collected at our booth when you arrive. Please have your queue number ready.",
  "- في حلبة الكورنيش، يتم الدفع عند الكشك عند وصولك. يرجى إحضار رقم طابورك.",
]);

/** A Terms clause's body without the booth line; the same text when it has none. */
export function withoutBoothLine(body: string): string {
  const lines = body.split("\n");
  const kept = lines.filter((l) => !BOOTH_TERMS_LINES.has(l.trim()));
  return kept.length === lines.length ? body : kept.join("\n");
}

/** Experiences' Good to know card about paying at the booth (content/pages/experiences.ts), by its title. */
export const isBoothCard = (title: string) => ["pay at the booth", "الدفع عند الكشك"].includes(title.trim().toLowerCase());
