// The waitlist claim card's words in every language the site speaks (ClaimCard.tsx). Kept apart from
// the site's dictionaries (src/i18n/tx), like the post-ride rating's: the ten languages the booking
// app speaks take its own wording word for word (wlcKicker, wlcTitle, wlcEnds, wlcClaim, wlcDecline,
// wlcDoneTitle, wlcDoneSub, wlcLateTitle, wlcLateSub, wlcFullSub, wlcGoneSub, wlcNoTitle, wlcNoSub,
// pgErrNet, retryBtn and tabMyRides: English and Arabic in app.src.html, the others in its
// i18n/<code>.json), so a rider reads the same card on either site. Indonesian, Malay, German,
// Russian, Chinese and Japanese, which the booking app does not speak, follow src/i18n/TRANSLATING.md:
// the app's label My Bookings is given in English, in brackets after a translation where the site's
// dictionaries do the same.
import type { Locale } from "@/i18n/locales";

export type ClaimWords = {
  kicker: string; title: string; ends: string; claim: string; decline: string;
  doneTitle: string; doneSub: string; lateTitle: string; lateSub: string; fullSub: string; goneSub: string;
  noTitle: string; noSub: string; net: string; retry: string; mine: string;
};

export const CLAIM_WORDS: Record<Locale, ClaimWords> = {
  en: {
    kicker: "Waitlist", title: "A place is free for you", ends: "It is yours if you claim it within", claim: "Claim my place", decline: "I can't come",
    doneTitle: "Your place is booked", doneSub: "See you on the ride. Your ticket is in My Bookings.",
    lateTitle: "This offer has ended", lateSub: "The time to claim it ran out, so the place went to the next rider. You are still on the waitlist.",
    fullSub: "The place was taken before you claimed it. You are still on the waitlist.",
    goneSub: "This link no longer holds an offer. Your bookings are in My Bookings.",
    noTitle: "Thank you for telling us", noSub: "The place goes to the next rider. You are still on the waitlist.",
    net: "Couldn’t save. Check your connection and try again.", retry: "Try again", mine: "My Bookings",
  },
  ar: {
    kicker: "قائمة الانتظار", title: "يوجد مكان شاغر لك", ends: "المكان لك إذا أكّدته خلال", claim: "أكّد مكاني", decline: "لا أستطيع الحضور",
    doneTitle: "تم حجز مكانك", doneSub: "نراك في الرحلة. تذكرتك في «حجوزاتي».",
    lateTitle: "انتهى هذا العرض", lateSub: "انتهى وقت التأكيد فانتقل المكان إلى الراكب التالي. ما زلت في قائمة الانتظار.",
    fullSub: "تم شغل المكان قبل أن تؤكّده. ما زلت في قائمة الانتظار.",
    goneSub: "لم يعد هذا الرابط يحمل عرضاً. حجوزاتك في «حجوزاتي».",
    noTitle: "شكراً لإبلاغنا", noSub: "ينتقل المكان إلى الراكب التالي. ما زلت في قائمة الانتظار.",
    net: "لم نتمكن من الحفظ. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.", retry: "إعادة المحاولة", mine: "حجوزاتي",
  },
  id: {
    kicker: "Daftar tunggu", title: "Ada tempat kosong untuk Anda", ends: "Tempat ini milik Anda jika Anda mengambilnya dalam", claim: "Ambil tempat saya", decline: "Saya tidak bisa datang",
    doneTitle: "Tempat Anda sudah dipesan", doneSub: "Sampai jumpa di sesi bersepeda. Tiket Anda ada di My Bookings.",
    lateTitle: "Penawaran ini sudah berakhir", lateSub: "Waktu untuk mengambilnya sudah habis, jadi tempat ini diberikan kepada pesepeda berikutnya. Anda masih ada di daftar tunggu.",
    fullSub: "Tempat ini sudah diambil sebelum Anda mengambilnya. Anda masih ada di daftar tunggu.",
    goneSub: "Tautan ini tidak lagi berisi penawaran. Pemesanan Anda ada di My Bookings.",
    noTitle: "Terima kasih sudah memberi tahu kami", noSub: "Tempat ini diberikan kepada pesepeda berikutnya. Anda masih ada di daftar tunggu.",
    net: "Tidak dapat menyimpan. Periksa koneksi Anda dan coba lagi.", retry: "Coba lagi", mine: "My Bookings",
  },
  ms: {
    kicker: "Senarai menunggu", title: "Ada tempat kosong untuk anda", ends: "Tempat ini milik anda jika anda mengambilnya dalam masa", claim: "Ambil tempat saya", decline: "Saya tidak dapat hadir",
    doneTitle: "Tempat anda telah ditempah", doneSub: "Jumpa anda semasa kayuhan. Tiket anda ada di Tempahan Saya (My Bookings).",
    lateTitle: "Tawaran ini telah tamat", lateSub: "Masa untuk mengambilnya telah tamat, jadi tempat itu diberikan kepada penunggang seterusnya. Anda masih dalam senarai menunggu.",
    fullSub: "Tempat itu telah diambil sebelum anda mengambilnya. Anda masih dalam senarai menunggu.",
    goneSub: "Pautan ini tidak lagi membawa tawaran. Tempahan anda ada di Tempahan Saya (My Bookings).",
    noTitle: "Terima kasih kerana memberitahu kami", noSub: "Tempat itu diberikan kepada penunggang seterusnya. Anda masih dalam senarai menunggu.",
    net: "Tidak dapat disimpan. Semak sambungan anda dan cuba lagi.", retry: "Cuba lagi", mine: "Tempahan Saya (My Bookings)",
  },
  de: {
    kicker: "Warteliste", title: "Ein Platz ist für dich frei", ends: "Er gehört dir, wenn du ihn innerhalb dieser Zeit nimmst:", claim: "Meinen Platz nehmen", decline: "Ich kann nicht kommen",
    doneTitle: "Dein Platz ist gebucht", doneSub: "Bis zur Fahrt! Dein Ticket findest du unter „Meine Buchungen“ (My Bookings).",
    lateTitle: "Dieses Angebot ist abgelaufen", lateSub: "Die Zeit ist abgelaufen, deshalb ging der Platz an die nächste Person. Du bleibst auf der Warteliste.",
    fullSub: "Der Platz war vergeben, bevor du ihn nehmen konntest. Du bleibst auf der Warteliste.",
    goneSub: "Dieser Link enthält kein Angebot mehr. Deine Buchungen findest du unter „Meine Buchungen“ (My Bookings).",
    noTitle: "Danke für deine Nachricht", noSub: "Der Platz geht an die nächste Person. Du bleibst auf der Warteliste.",
    net: "Speichern nicht möglich. Prüfe deine Verbindung und versuche es erneut.", retry: "Erneut versuchen", mine: "Meine Buchungen (My Bookings)",
  },
  es: {
    kicker: "Lista de espera", title: "Hay una plaza libre para ti", ends: "Es tuya si la confirmas en", claim: "Confirmar mi plaza", decline: "No puedo ir",
    doneTitle: "Tu plaza está reservada", doneSub: "Nos vemos en la salida. Tu entrada está en Mis reservas.",
    lateTitle: "Esta oferta ha terminado", lateSub: "Se acabó el tiempo y la plaza pasó a la siguiente persona. Sigues en la lista de espera.",
    fullSub: "La plaza se ocupó antes de que la confirmaras. Sigues en la lista de espera.",
    goneSub: "Este enlace ya no tiene ninguna oferta. Tus reservas están en Mis reservas.",
    noTitle: "Gracias por avisarnos", noSub: "La plaza pasa a la siguiente persona. Sigues en la lista de espera.",
    net: "No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.", retry: "Reintentar", mine: "Mis reservas",
  },
  fr: {
    kicker: "Liste d'attente", title: "Une place est libre pour vous", ends: "Elle est à vous si vous la prenez dans les", claim: "Prendre ma place", decline: "Je ne peux pas venir",
    doneTitle: "Votre place est réservée", doneSub: "À bientôt sur la sortie. Votre billet est dans Mes réservations.",
    lateTitle: "Cette proposition est terminée", lateSub: "Le délai est passé, la place est allée à la personne suivante. Vous restez sur la liste d'attente.",
    fullSub: "La place a été prise avant vous. Vous restez sur la liste d'attente.",
    goneSub: "Ce lien ne porte plus de proposition. Vos réservations sont dans Mes réservations.",
    noTitle: "Merci de nous avoir prévenus", noSub: "La place va à la personne suivante. Vous restez sur la liste d'attente.",
    net: "Impossible d'enregistrer. Vérifiez votre connexion et réessayez.", retry: "Réessayer", mine: "Mes réservations",
  },
  pt: {
    kicker: "Lista de espera", title: "Há uma vaga livre para você", ends: "É sua se confirmar em", claim: "Confirmar minha vaga", decline: "Não posso ir",
    doneTitle: "Sua vaga está reservada", doneSub: "Até o passeio. Seu ingresso está em Minhas reservas.",
    lateTitle: "Esta oferta terminou", lateSub: "O tempo acabou e a vaga foi para a próxima pessoa. Você continua na lista de espera.",
    fullSub: "A vaga foi ocupada antes da sua confirmação. Você continua na lista de espera.",
    goneSub: "Este link não tem mais uma oferta. Suas reservas estão em Minhas reservas.",
    noTitle: "Obrigado por avisar", noSub: "A vaga vai para a próxima pessoa. Você continua na lista de espera.",
    net: "Não foi possível salvar. Verifique sua conexão e tente novamente.", retry: "Tentar novamente", mine: "Minhas reservas",
  },
  tl: {
    kicker: "Waitlist", title: "May bakanteng puwesto para sa iyo", ends: "Sa iyo ito kung kukunin mo sa loob ng", claim: "Kunin ang puwesto ko", decline: "Hindi ako makakapunta",
    doneTitle: "Naka-book na ang puwesto mo", doneSub: "Kita tayo sa ride. Nasa Aking mga Booking ang ticket mo.",
    lateTitle: "Tapos na ang alok na ito", lateSub: "Naubos ang oras kaya napunta ang puwesto sa susunod. Nasa waitlist ka pa rin.",
    fullSub: "Nakuha na ang puwesto bago mo ito kinuha. Nasa waitlist ka pa rin.",
    goneSub: "Wala nang alok sa link na ito. Nasa Aking mga Booking ang mga booking mo.",
    noTitle: "Salamat sa pagsabi sa amin", noSub: "Mapupunta ang puwesto sa susunod. Nasa waitlist ka pa rin.",
    net: "Hindi ma-save. Suriin ang iyong koneksyon at subukan ulit.", retry: "Subukan ulit", mine: "Aking mga Booking",
  },
  ru: {
    kicker: "Лист ожидания", title: "Для вас освободилось место", ends: "Место ваше, если вы займёте его в течение", claim: "Занять моё место", decline: "Я не смогу прийти",
    doneTitle: "Ваше место забронировано", doneSub: "До встречи на заезде. Ваш билет — в разделе «Мои бронирования» (My Bookings).",
    lateTitle: "Это предложение больше не действует", lateSub: "Время вышло, и место перешло к следующему участнику. Вы по-прежнему в листе ожидания.",
    fullSub: "Место заняли раньше, чем вы успели его подтвердить. Вы по-прежнему в листе ожидания.",
    goneSub: "По этой ссылке больше нет предложения. Ваши бронирования — в разделе «Мои бронирования» (My Bookings).",
    noTitle: "Спасибо, что сообщили", noSub: "Место перейдёт к следующему участнику. Вы по-прежнему в листе ожидания.",
    net: "Не удалось сохранить. Проверьте подключение и попробуйте снова.", retry: "Попробовать снова", mine: "Мои бронирования (My Bookings)",
  },
  ur: {
    kicker: "انتظار کی فہرست", title: "آپ کے لیے ایک جگہ خالی ہے", ends: "یہ آپ کی ہے اگر آپ اسے اندر لے لیں", claim: "میری جگہ لیں", decline: "میں نہیں آ سکتا",
    doneTitle: "آپ کی جگہ بک ہو گئی", doneSub: "رائیڈ پر ملاقات ہوگی۔ آپ کا ٹکٹ میری بکنگز میں ہے۔",
    lateTitle: "یہ آفر ختم ہو گئی", lateSub: "وقت ختم ہو گیا، اس لیے جگہ اگلے رائیڈر کو چلی گئی۔ آپ اب بھی انتظار کی فہرست میں ہیں۔",
    fullSub: "آپ کے لینے سے پہلے جگہ بھر گئی۔ آپ اب بھی انتظار کی فہرست میں ہیں۔",
    goneSub: "اس لنک پر اب کوئی آفر نہیں۔ آپ کی بکنگز میری بکنگز میں ہیں۔",
    noTitle: "بتانے کا شکریہ", noSub: "جگہ اگلے رائیڈر کو جائے گی۔ آپ اب بھی انتظار کی فہرست میں ہیں۔",
    net: "محفوظ نہیں ہو سکا۔ اپنا کنکشن چیک کریں اور دوبارہ کوشش کریں۔", retry: "دوبارہ کوشش کریں", mine: "میری بکنگز",
  },
  hi: {
    kicker: "प्रतीक्षा सूची", title: "आपके लिए एक जगह खाली है", ends: "यह आपकी है अगर आप इसे इतने समय में लें", claim: "मेरी जगह पक्की करें", decline: "मैं नहीं आ सकता",
    doneTitle: "आपकी जगह बुक हो गई", doneSub: "राइड पर मिलते हैं। आपका टिकट मेरी बुकिंग में है।",
    lateTitle: "यह ऑफ़र खत्म हो गया", lateSub: "समय खत्म हो गया, इसलिए जगह अगले राइडर को चली गई। आप अभी भी प्रतीक्षा सूची में हैं।",
    fullSub: "आपके लेने से पहले जगह भर गई। आप अभी भी प्रतीक्षा सूची में हैं।",
    goneSub: "इस लिंक पर अब कोई ऑफ़र नहीं है। आपकी बुकिंग मेरी बुकिंग में हैं।",
    noTitle: "बताने के लिए धन्यवाद", noSub: "जगह अगले राइडर को जाएगी। आप अभी भी प्रतीक्षा सूची में हैं।",
    net: "सहेज नहीं सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।", retry: "फिर कोशिश करें", mine: "मेरी बुकिंग",
  },
  ne: {
    kicker: "प्रतीक्षा सूची", title: "तपाईंका लागि एउटा ठाउँ खाली छ", ends: "यति समयभित्र लिनुभयो भने यो तपाईंको हो", claim: "मेरो ठाउँ लिनुहोस्", decline: "म आउन सक्दिनँ",
    doneTitle: "तपाईंको ठाउँ बुक भयो", doneSub: "राइडमा भेटौँला। तपाईंको टिकट मेरा बुकिङमा छ।",
    lateTitle: "यो प्रस्ताव सकियो", lateSub: "समय सकियो, त्यसैले ठाउँ अर्को राइडरलाई गयो। तपाईं अझै प्रतीक्षा सूचीमा हुनुहुन्छ।",
    fullSub: "तपाईंले लिनुअघि नै ठाउँ भरियो। तपाईं अझै प्रतीक्षा सूचीमा हुनुहुन्छ।",
    goneSub: "यो लिङ्कमा अब प्रस्ताव छैन। तपाईंका बुकिङ मेरा बुकिङमा छन्।",
    noTitle: "जानकारी दिनुभएकोमा धन्यवाद", noSub: "ठाउँ अर्को राइडरलाई जान्छ। तपाईं अझै प्रतीक्षा सूचीमा हुनुहुन्छ।",
    net: "सेभ गर्न सकिएन। जडान जाँच्नुहोस् र फेरि प्रयास गर्नुहोस्।", retry: "फेरि प्रयास गर्नुहोस्", mine: "मेरा बुकिङ",
  },
  bn: {
    kicker: "অপেক্ষমাণ তালিকা", title: "আপনার জন্য একটি জায়গা খালি", ends: "এর মধ্যে নিলে জায়গাটি আপনার", claim: "আমার জায়গা নিন", decline: "আমি আসতে পারব না",
    doneTitle: "আপনার জায়গা বুক হয়েছে", doneSub: "রাইডে দেখা হবে। আপনার টিকিট আমার বুকিং-এ আছে।",
    lateTitle: "এই অফার শেষ হয়েছে", lateSub: "সময় শেষ, তাই জায়গাটি পরের জনের কাছে গেছে। আপনি এখনও অপেক্ষমাণ তালিকায় আছেন।",
    fullSub: "আপনি নেওয়ার আগেই জায়গাটি পূর্ণ হয়ে গেছে। আপনি এখনও অপেক্ষমাণ তালিকায় আছেন।",
    goneSub: "এই লিংকে আর কোনো অফার নেই। আপনার বুকিং আমার বুকিং-এ আছে।",
    noTitle: "জানানোর জন্য ধন্যবাদ", noSub: "জায়গাটি পরের জনের কাছে যাবে। আপনি এখনও অপেক্ষমাণ তালিকায় আছেন।",
    net: "সংরক্ষণ করা গেল না। সংযোগ দেখে আবার চেষ্টা করুন।", retry: "আবার চেষ্টা করুন", mine: "আমার বুকিং",
  },
  zh: {
    kicker: "候补名单", title: "有一个名额空出来了，留给您", ends: "在以下时间内确认，名额就是您的：", claim: "确认我的名额", decline: "我来不了",
    doneTitle: "您的名额已预订", doneSub: "骑行时见。您的票在“我的预订”（My Bookings）中。",
    lateTitle: "此邀请已结束", lateSub: "确认时间已过，名额已转给下一位骑行者。您仍在候补名单中。",
    fullSub: "在您确认之前，名额已被占用。您仍在候补名单中。",
    goneSub: "此链接已不再包含邀请。您的预订在“我的预订”（My Bookings）中。",
    noTitle: "感谢您告诉我们", noSub: "名额将转给下一位骑行者。您仍在候补名单中。",
    net: "无法保存。请检查网络连接后重试。", retry: "重试", mine: "我的预订（My Bookings）",
  },
  ja: {
    kicker: "キャンセル待ち", title: "あなたのための空きが出ました", ends: "この時間内に確定すれば、あなたの参加枠になります：", claim: "参加枠を確定する", decline: "参加できません",
    doneTitle: "参加枠を予約しました", doneSub: "ライドでお会いしましょう。チケットは「マイ予約（My Bookings）」にあります。",
    lateTitle: "このご案内は終了しました", lateSub: "確定の期限が過ぎたため、参加枠は次の方に移りました。引き続きキャンセル待ちに登録されています。",
    fullSub: "確定される前に参加枠が埋まりました。引き続きキャンセル待ちに登録されています。",
    goneSub: "このリンクにはご案内がありません。予約は「マイ予約（My Bookings）」で確認できます。",
    noTitle: "お知らせいただきありがとうございます", noSub: "参加枠は次の方に移ります。引き続きキャンセル待ちに登録されています。",
    net: "保存できませんでした。接続を確認して、もう一度お試しください。", retry: "再試行", mine: "マイ予約（My Bookings）",
  },
};

export const claimWords = (locale: string): ClaimWords => CLAIM_WORDS[locale as Locale] ?? CLAIM_WORDS.en;
