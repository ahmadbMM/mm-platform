// "Remind me when booking opens" (RemindBell, lib/open-remind.ts; the booking app's customer features round, 2026-11-19,
// item 2) in every language the site speaks: the bell (btn, and set once the ask stands), the pop-up's title (opens, {0}
// when it opens), its offers (cal, upd), its state and taking it back (set, rm), what a refusal says (isOpen: it opened
// meanwhile; no: a reminder cannot be set for this date), a failure (failed), Close, and the calendar file's title (icsT,
// {0} the date's name; ride, a circuit night's name there). The ten languages the booking app speaks take its own words
// word for word (ormBtn, ormSet, ormOpens, ormCal, ormUpd, ormRm, ormIsOpen, ormNo, errConnection, closeBtn, ormIcsT,
// icsRideTitle: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German,
// Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md: "Updates" is the booking app's
// list, so they name it in English. Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type RemindWords = {
  btn: string; set: string; opens: string; cal: string; upd: string; rm: string;
  isOpen: string; no: string; failed: string; close: string; icsT: string; ride: string;
};

export const REMIND_WORDS: Record<Locale, RemindWords> = {
  en: { btn: "Remind me", set: "Reminder set", opens: "Booking opens {0}", cal: "Add to my calendar", upd: "Tell me in Updates", rm: "Remove reminder",
    isOpen: "Booking is open now", no: "A reminder can’t be set for this date", failed: "Connection error. Check your network.", close: "Close", icsT: "Booking opens: {0}", ride: "MicroMobility Ride" },
  ar: { btn: "ذكّرني", set: "تم ضبط التذكير", opens: "يفتح الحجز {0}", cal: "أضف إلى تقويمي", upd: "أخبرني في التحديثات", rm: "إزالة التذكير",
    isOpen: "الحجز مفتوح الآن", no: "لا يمكن ضبط تذكير لهذا الموعد", failed: "خطأ في الاتصال. تحقق من شبكتك.", close: "إغلاق", icsT: "يفتح الحجز: {0}", ride: "جولة MicroMobility" },
  id: { btn: "Ingatkan saya", set: "Pengingat dipasang", opens: "Pemesanan dibuka {0}", cal: "Tambahkan ke kalender saya", upd: "Beri tahu saya di Updates", rm: "Hapus pengingat",
    isOpen: "Pemesanan sudah dibuka", no: "Pengingat tidak dapat dipasang untuk tanggal ini", failed: "Kesalahan koneksi. Periksa jaringan Anda.", close: "Tutup", icsT: "Pemesanan dibuka: {0}", ride: "Bersepeda MicroMobility" },
  ms: { btn: "Ingatkan saya", set: "Peringatan ditetapkan", opens: "Tempahan dibuka {0}", cal: "Tambah ke kalendar saya", upd: "Beritahu saya dalam Updates", rm: "Buang peringatan",
    isOpen: "Tempahan sudah dibuka", no: "Peringatan tidak dapat ditetapkan untuk tarikh ini", failed: "Ralat sambungan. Semak rangkaian anda.", close: "Tutup", icsT: "Tempahan dibuka: {0}", ride: "Kayuhan MicroMobility" },
  de: { btn: "Erinnere mich", set: "Erinnerung gesetzt", opens: "Buchung öffnet {0}", cal: "Zu meinem Kalender hinzufügen", upd: "In Updates benachrichtigen", rm: "Erinnerung entfernen",
    isOpen: "Die Buchung ist jetzt geöffnet", no: "Für diesen Termin kann keine Erinnerung gesetzt werden", failed: "Verbindungsfehler. Prüfe dein Netzwerk.", close: "Schließen", icsT: "Buchung öffnet: {0}", ride: "MicroMobility-Fahrt" },
  es: { btn: "Recordármelo", set: "Recordatorio activado", opens: "Las reservas abren el {0}", cal: "Añadir a mi calendario", upd: "Avisarme en Novedades", rm: "Quitar recordatorio",
    isOpen: "Las reservas ya están abiertas", no: "No se puede poner un recordatorio para esta fecha", failed: "Error de conexión. Comprueba tu red.", close: "Cerrar", icsT: "Abren las reservas: {0}", ride: "Recorrido MicroMobility" },
  fr: { btn: "Me le rappeler", set: "Rappel activé", opens: "Ouverture des réservations : {0}", cal: "Ajouter à mon agenda", upd: "Me prévenir dans Nouveautés", rm: "Supprimer le rappel",
    isOpen: "Les réservations sont ouvertes", no: "Impossible de programmer un rappel pour cette date", failed: "Erreur de connexion. Vérifiez votre réseau.", close: "Fermer", icsT: "Ouverture des réservations : {0}", ride: "Sortie MicroMobility" },
  pt: { btn: "Lembrar-me", set: "Lembrete ativado", opens: "As reservas abrem {0}", cal: "Adicionar ao meu calendário", upd: "Avisar-me em Novidades", rm: "Remover lembrete",
    isOpen: "As reservas já estão abertas", no: "Não é possível definir um lembrete para esta data", failed: "Erro de conexão. Verifique sua rede.", close: "Fechar", icsT: "Abertura das reservas: {0}", ride: "Passeio MicroMobility" },
  tl: { btn: "Paalalahanan ako", set: "Naka-set ang paalala", opens: "Magbubukas ang booking sa {0}", cal: "Idagdag sa aking kalendaryo", upd: "Sabihan ako sa Mga update", rm: "Alisin ang paalala",
    isOpen: "Bukas na ang booking", no: "Hindi makapag-set ng paalala para sa petsang ito", failed: "Error sa koneksyon. Suriin ang iyong network.", close: "Isara", icsT: "Magbubukas ang booking: {0}", ride: "Ride sa MicroMobility" },
  ru: { btn: "Напомнить", set: "Напоминание установлено", opens: "Бронирование откроется {0}", cal: "Добавить в мой календарь", upd: "Сообщить в «Обновлениях» (Updates)", rm: "Удалить напоминание",
    isOpen: "Бронирование уже открыто", no: "Для этой даты нельзя установить напоминание", failed: "Ошибка соединения. Проверьте сеть.", close: "Закрыть", icsT: "Бронирование откроется: {0}", ride: "Поездка MicroMobility" },
  ur: { btn: "مجھے یاد دلائیں", set: "یاد دہانی لگ گئی", opens: "بکنگ کھلے گی: {0}", cal: "میرے کیلنڈر میں شامل کریں", upd: "اپ ڈیٹس میں بتائیں", rm: "یاد دہانی ہٹائیں",
    isOpen: "بکنگ اب کھل چکی ہے", no: "اس تاریخ کے لیے یاد دہانی نہیں لگ سکتی", failed: "کنکشن کی خرابی۔ اپنا نیٹ ورک چیک کریں۔", close: "بند کریں", icsT: "بکنگ کھلے گی: {0}", ride: "MicroMobility رائیڈ" },
  hi: { btn: "मुझे याद दिलाएँ", set: "रिमाइंडर सेट है", opens: "बुकिंग खुलेगी: {0}", cal: "मेरे कैलेंडर में जोड़ें", upd: "अपडेट में बताएँ", rm: "रिमाइंडर हटाएँ",
    isOpen: "बुकिंग अब खुल गई है", no: "इस तारीख के लिए रिमाइंडर नहीं लग सकता", failed: "कनेक्शन त्रुटि। अपना नेटवर्क जाँचें।", close: "बंद करें", icsT: "बुकिंग खुलेगी: {0}", ride: "MicroMobility राइड" },
  ne: { btn: "मलाई सम्झाउनुहोस्", set: "सम्झना राखियो", opens: "बुकिङ खुल्छ: {0}", cal: "मेरो क्यालेन्डरमा थप्नुहोस्", upd: "अपडेटहरूमा भन्नुहोस्", rm: "सम्झना हटाउनुहोस्",
    isOpen: "बुकिङ अब खुलेको छ", no: "यो मितिका लागि सम्झना राख्न सकिँदैन", failed: "जडान त्रुटि। आफ्नो नेटवर्क जाँच्नुहोस्।", close: "बन्द गर्नुहोस्", icsT: "बुकिङ खुल्छ: {0}", ride: "MicroMobility राइड" },
  bn: { btn: "আমাকে মনে করিয়ে দিন", set: "রিমাইন্ডার সেট আছে", opens: "বুকিং খুলবে: {0}", cal: "আমার ক্যালেন্ডারে যোগ করুন", upd: "আপডেটে জানান", rm: "রিমাইন্ডার সরান",
    isOpen: "বুকিং এখন খোলা", no: "এই তারিখের জন্য রিমাইন্ডার সেট করা যাবে না", failed: "সংযোগে সমস্যা। আপনার নেটওয়ার্ক দেখে নিন।", close: "বন্ধ করুন", icsT: "বুকিং খুলবে: {0}", ride: "MicroMobility রাইড" },
  zh: { btn: "提醒我", set: "已设置提醒", opens: "{0} 开放预订", cal: "添加到我的日历", upd: "在 Updates 中通知我", rm: "移除提醒",
    isOpen: "现已开放预订", no: "无法为此日期设置提醒", failed: "连接错误，请检查网络。", close: "关闭", icsT: "开放预订：{0}", ride: "MicroMobility 骑行" },
  ja: { btn: "リマインド", set: "リマインダー設定済み", opens: "予約開始：{0}", cal: "カレンダーに追加", upd: "Updates でお知らせ", rm: "リマインダーを解除",
    isOpen: "予約の受付が始まりました", no: "この日程にはリマインダーを設定できません", failed: "接続エラーです。ネットワークを確認してください。", close: "閉じる", icsT: "予約開始：{0}", ride: "MicroMobility ライド" },
};

export const remindWords = (locale: string): RemindWords => REMIND_WORDS[locale as Locale] ?? REMIND_WORDS.en;
