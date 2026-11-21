// "Still coming?" on the ticket (TicketCard, TicketComing; the booking app's _stcHtml, 2026-11-13, new features F2) in
// every language the site speaks: the group's name for a screen reader (ask), the two buttons (yes, no) and the chip after
// a yes (ok). The ten languages the booking app speaks take its own words word for word (stillAsk, stillYes, stillNo,
// stillOk: English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German, Russian,
// Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Change a text here in every language at
// once.
// Running late (the customer features round, 2026-11-19, item 1; lib/still-coming.ts) adds its button (late), the pop-up's
// title (lateAsk), each time ("{0} min", lateMin), the chip after a pick (lateChip), "I'm on time" (onTime), what a refusal
// says (noMore: the session's time is over, called off or the party checked in; noPlace: the booking holds no place) and the
// pop-up's Close: the booking app's rlBtn, rlAsk, rlMin, rlChip, rlOnTime, rlNoMore, rlNoPlace and closeBtn.
import type { Locale } from "@/i18n/locales";

export type ComingWords = {
  ask: string; yes: string; no: string; ok: string;
  late: string; lateAsk: string; lateMin: string; lateChip: string; onTime: string; noMore: string; noPlace: string; close: string;
};

export const COMING_WORDS: Record<Locale, ComingWords> = {
  en: { ask: "Are you still coming?", yes: "I’m coming", no: "Can’t come", ok: "Coming",
    late: "Running late", lateAsk: "How late will you be?", lateMin: "{0} min", lateChip: "Running late, about {0} min", onTime: "I’m on time", noMore: "Too late to change this now", noPlace: "This booking no longer holds a place", close: "Close" },
  ar: { ask: "هل ما زلت قادمًا؟", yes: "سأحضر", no: "لا أستطيع الحضور", ok: "سيحضر",
    late: "سأتأخر", lateAsk: "كم ستتأخر؟", lateMin: "{0} دقيقة", lateChip: "سأتأخر نحو {0} دقيقة", onTime: "سأصل في الموعد", noMore: "فات وقت تغيير هذا الآن", noPlace: "لم يعد لهذا الحجز مكان محجوز", close: "إغلاق" },
  id: { ask: "Apakah Anda masih akan datang?", yes: "Saya akan datang", no: "Tidak bisa datang", ok: "Akan datang",
    late: "Saya terlambat", lateAsk: "Berapa lama Anda akan terlambat?", lateMin: "{0} menit", lateChip: "Terlambat sekitar {0} menit", onTime: "Saya tepat waktu", noMore: "Sudah tidak bisa diubah sekarang", noPlace: "Pemesanan ini tidak lagi memiliki tempat", close: "Tutup" },
  ms: { ask: "Adakah anda masih akan datang?", yes: "Saya akan datang", no: "Tidak dapat datang", ok: "Akan datang",
    late: "Saya lewat", lateAsk: "Berapa lama anda akan lewat?", lateMin: "{0} min", lateChip: "Lewat kira-kira {0} min", onTime: "Saya tepat pada masanya", noMore: "Sudah tidak boleh ditukar sekarang", noPlace: "Tempahan ini tidak lagi mempunyai tempat", close: "Tutup" },
  de: { ask: "Kommst du noch?", yes: "Ich komme", no: "Ich kann nicht", ok: "Zugesagt",
    late: "Ich komme später", lateAsk: "Wie viel später kommst du?", lateMin: "{0} Min.", lateChip: "Etwa {0} Min. später", onTime: "Ich bin pünktlich", noMore: "Das lässt sich jetzt nicht mehr ändern", noPlace: "Diese Buchung hat keinen Platz mehr", close: "Schließen" },
  es: { ask: "¿Sigues viniendo?", yes: "Voy", no: "No puedo ir", ok: "Asistirá",
    late: "Llego tarde", lateAsk: "¿Cuánto vas a tardar?", lateMin: "{0} min", lateChip: "Llego unos {0} min tarde", onTime: "Llegaré a tiempo", noMore: "Ya es tarde para cambiar esto", noPlace: "Esta reserva ya no tiene plaza", close: "Cerrar" },
  fr: { ask: "Vous venez toujours ?", yes: "Je viens", no: "Je ne peux pas venir", ok: "Présent",
    late: "En retard", lateAsk: "Combien de retard aurez-vous ?", lateMin: "{0} min", lateChip: "En retard d’environ {0} min", onTime: "Je serai à l’heure", noMore: "Il est trop tard pour modifier cela", noPlace: "Cette réservation n’a plus de place", close: "Fermer" },
  pt: { ask: "Você ainda vem?", yes: "Eu vou", no: "Não posso ir", ok: "Confirmado",
    late: "Vou me atrasar", lateAsk: "Quanto vai se atrasar?", lateMin: "{0} min", lateChip: "Atraso de cerca de {0} min", onTime: "Vou chegar a tempo", noMore: "Já é tarde para mudar isto", noPlace: "Esta reserva já não tem vaga", close: "Fechar" },
  tl: { ask: "Darating ka pa rin ba?", yes: "Darating ako", no: "Hindi ako makakarating", ok: "Darating",
    late: "Male ako", lateAsk: "Gaano ka mahuhuli?", lateMin: "{0} min", lateChip: "Mahuhuli nang mga {0} min", onTime: "Darating ako sa oras", noMore: "Huli na para baguhin ito ngayon", noPlace: "Wala nang puwesto ang booking na ito", close: "Isara" },
  ru: { ask: "Вы всё ещё придёте?", yes: "Я приду", no: "Не смогу прийти", ok: "Подтверждено",
    late: "Опаздываю", lateAsk: "На сколько вы опоздаете?", lateMin: "{0} мин", lateChip: "Опаздываю примерно на {0} мин", onTime: "Приду вовремя", noMore: "Изменить это уже нельзя", noPlace: "У этой брони больше нет места", close: "Закрыть" },
  ur: { ask: "کیا آپ اب بھی آ رہے ہیں؟", yes: "میں آ رہا ہوں", no: "میں نہیں آ سکوں گا", ok: "آ رہے ہیں",
    late: "دیر ہو رہی ہے", lateAsk: "آپ کتنی دیر سے آئیں گے؟", lateMin: "{0} منٹ", lateChip: "تقریباً {0} منٹ کی دیر", onTime: "میں وقت پر ہوں", noMore: "اب اسے بدلنے کا وقت گزر گیا ہے", noPlace: "اس بکنگ میں اب جگہ نہیں ہے", close: "بند کریں" },
  hi: { ask: "क्या आप अब भी आ रहे हैं?", yes: "मैं आ रहा हूँ", no: "मैं नहीं आ पाऊँगा", ok: "आ रहे हैं",
    late: "देर हो रही है", lateAsk: "आप कितनी देर से आएँगे?", lateMin: "{0} मिनट", lateChip: "लगभग {0} मिनट की देरी", onTime: "मैं समय पर हूँ", noMore: "अब इसे बदलने का समय निकल गया है", noPlace: "इस बुकिंग में अब जगह नहीं है", close: "बंद करें" },
  ne: { ask: "के तपाईं अझै आउँदै हुनुहुन्छ?", yes: "म आउँदैछु", no: "म आउन सक्दिनँ", ok: "आउँदै",
    late: "ढिलो हुँदैछ", lateAsk: "तपाईं कति ढिलो आउनुहुन्छ?", lateMin: "{0} मिनेट", lateChip: "करिब {0} मिनेट ढिलो", onTime: "म समयमै आउँछु", noMore: "अब यो बदल्ने समय गइसक्यो", noPlace: "यो बुकिङमा अब ठाउँ छैन", close: "बन्द गर्नुहोस्" },
  bn: { ask: "আপনি কি এখনও আসছেন?", yes: "আমি আসছি", no: "আমি আসতে পারব না", ok: "আসছেন",
    late: "দেরি হচ্ছে", lateAsk: "আপনার কত দেরি হবে?", lateMin: "{0} মিনিট", lateChip: "প্রায় {0} মিনিট দেরি", onTime: "আমি সময়মতো আসছি", noMore: "এখন এটি বদলানোর সময় পেরিয়ে গেছে", noPlace: "এই বুকিংয়ে আর জায়গা নেই", close: "বন্ধ করুন" },
  zh: { ask: "您还会来吗？", yes: "我会来", no: "来不了", ok: "已确认",
    late: "会迟到", lateAsk: "您会迟到多久？", lateMin: "{0} 分钟", lateChip: "约迟到 {0} 分钟", onTime: "我会准时到", noMore: "现在已无法更改", noPlace: "此预订已不再保有名额", close: "关闭" },
  ja: { ask: "予定どおり参加しますか？", yes: "参加します", no: "参加できません", ok: "参加予定",
    late: "遅れます", lateAsk: "どのくらい遅れますか？", lateMin: "{0}分", lateChip: "約{0}分遅れます", onTime: "時間どおりに着きます", noMore: "今からは変更できません", noPlace: "この予約の席はもうありません", close: "閉じる" },
};

export const comingWords = (locale: string): ComingWords => COMING_WORDS[locale as Locale] ?? COMING_WORDS.en;
