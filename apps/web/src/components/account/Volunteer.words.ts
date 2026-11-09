// The volunteering card's words in every language the site speaks (VolunteerCard.tsx), apart from the site's translation
// dictionaries as the blood type card's are (BloodType.words.ts): the booking app's own wording, word for word, in the ten
// languages it speaks (accVol*, 2026-11-05; the hours' words accVolHrs_*, 2026-11-09). Change a text here in every language
// at once.
import { intlOf, type Locale } from "@/i18n/locales";

/** The hours with their word, by the language's plural category (Intl.PluralRules); `other` for the rest. */
export type HoursWords = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type VolunteerWords = { title: string; hours: string; open: string; join: string; recent: string; hrs: HoursWords };

export const VOLUNTEER_WORDS: Record<Locale, VolunteerWords> = {
  en: { title: "Volunteering", hours: "Your volunteering hours: {0}", open: "Open the volunteer portal", join: "Help at our events and earn volunteering hours.", recent: "Recent hours", hrs: { one: "{0} hour", other: "{0} hours" } },
  ar: { title: "التطوع", hours: "ساعات تطوعك: {0}", open: "افتح بوابة المتطوعين", join: "ساعد في فعالياتنا واكسب ساعات تطوع.", recent: "الساعات الأخيرة", hrs: { zero: "{0} ساعة", one: "ساعة واحدة", two: "ساعتان", few: "{0} ساعات", many: "{0} ساعة", other: "{0} ساعة" } },
  bn: { title: "স্বেচ্ছাসেবা", hours: "আপনার স্বেচ্ছাসেবার ঘণ্টা: {0}", open: "স্বেচ্ছাসেবক পোর্টাল খুলুন", join: "আমাদের ইভেন্টে সাহায্য করুন এবং স্বেচ্ছাসেবার ঘণ্টা অর্জন করুন।", recent: "সাম্প্রতিক ঘণ্টা", hrs: { other: "{0} ঘণ্টা" } },
  de: { title: "Ehrenamt", hours: "Deine Stunden als Freiwilliger: {0}", open: "Freiwilligenportal öffnen", join: "Hilf bei unseren Veranstaltungen und sammle Freiwilligenstunden.", recent: "Letzte Stunden", hrs: { one: "{0} Stunde", other: "{0} Stunden" } },
  es: { title: "Voluntariado", hours: "Tus horas de voluntariado: {0}", open: "Abrir el portal de voluntarios", join: "Ayuda en nuestros eventos y gana horas de voluntariado.", recent: "Horas recientes", hrs: { one: "{0} hora", other: "{0} horas" } },
  fr: { title: "Bénévolat", hours: "Vos heures de bénévolat : {0}", open: "Ouvrir le portail des bénévoles", join: "Aidez lors de nos événements et gagnez des heures de bénévolat.", recent: "Heures récentes", hrs: { one: "{0} heure", other: "{0} heures" } },
  hi: { title: "स्वयंसेवा", hours: "आपके स्वयंसेवा के घंटे: {0}", open: "स्वयंसेवक पोर्टल खोलें", join: "हमारे इवेंट में मदद करें और स्वयंसेवा के घंटे कमाएँ।", recent: "हाल के घंटे", hrs: { one: "{0} घंटा", other: "{0} घंटे" } },
  id: { title: "Relawan", hours: "Jam relawan Anda: {0}", open: "Buka portal relawan", join: "Bantu di acara kami dan dapatkan jam kerja relawan.", recent: "Jam terbaru", hrs: { other: "{0} jam" } },
  ja: { title: "ボランティア", hours: "あなたのボランティア時間: {0}", open: "ボランティアポータルを開く", join: "イベントをお手伝いして、ボランティア時間を貯めましょう。", recent: "最近の時間", hrs: { other: "{0}時間" } },
  ms: { title: "Sukarelawan", hours: "Jam sukarelawan anda: {0}", open: "Buka portal sukarelawan", join: "Bantu di acara kami dan dapatkan jam sukarelawan.", recent: "Jam terkini", hrs: { other: "{0} jam" } },
  ne: { title: "स्वयंसेवा", hours: "तपाईंका स्वयंसेवाका घण्टा: {0}", open: "स्वयंसेवक पोर्टल खोल्नुहोस्", join: "हाम्रा कार्यक्रमहरूमा सहयोग गर्नुहोस् र स्वयंसेवाका घण्टा कमाउनुहोस्।", recent: "हालका घण्टा", hrs: { other: "{0} घण्टा" } },
  pt: { title: "Voluntariado", hours: "Suas horas de voluntariado: {0}", open: "Abrir o portal de voluntários", join: "Ajude nos nossos eventos e ganhe horas de voluntariado.", recent: "Horas recentes", hrs: { one: "{0} hora", other: "{0} horas" } },
  ru: { title: "Волонтёрство", hours: "Ваши часы волонтёрства: {0}", open: "Открыть портал волонтёров", join: "Помогайте на наших мероприятиях и набирайте часы волонтёрства.", recent: "Последние часы", hrs: { one: "{0} час", few: "{0} часа", many: "{0} часов", other: "{0} часа" } },
  tl: { title: "Pagboboluntaryo", hours: "Ang iyong mga oras ng pagboboluntaryo: {0}", open: "Buksan ang volunteer portal", join: "Tumulong sa aming mga event at kumita ng mga oras ng pagboboluntaryo.", recent: "Mga kamakailang oras", hrs: { other: "{0} oras" } },
  ur: { title: "رضاکاری", hours: "آپ کے رضاکاری کے گھنٹے: {0}", open: "رضاکار پورٹل کھولیں", join: "ہمارے ایونٹس میں مدد کریں اور رضاکاری کے گھنٹے کمائیں۔", recent: "حالیہ گھنٹے", hrs: { one: "{0} گھنٹہ", other: "{0} گھنٹے" } },
  zh: { title: "志愿服务", hours: "你的志愿服务时长: {0}", open: "打开志愿者门户", join: "来我们的活动帮忙,赚取志愿服务时长。", recent: "最近的时长", hrs: { other: "{0} 小时" } },
};

export const volunteerWords = (locale: string): VolunteerWords => VOLUNTEER_WORDS[locale as Locale] ?? VOLUNTEER_WORDS.en;

/** Hours with their word, as the booking app writes them (_tn('accVolHrs')): "1 hour", "6 hours", "2.5 hours"; Arabic
 *  "ساعة واحدة", "ساعتان", "3 ساعات", "11 ساعة". Two decimals at most, Latin digits in every language. */
export function hoursText(hours: number, locale: string): string {
  const n = Math.round((Number(hours) || 0) * 100) / 100, w = volunteerWords(locale).hrs;
  let c: Intl.LDMLPluralRule = "other";
  try { c = new Intl.PluralRules(intlOf(locale)).select(n); } catch { /* an engine without the language: "other" */ }
  return (w[c] ?? w.other).replace("{0}", String(n));
}
