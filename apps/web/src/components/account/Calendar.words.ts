// My Account's Calendar section and its pop-up (CalendarFeed.tsx, lib/calendar-feed.ts; the booking app's Account row
// "Calendar" and calendar-feed.js, 2026-11-13, new features F27) in every language the site speaks: the section's name
// (row, also the pop-up's kicker), the pop-up's title, Add to my calendar, Copy the address, Replace the address, the
// question before a replace (askTitle, askBody), the line when the key did not come or a replace failed (err), Close,
// Try again, Loading and the question's Cancel (it dismisses; the dictionaries' "Cancel" cancels a booking). The ten
// languages the booking app speaks take its own words word for word (calViewCal, closeBtn, retryBtn, loadingLabel and
// cancelBtn: English and Arabic in app.src.html, the others in its i18n/<code>.json; the rest in calendar-feed.js
// CALF_T). Indonesian, Malay, German, Russian, Chinese and Japanese, which it does not speak, follow
// src/i18n/TRANSLATING.md (Close, Try again and Loading as the site's dictionaries already say them). Change a text here
// in every language at once.
import type { Locale } from "@/i18n/locales";

export type CalendarWords = {
  row: string; title: string; add: string; copy: string; replace: string; askTitle: string; askBody: string;
  err: string; close: string; retry: string; loading: string; cancel: string;
};

