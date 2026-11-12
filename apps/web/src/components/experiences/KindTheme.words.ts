// The words of the Experiences card, its list and the Saturday ride (the owner's picks on the booking app's theming page,
// 2026-11-13; lib/kind-theme.ts), in every language the site speaks. Kept apart from the site's translation dictionaries
// (src/i18n/tx), as the rating's are (RatingForm.words.ts): the card's "About" is an event's short About, where the
// dictionaries' "About" is the About us page, and the ten languages the booking app speaks take its own wording word for
// word (its infoAboutShort, infoSeeDates, sunriseLbl, sunriseAt, kfLbl, kfAll, kfSat, kfSwim, kfPetro, regStep1TitleDate
// and rgIntPlace: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German,
// Russian, Chinese and Japanese, which the booking app does not speak, follow src/i18n/TRANSLATING.md, and name the
// Marine Sciences roundabout as the Saturday ride's Details text does in each. Change a text here in every language at
// once. The page resolves them on the server (kindThemeWords) and passes the browser its language's alone.
import type { Locale } from "@/i18n/locales";

export type KindThemeWords = {
  /** The Experiences card's About link and its dialog's kicker; the dialog's button. */
  about: string; seeDates: string;
  /** The Saturday ride's Details fact, and its row's line with the time in {0}. */
  sunrise: string; sunriseAt: string;
  /** The kind switch: its name for a screen reader, All, and the short names of the kinds that have one. */
  show: string; all: string; kinds: { saturday: string; swim: string; petromin: string };
  /** A list that mixes bike rides and sessions without a bike. */
  chooseDate: string;
  /** The Saturday ride's route: where the intermediates turn. */
  intPlace: string;
};

