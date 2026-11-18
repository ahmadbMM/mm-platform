// The words of the Experiences card, its list and the Saturday ride (the owner's picks on the booking app's theming page,
// 2026-11-13; lib/kind-theme.ts), in every language the site speaks. Kept apart from the site's translation dictionaries
// (src/i18n/tx), as the rating's are (RatingForm.words.ts): the card's "About" is an event's short About, where the
// dictionaries' "About" is the About us page, and the ten languages the booking app speaks take its own wording word for
// word (its infoAboutShort, infoSeeDates, sunriseLbl, sunriseAt, kfLbl, kfAll, kfSat, kfSwim, kfPetro, regStep1TitleDate
// and rgIntPlace: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German,
// Russian, Chinese and Japanese, which the booking app does not speak, follow src/i18n/TRANSLATING.md, and name the
// Marine Sciences roundabout as the Saturday ride's Details text does in each. Change a text here in every language at
// once. The page resolves them on the server (kindThemeWords) and passes the browser its language's alone.
// A date the visitor already holds (the owner's pick 4, 2026-11-13; lib/held.ts) says Booked, On the waitlist or Reserved:
// the booking app's tkStBooked, wlOnList and statusReserved, word for word in its ten languages. They are kept here too:
// the dictionaries' "Booked" (the ticket's first stage, the members' area) says बुक हो गया, بُک شدہ, বুক করা হয়েছে and
// बुक भएको where the booking app's card says बुक, بک شدہ, বুক করা and बुक भयो, and their "Reserved" is a rental bike's
// state (the NFC bike pages), not a rider's place.
// The date step's calendar (the user, 2026-11-16: "add a calendar view in reserve section for customers"; lib/reserve-
// calendar.ts): the List / Calendar switch and the month's arrows say the booking app's shGrpView, calViewList, calViewCal,
// calPrev and calNext, word for word in its ten languages.
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
  /** A date the signed-in visitor already holds: Booked, On the waitlist (every rider of theirs waits), Reserved (a ride
   *  staff approve, until its list is out and theirs are approved). */
  held: { ok: string; wl: string; rsv: string };
  /** The date step's List / Calendar switch: its name for a screen reader and its two buttons' names; the calendar's
   *  arrows to the month before and after (lib/reserve-calendar.ts). */
  cal: { view: string; list: string; cal: string; prev: string; next: string };
};

