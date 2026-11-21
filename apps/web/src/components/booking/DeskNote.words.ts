// "Note for the desk" (the booking app's customer features round, 2026-11-19, item 9): the label over the rider's own note
// in the ticket's Details (TicketCard; lib/tickets.ts riderNote), in every language the site speaks. The ten languages the
// booking app speaks take its own word for word (dntLabel: English and Arabic in app.src.html, the others in its
// i18n/<code>.json), the label it shows riders (staff read "Rider's note"). Indonesian, Malay, German, Russian, Chinese
// and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Change it here in every language at once.
import type { Locale } from "@/i18n/locales";

export const DESK_NOTE_WORDS: Record<Locale, string> = {
  en: "Note for the desk",
  ar: "ملاحظة لفريق الاستقبال",
  id: "Catatan untuk meja depan",
  ms: "Nota untuk kaunter",
  de: "Notiz für den Empfang",
  es: "Nota para el mostrador",
  fr: "Note pour l'accueil",
  pt: "Nota para o balcão",
  tl: "Tala para sa desk",
  ru: "Заметка для стойки",
  ur: "ڈیسک کے لیے نوٹ",
  hi: "डेस्क के लिए नोट",
  ne: "डेस्कका लागि नोट",
  bn: "ডেস্কের জন্য নোট",
  zh: "给前台的备注",
  ja: "受付へのメモ",
};

export const deskNoteWord = (locale: string): string => DESK_NOTE_WORDS[locale as Locale] ?? DESK_NOTE_WORDS.en;
