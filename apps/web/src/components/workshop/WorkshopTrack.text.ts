// WorkshopTrack's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: { title: "Track your service", hint: "Your reference looks like W-0042.", ref: "Reference", phone: "Mobile number", go: "Check", busy: "Checking…",
    notFound: "No request matches that reference and number.", throttled: "Too many checks - try again in a few minutes.", error: "Could not check right now. Try again.",
    scheduled: "Booked for", price: "Price", cancelled: "This request was cancelled.",
    stages: { new: "Received", confirmed: "Confirmed", in_workshop: "In the workshop", awaiting_parts: "Waiting for parts", ready: "Ready for pickup", completed: "Completed" } as Record<string, string> },
  ar: { title: "تتبّع صيانتك", hint: "رقم طلبك يبدأ بـ W، مثل W-0042.", ref: "رقم الطلب", phone: "رقم الجوال", go: "تحقق", busy: "جارٍ التحقق…",
    notFound: "لا يوجد طلب بهذا الرقم وهذا الجوال.", throttled: "محاولات كثيرة - حاول بعد دقائق.", error: "تعذّر التحقق الآن. حاول مجدداً.",
    scheduled: "الموعد", price: "السعر", cancelled: "أُلغي هذا الطلب.",
    stages: { new: "تم الاستلام", confirmed: "مؤكد", in_workshop: "في الورشة", awaiting_parts: "بانتظار القطع", ready: "جاهزة للاستلام", completed: "مكتملة" } as Record<string, string> },
};