export const KIND_THEME_WORDS: Record<Locale, KindThemeWords> = {
  en: { about: "About", seeDates: "See dates", sunrise: "Sunrise", sunriseAt: "Sunrise {0}", show: "Show", all: "All", kinds: { saturday: "Saturday", swim: "Pool", petromin: "Petromin" }, chooseDate: "Choose a date", intPlace: "Marine Sciences roundabout", held: { ok: "Booked", wl: "On the waitlist", rsv: "Reserved" }, cal: { view: "View", list: "List", cal: "Calendar", prev: "Previous month", next: "Next month" } },
  ar: { about: "نبذة", seeDates: "عرض المواعيد", sunrise: "الشروق", sunriseAt: "الشروق {0}", show: "عرض", all: "الكل", kinds: { saturday: "السبت", swim: "المسبح", petromin: "بترومين" }, chooseDate: "اختر موعدًا", intPlace: "دوار علوم البحار", held: { ok: "محجوز", wl: "على قائمة الانتظار", rsv: "محجوز" }, cal: { view: "العرض", list: "قائمة", cal: "تقويم", prev: "الشهر السابق", next: "الشهر التالي" } },
  id: { about: "Tentang", seeDates: "Lihat tanggal", sunrise: "Matahari terbit", sunriseAt: "Matahari terbit {0}", show: "Tampilkan", all: "Semua", kinds: { saturday: "Sabtu", swim: "Renang", petromin: "Petromin" }, chooseDate: "Pilih tanggal", intPlace: "Bundaran Marine Sciences", held: { ok: "Sudah dipesan", wl: "Dalam daftar tunggu", rsv: "Direservasi" }, cal: { view: "Tampilan", list: "Daftar", cal: "Kalender", prev: "Bulan sebelumnya", next: "Bulan berikutnya" } },
  ms: { about: "Tentang", seeDates: "Lihat tarikh", sunrise: "Matahari terbit", sunriseAt: "Matahari terbit {0}", show: "Tunjuk", all: "Semua", kinds: { saturday: "Sabtu", swim: "Kolam", petromin: "Petromin" }, chooseDate: "Pilih tarikh", intPlace: "Bulatan Marine Sciences", held: { ok: "Telah ditempah", wl: "Dalam senarai menunggu", rsv: "Dikhaskan" }, cal: { view: "Paparan", list: "Senarai", cal: "Kalendar", prev: "Bulan sebelumnya", next: "Bulan seterusnya" } },
  de: { about: "Überblick", seeDates: "Termine ansehen", sunrise: "Sonnenaufgang", sunriseAt: "Sonnenaufgang {0}", show: "Anzeigen", all: "Alle", kinds: { saturday: "Samstag", swim: "Pool", petromin: "Petromin" }, chooseDate: "Wähle einen Termin", intPlace: "Marine-Sciences-Kreisverkehr", held: { ok: "Gebucht", wl: "Auf der Warteliste", rsv: "Reserviert" }, cal: { view: "Ansicht", list: "Liste", cal: "Kalender", prev: "Vorheriger Monat", next: "Nächster Monat" } },
  es: { about: "Información", seeDates: "Ver fechas", sunrise: "Amanecer", sunriseAt: "Amanecer {0}", show: "Mostrar", all: "Todo", kinds: { saturday: "Sábado", swim: "Piscina", petromin: "Petromin" }, chooseDate: "Elige una fecha", intPlace: "Rotonda de Ciencias Marinas", held: { ok: "Reservado", wl: "En lista de espera", rsv: "Reservada" }, cal: { view: "Vista", list: "Lista", cal: "Calendario", prev: "Mes anterior", next: "Mes siguiente" } },
  fr: { about: "À propos", seeDates: "Voir les dates", sunrise: "Lever du soleil", sunriseAt: "Lever du soleil {0}", show: "Afficher", all: "Tout", kinds: { saturday: "Samedi", swim: "Piscine", petromin: "Petromin" }, chooseDate: "Choisissez une date", intPlace: "Rond-point des Sciences marines", held: { ok: "Réservé", wl: "Sur liste d’attente", rsv: "Réservé" }, cal: { view: "Affichage", list: "Liste", cal: "Calendrier", prev: "Mois précédent", next: "Mois suivant" } },
  pt: { about: "Sobre", seeDates: "Ver datas", sunrise: "Nascer do sol", sunriseAt: "Nascer do sol {0}", show: "Mostrar", all: "Tudo", kinds: { saturday: "Sábado", swim: "Piscina", petromin: "Petromin" }, chooseDate: "Escolha uma data", intPlace: "Rotatória de Ciências Marinhas", held: { ok: "Reservado", wl: "Na lista de espera", rsv: "Reservada" }, cal: { view: "Vista", list: "Lista", cal: "Calendário", prev: "Mês anterior", next: "Próximo mês" } },
  tl: { about: "Tungkol", seeDates: "Tingnan ang mga petsa", sunrise: "Pagsikat ng araw", sunriseAt: "Pagsikat ng araw {0}", show: "Ipakita", all: "Lahat", kinds: { saturday: "Sabado", swim: "Pool", petromin: "Petromin" }, chooseDate: "Pumili ng petsa", intPlace: "Rotonda ng Marine Sciences", held: { ok: "Naka-book", wl: "Nasa waitlist", rsv: "Naka-reserve" }, cal: { view: "View", list: "Listahan", cal: "Kalendaryo", prev: "Nakaraang buwan", next: "Susunod na buwan" } },
  ru: { about: "Описание", seeDates: "Посмотреть даты", sunrise: "Восход", sunriseAt: "Восход {0}", show: "Показать", all: "Все", kinds: { saturday: "Суббота", swim: "Бассейн", petromin: "Petromin" }, chooseDate: "Выберите дату", intPlace: "Развязка «Морские науки»", held: { ok: "Забронировано", wl: "В листе ожидания", rsv: "Зарезервировано" }, cal: { view: "Вид", list: "Список", cal: "Календарь", prev: "Предыдущий месяц", next: "Следующий месяц" } },
  ur: { about: "تعارف", seeDates: "تاریخیں دیکھیں", sunrise: "طلوعِ آفتاب", sunriseAt: "طلوعِ آفتاب {0}", show: "دکھائیں", all: "سب", kinds: { saturday: "ہفتہ", swim: "پول", petromin: "پیٹرومن" }, chooseDate: "تاریخ منتخب کریں", intPlace: "میرین سائنسز راؤنڈ اباؤٹ", held: { ok: "بک شدہ", wl: "ویٹ لسٹ پر", rsv: "ریزرو" }, cal: { view: "منظر", list: "فہرست", cal: "کیلنڈر", prev: "پچھلا مہینہ", next: "اگلا مہینہ" } },
  hi: { about: "जानकारी", seeDates: "तारीखें देखें", sunrise: "सूर्योदय", sunriseAt: "सूर्योदय {0}", show: "दिखाएँ", all: "सभी", kinds: { saturday: "शनिवार", swim: "पूल", petromin: "पेट्रोमिन" }, chooseDate: "तारीख चुनें", intPlace: "मरीन साइंसेज़ राउंडअबाउट", held: { ok: "बुक", wl: "प्रतीक्षा सूची में", rsv: "आरक्षित" }, cal: { view: "व्यू", list: "सूची", cal: "कैलेंडर", prev: "पिछला महीना", next: "अगला महीना" } },
  ne: { about: "बारेमा", seeDates: "मितिहरू हेर्नुहोस्", sunrise: "सूर्योदय", sunriseAt: "सूर्योदय {0}", show: "देखाउनुहोस्", all: "सबै", kinds: { saturday: "शनिबार", swim: "पूल", petromin: "पेट्रोमिन" }, chooseDate: "मिति छान्नुहोस्", intPlace: "मरिन साइन्सेस राउन्डअबाउट", held: { ok: "बुक भयो", wl: "प्रतीक्षा सूचीमा", rsv: "आरक्षित" }, cal: { view: "दृश्य", list: "सूची", cal: "पात्रो", prev: "अघिल्लो महिना", next: "अर्को महिना" } },
  bn: { about: "সম্পর্কে", seeDates: "তারিখগুলো দেখুন", sunrise: "সূর্যোদয়", sunriseAt: "সূর্যোদয় {0}", show: "দেখান", all: "সব", kinds: { saturday: "শনিবার", swim: "পুল", petromin: "Petromin" }, chooseDate: "একটি তারিখ বেছে নিন", intPlace: "মেরিন সায়েন্সেস রাউন্ডঅ্যাবাউট", held: { ok: "বুক করা", wl: "ওয়েটিং লিস্টে", rsv: "রিজার্ভ করা" }, cal: { view: "ভিউ", list: "তালিকা", cal: "ক্যালেন্ডার", prev: "আগের মাস", next: "পরের মাস" } },
  zh: { about: "简介", seeDates: "查看日期", sunrise: "日出", sunriseAt: "日出 {0}", show: "显示", all: "全部", kinds: { saturday: "周六", swim: "泳池", petromin: "Petromin" }, chooseDate: "选择日期", intPlace: "海洋科学环岛", held: { ok: "已预订", wl: "候补中", rsv: "已预留" }, cal: { view: "视图", list: "列表", cal: "日历", prev: "上个月", next: "下个月" } },
  ja: { about: "概要", seeDates: "日程を見る", sunrise: "日の出", sunriseAt: "日の出{0}", show: "表示", all: "すべて", kinds: { saturday: "土曜", swim: "プール", petromin: "Petromin" }, chooseDate: "日程を選ぶ", intPlace: "マリン・サイエンス・ラウンドアバウト", held: { ok: "予約済み", wl: "キャンセル待ち中", rsv: "仮予約" }, cal: { view: "表示", list: "リスト", cal: "カレンダー", prev: "前の月", next: "次の月" } },
};

export const kindThemeWords = (locale: string): KindThemeWords => KIND_THEME_WORDS[locale as Locale] ?? KIND_THEME_WORDS.en;
