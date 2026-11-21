// The check-up pop-up for details an account owes (the booking app's 3ebaf706: appKicker, fixOwnTitle, fixAddBtn, logOut).
// In every language the site speaks: the ten the booking app speaks take its own words, word for word; Indonesian,
// Malay, German, Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Generated once
// from the booking app's files; change a text in every language at once.
import type { Locale } from "@/i18n/locales";

export type FixGateWords = { kicker: string; title: string; add: string; logOut: string };

export const FIX_GATE_WORDS: Record<Locale, FixGateWords> = {
  en: {"kicker":"Account check-up","title":"A few details for your account","add":"Add details","logOut":"Log out"},
  ar: {"kicker":"مراجعة الحساب","title":"بعض التفاصيل لحسابك","add":"أضف التفاصيل","logOut":"تسجيل الخروج"},
  fr: {"kicker":"Vérification du compte","title":"Quelques informations pour votre compte","add":"Ajouter les informations","logOut":"Se déconnecter"},
  es: {"kicker":"Revisión de la cuenta","title":"Algunos datos para tu cuenta","add":"Añadir los datos","logOut":"Cerrar sesión"},
  pt: {"kicker":"Revisão da conta","title":"Alguns dados para a sua conta","add":"Adicionar os dados","logOut":"Sair"},
  ur: {"kicker":"اکاؤنٹ کی جانچ","title":"آپ کے اکاؤنٹ کے لیے چند تفصیلات","add":"تفصیلات شامل کریں","logOut":"لاگ آؤٹ"},
  hi: {"kicker":"खाते की जाँच","title":"आपके खाते के लिए कुछ जानकारी","add":"जानकारी जोड़ें","logOut":"लॉग आउट"},
  tl: {"kicker":"Tsek ng account","title":"Ilang detalye para sa account mo","add":"Idagdag ang mga detalye","logOut":"Mag-log out"},
  ne: {"kicker":"खाता जाँच","title":"तपाईंको खाताका लागि केही विवरण","add":"विवरण थप्नुहोस्","logOut":"लग आउट"},
  bn: {"kicker":"অ্যাকাউন্ট যাচাই","title":"আপনার অ্যাকাউন্টের জন্য কয়েকটি তথ্য","add":"তথ্য যোগ করুন","logOut":"লগ আউট"},
  de: {"kicker":"Kontoprüfung","title":"Ein paar Angaben für dein Konto","add":"Angaben ergänzen","logOut":"Abmelden"},
  id: {"kicker":"Pemeriksaan akun","title":"Beberapa data untuk akun Anda","add":"Tambahkan data","logOut":"Keluar"},
  ja: {"kicker":"アカウントの確認","title":"アカウントに必要な情報","add":"情報を追加する","logOut":"ログアウト"},
  ms: {"kicker":"Semakan akaun","title":"Beberapa butiran untuk akaun anda","add":"Tambah butiran","logOut":"Log keluar"},
  ru: {"kicker":"Проверка аккаунта","title":"Несколько данных для вашего аккаунта","add":"Добавить данные","logOut":"Выйти"},
  zh: {"kicker":"账户核查","title":"您的账户还需要一些信息","add":"补充信息","logOut":"退出登录"},
};

export const fixGateWords = (locale: string): FixGateWords => FIX_GATE_WORDS[locale as Locale] ?? FIX_GATE_WORDS.en;
