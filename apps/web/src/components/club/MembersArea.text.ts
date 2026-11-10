// MembersArea's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    title: "Your membership", label: "Membership card", credits: "ride credits", since: "Member since", top: "Top tier - enjoy every perk",
    toNext: (n: string, t: string) => `${n} ${n === "1" ? "credit" : "credits"} to reach ${t}`,
    attendance: "Your rides", rides: (n: string) => `${n} ${n === "1" ? "ride" : "rides"}`, groupRides: (n: string) => `${n} ${n === "1" ? "community ride" : "community rides"}`,
    last: "Last rides", noLast: "No completed rides yet.", rated: "Rated", rate: "Rate it",
    upcoming: "Upcoming members' sessions", booked: "Booked", book: "Book",
    birthday: (name: string) => `Happy birthday, ${name}!`, birthdayText: "Wishing you a great year of riding, from all of us at Micromobility.",
    announcements: "Announcements",
    community: "Community", yourTitle: "Your title", noTitle: "You do not have a title yet.", seeMembers: "Open Community", manageTitle: "Choose your title",
  },
  ar: {
    title: "عضويتك", label: "بطاقة العضوية", credits: "رصيد ركوب", since: "عضو منذ", top: "أعلى مستوى - استمتع بكل المزايا",
    toNext: (n: string, t: string) => `${n} رصيد للوصول إلى ${t}`,
    attendance: "رحلاتك", rides: (n: string) => `${n} رحلة`, groupRides: (n: string) => `${n} ركبة مجتمعية`,
    last: "آخر الرحلات", noLast: "لا رحلات مكتملة بعد.", rated: "تم التقييم", rate: "قيّمها",
    upcoming: "جلسات الأعضاء القادمة", booked: "محجوزة", book: "احجز",
    birthday: (name: string) => `كل عام وأنت بخير يا ${name}!`, birthdayText: "نتمنى لك سنة رائعة على الدراجة، من كل فريق مايكروموبيليتي.",
    announcements: "الإعلانات",
    community: "المجتمع", yourTitle: "لقبك", noTitle: "ليس لديك لقب بعد.", seeMembers: "افتح المجتمع", manageTitle: "اختر لقبك",
  },
};
