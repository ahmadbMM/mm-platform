// "Report a bike problem" on the ticket (TicketCard, TicketBikeReport; the booking app's _brpHtml and bike-report.js,
// 2026-11-13, new features F15) in every language the site speaks: the button (btn) and the chip after a report (sent),
// and the pop-up's words: which bike, the seven faults (the database's names, lib/bike-report.ts BRP_FAULTS), the note,
// Send report, Close, the line when no fault is picked (pick) and the one when it could not be sent (err). The ten
// languages the booking app speaks take its own words word for word (brpBtn, brpSent in app.src.html and its
// i18n/<code>.json; the pop-up's in bike-report.js BRP_T). Indonesian, Malay, German, Russian, Chinese and Japanese,
// which it does not speak, follow src/i18n/TRANSLATING.md. Change a text here in every language at once.
import type { Locale } from "@/i18n/locales";
import type { BrpFault } from "@/lib/bike-report";

export type BikeReportWords = Record<BrpFault, string> & {
  btn: string; sent: string; bike: string; note: string; send: string; close: string; pick: string; err: string;
};

export const BIKE_REPORT_WORDS: Record<Locale, BikeReportWords> = {
  en: {
    btn: "Report a bike problem", sent: "Problem reported", bike: "Bike",
    brakes: "Brakes", gears: "Gears", tyre: "Tyre", chain: "Chain", saddle: "Saddle", lights: "Lights", other: "Other",
    note: "Note (optional)", send: "Send report", close: "Close", pick: "Choose what is wrong.", err: "We could not send it. Please try again.",
  },
  ar: {
    btn: "الإبلاغ عن مشكلة في الدراجة", sent: "تم الإبلاغ عن المشكلة", bike: "الدراجة",
    brakes: "المكابح", gears: "ناقل السرعات", tyre: "الإطار", chain: "السلسلة", saddle: "المقعد", lights: "الأضواء", other: "أخرى",
    note: "ملاحظة (اختياري)", send: "إرسال البلاغ", close: "إغلاق", pick: "اختر نوع المشكلة.", err: "تعذّر الإرسال. يرجى المحاولة مرة أخرى.",
  },
  id: {
    btn: "Laporkan masalah sepeda", sent: "Masalah dilaporkan", bike: "Sepeda",
    brakes: "Rem", gears: "Gigi", tyre: "Ban", chain: "Rantai", saddle: "Sadel", lights: "Lampu", other: "Lainnya",
    note: "Catatan (opsional)", send: "Kirim laporan", close: "Tutup", pick: "Pilih masalahnya.", err: "Laporan gagal dikirim. Silakan coba lagi.",
  },
  ms: {
    btn: "Laporkan masalah basikal", sent: "Masalah dilaporkan", bike: "Basikal",
    brakes: "Brek", gears: "Gear", tyre: "Tayar", chain: "Rantai", saddle: "Tempat duduk", lights: "Lampu", other: "Lain-lain",
    note: "Nota (pilihan)", send: "Hantar laporan", close: "Tutup", pick: "Pilih masalahnya.", err: "Laporan tidak dapat dihantar. Sila cuba lagi.",
  },
  de: {
    btn: "Problem mit dem Rad melden", sent: "Problem gemeldet", bike: "Rad",
    brakes: "Bremsen", gears: "Schaltung", tyre: "Reifen", chain: "Kette", saddle: "Sattel", lights: "Licht", other: "Sonstiges",
    note: "Notiz (optional)", send: "Meldung senden", close: "Schließen", pick: "Wähle aus, was nicht stimmt.", err: "Die Meldung konnte nicht gesendet werden. Bitte versuch es noch einmal.",
  },
  es: {
    btn: "Informar de un problema con la bici", sent: "Problema comunicado", bike: "Bici",
    brakes: "Frenos", gears: "Cambios", tyre: "Neumático", chain: "Cadena", saddle: "Sillín", lights: "Luces", other: "Otro",
    note: "Nota (opcional)", send: "Enviar aviso", close: "Cerrar", pick: "Elige el problema.", err: "No se pudo enviar. Inténtalo de nuevo.",
  },
  fr: {
    btn: "Signaler un problème de vélo", sent: "Problème signalé", bike: "Vélo",
    brakes: "Freins", gears: "Vitesses", tyre: "Pneu", chain: "Chaîne", saddle: "Selle", lights: "Éclairage", other: "Autre",
    note: "Note (facultatif)", send: "Envoyer le signalement", close: "Fermer", pick: "Choisissez le problème.", err: "Envoi impossible. Veuillez réessayer.",
  },
  pt: {
    btn: "Comunicar um problema na bicicleta", sent: "Problema comunicado", bike: "Bicicleta",
    brakes: "Travões", gears: "Mudanças", tyre: "Pneu", chain: "Corrente", saddle: "Selim", lights: "Luzes", other: "Outro",
    note: "Nota (opcional)", send: "Enviar aviso", close: "Fechar", pick: "Escolha o problema.", err: "Não foi possível enviar. Tente novamente.",
  },
  tl: {
    btn: "I-report ang problema sa bike", sent: "Nai-report na ang problema", bike: "Bike",
    brakes: "Preno", gears: "Gear", tyre: "Gulong", chain: "Kadena", saddle: "Upuan", lights: "Ilaw", other: "Iba pa",
    note: "Tala (opsyonal)", send: "Ipadala ang report", close: "Isara", pick: "Piliin ang problema.", err: "Hindi naipadala. Pakisubukang muli.",
  },
  ru: {
    btn: "Сообщить о проблеме с велосипедом", sent: "Сообщение отправлено", bike: "Велосипед",
    brakes: "Тормоза", gears: "Передачи", tyre: "Шина", chain: "Цепь", saddle: "Седло", lights: "Фонари", other: "Другое",
    note: "Комментарий (необязательно)", send: "Отправить", close: "Закрыть", pick: "Выберите, что не так.", err: "Не удалось отправить. Попробуйте ещё раз.",
  },
  ur: {
    btn: "سائیکل کی خرابی کی اطلاع دیں", sent: "خرابی کی اطلاع دے دی گئی", bike: "سائیکل",
    brakes: "بریک", gears: "گیئر", tyre: "ٹائر", chain: "چین", saddle: "سیٹ", lights: "لائٹس", other: "دیگر",
    note: "نوٹ (اختیاری)", send: "اطلاع بھیجیں", close: "بند کریں", pick: "خرابی منتخب کریں۔", err: "بھیجا نہیں جا سکا۔ دوبارہ کوشش کریں۔",
  },
  hi: {
    btn: "साइकिल की समस्या बताएँ", sent: "समस्या बता दी गई", bike: "साइकिल",
    brakes: "ब्रेक", gears: "गियर", tyre: "टायर", chain: "चेन", saddle: "सीट", lights: "लाइट", other: "अन्य",
    note: "नोट (वैकल्पिक)", send: "रिपोर्ट भेजें", close: "बंद करें", pick: "समस्या चुनें।", err: "भेजा नहीं जा सका। फिर कोशिश करें।",
  },
  ne: {
    btn: "साइकलको समस्या रिपोर्ट गर्नुहोस्", sent: "समस्या रिपोर्ट गरियो", bike: "साइकल",
    brakes: "ब्रेक", gears: "गियर", tyre: "टायर", chain: "चेन", saddle: "सिट", lights: "बत्ती", other: "अन्य",
    note: "टिप्पणी (ऐच्छिक)", send: "रिपोर्ट पठाउनुहोस्", close: "बन्द गर्नुहोस्", pick: "समस्या छान्नुहोस्।", err: "पठाउन सकिएन। फेरि प्रयास गर्नुहोस्।",
  },
  bn: {
    btn: "সাইকেলের সমস্যা জানান", sent: "সমস্যা জানানো হয়েছে", bike: "সাইকেল",
    brakes: "ব্রেক", gears: "গিয়ার", tyre: "টায়ার", chain: "চেইন", saddle: "সিট", lights: "লাইট", other: "অন্যান্য",
    note: "নোট (ঐচ্ছিক)", send: "রিপোর্ট পাঠান", close: "বন্ধ করুন", pick: "সমস্যাটি বেছে নিন।", err: "পাঠানো যায়নি। আবার চেষ্টা করুন।",
  },
  zh: {
    btn: "报告自行车问题", sent: "问题已报告", bike: "自行车",
    brakes: "刹车", gears: "变速", tyre: "轮胎", chain: "链条", saddle: "车座", lights: "车灯", other: "其他",
    note: "备注（选填）", send: "发送报告", close: "关闭", pick: "请选择问题。", err: "发送失败，请重试。",
  },
  ja: {
    btn: "自転車の不具合を報告", sent: "不具合を報告しました", bike: "自転車",
    brakes: "ブレーキ", gears: "変速", tyre: "タイヤ", chain: "チェーン", saddle: "サドル", lights: "ライト", other: "その他",
    note: "メモ（任意）", send: "報告を送信", close: "閉じる", pick: "不具合の内容を選んでください。", err: "送信できませんでした。もう一度お試しください。",
  },
};

export const bikeReportWords = (locale: string): BikeReportWords => BIKE_REPORT_WORDS[locale as Locale] ?? BIKE_REPORT_WORDS.en;
