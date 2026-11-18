// Plan my Saturdays and My month on /club (PlanSaturdays.tsx, MyMonth.tsx; the booking app's member-hub.js, new
// features F10 and F13, 2026-11-13), and since the Community features round (2026-11-18) the Build-up plan (BuildupPlan.tsx),
// in every language the site speaks. The ten languages the booking app speaks take its own words word for word (HUB_T
// plan, err, monTitle, monSats, yrSessions, monBadges, monVs, bup*, goalDone, wl, book and rsCancel; tkStBooked and sessFbk
// from its i18n). Indonesian, Malay, German, Russian, Chinese and Japanese, which the booking app does not speak, follow
// src/i18n/TRANSLATING.md, with "Badges earned", "Booked", "On the waitlist", "Book" and "Fully booked" as the site's
// dictionaries already say them and "session" as the rating pop-up's words do (RatingFin.words.ts); a Saturday ride called
// off is "Abgesagt" and "中止", never a booking's "Storniert". Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type MemberHubWords = {
  /** Plan my Saturdays: its name, and the line said when a tick did not go through */
  plan: string; err: string;
  /** My month: its name, its three tiles, and the comparison with the month before ({0} that month's name) */
  month: string; sats: string; sessions: string; badges: string; vs: string;
  /** The Build-up plan (the booking app's HUB_T bup, bupOne, bupN ({0} the Saturdays left), bupSats (its list's name for a
   *  screen reader) and bupSoon, with goalDone, tkStBooked, wl, book, sessFbk and rsCancel for its rows' ends) */
  bup: string; bupOne: string; bupN: string; bupSats: string; bupSoon: string;
  bupDone: string; bupBooked: string; bupWl: string; bupBook: string; bupFull: string; bupCancel: string;
};

