// WorkshopForm's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    lane: "How it's serviced", dropoff: "Drop off", dropoffSub: "You bring the bike in", wait: "While you wait", waitSub: "Quick fixes",
    pickup: "Pickup & delivery", pickupSub: "We come to you", pickupAddr: "Pickup address", notSure: "Not sure? Describe the problem",
    notSureHint: "Pick one and we'll suggest the right service.", suggested: "Suggested", included: "What's included", free: "Free",
    about: (m: number) => `~${m} min`, parts: "Add parts (optional)", day: "Preferred day", time: "Preferred time", name: "Your name",
    phone: "Mobile number", bike: "Your bike (e.g. ALVAS DA54 AL)", notes: "Anything we should know? (optional)", total: "Estimated total",
    send: "Send request", sending: "Sending…", ref: "Your reference", another: "Request another",
    code: "Have a code?", apply: "Apply code", codeOn: (c: string, d: string) => `Code ${c}: ${d} off`, codeBad: "That code isn't valid.", codeRemove: "Remove",
    errors: { name: "Enter your name - letters, spaces and periods only.", phone: "Check the mobile number, e.g. 05XXXXXXXX.", service: "Pick a service.",
      day: "Pick a day.", pickup_address: "Add the pickup address.", throttled: "Too many requests from this network - try again in a few minutes.",
      generic: "It could not be sent. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    lane: "طريقة الخدمة", dropoff: "إحضار للورشة", dropoffSub: "أنت تُحضر الدراجة", wait: "انتظار سريع", waitSub: "إصلاحات سريعة",
    pickup: "استلام وتوصيل", pickupSub: "نأتي إليك", pickupAddr: "عنوان الاستلام", notSure: "غير متأكد؟ صف المشكلة",
    notSureHint: "اختر عرضاً ونقترح الخدمة المناسبة.", suggested: "مقترح", included: "ماذا يشمل", free: "مجاناً",
    about: (m: number) => `~${m} دقيقة`, parts: "أضف قطعاً (اختياري)", day: "اليوم المفضل", time: "الوقت المفضل", name: "اسمك",
    phone: "رقم الجوال", bike: "دراجتك (مثال: ALVAS DA54 AL)", notes: "أي تفاصيل تهمنا؟ (اختياري)", total: "الإجمالي التقريبي",
    send: "أرسل الطلب", sending: "جارٍ الإرسال…", ref: "رقم طلبك", another: "طلب آخر",
    code: "لديك كود؟", apply: "تطبيق", codeOn: (c: string, d: string) => `الكود ${c}: خصم ${d}`, codeBad: "هذا الكود غير صالح.", codeRemove: "إزالة",
    errors: { name: "أدخل اسمك - حروف ومسافات ونقاط فقط.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.", service: "اختر خدمة.",
      day: "اختر يوماً.", pickup_address: "أضف عنوان الاستلام.", throttled: "طلبات كثيرة من هذه الشبكة - حاول بعد دقائق.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};