export const CALENDAR_WORDS: Record<Locale, CalendarWords> = {
  en: {
    row: "Calendar", title: "Your bookings in your calendar", add: "Add to my calendar", copy: "Copy the address", replace: "Replace the address",
    askTitle: "Replace the address?", askBody: "The old address stops working. A calendar that uses it will no longer update.",
    err: "We could not do that. Please try again.", close: "Close", retry: "Try again", loading: "Loading…", cancel: "Cancel",
  },
  ar: {
    row: "تقويم", title: "حجوزاتك في تقويمك", add: "أضف إلى تقويمي", copy: "نسخ العنوان", replace: "استبدال العنوان",
    askTitle: "استبدال العنوان؟", askBody: "سيتوقف العنوان القديم عن العمل، ولن يتحدّث أي تقويم يستخدمه بعد الآن.",
    err: "تعذّر ذلك. يرجى المحاولة مرة أخرى.", close: "إغلاق", retry: "إعادة المحاولة", loading: "جارٍ التحميل…", cancel: "إلغاء",
  },
  id: {
    row: "Kalender", title: "Pemesanan Anda di kalender Anda", add: "Tambahkan ke kalender saya", copy: "Salin alamat", replace: "Ganti alamat",
    askTitle: "Ganti alamat?", askBody: "Alamat lama tidak akan berfungsi lagi. Kalender yang memakainya tidak akan diperbarui lagi.",
    err: "Tidak dapat dilakukan. Silakan coba lagi.", close: "Tutup", retry: "Coba lagi", loading: "Memuat…", cancel: "Batal",
  },
  ms: {
    row: "Kalendar", title: "Tempahan anda dalam kalendar anda", add: "Tambah ke kalendar saya", copy: "Salin alamat", replace: "Tukar alamat",
    askTitle: "Tukar alamat?", askBody: "Alamat lama tidak akan berfungsi lagi. Kalendar yang menggunakannya tidak akan dikemas kini lagi.",
    err: "Tidak dapat dilakukan. Sila cuba lagi.", close: "Tutup", retry: "Cuba lagi", loading: "Memuatkan…", cancel: "Batal",
  },
  de: {
    row: "Kalender", title: "Deine Buchungen in deinem Kalender", add: "Zu meinem Kalender hinzufügen", copy: "Adresse kopieren", replace: "Adresse ersetzen",
    askTitle: "Adresse ersetzen?", askBody: "Die alte Adresse funktioniert dann nicht mehr. Ein Kalender, der sie nutzt, wird nicht mehr aktualisiert.",
    err: "Das hat nicht geklappt. Bitte versuch es noch einmal.", close: "Schließen", retry: "Erneut versuchen", loading: "Wird geladen …", cancel: "Abbrechen",
  },
  es: {
    row: "Calendario", title: "Tus reservas en tu calendario", add: "Añadir a mi calendario", copy: "Copiar la dirección", replace: "Reemplazar la dirección",
    askTitle: "¿Reemplazar la dirección?", askBody: "La dirección anterior dejará de funcionar. Un calendario que la use ya no se actualizará.",
    err: "No se pudo hacer. Inténtalo de nuevo.", close: "Cerrar", retry: "Reintentar", loading: "Cargando…", cancel: "Cancelar",
  },
  fr: {
    row: "Calendrier", title: "Vos réservations dans votre calendrier", add: "Ajouter à mon calendrier", copy: "Copier l’adresse", replace: "Remplacer l’adresse",
    askTitle: "Remplacer l’adresse ?", askBody: "L’ancienne adresse cessera de fonctionner. Un calendrier qui l’utilise ne se mettra plus à jour.",
    err: "Action impossible. Veuillez réessayer.", close: "Fermer", retry: "Réessayer", loading: "Chargement…", cancel: "Annuler",
  },
  pt: {
    row: "Calendário", title: "As suas reservas no seu calendário", add: "Adicionar ao meu calendário", copy: "Copiar o endereço", replace: "Substituir o endereço",
    askTitle: "Substituir o endereço?", askBody: "O endereço antigo deixa de funcionar. Um calendário que o utilize deixará de ser atualizado.",
    err: "Não foi possível. Tente novamente.", close: "Fechar", retry: "Tentar novamente", loading: "Carregando…", cancel: "Cancelar",
  },
  tl: {
    row: "Kalendaryo", title: "Ang mga booking mo sa kalendaryo mo", add: "Idagdag sa kalendaryo ko", copy: "Kopyahin ang address", replace: "Palitan ang address",
    askTitle: "Palitan ang address?", askBody: "Hindi na gagana ang lumang address. Hindi na mag-a-update ang kalendaryong gumagamit nito.",
    err: "Hindi ito nagawa. Pakisubukang muli.", close: "Isara", retry: "Subukan ulit", loading: "Naglo-load…", cancel: "Kanselahin",
  },
  ru: {
    row: "Календарь", title: "Ваши бронирования в вашем календаре", add: "Добавить в мой календарь", copy: "Скопировать адрес", replace: "Заменить адрес",
    askTitle: "Заменить адрес?", askBody: "Старый адрес перестанет работать. Календарь, который его использует, больше не будет обновляться.",
    err: "Не получилось. Попробуйте ещё раз.", close: "Закрыть", retry: "Попробовать снова", loading: "Загрузка…", cancel: "Отмена",
  },
  ur: {
    row: "کیلنڈر", title: "آپ کی بکنگز آپ کے کیلنڈر میں", add: "میرے کیلنڈر میں شامل کریں", copy: "پتہ کاپی کریں", replace: "پتہ تبدیل کریں",
    askTitle: "پتہ تبدیل کریں؟", askBody: "پرانا پتہ کام کرنا بند کر دے گا۔ جو کیلنڈر اسے استعمال کرتا ہے وہ مزید اپ ڈیٹ نہیں ہوگا۔",
    err: "یہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔", close: "بند کریں", retry: "دوبارہ کوشش کریں", loading: "لوڈ ہو رہا ہے…", cancel: "منسوخ",
  },
  hi: {
    row: "कैलेंडर", title: "आपकी बुकिंग आपके कैलेंडर में", add: "मेरे कैलेंडर में जोड़ें", copy: "पता कॉपी करें", replace: "पता बदलें",
    askTitle: "पता बदलें?", askBody: "पुराना पता काम करना बंद कर देगा। जो कैलेंडर उसका इस्तेमाल करता है, वह आगे अपडेट नहीं होगा।",
    err: "यह नहीं हो सका। फिर कोशिश करें।", close: "बंद करें", retry: "फिर कोशिश करें", loading: "लोड हो रहा है…", cancel: "रद्द करें",
  },
  ne: {
    row: "पात्रो", title: "तपाईंका बुकिङहरू तपाईंको पात्रोमा", add: "मेरो पात्रोमा थप्नुहोस्", copy: "ठेगाना कपी गर्नुहोस्", replace: "ठेगाना बदल्नुहोस्",
    askTitle: "ठेगाना बदल्ने?", askBody: "पुरानो ठेगानाले काम गर्न छोड्नेछ। त्यो प्रयोग गर्ने पात्रो अब अपडेट हुने छैन।",
    err: "यो हुन सकेन। फेरि प्रयास गर्नुहोस्।", close: "बन्द गर्नुहोस्", retry: "फेरि प्रयास गर्नुहोस्", loading: "लोड हुँदैछ…", cancel: "रद्द",
  },
  bn: {
    row: "ক্যালেন্ডার", title: "আপনার ক্যালেন্ডারে আপনার বুকিং", add: "আমার ক্যালেন্ডারে যোগ করুন", copy: "ঠিকানা কপি করুন", replace: "ঠিকানা বদলান",
    askTitle: "ঠিকানা বদলাবেন?", askBody: "পুরোনো ঠিকানা আর কাজ করবে না। যে ক্যালেন্ডার সেটি ব্যবহার করে, তা আর আপডেট হবে না।",
    err: "এটি করা যায়নি। আবার চেষ্টা করুন।", close: "বন্ধ করুন", retry: "আবার চেষ্টা করুন", loading: "লোড হচ্ছে…", cancel: "বাতিল",
  },
  zh: {
    row: "日历", title: "在您的日历中查看预订", add: "添加到我的日历", copy: "复制地址", replace: "更换地址",
    askTitle: "更换地址？", askBody: "旧地址将失效，使用它的日历将不再更新。",
    err: "操作未能完成，请重试。", close: "关闭", retry: "重试", loading: "正在加载…", cancel: "取消",
  },
  ja: {
    row: "カレンダー", title: "予約をカレンダーで確認", add: "カレンダーに追加", copy: "アドレスをコピー", replace: "アドレスを再発行",
    askTitle: "アドレスを再発行しますか？", askBody: "古いアドレスは使えなくなります。そのアドレスを使っているカレンダーは更新されなくなります。",
    err: "うまくいきませんでした。もう一度お試しください。", close: "閉じる", retry: "再試行", loading: "読み込み中…", cancel: "キャンセル",
  },
};

export const calendarWords = (locale: string): CalendarWords => CALENDAR_WORDS[locale as Locale] ?? CALENDAR_WORDS.en;
