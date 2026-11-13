// The post-ride rating's last screen in every language the site speaks (RatingGate.tsx; the booking app's _rgFinHtml,
// 2026-11-13, the Community tab reach build's R5): New badge! over a badge just earned, the month's challenge by its
// name (_hpName: first, second, back, or a number of sessions this month, {0} the number), and the two buttons,
// Community and Done. The ten languages the booking app speaks take its own words word for word (bdgNew, hpFirst,
// hpSecond, hpBack, hpLevel, mbTitle, doneBtn: English and Arabic in app.src.html, the others in its
// i18n/<code>.json). Indonesian, Malay, German, Russian, Chinese and Japanese, which the booking app does not speak,
// follow src/i18n/TRANSLATING.md (German and Russian say the number of sessions in a form right for any number).
// Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type RatingFinWords = {
  /** above a badge just earned */
  badge: string;
  /** the month's challenge by its kind; {0} in level is its target */
  first: string; second: string; back: string; level: string;
  community: string; done: string;
};

export const RATING_FIN_WORDS: Record<Locale, RatingFinWords> = {
  en: { badge: "New badge!", first: "Your first session", second: "Your second session", back: "Back this month", level: "{0} sessions this month", community: "Community", done: "Done" },
  ar: { badge: "وسام جديد!", first: "جلستك الأولى", second: "جلستك الثانية", back: "عُد هذا الشهر", level: "{0} جلسات هذا الشهر", community: "المجتمع", done: "تم" },
  id: { badge: "Lencana baru!", first: "Sesi pertama Anda", second: "Sesi kedua Anda", back: "Kembali bulan ini", level: "{0} sesi bulan ini", community: "Komunitas", done: "Selesai" },
  ms: { badge: "Lencana baharu!", first: "Sesi pertama anda", second: "Sesi kedua anda", back: "Kembali bulan ini", level: "{0} sesi bulan ini", community: "Komuniti", done: "Selesai" },
  de: { badge: "Neues Abzeichen!", first: "Deine erste Session", second: "Deine zweite Session", back: "Diesen Monat wieder dabei", level: "Sessions diesen Monat: {0}", community: "Community", done: "Fertig" },
  es: { badge: "¡Nueva insignia!", first: "Tu primera sesión", second: "Tu segunda sesión", back: "De vuelta este mes", level: "{0} sesiones este mes", community: "Comunidad", done: "Hecho" },
  fr: { badge: "Nouveau badge !", first: "Votre première séance", second: "Votre deuxième séance", back: "De retour ce mois-ci", level: "{0} séances ce mois-ci", community: "Communauté", done: "Terminé" },
  pt: { badge: "Nova conquista!", first: "A sua primeira sessão", second: "A sua segunda sessão", back: "De volta este mês", level: "{0} sessões este mês", community: "Comunidade", done: "Concluído" },
  tl: { badge: "Bagong badge!", first: "Ang una mong session", second: "Ang ikalawa mong session", back: "Bumalik ngayong buwan", level: "{0} session ngayong buwan", community: "Komunidad", done: "Tapos" },
  ru: { badge: "Новый значок!", first: "Ваше первое занятие", second: "Ваше второе занятие", back: "Снова с нами в этом месяце", level: "Занятий в этом месяце: {0}", community: "Сообщество", done: "Готово" },
  ur: { badge: "نیا بیج!", first: "آپ کا پہلا سیشن", second: "آپ کا دوسرا سیشن", back: "اس مہینے واپس آئیں", level: "اس مہینے {0} سیشن", community: "کمیونٹی", done: "مکمل" },
  hi: { badge: "नया बैज!", first: "आपका पहला सत्र", second: "आपका दूसरा सत्र", back: "इस महीने वापसी", level: "इस महीने {0} सत्र", community: "समुदाय", done: "हो गया" },
  ne: { badge: "नयाँ ब्याज!", first: "तपाईंको पहिलो सत्र", second: "तपाईंको दोस्रो सत्र", back: "यो महिना फर्कनुहोस्", level: "यो महिना {0} सत्र", community: "समुदाय", done: "सकियो" },
  bn: { badge: "নতুন ব্যাজ!", first: "আপনার প্রথম সেশন", second: "আপনার দ্বিতীয় সেশন", back: "এই মাসে ফিরে আসুন", level: "এই মাসে {0}টি সেশন", community: "কমিউনিটি", done: "সম্পন্ন" },
  zh: { badge: "新徽章！", first: "您的第一场活动", second: "您的第二场活动", back: "本月回归", level: "本月 {0} 场活动", community: "社区", done: "完成" },
  ja: { badge: "新しいバッジ！", first: "初めてのセッション", second: "2回目のセッション", back: "今月また参加", level: "今月{0}回のセッション", community: "コミュニティ", done: "完了" },
};

export const ratingFinWords = (locale: string): RatingFinWords => RATING_FIN_WORDS[locale as Locale] ?? RATING_FIN_WORDS.en;
