// The post-ride rating's last screen in every language the site speaks (RatingGate.tsx; the booking app's _rgFinHtml,
// 2026-11-13, the Community tab reach build's R5): New badge! over a badge just earned, the month's challenge by its
// name (_hpName: first, second, back, or a number of sessions this month, {0} the number), and the two buttons,
// Community and Done. The first five rides (the new features build F1): the path's name, its count ({0} rides of {1})
// and the Book button. The ten languages the booking app speaks take its own words word for word (bdgNew, hpFirst,
// hpSecond, hpBack, hpLevel, mbTitle, doneBtn, p5Title, p5Of, mrBookNext: English and Arabic in app.src.html, the
// others in its i18n/<code>.json). Indonesian, Malay, German, Russian, Chinese and Japanese, which the booking app does
// not speak, follow src/i18n/TRANSLATING.md (German and Russian say the number of sessions in a form right for any
// number). Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type RatingFinWords = {
  /** above a badge just earned */
  badge: string;
  /** the month's challenge by its kind; {0} in level is its target */
  first: string; second: string; back: string; level: string;
  community: string; done: string;
  /** the first five rides: its name, its count ({0} rides of {1}), and Book */
  p5: string; p5Of: string; book: string;
};

export const RATING_FIN_WORDS: Record<Locale, RatingFinWords> = {
  en: { badge: "New badge!", first: "Your first session", second: "Your second session", back: "Back this month", level: "{0} sessions this month", community: "Community", done: "Done", p5: "Your first five rides", p5Of: "{0} of {1}", book: "Book your next ride" },
  ar: { badge: "وسام جديد!", first: "جلستك الأولى", second: "جلستك الثانية", back: "عُد هذا الشهر", level: "{0} جلسات هذا الشهر", community: "المجتمع", done: "تم", p5: "جولاتك الخمس الأولى", p5Of: "{0} من {1}", book: "احجز جولتك القادمة" },
  id: { badge: "Lencana baru!", first: "Sesi pertama Anda", second: "Sesi kedua Anda", back: "Kembali bulan ini", level: "{0} sesi bulan ini", community: "Komunitas", done: "Selesai", p5: "Lima gowes pertama Anda", p5Of: "{0} dari {1}", book: "Pesan gowes Anda berikutnya" },
  ms: { badge: "Lencana baharu!", first: "Sesi pertama anda", second: "Sesi kedua anda", back: "Kembali bulan ini", level: "{0} sesi bulan ini", community: "Komuniti", done: "Selesai", p5: "Lima kayuhan pertama anda", p5Of: "{0} daripada {1}", book: "Tempah kayuhan anda seterusnya" },
  de: { badge: "Neues Abzeichen!", first: "Deine erste Session", second: "Deine zweite Session", back: "Diesen Monat wieder dabei", level: "Sessions diesen Monat: {0}", community: "Community", done: "Fertig", p5: "Deine ersten fünf Ausfahrten", p5Of: "{0} von {1}", book: "Buche deine nächste Ausfahrt" },
  es: { badge: "¡Nueva insignia!", first: "Tu primera sesión", second: "Tu segunda sesión", back: "De vuelta este mes", level: "{0} sesiones este mes", community: "Comunidad", done: "Hecho", p5: "Tus cinco primeros recorridos", p5Of: "{0} de {1}", book: "Reserva tu próximo recorrido" },
  fr: { badge: "Nouveau badge !", first: "Votre première séance", second: "Votre deuxième séance", back: "De retour ce mois-ci", level: "{0} séances ce mois-ci", community: "Communauté", done: "Terminé", p5: "Vos cinq premières sorties", p5Of: "{0} sur {1}", book: "Réservez votre prochaine sortie" },
  pt: { badge: "Nova conquista!", first: "A sua primeira sessão", second: "A sua segunda sessão", back: "De volta este mês", level: "{0} sessões este mês", community: "Comunidade", done: "Concluído", p5: "Seus cinco primeiros passeios", p5Of: "{0} de {1}", book: "Reserve seu próximo passeio" },
  tl: { badge: "Bagong badge!", first: "Ang una mong session", second: "Ang ikalawa mong session", back: "Bumalik ngayong buwan", level: "{0} session ngayong buwan", community: "Komunidad", done: "Tapos", p5: "Ang una mong limang ride", p5Of: "{0} sa {1}", book: "I-book ang susunod mong ride" },
  ru: { badge: "Новый значок!", first: "Ваше первое занятие", second: "Ваше второе занятие", back: "Снова с нами в этом месяце", level: "Занятий в этом месяце: {0}", community: "Сообщество", done: "Готово", p5: "Ваши первые пять заездов", p5Of: "{0} из {1}", book: "Забронируйте следующий заезд" },
  ur: { badge: "نیا بیج!", first: "آپ کا پہلا سیشن", second: "آپ کا دوسرا سیشن", back: "اس مہینے واپس آئیں", level: "اس مہینے {0} سیشن", community: "کمیونٹی", done: "مکمل", p5: "آپ کی پہلی پانچ رائیڈز", p5Of: "{1} میں سے {0}", book: "اپنی اگلی رائیڈ بُک کریں" },
  hi: { badge: "नया बैज!", first: "आपका पहला सत्र", second: "आपका दूसरा सत्र", back: "इस महीने वापसी", level: "इस महीने {0} सत्र", community: "समुदाय", done: "हो गया", p5: "आपकी पहली पाँच राइड", p5Of: "{1} में से {0}", book: "अपनी अगली राइड बुक करें" },
  ne: { badge: "नयाँ ब्याज!", first: "तपाईंको पहिलो सत्र", second: "तपाईंको दोस्रो सत्र", back: "यो महिना फर्कनुहोस्", level: "यो महिना {0} सत्र", community: "समुदाय", done: "सकियो", p5: "तपाईंका पहिला पाँच राइड", p5Of: "{1} मध्ये {0}", book: "आफ्नो अर्को राइड बुक गर्नुहोस्" },
  bn: { badge: "নতুন ব্যাজ!", first: "আপনার প্রথম সেশন", second: "আপনার দ্বিতীয় সেশন", back: "এই মাসে ফিরে আসুন", level: "এই মাসে {0}টি সেশন", community: "কমিউনিটি", done: "সম্পন্ন", p5: "আপনার প্রথম পাঁচটি রাইড", p5Of: "{1}টির মধ্যে {0}টি", book: "আপনার পরের রাইড বুক করুন" },
  zh: { badge: "新徽章！", first: "您的第一场活动", second: "您的第二场活动", back: "本月回归", level: "本月 {0} 场活动", community: "社区", done: "完成", p5: "您的前五次骑行", p5Of: "已完成 {0} 次，共 {1} 次", book: "预订下一次骑行" },
  ja: { badge: "新しいバッジ！", first: "初めてのセッション", second: "2回目のセッション", back: "今月また参加", level: "今月{0}回のセッション", community: "コミュニティ", done: "完了", p5: "最初の5回のライド", p5Of: "{1}回中{0}回", book: "次のライドを予約" },
};

export const ratingFinWords = (locale: string): RatingFinWords => RATING_FIN_WORDS[locale as Locale] ?? RATING_FIN_WORDS.en;