export const KIND_THEME_WORDS: Record<Locale, KindThemeWords> = {
  en: { about: "About", seeDates: "See dates", sunrise: "Sunrise", sunriseAt: "Sunrise {0}", show: "Show", all: "All", kinds: { saturday: "Saturday", swim: "Pool", petromin: "Petromin" }, chooseDate: "Choose a date", intPlace: "Marine Sciences roundabout" },
  ar: { about: "نبذة", seeDates: "عرض المواعيد", sunrise: "الشروق", sunriseAt: "الشروق {0}", show: "عرض", all: "الكل", kinds: { saturday: "السبت", swim: "المسبح", petromin: "بترومين" }, chooseDate: "اختر موعدًا", intPlace: "دوار علوم البحار" },
  id: { about: "Tentang", seeDates: "Lihat tanggal", sunrise: "Matahari terbit", sunriseAt: "Matahari terbit {0}", show: "Tampilkan", all: "Semua", kinds: { saturday: "Sabtu", swim: "Renang", petromin: "Petromin" }, chooseDate: "Pilih tanggal", intPlace: "Bundaran Marine Sciences" },
  ms: { about: "Tentang", seeDates: "Lihat tarikh", sunrise: "Matahari terbit", sunriseAt: "Matahari terbit {0}", show: "Tunjuk", all: "Semua", kinds: { saturday: "Sabtu", swim: "Kolam", petromin: "Petromin" }, chooseDate: "Pilih tarikh", intPlace: "Bulatan Marine Sciences" },
  de: { about: "Überblick", seeDates: "Termine ansehen", sunrise: "Sonnenaufgang", sunriseAt: "Sonnenaufgang {0}", show: "Anzeigen", all: "Alle", kinds: { saturday: "Samstag", swim: "Pool", petromin: "Petromin" }, chooseDate: "Wähle einen Termin", intPlace: "Marine-Sciences-Kreisverkehr" },
  es: { about: "Información", seeDates: "Ver fechas", sunrise: "Amanecer", sunriseAt: "Amanecer {0}", show: "Mostrar", all: "Todo", kinds: { saturday: "Sábado", swim: "Piscina", petromin: "Petromin" }, chooseDate: "Elige una fecha", intPlace: "Rotonda de Ciencias Marinas" },
  fr: { about: "À propos", seeDates: "Voir les dates", sunrise: "Lever du soleil", sunriseAt: "Lever du soleil {0}", show: "Afficher", all: "Tout", kinds: { saturday: "Samedi", swim: "Piscine", petromin: "Petromin" }, chooseDate: "Choisissez une date", intPlace: "Rond-point des Sciences marines" },
  pt: { about: "Sobre", seeDates: "Ver datas", sunrise: "Nascer do sol", sunriseAt: "Nascer do sol {0}", show: "Mostrar", all: "Tudo", kinds: { saturday: "Sábado", swim: "Piscina", petromin: "Petromin" }, chooseDate: "Escolha uma data", intPlace: "Rotatória de Ciências Marinhas" },
  tl: { about: "Tungkol", seeDates: "Tingnan ang mga petsa", sunrise: "Pagsikat ng araw", sunriseAt: "Pagsikat ng araw {0}", show: "Ipakita", all: "Lahat", kinds: { saturday: "Sabado", swim: "Pool", petromin: "Petromin" }, chooseDate: "Pumili ng petsa", intPlace: "Rotonda ng Marine Sciences" },
  ru: { about: "Описание", seeDates: "Посмотреть даты", sunrise: "Восход", sunriseAt: "Восход {0}", show: "Показать", all: "Все", kinds: { saturday: "Суббота", swim: "Бассейн", petromin: "Petromin" }, chooseDate: "Выберите дату", intPlace: "Развязка «Морские науки»" },
  ur: { about: "تعارف", seeDates: "تاریخیں دیکھیں", sunrise: "طلوعِ آفتاب", sunriseAt: "طلوعِ آفتاب {0}", show: "دکھائیں", all: "سب", kinds: { saturday: "ہفتہ", swim: "پول", petromin: "پیٹرومن" }, chooseDate: "تاریخ منتخب کریں", intPlace: "میرین سائنسز راؤنڈ اباؤٹ" },
  hi: { about: "जानकारी", seeDates: "तारीखें देखें", sunrise: "सूर्योदय", sunriseAt: "सूर्योदय {0}", show: "दिखाएँ", all: "सभी", kinds: { saturday: "शनिवार", swim: "पूल", petromin: "पेट्रोमिन" }, chooseDate: "तारीख चुनें", intPlace: "मरीन साइंसेज़ राउंडअबाउट" },
  ne: { about: "बारेमा", seeDates: "मितिहरू हेर्नुहोस्", sunrise: "सूर्योदय", sunriseAt: "सूर्योदय {0}", show: "देखाउनुहोस्", all: "सबै", kinds: { saturday: "शनिबार", swim: "पूल", petromin: "पेट्रोमिन" }, chooseDate: "मिति छान्नुहोस्", intPlace: "मरिन साइन्सेस राउन्डअबाउट" },
  bn: { about: "সম্পর্কে", seeDates: "তারিখগুলো দেখুন", sunrise: "সূর্যোদয়", sunriseAt: "সূর্যোদয় {0}", show: "দেখান", all: "সব", kinds: { saturday: "শনিবার", swim: "পুল", petromin: "Petromin" }, chooseDate: "একটি তারিখ বেছে নিন", intPlace: "মেরিন সায়েন্সেস রাউন্ডঅ্যাবাউট" },
  zh: { about: "简介", seeDates: "查看日期", sunrise: "日出", sunriseAt: "日出 {0}", show: "显示", all: "全部", kinds: { saturday: "周六", swim: "泳池", petromin: "Petromin" }, chooseDate: "选择日期", intPlace: "海洋科学环岛" },
  ja: { about: "概要", seeDates: "日程を見る", sunrise: "日の出", sunriseAt: "日の出{0}", show: "表示", all: "すべて", kinds: { saturday: "土曜", swim: "プール", petromin: "Petromin" }, chooseDate: "日程を選ぶ", intPlace: "マリン・サイエンス・ラウンドアバウト" },
};

export const kindThemeWords = (locale: string): KindThemeWords => KIND_THEME_WORDS[locale as Locale] ?? KIND_THEME_WORDS.en;
