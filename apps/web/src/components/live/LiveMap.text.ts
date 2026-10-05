// The live map's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    leader: "Ride leader", sweeper: "Sweeper", recenter: "Recenter", loading: "Loading the map…",
    noPosition: "No position yet - the leader has not started sharing. This page keeps checking.",
    notBooked: "You have no booking on this ride.",
    unavailable: "The live map is not available yet.",
    signin: "Your session has ended. Sign in again to see the live map.",
    network: "The map could not be updated. Check the connection - it keeps trying.",
    mapFailed: "The map could not be loaded. Check the connection and reload the page.",
    ended: "This ride is over. The live map is no longer updated.",
    updated: (t: string) => `Updated ${t}`,
    speed: (n: string) => `${n} km/h`,
  },
  ar: {
    leader: "قائد الجولة", sweeper: "المرافق الخلفي", recenter: "إعادة التمركز", loading: "جارٍ تحميل الخريطة…",
    noPosition: "لا يوجد موقع بعد - لم يبدأ القائد المشاركة. تواصل هذه الصفحة التحقق.",
    notBooked: "ليس لديك حجز في هذه الجولة.",
    unavailable: "الخريطة الحية غير متاحة بعد.",
    signin: "انتهت جلستك. سجّل الدخول مجدداً لرؤية الخريطة الحية.",
    network: "تعذّر تحديث الخريطة. تحقق من الاتصال - وستواصل المحاولة.",
    mapFailed: "تعذّر تحميل الخريطة. تحقق من الاتصال وأعد تحميل الصفحة.",
    ended: "انتهت هذه الجولة، ولم تعد الخريطة الحية تُحدَّث.",
    updated: (t: string) => `آخر تحديث ${t}`,
    speed: (n: string) => `${n} كم/س`,
  },
};
