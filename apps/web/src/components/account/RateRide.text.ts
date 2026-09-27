// RateRide's own words, in English and Arabic - the booking app's post-ride rating (its rate*
// LANG keys), with the quick tags of the 2026-09-27 round; every other language translates the
// English (src/i18n/tx).
export const T = {
  en: {
    title: "Rate your ride", exp: "Your experience", bike: "Your bike", tags: "What stood out?", note: "A note (optional)",
    send: "Send rating", sending: "Sending…", thanks: "Thank you - your rating helps us make every ride better.",
    low: "Not great", high: "Excellent",
    tag: { route: "The route", pace: "The pace", bike: "The bike", staff: "The staff", safety: "Safety", fun: "Fun" } as Record<string, string>,
    errors: { missing: "Pick a score for your experience first.", signin: "Your session has ended - sign in again to rate the ride.", refused: "This booking cannot be rated.", generic: "It could not be sent. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    title: "قيّم جولتك", exp: "تجربتك", bike: "دراجتك", tags: "ما الذي لفت انتباهك؟", note: "ملاحظة (اختياري)",
    send: "إرسال التقييم", sending: "جارٍ الإرسال…", thanks: "شكراً لك - تقييمك يساعدنا على تحسين كل جولة.",
    low: "ليست رائعة", high: "ممتازة",
    tag: { route: "المسار", pace: "السرعة", bike: "الدراجة", staff: "الفريق", safety: "السلامة", fun: "المتعة" } as Record<string, string>,
    errors: { missing: "اختر تقييماً لتجربتك أولاً.", signin: "انتهت جلستك - سجّل الدخول مجدداً لتقييم الجولة.", refused: "لا يمكن تقييم هذا الحجز.", generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};
