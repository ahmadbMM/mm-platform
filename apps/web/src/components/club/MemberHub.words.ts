// Plan my Saturdays and My month on /club (PlanSaturdays.tsx, MyMonth.tsx; the booking app's member-hub.js, new
// features F10 and F13, 2026-11-13) in every language the site speaks. The ten languages the booking app speaks take its
// own words word for word (HUB_T plan, err, monTitle, monSats, yrSessions, monBadges, monVs). Indonesian, Malay,
// German, Russian, Chinese and Japanese, which the booking app does not speak, follow src/i18n/TRANSLATING.md, with
// "Badges earned" as the site's dictionaries already say it and "session" as the rating pop-up's words do
// (RatingFin.words.ts). Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type MemberHubWords = {
  /** Plan my Saturdays: its name, and the line said when a tick did not go through */
  plan: string; err: string;
  /** My month: its name, its three tiles, and the comparison with the month before ({0} that month's name) */
  month: string; sats: string; sessions: string; badges: string; vs: string;
};

export const MEMBER_HUB_WORDS: Record<Locale, MemberHubWords> = {
  en: { plan: "Plan my Saturdays", err: "We could not do that. Please try again.", month: "My month", sats: "Saturdays ridden", sessions: "Sessions", badges: "Badges earned", vs: "Sessions compared with {0}" },
  ar: { plan: "خطتي لأيام السبت", err: "تعذّر ذلك. يرجى المحاولة مرة أخرى.", month: "شهري", sats: "أيام السبت التي ركبت فيها", sessions: "الأنشطة", badges: "الأوسمة المكتسبة", vs: "الأنشطة مقارنةً بشهر {0}" },
  id: { plan: "Rencanakan Sabtu saya", err: "Gagal dilakukan. Silakan coba lagi.", month: "Bulan saya", sats: "Sabtu bersepeda", sessions: "Sesi", badges: "Lencana yang diraih", vs: "Sesi dibandingkan {0}" },
  ms: { plan: "Rancang Sabtu saya", err: "Tidak berjaya. Sila cuba lagi.", month: "Bulan saya", sats: "Sabtu berkayuh", sessions: "Sesi", badges: "Lencana yang dicapai", vs: "Sesi berbanding {0}" },
  de: { plan: "Meine Samstage planen", err: "Das hat nicht geklappt. Bitte versuche es noch einmal.", month: "Mein Monat", sats: "Gefahrene Samstage", sessions: "Sessions", badges: "Gesammelte Abzeichen", vs: "Sessions im Vergleich zum {0}" },
  es: { plan: "Planificar mis sábados", err: "No se pudo hacer. Inténtalo de nuevo.", month: "Mi mes", sats: "Sábados rodados", sessions: "Sesiones", badges: "Insignias conseguidas", vs: "Sesiones respecto a {0}" },
  fr: { plan: "Planifier mes samedis", err: "Action impossible. Veuillez réessayer.", month: "Mon mois", sats: "Samedis roulés", sessions: "Sessions", badges: "Badges obtenus", vs: "Sessions par rapport à {0}" },
  pt: { plan: "Planejar os meus sábados", err: "Não foi possível. Tente novamente.", month: "O meu mês", sats: "Sábados pedalados", sessions: "Sessões", badges: "Conquistas obtidas", vs: "Sessões face a {0}" },
  tl: { plan: "Planuhin ang mga Sabado ko", err: "Hindi ito nagawa. Pakisubukang muli.", month: "Ang buwan ko", sats: "Mga Sabadong nag-ride", sessions: "Mga session", badges: "Mga nakuhang badge", vs: "Mga session kumpara sa {0}" },
  ru: { plan: "Мои планы на субботы", err: "Не получилось. Попробуйте ещё раз.", month: "Мой месяц", sats: "Субботы с заездом", sessions: "Занятия", badges: "Полученные значки", vs: "Занятия по сравнению с прошлым месяцем ({0})" },
  ur: { plan: "میرے ہفتے کے دنوں کی منصوبہ بندی", err: "یہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔", month: "میرا مہینہ", sats: "سواری والے ہفتے", sessions: "سیشن", badges: "حاصل کیے گئے بیجز", vs: "{0} کے مقابلے میں سیشن" },
  hi: { plan: "मेरे शनिवार की योजना", err: "यह नहीं हो सका। फिर कोशिश करें।", month: "मेरा महीना", sats: "राइड वाले शनिवार", sessions: "सत्र", badges: "अर्जित बैज", vs: "{0} की तुलना में सत्र" },
  ne: { plan: "मेरा शनिबारको योजना", err: "यो हुन सकेन। फेरि प्रयास गर्नुहोस्।", month: "मेरो महिना", sats: "राइड गरेका शनिबार", sessions: "सत्र", badges: "कमाएका ब्याजहरू", vs: "{0} को तुलनामा सत्र" },
  bn: { plan: "আমার শনিবারের পরিকল্পনা", err: "এটি করা যায়নি। আবার চেষ্টা করুন।", month: "আমার মাস", sats: "রাইড করা শনিবার", sessions: "সেশন", badges: "অর্জিত ব্যাজ", vs: "{0}-এর তুলনায় সেশন" },
  zh: { plan: "规划我的周六", err: "未能完成，请重试。", month: "我的月度回顾", sats: "骑行的周六", sessions: "活动", badges: "已获得的徽章", vs: "与{0}相比的活动" },
  ja: { plan: "土曜日の予定を立てる", err: "うまくいきませんでした。もう一度お試しください。", month: "今月のまとめ", sats: "ライドした土曜日", sessions: "セッション", badges: "獲得したバッジ", vs: "{0}と比べたセッション数" },
};

export const memberHubWords = (locale: string): MemberHubWords => MEMBER_HUB_WORDS[locale as Locale] ?? MEMBER_HUB_WORDS.en;
