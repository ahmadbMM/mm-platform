// "Safety feedback" on My Account's bookings (TicketCard and Past rides; lib/safety-feedback.ts; the booking app's
// _sfyBtn, 2026-11-21) in every language the site speaks: the link's words (btn), which open the booking app's form. The
// eleven languages the booking app speaks take its own sfyBtn word for word (app.src.html and its i18n/<code>.json);
// Indonesian, German, Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Change a
// text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type SafetyWords = { btn: string };

export const SAFETY_WORDS: Record<Locale, SafetyWords> = {
  en: { btn: "Safety feedback" },
  ar: { btn: "ملاحظات السلامة" },
  id: { btn: "Masukan keselamatan" },
  ms: { btn: "Maklum balas keselamatan" },
  de: { btn: "Feedback zur Sicherheit" },
  es: { btn: "Seguridad" },
  fr: { btn: "Retour sécurité" },
  pt: { btn: "Segurança" },
  tl: { btn: "Safety feedback" },
  ru: { btn: "Отзыв о безопасности" },
  ur: { btn: "حفاظتی رائے" },
  hi: { btn: "सुरक्षा प्रतिक्रिया" },
  ne: { btn: "सुरक्षा प्रतिक्रिया" },
  bn: { btn: "নিরাপত্তা মতামত" },
  zh: { btn: "安全反馈" },
  ja: { btn: "安全についてのご意見" },
};

export const safetyWords = (locale: string): SafetyWords => SAFETY_WORDS[locale as Locale] ?? SAFETY_WORDS.en;
