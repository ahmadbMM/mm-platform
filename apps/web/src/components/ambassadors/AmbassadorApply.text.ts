// AmbassadorApply's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    name: "Full name", phone: "Mobile number", insta: "Instagram (optional)", why: "Why you? Tell us about your community and riding", sending: "Sending…",
    already: "You have already applied with this number - the team will be in touch.", active: "This number already has an ambassador code - open your card above.",
    errors: { name_short: "Write each name in full: every name needs at least two letters.", name: "Enter your name - letters, spaces and periods only.", phone: "Check the mobile number, e.g. 05XXXXXXXX.", instagram: "Check the Instagram handle.", throttled: "Too many tries from this network - wait a few minutes.", generic: "It could not be sent. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    name: "الاسم الكامل", phone: "رقم الجوال", insta: "حساب إنستغرام (اختياري)", why: "لماذا أنت؟ حدثنا عن مجتمعك وركوبك", sending: "جارٍ الإرسال…",
    already: "سبق أن قدّمت بهذا الرقم - سيتواصل معك الفريق.", active: "لهذا الرقم كود سفير بالفعل - افتح بطاقتك في الأعلى.",
    errors: { name_short: "اكتب كل اسم كاملًا: يجب أن يتكون كل اسم من حرفين على الأقل.", name: "أدخل اسمك - حروف ومسافات ونقاط فقط.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.", instagram: "تحقق من حساب إنستغرام.", throttled: "محاولات كثيرة من هذه الشبكة - انتظر دقائق.", generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};
