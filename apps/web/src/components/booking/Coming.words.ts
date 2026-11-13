// "Still coming?" on the ticket (TicketCard, TicketComing; the booking app's _stcHtml, 2026-11-13, new features F2) in
// every language the site speaks: the group's name for a screen reader (ask), the two buttons (yes, no) and the chip after
// a yes (ok). The ten languages the booking app speaks take its own words word for word (stillAsk, stillYes, stillNo,
// stillOk: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German, Russian,
// Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Change a text here in every language at
// once.
import type { Locale } from "@/i18n/locales";

export type ComingWords = { ask: string; yes: string; no: string; ok: string };

export const COMING_WORDS: Record<Locale, ComingWords> = {
  en: { ask: "Are you still coming?", yes: "I’m coming", no: "Can’t come", ok: "Coming" },
  ar: { ask: "هل ما زلت قادمًا؟", yes: "سأحضر", no: "لا أستطيع الحضور", ok: "سيحضر" },
  id: { ask: "Apakah Anda masih akan datang?", yes: "Saya akan datang", no: "Tidak bisa datang", ok: "Akan datang" },
  ms: { ask: "Adakah anda masih akan datang?", yes: "Saya akan datang", no: "Tidak dapat datang", ok: "Akan datang" },
  de: { ask: "Kommst du noch?", yes: "Ich komme", no: "Ich kann nicht", ok: "Zugesagt" },
  es: { ask: "¿Sigues viniendo?", yes: "Voy", no: "No puedo ir", ok: "Asistirá" },
  fr: { ask: "Vous venez toujours ?", yes: "Je viens", no: "Je ne peux pas venir", ok: "Présent" },
  pt: { ask: "Você ainda vem?", yes: "Eu vou", no: "Não posso ir", ok: "Confirmado" },
  tl: { ask: "Darating ka pa rin ba?", yes: "Darating ako", no: "Hindi ako makakarating", ok: "Darating" },
  ru: { ask: "Вы всё ещё придёте?", yes: "Я приду", no: "Не смогу прийти", ok: "Подтверждено" },
  ur: { ask: "کیا آپ اب بھی آ رہے ہیں؟", yes: "میں آ رہا ہوں", no: "میں نہیں آ سکوں گا", ok: "آ رہے ہیں" },
  hi: { ask: "क्या आप अब भी आ रहे हैं?", yes: "मैं आ रहा हूँ", no: "मैं नहीं आ पाऊँगा", ok: "आ रहे हैं" },
  ne: { ask: "के तपाईं अझै आउँदै हुनुहुन्छ?", yes: "म आउँदैछु", no: "म आउन सक्दिनँ", ok: "आउँदै" },
  bn: { ask: "আপনি কি এখনও আসছেন?", yes: "আমি আসছি", no: "আমি আসতে পারব না", ok: "আসছেন" },
  zh: { ask: "您还会来吗？", yes: "我会来", no: "来不了", ok: "已确认" },
  ja: { ask: "予定どおり参加しますか？", yes: "参加します", no: "参加できません", ok: "参加予定" },
};

export const comingWords = (locale: string): ComingWords => COMING_WORDS[locale as Locale] ?? COMING_WORDS.en;
