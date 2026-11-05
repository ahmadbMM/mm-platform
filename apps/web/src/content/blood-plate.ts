import { isRtl } from "@/i18n/locales";

// The Blood Donation event's plate (content/blood-words.ts), which holds none of its words: on staging the ticket
// (components/booking/TicketCard.tsx) is drawn in the browser too, after a booking (BookingFlow), and that file's words
// stay on the server. The ticket's own words come from the page, in its `blood` prop.

/** All five marks on their white plate, one image: MicroMobility above a hairline, the four partners in one row (the booking app's _bldLogosImg). */
export const bloodPlate = (locale: string): string => (isRtl(locale) ? "/site/blood-partners-rtl.webp?v=3" : "/site/blood-partners.webp?v=3");
/** The plate's own size, so a page keeps its room before it loads. */
export const BLOOD_PLATE_SIZE = { width: 1503, height: 433 };
