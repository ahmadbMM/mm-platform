// The personal landmarks' words on My Account > Stats (Landmarks.tsx: the first ride's anniversary card and the kinds
// tried) in every language the site speaks, kept apart from the site's translation dictionaries as the share pop-up's
// are (BadgeShare.words.ts): the ten languages the booking app speaks take its own wording (lmAnniv_*, lmLine, lmSign,
// lmKinds, lmDone, lmNotYet: English and Arabic in app.src.html, the others in its i18n/<code>.json, new features build
// F16, 2026-11-13); Indonesian, Malay, German, Russian, Chinese and Japanese, which it does not speak, follow
// src/i18n/TRANSLATING.md and the site's own "First ride". `anniv` holds the plural forms that differ from `other`, picked
// as the booking app's _tn picks them (Intl.PluralRules). `line` is the built-in line the team's own replaces (site_content
// msg.templates, lm_anniv). Change a text in every language at once.
import type { Locale } from "@/i18n/locales";

export type LandmarkWords = {
  /** "{0} years since your first ride", by plural form */
  anniv: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
  line: string; sign: string; kinds: string; done: string; notYet: string;
};

export const LANDMARK_WORDS: Record<Locale, LandmarkWords> = {
  en: { anniv: { one: "{0} year since your first ride", other: "{0} years since your first ride" }, line: "Thank you for riding with us. Here is to many more rides together.", sign: "The MicroMobility team", kinds: "Tried so far", done: "Done", notYet: "Not yet" },
  ar: { anniv: { zero: "{0} عاماً على أول جولة لك", one: "عام على أول جولة لك", two: "عامان على أول جولة لك", few: "{0} أعوام على أول جولة لك", many: "{0} عاماً على أول جولة لك", other: "{0} عام على أول جولة لك" }, line: "شكراً لمشاركتك الجولات معنا. نتطلع إلى جولات كثيرة قادمة معاً.", sign: "فريق مايكروموبيليتي", kinds: "ما جرّبته حتى الآن", done: "تمّ", notYet: "ليس بعد" },
  fr: { anniv: { one: "{0} an depuis votre première sortie", other: "{0} ans depuis votre première sortie" }, line: "Merci de rouler avec nous. À de nombreuses sorties encore, ensemble.", sign: "L’équipe MicroMobility", kinds: "Déjà essayé", done: "Fait", notYet: "Pas encore" },
  es: { anniv: { one: "{0} año desde tu primer recorrido", other: "{0} años desde tu primer recorrido" }, line: "Gracias por rodar con nosotros. Por muchos recorridos más juntos.", sign: "El equipo de MicroMobility", kinds: "Lo que ya probaste", done: "Hecho", notYet: "Todavía no" },
  pt: { anniv: { one: "{0} ano desde o seu primeiro passeio", other: "{0} anos desde o seu primeiro passeio" }, line: "Obrigado por pedalar conosco. Que venham muitos outros passeios juntos.", sign: "A equipe MicroMobility", kinds: "O que você já experimentou", done: "Feito", notYet: "Ainda não" },
  ur: { anniv: { one: "آپ کی پہلی رائیڈ کو {0} سال ہو گیا", other: "آپ کی پہلی رائیڈ کو {0} سال ہو گئے" }, line: "ہمارے ساتھ رائیڈ کرنے کا شکریہ۔ آگے بھی بہت سی رائیڈز ایک ساتھ ہوں۔", sign: "MicroMobility ٹیم", kinds: "اب تک آزمایا", done: "ہو گیا", notYet: "ابھی نہیں" },
  hi: { anniv: { one: "आपकी पहली राइड को {0} साल हो गया", other: "आपकी पहली राइड को {0} साल हो गए" }, line: "हमारे साथ राइड करने के लिए धन्यवाद। आगे भी कई और राइड्स साथ में हों।", sign: "MicroMobility टीम", kinds: "अब तक आज़माया", done: "हो गया", notYet: "अभी नहीं" },
  tl: { anniv: { other: "{0} taon mula sa una mong ride" }, line: "Salamat sa pag-ride kasama namin. Nawa ay marami pa tayong ride na magkasama.", sign: "Ang MicroMobility team", kinds: "Mga nasubukan mo na", done: "Tapos na", notYet: "Hindi pa" },
  ne: { anniv: { other: "तपाईंको पहिलो राइड भएको {0} वर्ष" }, line: "हामीसँग राइड गर्नुभएकोमा धन्यवाद। अझै धेरै राइडहरू सँगै गरौं।", sign: "MicroMobility टोली", kinds: "अहिलेसम्म प्रयास गरिएका", done: "भयो", notYet: "अहिलेसम्म छैन" },
  bn: { anniv: { other: "আপনার প্রথম রাইডের {0} বছর" }, line: "আমাদের সঙ্গে রাইড করার জন্য ধন্যবাদ। সামনে আরও অনেক রাইড একসঙ্গে হোক।", sign: "MicroMobility টিম", kinds: "এখন পর্যন্ত যা করেছেন", done: "হয়েছে", notYet: "এখনও না" },
  id: { anniv: { other: "{0} tahun sejak gowes pertama Anda" }, line: "Terima kasih sudah gowes bersama kami. Semoga masih banyak gowes bersama yang menanti.", sign: "Tim MicroMobility", kinds: "Yang sudah dicoba", done: "Sudah", notYet: "Belum" },
  ms: { anniv: { other: "{0} tahun sejak kayuhan pertama anda" }, line: "Terima kasih kerana berkayuh bersama kami. Semoga lebih banyak kayuhan bersama selepas ini.", sign: "Pasukan MicroMobility", kinds: "Yang sudah dicuba", done: "Sudah", notYet: "Belum" },
  de: { anniv: { one: "{0} Jahr seit deiner ersten Fahrt", other: "{0} Jahre seit deiner ersten Fahrt" }, line: "Danke, dass du mit uns fährst. Auf viele weitere gemeinsame Ausfahrten.", sign: "Das MicroMobility-Team", kinds: "Bisher ausprobiert", done: "Erledigt", notYet: "Noch nicht" },
  ru: { anniv: { one: "{0} год с вашего первого заезда", many: "{0} лет с вашего первого заезда", other: "{0} года с вашего первого заезда" }, line: "Спасибо, что катаетесь с нами. Впереди ещё много совместных заездов.", sign: "Команда MicroMobility", kinds: "Уже попробовано", done: "Пройдено", notYet: "Ещё нет" },
  zh: { anniv: { other: "距您的首次骑行已 {0} 年" }, line: "感谢您与我们一起骑行。期待未来更多的同行时光。", sign: "MicroMobility 团队", kinds: "已尝试的活动", done: "已完成", notYet: "尚未" },
  ja: { anniv: { other: "初めてのライドから{0}年" }, line: "私たちと一緒に走ってくださり、ありがとうございます。これからもたくさんのライドをご一緒しましょう。", sign: "MicroMobilityチーム", kinds: "これまでの体験", done: "済み", notYet: "まだ" },
};

export const landmarkWords = (locale: string): LandmarkWords => LANDMARK_WORDS[locale as Locale] ?? LANDMARK_WORDS.en;

/** "2 years since your first ride" in the reader's language, the plural form as the booking app's _tn picks it. */
export function annivTitle(locale: string, years: number): string {
  const w = landmarkWords(locale).anniv;
  let c: Intl.LDMLPluralRule = "other";
  try { c = new Intl.PluralRules(LANDMARK_WORDS[locale as Locale] ? locale : "en").select(years); } catch { /* other */ }
  return (w[c] ?? w.other).split("{0}").join(String(years));
}
