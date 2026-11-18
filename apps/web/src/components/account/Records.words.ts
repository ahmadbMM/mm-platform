// My records on My Account's Stats (MyRecords.tsx, lib/my-records.ts; the booking app's _recHtml, 2026-11-18) in every
// language the site speaks: the card's name, the four tiles' names and "{0} of {1}" (Bike types tried, "3 of 5"). The ten
// languages the booking app speaks take its own words word for word (recTitle, recSat, recMonth, recTypes, recOf and
// recRoutes: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German, Russian,
// Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md, "session" as My month says it
// (MemberHub.words.ts). Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type RecordsWords = { title: string; sat: string; month: string; types: string; of: string; routes: string };

export const RECORDS_WORDS: Record<Locale, RecordsWords> = {
  en: { title: "My records", sat: "Saturdays in a row", month: "Sessions in your best month", types: "Bike types tried", of: "{0} of {1}", routes: "Routes ridden" },
  ar: { title: "أرقامي القياسية", sat: "أيام سبت متتالية", month: "الجلسات في أفضل شهر لك", types: "أنواع الدراجات التي جرّبتها", of: "{0} من {1}", routes: "المسارات التي قطعتها" },
  id: { title: "Rekor saya", sat: "Sabtu berturut-turut", month: "Sesi di bulan terbaik Anda", types: "Jenis sepeda yang dicoba", of: "{0} dari {1}", routes: "Rute yang ditempuh" },
  ms: { title: "Rekod saya", sat: "Sabtu berturut-turut", month: "Sesi dalam bulan terbaik anda", types: "Jenis basikal yang dicuba", of: "{0} daripada {1}", routes: "Laluan yang dikayuh" },
  de: { title: "Meine Rekorde", sat: "Samstage in Folge", month: "Sessions in deinem besten Monat", types: "Ausprobierte Fahrradtypen", of: "{0} von {1}", routes: "Gefahrene Routen" },
  es: { title: "Mis récords", sat: "Sábados seguidos", month: "Sesiones en tu mejor mes", types: "Tipos de bici probados", of: "{0} de {1}", routes: "Rutas recorridas" },
  fr: { title: "Mes records", sat: "Samedis d’affilée", month: "Séances de votre meilleur mois", types: "Types de vélo essayés", of: "{0} sur {1}", routes: "Parcours effectués" },
  pt: { title: "Os meus recordes", sat: "Sábados seguidos", month: "Sessões no seu melhor mês", types: "Tipos de bicicleta experimentados", of: "{0} de {1}", routes: "Percursos feitos" },
  tl: { title: "Mga record ko", sat: "Sunod-sunod na Sabado", month: "Mga session sa pinakamagandang buwan mo", types: "Mga uri ng bike na nasubukan", of: "{0} sa {1}", routes: "Mga rutang nadaanan" },
  ru: { title: "Мои рекорды", sat: "Субботы подряд", month: "Занятия в ваш лучший месяц", types: "Типы велосипедов, которые вы пробовали", of: "{0} из {1}", routes: "Пройденные маршруты" },
  ur: { title: "میرے ریکارڈ", sat: "لگاتار ہفتے کے دن", month: "آپ کے بہترین مہینے کے سیشن", types: "آزمائی گئی بائیک کی اقسام", of: "{1} میں سے {0}", routes: "طے کیے گئے راستے" },
  hi: { title: "मेरे रिकॉर्ड", sat: "लगातार शनिवार", month: "आपके सबसे अच्छे महीने के सत्र", types: "आज़माए गए बाइक प्रकार", of: "{1} में से {0}", routes: "तय किए गए रूट" },
  ne: { title: "मेरा रेकर्डहरू", sat: "लगातार शनिबार", month: "तपाईंको उत्कृष्ट महिनाका सत्रहरू", types: "चलाइएका बाइकका प्रकार", of: "{1} मध्ये {0}", routes: "पार गरिएका रुटहरू" },
  bn: { title: "আমার রেকর্ড", sat: "টানা শনিবার", month: "আপনার সেরা মাসের সেশন", types: "চালানো বাইকের ধরন", of: "{1}টির মধ্যে {0}টি", routes: "যেসব রুটে চালিয়েছেন" },
  zh: { title: "我的纪录", sat: "连续骑行的周六", month: "最佳月份的活动", types: "骑过的车型", of: "{0}/{1}", routes: "骑过的路线" },
  ja: { title: "マイ記録", sat: "連続した土曜日", month: "ベストな月のセッション数", types: "試した自転車のタイプ", of: "{1}種類中{0}種類", routes: "走ったルート" },
};

export const recordsWords = (locale: string): RecordsWords => RECORDS_WORDS[locale as Locale] ?? RECORDS_WORDS.en;