export const MEMBER_HUB_WORDS: Record<Locale, MemberHubWords> = {
  en: { plan: "Plan my Saturdays", err: "We could not do that. Please try again.", month: "My month", sats: "Saturdays ridden", sessions: "Sessions", badges: "Badges earned", vs: "Sessions compared with {0}",
    bup: "Build-up plan", bupOne: "1 Saturday to go", bupN: "{0} Saturdays to go", bupSats: "Saturday rides", bupSoon: "Not open yet", bupDone: "Done", bupBooked: "Booked", bupWl: "On the waitlist", bupBook: "Book", bupFull: "Fully booked", bupCancel: "Cancelled" },
  ar: { plan: "خطتي لأيام السبت", err: "تعذّر ذلك. يرجى المحاولة مرة أخرى.", month: "شهري", sats: "أيام السبت التي ركبت فيها", sessions: "الأنشطة", badges: "الأوسمة المكتسبة", vs: "الأنشطة مقارنةً بشهر {0}",
    bup: "خطة الاستعداد", bupOne: "يتبقى سبت واحد", bupN: "أيام السبت المتبقية: {0}", bupSats: "جولات السبت", bupSoon: "لم يُفتح الحجز بعد", bupDone: "تم", bupBooked: "محجوز", bupWl: "في قائمة الانتظار", bupBook: "احجز", bupFull: "محجوز بالكامل", bupCancel: "ملغاة" },
  id: { plan: "Rencanakan Sabtu saya", err: "Gagal dilakukan. Silakan coba lagi.", month: "Bulan saya", sats: "Sabtu bersepeda", sessions: "Sesi", badges: "Lencana yang diraih", vs: "Sesi dibandingkan {0}",
    bup: "Rencana persiapan", bupOne: "Tinggal 1 Sabtu", bupN: "Tinggal {0} Sabtu", bupSats: "Tur Sabtu", bupSoon: "Belum dibuka", bupDone: "Selesai", bupBooked: "Sudah dipesan", bupWl: "Dalam daftar tunggu", bupBook: "Pesan", bupFull: "Penuh", bupCancel: "Dibatalkan" },
  ms: { plan: "Rancang Sabtu saya", err: "Tidak berjaya. Sila cuba lagi.", month: "Bulan saya", sats: "Sabtu berkayuh", sessions: "Sesi", badges: "Lencana yang dicapai", vs: "Sesi berbanding {0}",
    bup: "Pelan persediaan", bupOne: "Tinggal 1 Sabtu", bupN: "Tinggal {0} Sabtu", bupSats: "Kayuhan Sabtu", bupSoon: "Belum dibuka", bupDone: "Selesai", bupBooked: "Telah ditempah", bupWl: "Dalam senarai menunggu", bupBook: "Tempah", bupFull: "Penuh", bupCancel: "Dibatalkan" },
  de: { plan: "Meine Samstage planen", err: "Das hat nicht geklappt. Bitte versuche es noch einmal.", month: "Mein Monat", sats: "Gefahrene Samstage", sessions: "Sessions", badges: "Gesammelte Abzeichen", vs: "Sessions im Vergleich zum {0}",
    bup: "Vorbereitungsplan", bupOne: "Noch 1 Samstag", bupN: "Noch {0} Samstage", bupSats: "Samstagsausfahrten", bupSoon: "Noch nicht offen", bupDone: "Erledigt", bupBooked: "Gebucht", bupWl: "Auf der Warteliste", bupBook: "Buchen", bupFull: "Ausgebucht", bupCancel: "Abgesagt" },
  es: { plan: "Planificar mis sábados", err: "No se pudo hacer. Inténtalo de nuevo.", month: "Mi mes", sats: "Sábados rodados", sessions: "Sesiones", badges: "Insignias conseguidas", vs: "Sesiones respecto a {0}",
    bup: "Plan de preparación", bupOne: "Queda 1 sábado", bupN: "Quedan {0} sábados", bupSats: "Recorridos del sábado", bupSoon: "Aún no abierto", bupDone: "Hecho", bupBooked: "Reservado", bupWl: "En lista de espera", bupBook: "Reservar", bupFull: "Completa", bupCancel: "Cancelada" },
  fr: { plan: "Planifier mes samedis", err: "Action impossible. Veuillez réessayer.", month: "Mon mois", sats: "Samedis roulés", sessions: "Sessions", badges: "Badges obtenus", vs: "Sessions par rapport à {0}",
    bup: "Plan de préparation", bupOne: "1 samedi restant", bupN: "{0} samedis restants", bupSats: "Sorties du samedi", bupSoon: "Pas encore ouvert", bupDone: "Terminé", bupBooked: "Réservé", bupWl: "En liste d’attente", bupBook: "Réserver", bupFull: "Complète", bupCancel: "Annulée" },
  pt: { plan: "Planejar os meus sábados", err: "Não foi possível. Tente novamente.", month: "O meu mês", sats: "Sábados pedalados", sessions: "Sessões", badges: "Conquistas obtidas", vs: "Sessões face a {0}",
    bup: "Plano de preparação", bupOne: "Falta 1 sábado", bupN: "Faltam {0} sábados", bupSats: "Passeios de sábado", bupSoon: "Ainda não aberto", bupDone: "Concluído", bupBooked: "Reservado", bupWl: "Na lista de espera", bupBook: "Reservar", bupFull: "Lotada", bupCancel: "Cancelada" },
  tl: { plan: "Planuhin ang mga Sabado ko", err: "Hindi ito nagawa. Pakisubukang muli.", month: "Ang buwan ko", sats: "Mga Sabadong nag-ride", sessions: "Mga session", badges: "Mga nakuhang badge", vs: "Mga session kumpara sa {0}",
    bup: "Plano ng paghahanda", bupOne: "1 Sabado na lang", bupN: "{0} Sabado na lang", bupSats: "Mga Saturday ride", bupSoon: "Hindi pa bukas", bupDone: "Tapos na", bupBooked: "Naka-book", bupWl: "Nasa waitlist", bupBook: "Mag-book", bupFull: "Puno na", bupCancel: "Kanselado" },
  ru: { plan: "Мои планы на субботы", err: "Не получилось. Попробуйте ещё раз.", month: "Мой месяц", sats: "Субботы с заездом", sessions: "Занятия", badges: "Полученные значки", vs: "Занятия по сравнению с прошлым месяцем ({0})",
    bup: "План подготовки", bupOne: "Осталась 1 суббота", bupN: "Осталось суббот: {0}", bupSats: "Субботние заезды", bupSoon: "Ещё не открыто", bupDone: "Выполнено", bupBooked: "Забронировано", bupWl: "В листе ожидания", bupBook: "Забронировать", bupFull: "Мест нет", bupCancel: "Отменено" },
  ur: { plan: "میرے ہفتے کے دنوں کی منصوبہ بندی", err: "یہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔", month: "میرا مہینہ", sats: "سواری والے ہفتے", sessions: "سیشن", badges: "حاصل کیے گئے بیجز", vs: "{0} کے مقابلے میں سیشن",
    bup: "تیاری کا منصوبہ", bupOne: "ہفتے کا 1 دن باقی", bupN: "ہفتے کے {0} دن باقی", bupSats: "ہفتے کی رائیڈز", bupSoon: "ابھی کھلا نہیں", bupDone: "مکمل", bupBooked: "بک شدہ", bupWl: "انتظار کی فہرست میں", bupBook: "بک کریں", bupFull: "مکمل بھرا", bupCancel: "منسوخ" },
  hi: { plan: "मेरे शनिवार की योजना", err: "यह नहीं हो सका। फिर कोशिश करें।", month: "मेरा महीना", sats: "राइड वाले शनिवार", sessions: "सत्र", badges: "अर्जित बैज", vs: "{0} की तुलना में सत्र",
    bup: "तैयारी की योजना", bupOne: "1 शनिवार बाकी", bupN: "{0} शनिवार बाकी", bupSats: "शनिवार राइड", bupSoon: "अभी खुला नहीं", bupDone: "पूरा", bupBooked: "बुक", bupWl: "प्रतीक्षा सूची में", bupBook: "बुक करें", bupFull: "पूरी तरह भरा", bupCancel: "रद्द" },
  ne: { plan: "मेरा शनिबारको योजना", err: "यो हुन सकेन। फेरि प्रयास गर्नुहोस्।", month: "मेरो महिना", sats: "राइड गरेका शनिबार", sessions: "सत्र", badges: "कमाएका ब्याजहरू", vs: "{0} को तुलनामा सत्र",
    bup: "तयारी योजना", bupOne: "1 शनिबार बाँकी", bupN: "{0} शनिबार बाँकी", bupSats: "शनिबार राइडहरू", bupSoon: "अझै खुलेको छैन", bupDone: "पूरा भयो", bupBooked: "बुक भयो", bupWl: "प्रतीक्षा सूचीमा", bupBook: "बुक गर्नुहोस्", bupFull: "पूरै भरियो", bupCancel: "रद्द" },
  bn: { plan: "আমার শনিবারের পরিকল্পনা", err: "এটি করা যায়নি। আবার চেষ্টা করুন।", month: "আমার মাস", sats: "রাইড করা শনিবার", sessions: "সেশন", badges: "অর্জিত ব্যাজ", vs: "{0}-এর তুলনায় সেশন",
    bup: "প্রস্তুতির পরিকল্পনা", bupOne: "1টি শনিবার বাকি", bupN: "{0}টি শনিবার বাকি", bupSats: "শনিবারের রাইড", bupSoon: "এখনো খোলেনি", bupDone: "সম্পন্ন", bupBooked: "বুক করা", bupWl: "অপেক্ষার তালিকায়", bupBook: "বুক করুন", bupFull: "পুরোপুরি বুক", bupCancel: "বাতিল" },
  zh: { plan: "规划我的周六", err: "未能完成，请重试。", month: "我的月度回顾", sats: "骑行的周六", sessions: "活动", badges: "已获得的徽章", vs: "与{0}相比的活动",
    bup: "备赛计划", bupOne: "还剩 1 个周六", bupN: "还剩 {0} 个周六", bupSats: "周六骑行", bupSoon: "尚未开放", bupDone: "已完成", bupBooked: "已预订", bupWl: "候补中", bupBook: "预订", bupFull: "已满", bupCancel: "已取消" },
  ja: { plan: "土曜日の予定を立てる", err: "うまくいきませんでした。もう一度お試しください。", month: "今月のまとめ", sats: "ライドした土曜日", sessions: "セッション", badges: "獲得したバッジ", vs: "{0}と比べたセッション数",
    bup: "準備プラン", bupOne: "土曜日はあと1回", bupN: "土曜日はあと{0}回", bupSats: "土曜日のライド", bupSoon: "受付前", bupDone: "完了", bupBooked: "予約済み", bupWl: "キャンセル待ち中", bupBook: "予約", bupFull: "満員", bupCancel: "中止" },
};

export const memberHubWords = (locale: string): MemberHubWords => MEMBER_HUB_WORDS[locale as Locale] ?? MEMBER_HUB_WORDS.en;
