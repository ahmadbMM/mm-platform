// "Need help?" on the ticket (TicketCard, TicketHelp; lib/ride-help.ts; the booking app's help on the ride, 2026-11-16) in
// every language the site speaks: the button and the pop-up's title (btn), what is wrong (lost, hurt, bike, other), WhatsApp
// us, Call us, the ambulance with its number, the words a screen reader gives the pin once the location is in the message
// (loc), and Close. The ten languages the booking app speaks take its own words word for word (rhBtn, rhLost, rhHurt, rhBike,
// rhOther, rhWa, rhCall, rhAmb, rhLoc and closeBtn in app.src.html and its i18n/<code>.json). Indonesian, Malay, German,
// Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md, with the site's own WhatsApp us,
// Call us and Close. The message the rider sends is not here: it is English or Arabic (lib/ride-help.ts RH_MSG). Change a
// text here in every language at once; the Help page's "Rides & bookings" answer names the button in each language.
import type { Locale } from "@/i18n/locales";
import type { RhKind } from "@/lib/ride-help";

export type RideHelpWords = Record<RhKind, string> & { btn: string; wa: string; call: string; amb: string; loc: string; close: string };

export const RIDE_HELP_WORDS: Record<Locale, RideHelpWords> = {
  en: {
    btn: "Need help?", lost: "I can't find the group", hurt: "I'm hurt or unwell", bike: "My bike broke down", other: "Something else",
    wa: "WhatsApp us", call: "Call us", amb: "Ambulance 997", loc: "with your location", close: "Close",
  },
  ar: {
    btn: "تحتاج مساعدة؟", lost: "لا أجد المجموعة", hurt: "أنا مصاب أو لست بخير", bike: "تعطلت دراجتي", other: "شيء آخر",
    wa: "راسلنا واتساب", call: "اتصل بنا", amb: "الإسعاف 997", loc: "مع موقعك", close: "إغلاق",
  },
  id: {
    btn: "Butuh bantuan?", lost: "Saya tidak menemukan grup", hurt: "Saya cedera atau tidak enak badan", bike: "Sepeda saya rusak", other: "Lainnya",
    wa: "Hubungi via WhatsApp", call: "Telepon kami", amb: "Ambulans 997", loc: "dengan lokasi Anda", close: "Tutup",
  },
  ms: {
    btn: "Perlukan bantuan?", lost: "Saya tidak jumpa kumpulan", hurt: "Saya cedera atau tidak sihat", bike: "Basikal saya rosak", other: "Lain-lain",
    wa: "WhatsApp kami", call: "Telefon kami", amb: "Ambulans 997", loc: "dengan lokasi anda", close: "Tutup",
  },
  de: {
    btn: "Brauchst du Hilfe?", lost: "Ich finde die Gruppe nicht", hurt: "Ich bin verletzt oder mir geht es nicht gut", bike: "Mein Rad ist kaputt", other: "Etwas anderes",
    wa: "Schreib uns auf WhatsApp", call: "Ruf uns an", amb: "Krankenwagen 997", loc: "mit deinem Standort", close: "Schließen",
  },
  es: {
    btn: "¿Necesitas ayuda?", lost: "No encuentro al grupo", hurt: "Estoy herido o no me siento bien", bike: "Mi bici se averió", other: "Otra cosa",
    wa: "Escríbenos por WhatsApp", call: "Llámanos", amb: "Ambulancia 997", loc: "con tu ubicación", close: "Cerrar",
  },
  fr: {
    btn: "Besoin d'aide ?", lost: "Je ne trouve pas le groupe", hurt: "Je suis blessé ou je ne me sens pas bien", bike: "Mon vélo est en panne", other: "Autre chose",
    wa: "Écrivez-nous sur WhatsApp", call: "Appelez-nous", amb: "Ambulance 997", loc: "avec votre position", close: "Fermer",
  },
  pt: {
    btn: "Precisa de ajuda?", lost: "Não encontro o grupo", hurt: "Estou ferido ou não me sinto bem", bike: "A minha bicicleta avariou", other: "Outra coisa",
    wa: "Fale connosco no WhatsApp", call: "Ligue-nos", amb: "Ambulância 997", loc: "com a sua localização", close: "Fechar",
  },
  tl: {
    btn: "Kailangan ng tulong?", lost: "Hindi ko makita ang grupo", hurt: "Nasaktan ako o masama ang pakiramdam ko", bike: "Nasira ang bisikleta ko", other: "Iba pa",
    wa: "Mag-WhatsApp sa amin", call: "Tawagan kami", amb: "Ambulansya 997", loc: "kasama ang lokasyon mo", close: "Isara",
  },
  ru: {
    btn: "Нужна помощь?", lost: "Не могу найти группу", hurt: "У меня травма или плохое самочувствие", bike: "Велосипед сломался", other: "Другое",
    wa: "Написать в WhatsApp", call: "Позвонить нам", amb: "Скорая помощь 997", loc: "с вашим местоположением", close: "Закрыть",
  },
  ur: {
    btn: "مدد چاہیے؟", lost: "مجھے گروپ نہیں مل رہا", hurt: "میں زخمی ہوں یا طبیعت ٹھیک نہیں", bike: "میری سائیکل خراب ہو گئی", other: "کچھ اور",
    wa: "واٹس ایپ پر لکھیں", call: "ہمیں کال کریں", amb: "ایمبولینس 997", loc: "آپ کی لوکیشن کے ساتھ", close: "بند کریں",
  },
  hi: {
    btn: "मदद चाहिए?", lost: "मुझे ग्रुप नहीं मिल रहा", hurt: "मुझे चोट लगी है या तबीयत ठीक नहीं", bike: "मेरी साइकिल खराब हो गई", other: "कुछ और",
    wa: "WhatsApp पर लिखें", call: "हमें कॉल करें", amb: "एम्बुलेंस 997", loc: "आपकी लोकेशन के साथ", close: "बंद करें",
  },
  ne: {
    btn: "सहयोग चाहिन्छ?", lost: "मैले समूह भेटिनँ", hurt: "म घाइते छु वा मलाई सन्चो छैन", bike: "मेरो साइकल बिग्रियो", other: "अरू केही",
    wa: "WhatsApp मा लेख्नुहोस्", call: "हामीलाई फोन गर्नुहोस्", amb: "एम्बुलेन्स 997", loc: "तपाईंको लोकेसनसहित", close: "बन्द गर्नुहोस्",
  },
  bn: {
    btn: "সাহায্য দরকার?", lost: "দলটিকে খুঁজে পাচ্ছি না", hurt: "আমি আহত বা অসুস্থ বোধ করছি", bike: "আমার সাইকেল নষ্ট হয়ে গেছে", other: "অন্য কিছু",
    wa: "WhatsApp-এ লিখুন", call: "আমাদের কল করুন", amb: "অ্যাম্বুলেন্স 997", loc: "আপনার লোকেশনসহ", close: "বন্ধ করুন",
  },
  zh: {
    btn: "需要帮助？", lost: "我找不到队伍", hurt: "我受伤了或身体不适", bike: "我的自行车坏了", other: "其他",
    wa: "WhatsApp 联系我们", call: "致电我们", amb: "救护车 997", loc: "附带您的位置", close: "关闭",
  },
  ja: {
    btn: "お困りですか？", lost: "グループが見つかりません", hurt: "けがをしたか、体調がよくありません", bike: "自転車が故障しました", other: "その他",
    wa: "WhatsAppで連絡", call: "電話する", amb: "救急車（997）", loc: "現在地付き", close: "閉じる",
  },
};

export const rideHelpWords = (locale: string): RideHelpWords => RIDE_HELP_WORDS[locale as Locale] ?? RIDE_HELP_WORDS.en;
