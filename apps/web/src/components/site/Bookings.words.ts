// The header's ticket (SiteNav.tsx), which opens Bookings (/bookings, 2026-11-19), named in every language the site speaks: the
// booking app's own word for its Bookings tab (tabMyRides) in the ten it speaks, the rest as AccountMenu.words.ts has them.
import type { Locale } from "@/i18n/locales";

export const BOOKINGS_WORD: Record<Locale, string> = {
  en: "Bookings",
  ar: "الحجوزات",
  fr: "Réservations",
  es: "Reservas",
  pt: "Reservas",
  ur: "بکنگز",
  hi: "बुकिंग",
  tl: "Mga Booking",
  ne: "बुकिङ",
  bn: "বুকিং",
  de: "Buchungen",
  id: "Pemesanan",
  ja: "予約",
  ms: "Tempahan",
  ru: "Бронирования",
  zh: "预订"
};

export const bookingsWord = (locale: string): string => BOOKINGS_WORD[locale as Locale] ?? BOOKINGS_WORD.en;
