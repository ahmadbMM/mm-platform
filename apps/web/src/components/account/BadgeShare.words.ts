// The words of the share pop-up (ShareImage.tsx: a badge on My Account, the title on /club) in every language the site
// speaks, kept apart from the site's translation dictionaries as the badge request's are (BadgeRequest.words.ts): the ten
// languages the booking app speaks take its own wording (badge-share.js SHR_T, tcShare and closeWord, 2026-11-13);
// Indonesian, Malay, German, Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md and
// the words the site already gives Share, Close and Try again. Change a text in every language at once.
import type { Locale } from "@/i18n/locales";

export type ShareWords = { share: string; close: string; badge: string; title: string; name: string; save: string; making: string; err: string; retry: string };

export const SHARE_WORDS: Record<Locale, ShareWords> = {
  en: { share: "Share", close: "Close", badge: "Badge earned", title: "Title", name: "Include my first name", save: "Save image", making: "Making the image", err: "We could not make the image. Please try again.", retry: "Try again" },
  ar: { share: "مشاركة", close: "إغلاق", badge: "وسام مكتسب", title: "لقب", name: "إضافة اسمي الأول", save: "حفظ الصورة", making: "جارٍ تجهيز الصورة", err: "تعذّر تجهيز الصورة. يرجى المحاولة مرة أخرى.", retry: "حاول مرة أخرى" },
  fr: { share: "Partager", close: "Fermer", badge: "Badge obtenu", title: "Titre", name: "Ajouter mon prénom", save: "Enregistrer l’image", making: "Création de l’image", err: "Impossible de créer l’image. Veuillez réessayer.", retry: "Réessayer" },
  es: { share: "Compartir", close: "Cerrar", badge: "Insignia conseguida", title: "Título", name: "Incluir mi nombre", save: "Guardar imagen", making: "Creando la imagen", err: "No se pudo crear la imagen. Inténtalo de nuevo.", retry: "Reintentar" },
  pt: { share: "Compartilhar", close: "Fechar", badge: "Conquista obtida", title: "Título", name: "Incluir o meu primeiro nome", save: "Guardar imagem", making: "A criar a imagem", err: "Não foi possível criar a imagem. Tente novamente.", retry: "Tentar novamente" },
  ur: { share: "شیئر کریں", close: "بند کریں", badge: "بیج حاصل کیا", title: "خطاب", name: "میرا پہلا نام شامل کریں", save: "تصویر محفوظ کریں", making: "تصویر تیار ہو رہی ہے", err: "تصویر نہیں بن سکی۔ دوبارہ کوشش کریں۔", retry: "دوبارہ کوشش کریں" },
  hi: { share: "शेयर करें", close: "बंद करें", badge: "बैज अर्जित", title: "खिताब", name: "मेरा पहला नाम जोड़ें", save: "चित्र सहेजें", making: "चित्र बन रहा है", err: "चित्र नहीं बन सका। फिर कोशिश करें।", retry: "फिर कोशिश करें" },
  tl: { share: "I-share", close: "Isara", badge: "Nakuhang badge", title: "Titulo", name: "Isama ang unang pangalan ko", save: "I-save ang larawan", making: "Ginagawa ang larawan", err: "Hindi nagawa ang larawan. Pakisubukang muli.", retry: "Subukang muli" },
  ne: { share: "सेयर गर्नुहोस्", close: "बन्द", badge: "ब्याज कमाइयो", title: "उपाधि", name: "मेरो पहिलो नाम राख्नुहोस्", save: "तस्बिर सेभ गर्नुहोस्", making: "तस्बिर बन्दैछ", err: "तस्बिर बन्न सकेन। फेरि प्रयास गर्नुहोस्।", retry: "फेरि प्रयास गर्नुहोस्" },
  bn: { share: "শেয়ার করুন", close: "বন্ধ", badge: "ব্যাজ অর্জিত", title: "উপাধি", name: "আমার প্রথম নাম যোগ করুন", save: "ছবি সেভ করুন", making: "ছবি তৈরি হচ্ছে", err: "ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।", retry: "আবার চেষ্টা করুন" },
  id: { share: "Bagikan", close: "Tutup", badge: "Lencana diraih", title: "Gelar", name: "Sertakan nama depan saya", save: "Simpan gambar", making: "Membuat gambar", err: "Gambar tidak dapat dibuat. Silakan coba lagi.", retry: "Coba lagi" },
  ms: { share: "Kongsi", close: "Tutup", badge: "Lencana dicapai", title: "Gelaran", name: "Sertakan nama pertama saya", save: "Simpan imej", making: "Membuat imej", err: "Imej tidak dapat dibuat. Sila cuba lagi.", retry: "Cuba lagi" },
  de: { share: "Teilen", close: "Schließen", badge: "Abzeichen verdient", title: "Titel", name: "Meinen Vornamen hinzufügen", save: "Bild speichern", making: "Bild wird erstellt", err: "Das Bild konnte nicht erstellt werden. Bitte versuche es erneut.", retry: "Erneut versuchen" },
  ru: { share: "Поделиться", close: "Закрыть", badge: "Значок получен", title: "Титул", name: "Добавить моё имя", save: "Сохранить изображение", making: "Создаём изображение", err: "Не удалось создать изображение. Попробуйте ещё раз.", retry: "Попробовать снова" },
  zh: { share: "分享", close: "关闭", badge: "已获得徽章", title: "头衔", name: "加上我的名字", save: "保存图片", making: "正在生成图片", err: "无法生成图片。请重试。", retry: "重试" },
  ja: { share: "シェア", close: "閉じる", badge: "バッジ獲得", title: "称号", name: "自分の名前を入れる", save: "画像を保存", making: "画像を作成中", err: "画像を作成できませんでした。もう一度お試しください。", retry: "再試行" },
};

export const shareWords = (locale: string): ShareWords => SHARE_WORDS[locale as Locale] ?? SHARE_WORDS.en;
