// The volunteering card's words in every language the site speaks (VolunteerCard.tsx), apart from the site's translation
// dictionaries as the blood type card's are (BloodType.words.ts): the booking app's own wording, word for word, in the ten
// languages it speaks (accVol*, 2026-11-05). Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type VolunteerWords = { title: string; hours: string; open: string; join: string; recent: string };

export const VOLUNTEER_WORDS: Record<Locale, VolunteerWords> = {
  en: { title: "Volunteering", hours: "Your volunteering hours: {0}", open: "Open the volunteer portal", join: "Help at our events and earn volunteering hours.", recent: "Recent hours" },
  ar: { title: "التطوع", hours: "ساعات تطوعك: {0}", open: "افتح بوابة المتطوعين", join: "ساعد في فعالياتنا واكسب ساعات تطوع.", recent: "الساعات الأخيرة" },
  bn: { title: "স্বেচ্ছাসেবা", hours: "আপনার স্বেচ্ছাসেবার ঘণ্টা: {0}", open: "স্বেচ্ছাসেবক পোর্টাল খুলুন", join: "আমাদের ইভেন্টে সাহায্য করুন এবং স্বেচ্ছাসেবার ঘণ্টা অর্জন করুন।", recent: "সাম্প্রতিক ঘণ্টা" },
  de: { title: "Ehrenamt", hours: "Deine Stunden als Freiwilliger: {0}", open: "Freiwilligenportal öffnen", join: "Hilf bei unseren Veranstaltungen und sammle Freiwilligenstunden.", recent: "Letzte Stunden" },
  es: { title: "Voluntariado", hours: "Tus horas de voluntariado: {0}", open: "Abrir el portal de voluntarios", join: "Ayuda en nuestros eventos y gana horas de voluntariado.", recent: "Horas recientes" },
  fr: { title: "Bénévolat", hours: "Vos heures de bénévolat : {0}", open: "Ouvrir le portail des bénévoles", join: "Aidez lors de nos événements et gagnez des heures de bénévolat.", recent: "Heures récentes" },
  hi: { title: "स्वयंसेवा", hours: "आपके स्वयंसेवा के घंटे: {0}", open: "स्वयंसेवक पोर्टल खोलें", join: "हमारे इवेंट में मदद करें और स्वयंसेवा के घंटे कमाएँ।", recent: "हाल के घंटे" },
  id: { title: "Relawan", hours: "Jam relawan Anda: {0}", open: "Buka portal relawan", join: "Bantu di acara kami dan dapatkan jam kerja relawan.", recent: "Jam terbaru" },
  ja: { title: "ボランティア", hours: "あなたのボランティア時間: {0}", open: "ボランティアポータルを開く", join: "イベントをお手伝いして、ボランティア時間を貯めましょう。", recent: "最近の時間" },
  ms: { title: "Sukarelawan", hours: "Jam sukarelawan anda: {0}", open: "Buka portal sukarelawan", join: "Bantu di acara kami dan dapatkan jam sukarelawan.", recent: "Jam terkini" },
  ne: { title: "स्वयंसेवा", hours: "तपाईंका स्वयंसेवाका घण्टा: {0}", open: "स्वयंसेवक पोर्टल खोल्नुहोस्", join: "हाम्रा कार्यक्रमहरूमा सहयोग गर्नुहोस् र स्वयंसेवाका घण्टा कमाउनुहोस्।", recent: "हालका घण्टा" },
  pt: { title: "Voluntariado", hours: "Suas horas de voluntariado: {0}", open: "Abrir o portal de voluntários", join: "Ajude nos nossos eventos e ganhe horas de voluntariado.", recent: "Horas recentes" },
  ru: { title: "Волонтёрство", hours: "Ваши часы волонтёрства: {0}", open: "Открыть портал волонтёров", join: "Помогайте на наших мероприятиях и набирайте часы волонтёрства.", recent: "Последние часы" },
  tl: { title: "Pagboboluntaryo", hours: "Ang iyong mga oras ng pagboboluntaryo: {0}", open: "Buksan ang volunteer portal", join: "Tumulong sa aming mga event at kumita ng mga oras ng pagboboluntaryo.", recent: "Mga kamakailang oras" },
  ur: { title: "رضاکاری", hours: "آپ کے رضاکاری کے گھنٹے: {0}", open: "رضاکار پورٹل کھولیں", join: "ہمارے ایونٹس میں مدد کریں اور رضاکاری کے گھنٹے کمائیں۔", recent: "حالیہ گھنٹے" },
  zh: { title: "志愿服务", hours: "你的志愿服务时长: {0}", open: "打开志愿者门户", join: "来我们的活动帮忙,赚取志愿服务时长。", recent: "最近的时长" },
};

export const volunteerWords = (locale: string): VolunteerWords => VOLUNTEER_WORDS[locale as Locale] ?? VOLUNTEER_WORDS.en;
