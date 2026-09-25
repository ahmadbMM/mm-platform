// ClubCard's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    email: "Email", phone: "Mobile number", open: "Open my card", opening: "Opening…", label: "Membership card", credits: "ride credits",
    since: "Member since", rides: (n: string) => `${n} ${n === "1" ? "ride" : "rides"} completed`, toNext: (n: string, t: string) => `${n} ${n === "1" ? "credit" : "credits"} to reach ${t}`, top: "Top tier - enjoy every perk",
    close: "Close my card", errors: { not_found: "Enter the email and the mobile number.", throttled: "Too many tries - wait a few minutes.", generic: "It could not be opened. Check the connection and try again." } as Record<string, string>,
  },
  ar: {
    email: "البريد الإلكتروني", phone: "رقم الجوال", open: "افتح بطاقتي", opening: "جارٍ الفتح…", label: "بطاقة العضوية", credits: "رصيد ركوب",
    since: "عضو منذ", rides: (n: string) => `${n} رحلة مكتملة`, toNext: (n: string, t: string) => `${n} رصيد للوصول إلى ${t}`, top: "أعلى مستوى - استمتع بكل المزايا",
    close: "أغلق بطاقتي", errors: { not_found: "أدخل البريد الإلكتروني ورقم الجوال.", throttled: "محاولات كثيرة - انتظر دقائق.", generic: "تعذّر الفتح. تحقق من الاتصال وحاول مجدداً." } as Record<string, string>,
  },
};
