// The product page's top half (store build 2026-11-15, chain w3a): the gallery and its viewer, the steps and pickers,
// the size guide, the buy box, the delivery and returns box and the back-in-stock pop-up, in English and Arabic; every
// other language translates the English (src/i18n/tx). Store.text.ts keeps the store's first words, which these pages
// still use (size, colour, Add to cart, the delivery ways, the return sentence's heading).
const arYears = (n: number) => (n === 1 ? "سنة واحدة" : n === 2 ? "سنتان" : n <= 10 ? `${n} سنوات` : `${n} سنة`);
const arMonths = (n: number) => (n === 1 ? "شهر واحد" : n === 2 ? "شهران" : n <= 10 ? `${n} أشهر` : `${n} شهراً`);

export const T = {
  en: {
    // the gallery (D12-C) and the viewer (F13)
    photos: "Photos",
    enlarge: (alt: string) => `Enlarge: ${alt}`,
    prevPhoto: "Previous photo",
    nextPhoto: "Next photo",

    // the name, the price and the key points (F24, F29)
    save: "Save",
    saved: "Saved",
    keySpecs: "Key specifications",
    tabby: (p: string) => `or 4 payments of ${p} with`,

    // the pickers and the steps (D11-C, F20-F22, F60)
    sizeGuide: "Size guide",
    riderHeight: "Rider height",
    chest: "Chest",
    waist: "Waist",
    cmRange: (a: number, b: number) => `${a}-${b} cm`,
    cmFrom: (a: number) => `${a}+ cm`,
    cmUpTo: (b: number) => `Up to ${b} cm`,
    yourHeight: "Your height in cm",
    noFit: "None of its sizes fits that height.",
    chooseSize: (s: string) => `Choose ${s}`,
    extras: "Extras",
    choiceFor: (n: string) => `Choice for ${n}`,

    // the buy box (D10, F25, F35, F83, F32, D14-E)
    summary: "Summary",
    totalWith: { pickup: "Total with pickup", jeddah: "Total with Jeddah delivery", ksa: "Total with delivery across Saudi Arabia" } as Record<string, string>,
    addedBtn: "Added",
    buyNow: "Buy now",
    applePay: "Buy with Apple Pay",
    askBike: "Ask about this bike",
    askItem: "Ask about this product",
    askMsg: (name: string, url: string) => `Hello, I have a question about ${name}: ${url}`,

    // the delivery and returns box (D16-A, F26-F28, X07, L07, L09)
    ready: (d: string) => `Ready ${d}`,
    pickupBuilt: "Collect fully built",
    jeddahBuilt: "Delivered ready to ride in Jeddah",
    warranty: "Warranty",
    year1: "1 year",
    yearsN: (n: number) => `${n} years`,
    month1: "1 month",
    monthsN: (n: number) => `${n} months`,
    and: (a: string, b: string) => `${a} and ${b}`,

    // back in stock (F34)
    notifyAny: "Tell me when it's back",
    notifyOf: (label: string) => `Tell me when ${label} is back`,
    send: "Send",
    sending: "Sending…",
    notifyDone: "Thank you. We'll message you on WhatsApp when it's back.",
    sendFailed: "It didn't go through. Please try again.",
    goneChoice: "This choice is no longer in the store.",
  },
  ar: {
    photos: "الصور",
    enlarge: (alt: string) => `تكبير: ${alt}`,
    prevPhoto: "الصورة السابقة",
    nextPhoto: "الصورة التالية",

    save: "حفظ",
    saved: "محفوظ",
    keySpecs: "أهم المواصفات",
    tabby: (p: string) => `أو 4 دفعات بقيمة ${p} مع`,

    sizeGuide: "دليل المقاسات",
    riderHeight: "طول الراكب",
    chest: "الصدر",
    waist: "الخصر",
    cmRange: (a: number, b: number) => `${a}-${b} سم`,
    cmFrom: (a: number) => `\u2066${a}+\u2069 سم`, // "190+" kept left to right inside the Arabic
    cmUpTo: (b: number) => `حتى ${b} سم`,
    yourHeight: "طولك بالسنتيمتر",
    noFit: "لا يناسب هذا الطول أيٌّ من مقاساته.",
    chooseSize: (s: string) => `اختر ${s}`,
    extras: "الإضافات",
    choiceFor: (n: string) => `الخيار لـ ${n}`,

    summary: "الملخص",
    totalWith: { pickup: "الإجمالي مع الاستلام", jeddah: "الإجمالي مع التوصيل داخل جدة", ksa: "الإجمالي مع التوصيل لجميع مناطق المملكة" } as Record<string, string>,
    addedBtn: "تمت الإضافة",
    buyNow: "اشترِ الآن",
    applePay: "اشترِ باستخدام Apple Pay",
    askBike: "اسأل عن هذه الدراجة",
    askItem: "اسأل عن هذا المنتج",
    askMsg: (name: string, url: string) => `السلام عليكم، عندي سؤال عن ${name}: ${url}`,

    ready: (d: string) => `جاهز للاستلام ${d}`,
    pickupBuilt: "استلمها مركّبة بالكامل",
    jeddahBuilt: "نوصلها داخل جدة جاهزة للركوب",
    warranty: "الضمان",
    year1: "سنة واحدة",
    yearsN: arYears,
    month1: "شهر واحد",
    monthsN: arMonths,
    and: (a: string, b: string) => `${a} و${b}`,

    notifyAny: "أبلغني عند توفره",
    notifyOf: (label: string) => `أبلغني عند توفر ${label}`,
    send: "إرسال",
    sending: "جارٍ الإرسال…",
    notifyDone: "شكراً لك. سنراسلك على واتساب عند توفره.",
    sendFailed: "لم يصل طلبك. حاول مرة أخرى.",
    goneChoice: "هذا الاختيار لم يعد في المتجر.",
  },
};

export type W3aText = typeof T.en;

/** A warranty in months as the warranty row words it: "2 years", "1 year and 6 months", "18 months" never (a whole year
 *  is always said in years). */
export function warrantyWords(t: W3aText, years: number, months: number): string {
  const y = years === 1 ? t.year1 : years > 1 ? t.yearsN(years) : "";
  const m = months === 1 ? t.month1 : months > 1 ? t.monthsN(months) : "";
  return y && m ? t.and(y, m) : y || m;
}
