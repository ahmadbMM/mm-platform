// The Helper path's words on My Account (HelperPath.tsx: the card on Badges, the helper days line on Stats) in every
// language the site speaks, kept apart from the site's translation dictionaries as the share pop-up's are
// (BadgeShare.words.ts): the ten languages the booking app speaks take its own wording (helper-path.js HP_T, new features
// build F23, 2026-11-13); Indonesian, Malay, German, Russian, Chinese and Japanese, which it does not speak, follow
// src/i18n/TRANSLATING.md, the site's own "Ride leader" and the tier name Rider. Change a text in every language at once.
import type { Locale } from "@/i18n/locales";

export type HelperWords = {
  title: string;
  /** the four steps: rider, helper, trainee ride leader, ride leader */
  s0: string; s1: string; s2: string; s3: string;
  /** "Next step: {0}" */
  next: string;
  days: string;
  /** "Helper days: {0}", the line on Stats */
  line: string;
  /** the helper-day ladder's four tiles */
  b1: string; b5: string; b10: string; b25: string;
};

export const HELPER_WORDS: Record<Locale, HelperWords> = {
  en: { title: "Helper path", s0: "Rider", s1: "Helper", s2: "Trainee ride leader", s3: "Ride leader", next: "Next step: {0}", days: "Helper days", line: "Helper days: {0}", b1: "1 helper day", b5: "5 helper days", b10: "10 helper days", b25: "25 helper days" },
  ar: { title: "مسار المساعد", s0: "راكب", s1: "مساعد", s2: "قائد جولة متدرّب", s3: "قائد الجولة", next: "الخطوة التالية: {0}", days: "أيام المساعدة", line: "أيام المساعدة: {0}", b1: "يوم مساعدة واحد", b5: "5 أيام مساعدة", b10: "10 أيام مساعدة", b25: "25 يوم مساعدة" },
  fr: { title: "Parcours d’assistant", s0: "Cycliste", s1: "Assistant", s2: "Chef de sortie en formation", s3: "Chef de sortie", next: "Prochaine étape : {0}", days: "Jours d’aide", line: "Jours d’aide : {0}", b1: "1 jour d’aide", b5: "5 jours d’aide", b10: "10 jours d’aide", b25: "25 jours d’aide" },
  es: { title: "Camino de ayudante", s0: "Ciclista", s1: "Ayudante", s2: "Líder de salida en formación", s3: "Líder de salida", next: "Siguiente paso: {0}", days: "Días de ayuda", line: "Días de ayuda: {0}", b1: "1 día de ayuda", b5: "5 días de ayuda", b10: "10 días de ayuda", b25: "25 días de ayuda" },
  pt: { title: "Percurso de ajudante", s0: "Ciclista", s1: "Ajudante", s2: "Líder de passeio em formação", s3: "Líder de passeio", next: "Próximo passo: {0}", days: "Dias de ajuda", line: "Dias de ajuda: {0}", b1: "1 dia de ajuda", b5: "5 dias de ajuda", b10: "10 dias de ajuda", b25: "25 dias de ajuda" },
  ur: { title: "مددگار کا راستہ", s0: "سوار", s1: "مددگار", s2: "زیرِ تربیت رائیڈ لیڈر", s3: "رائیڈ لیڈر", next: "اگلا مرحلہ: {0}", days: "مدد کے دن", line: "مدد کے دن: {0}", b1: "مدد کا 1 دن", b5: "مدد کے 5 دن", b10: "مدد کے 10 دن", b25: "مدد کے 25 دن" },
  hi: { title: "सहायक पथ", s0: "राइडर", s1: "सहायक", s2: "प्रशिक्षु राइड लीडर", s3: "राइड लीडर", next: "अगला चरण: {0}", days: "सहायता के दिन", line: "सहायता के दिन: {0}", b1: "सहायता का 1 दिन", b5: "सहायता के 5 दिन", b10: "सहायता के 10 दिन", b25: "सहायता के 25 दिन" },
  tl: { title: "Landas ng helper", s0: "Rider", s1: "Helper", s2: "Trainee ride leader", s3: "Ride leader", next: "Susunod na hakbang: {0}", days: "Mga araw ng pagtulong", line: "Mga araw ng pagtulong: {0}", b1: "1 araw ng pagtulong", b5: "5 araw ng pagtulong", b10: "10 araw ng pagtulong", b25: "25 araw ng pagtulong" },
  ne: { title: "सहयोगी पथ", s0: "राइडर", s1: "सहयोगी", s2: "प्रशिक्षार्थी राइड लिडर", s3: "राइड लिडर", next: "अर्को चरण: {0}", days: "सहयोगका दिन", line: "सहयोगका दिन: {0}", b1: "सहयोगको 1 दिन", b5: "सहयोगका 5 दिन", b10: "सहयोगका 10 दिन", b25: "सहयोगका 25 दिन" },
  bn: { title: "সহায়ক পথ", s0: "রাইডার", s1: "সহায়ক", s2: "শিক্ষানবিশ রাইড লিডার", s3: "রাইড লিডার", next: "পরের ধাপ: {0}", days: "সহায়তার দিন", line: "সহায়তার দিন: {0}", b1: "সহায়তার 1 দিন", b5: "সহায়তার 5 দিন", b10: "সহায়তার 10 দিন", b25: "সহায়তার 25 দিন" },
  id: { title: "Jalur asisten", s0: "Pesepeda", s1: "Asisten", s2: "Pemimpin gowes magang", s3: "Pemimpin gowes", next: "Langkah berikutnya: {0}", days: "Hari membantu", line: "Hari membantu: {0}", b1: "1 hari membantu", b5: "5 hari membantu", b10: "10 hari membantu", b25: "25 hari membantu" },
  ms: { title: "Laluan pembantu", s0: "Penunggang", s1: "Pembantu", s2: "Pelatih ketua kayuhan", s3: "Ketua kayuhan", next: "Langkah seterusnya: {0}", days: "Hari membantu", line: "Hari membantu: {0}", b1: "1 hari membantu", b5: "5 hari membantu", b10: "10 hari membantu", b25: "25 hari membantu" },
  de: { title: "Helferweg", s0: "Fahrer", s1: "Helfer", s2: "Tourleitung in Ausbildung", s3: "Tourleitung", next: "Nächster Schritt: {0}", days: "Helfertage", line: "Helfertage: {0}", b1: "1 Helfertag", b5: "5 Helfertage", b10: "10 Helfertage", b25: "25 Helfertage" },
  ru: { title: "Путь помощника", s0: "Велосипедист", s1: "Помощник", s2: "Стажёр ведущего заезда", s3: "Ведущий заезда", next: "Следующий шаг: {0}", days: "Дни помощи", line: "Дни помощи: {0}", b1: "1 день помощи", b5: "5 дней помощи", b10: "10 дней помощи", b25: "25 дней помощи" },
  zh: { title: "助手之路", s0: "骑士", s1: "助手", s2: "见习领骑", s3: "领骑", next: "下一步：{0}", days: "协助天数", line: "协助天数：{0}", b1: "协助 1 天", b5: "协助 5 天", b10: "协助 10 天", b25: "协助 25 天" },
  ja: { title: "ヘルパーへの道", s0: "乗り手", s1: "ヘルパー", s2: "ライドリーダー見習い", s3: "ライドリーダー", next: "次のステップ：{0}", days: "ヘルパー日数", line: "ヘルパー日数：{0}", b1: "ヘルパー1日", b5: "ヘルパー5日", b10: "ヘルパー10日", b25: "ヘルパー25日" },
};

export const helperWords = (locale: string): HelperWords => HELPER_WORDS[locale as Locale] ?? HELPER_WORDS.en;
