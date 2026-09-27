// MembersArea's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    title: "Your membership", label: "Membership card", credits: "ride credits", since: "Member since", top: "Top tier - enjoy every perk",
    toNext: (n: string, t: string) => `${n} credits to reach ${t}`,
    attendance: "Your rides", rides: (n: string) => `${n} rides`, groupRides: (n: string) => `${n} community rides`,
    last: "Last rides", noLast: "No completed rides yet.", rated: "Rated", rate: "Rate it",
    upcoming: "Upcoming members' rides", booked: "Booked", book: "Book",
    birthday: (name: string) => `Happy birthday, ${name}!`, birthdayText: "Wishing you a great year of riding, from all of us at Micromobility.",
    announcements: "Announcements",
  },
  ar: {
    title: "عضويتك", label: "بطاقة العضوية", credits: "رصيد ركوب", since: "عضو منذ", top: "أعلى مستوى - استمتع بكل المزايا",
    toNext: (n: string, t: string) => `${n} رصيد للوصول إلى ${t}`,
    attendance: "رحلاتك", rides: (n: string) => `${n} رحلة`, groupRides: (n: string) => `${n} ركبة مجتمعية`,
    last: "آخر الرحلات", noLast: "لا رحلات مكتملة بعد.", rated: "تم التقييم", rate: "قيّمها",
    upcoming: "ركبات الأعضاء القادمة", booked: "محجوزة", book: "احجز",
    birthday: (name: string) => `كل عام وأنت بخير يا ${name}!`, birthdayText: "نتمنى لك سنة رائعة على الدراجة، من كل فريق مايكروموبيليتي.",
    announcements: "الإعلانات",
  },
};
