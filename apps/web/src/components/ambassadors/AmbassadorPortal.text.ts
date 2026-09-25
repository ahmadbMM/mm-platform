// AmbassadorPortal's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    code: "Your code", phone: "Mobile number", open: "Open my card", opening: "Opening…", card: "Ambassador card",
    points: "Points", pending: "Pending", uses: "Uses", copy: "Copy", copied: "Copied ✓", share: "Share your code on WhatsApp",
    toNext: (n: string, t: string) => `${n} ${n === "1" ? "pt" : "pts"} to reach ${t}`, top: "Top tier - full perks", paused: "Your code is paused - the team will be in touch.",
    ledger: "Referral ledger", ledgerEmpty: "No uses yet - share your code and every booking made with it shows up here.",
    confirmed: "Confirmed", pendingSt: "Pending", voided: "Voided", redeem: "Redeem", requested: "Asked for", given: "Handed over", redemption: "Reward",
    redeemed: "Asked for - the team hands it over in store.", notEnough: "Not enough points yet.", close: "Close my card",
    errors: { not_found: "No active ambassador has that code and mobile.", throttled: "Too many tries - wait a few minutes.", generic: "It could not be opened. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    code: "كودك", phone: "رقم الجوال", open: "افتح بطاقتي", opening: "جارٍ الفتح…", card: "بطاقة السفير",
    points: "النقاط", pending: "قيد التأكيد", uses: "الاستخدامات", copy: "انسخ", copied: "تم النسخ ✓", share: "شارك كودك عبر واتساب",
    toNext: (n: string, t: string) => `${n} نقطة للوصول إلى ${t}`, top: "أعلى مستوى - كل المزايا", paused: "كودك موقوف مؤقتاً - سيتواصل معك الفريق.",
    ledger: "سجل الإحالات", ledgerEmpty: "لا استخدامات بعد - شارك كودك وسيظهر هنا كل حجز يُستخدم فيه.",
    confirmed: "مؤكدة", pendingSt: "قيد التأكيد", voided: "ملغاة", redeem: "استبدال", requested: "مطلوبة", given: "تم التسليم", redemption: "مكافأة",
    redeemed: "تم الطلب - يسلّمها الفريق في المتجر.", notEnough: "النقاط غير كافية بعد.", close: "أغلق بطاقتي",
    errors: { not_found: "لا يوجد سفير نشط بهذا الكود والجوال.", throttled: "محاولات كثيرة - انتظر دقائق.", generic: "تعذّر الفتح. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};
