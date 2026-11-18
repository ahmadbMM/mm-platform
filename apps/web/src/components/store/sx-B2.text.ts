// The product page's words from the "do all" build of 2026-11-18 (builder B2), in English and Arabic; every other
// language translates the English (src/i18n/tx).
const arWeeks = (n: number) => (n === 1 ? "أسبوع واحد" : n === 2 ? "أسبوعين" : n <= 10 ? `${n} أسابيع` : `${n} أسبوعًا`);
const arMonths = (n: number) => (n === 1 ? "شهر واحد" : n === 2 ? "شهرين" : n <= 10 ? `${n} أشهر` : `${n} شهرًا`);
const arRides = (n: number) => (n === 1 ? "جولة سبت واحدة" : n === 2 ? "جولتي سبت" : n <= 10 ? `${n} جولات سبت` : `${n} جولة سبت`);
const arTrips = (n: number) => (n === 1 ? "رحلة واحدة" : n === 2 ? "رحلتين" : n <= 10 ? `${n} رحلات` : `${n} رحلة`);

export const T = {
  en: {
    // SM05-B, P21: the way to have it is the step before Add
    howToGet: "How to get it",
    // SM09-B
    viewCart: "View cart",
    // N01
    share: "Share",
    copyLink: "Copy link",
    copied: "Link copied",
    sharedList: "Shared with you",
    // N12, N16, N25: the buy box's facts
    checkup: (w: number) => `First check-up free within ${w} weeks`,
    rode: (n: number) => (n === 1 ? "You've ridden this type on 1 Saturday ride" : `You've ridden this type on ${n} Saturday rides`),
    fleet: (rides: number, months: number) => `From our fleet: ${rides === 1 ? "1 ride" : `${rides} rides`} in ${months === 1 ? "1 month" : `${months} months`}`,
    // N24
    video: "See it on video",
    videoMsg: (name: string, url: string) => `Hello, I'd like to see ${name} on a video call: ${url}`,
    // N36: inside the way's label, only when true
    orderBy: (d: string, what: string) => `Order by ${d} for ${what} delivery`,
    orderByPickup: (d: string, what: string) => `Order by ${d} to collect it for ${what}`,
    // N13: the handover appointment
    handover: "20-minute handover",
    pickTime: "Pick a time",
    changeTime: "Change",
    handoverAt: (t: string) => `Handover at ${t}`,
    noTimes: "No times left that day. We'll arrange one with you.",
    timesFailed: "The times could not be loaded.",
  },
  ar: {
    howToGet: "طريقة الاستلام",
    viewCart: "عرض السلة",
    share: "مشاركة",
    copyLink: "نسخ الرابط",
    copied: "نُسخ الرابط",
    sharedList: "قائمة مشتركة معك",
    checkup: (w: number) => `أول فحص مجاني خلال ${arWeeks(w)}`,
    rode: (n: number) => `ركبت هذا النوع في ${arRides(n)}`,
    fleet: (rides: number, months: number) => `من أسطولنا: ${arTrips(rides)} خلال ${arMonths(months)}`,
    video: "شاهدها بمكالمة فيديو",
    videoMsg: (name: string, url: string) => `السلام عليكم، أرغب في رؤية ${name} بمكالمة فيديو: ${url}`,
    orderBy: (d: string, what: string) => `اطلب حتى ${d} ليصلك قبل ${what}`,
    orderByPickup: (d: string, what: string) => `اطلب حتى ${d} لتستلمها قبل ${what}`,
    handover: "تسليم في 20 دقيقة",
    pickTime: "اختر الوقت",
    changeTime: "تغيير",
    handoverAt: (t: string) => `التسليم الساعة ${t}`,
    noTimes: "لا أوقات متاحة في ذلك اليوم. سنتفق معك على وقت.",
    timesFailed: "تعذّر تحميل الأوقات.",
  },
};
export type B2Text = typeof T.en;
