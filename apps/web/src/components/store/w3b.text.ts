// The product page's sections below the buy box (store build 2026-11-15, chain w3b): the grouped specifications (F36),
// what's in the box (F37), the fit panel (F38), the add-ons (F30, D17-C), the starter set (F31), the comparison
// (F10, O09-B), the trade-in row (F52), the verified buyers' reviews (F42) and the questions (F41), in English and
// Arabic; every other language translates the English (src/i18n/tx). Amounts come in already written (sar).
export const T = {
  en: {
    // F36: the specification table
    riderHeight: "Rider height",
    cm: (r: string) => `${r} cm`,
    upToCm: (n: string) => `Up to ${n} cm`,
    groups: {
      size: "Size and weight", frame: "Frame", drive: "Drivetrain", brakes: "Brakes", wheels: "Wheels and tyres", power: "Motor and battery", other: "Other",
    } as Record<string, string>,

    // F37, F38
    boxH: "What's in the box",
    fitH: "Fit",
    fitK: "Fit",
    sizeK: "Size",
    bestK: "Best for",

    // F30, D17-C: the add-ons
    rideH: "Complete your ride",
    goesH: "Goes well with it",
    addOne: "Add",
    addedOne: "Added",
    addThis: (n: string) => `Add ${n} to your cart`,
    sizeAndColour: "Size and colour",
    pickBoth: "Choose a size and colour",
    pickOne: "Choose one",

    // F31: the starter set
    setH: "Starter set",
    setAdd: "Add the set to your cart",
    setAdded: "Set added",
    save: (p: string) => `You save ${p}`,
    apart: (p: string) => `${p} bought separately`,

    // F10, O09-B: the comparison
    cmpBikes: "Compare bikes",
    cmp: "Compare",
    current: "Currently viewing",
    view: "View",
    keys: {
      weight: "Weight", gears: "Gears", brakes: "Brakes", wheel: "Wheel size", frame: "Frame", fork: "Fork", tyre: "Tyres",
      battery: "Battery", motor: "Motor", range: "Range", material: "Material",
    } as Record<string, string>,

    // F52: trade-in
    tradeIn: "Trade in your old bike",
    tradeMsg: (n: string) => `Hello, I would like to trade in my old bike towards the ${n}.`,

    // F42: reviews
    reviewsH: "Reviews",
    review1: "1 review",
    reviewsN: (n: number) => `${n} reviews`,
    outOf5: (a: string) => `${a} out of 5`,
    verified: "Verified buyer",
    bought: (m: string) => `Bought ${m}`,
    allReviews: (n: number) => `Show all ${n} reviews`,

    // F41: questions
    faqH: "Questions and answers",
  },
  ar: {
    riderHeight: "طول الراكب",
    cm: (r: string) => `${r} سم`,
    upToCm: (n: string) => `حتى ${n} سم`,
    groups: {
      size: "المقاس والوزن", frame: "الإطار", drive: "ناقل الحركة", brakes: "الفرامل", wheels: "العجلات والإطارات", power: "المحرك والبطارية", other: "أخرى",
    } as Record<string, string>,

    boxH: "محتويات العلبة",
    fitH: "القَصّة والمقاس",
    fitK: "القَصّة",
    sizeK: "المقاس",
    bestK: "الأنسب لـ",

    rideH: "أكمل تجهيز رحلتك",
    goesH: "يناسبه أيضاً",
    addOne: "أضف",
    addedOne: "تمت الإضافة",
    addThis: (n: string) => `أضف ${n} إلى سلتك`,
    sizeAndColour: "المقاس واللون",
    pickBoth: "اختر المقاس واللون",
    pickOne: "اختر واحداً",

    setH: "طقم البداية",
    setAdd: "أضف الطقم إلى سلتك",
    setAdded: "تمت إضافة الطقم",
    save: (p: string) => `توفّر ${p}`,
    apart: (p: string) => `${p} عند الشراء منفصلاً`,

    cmpBikes: "قارن الدراجات",
    cmp: "قارن",
    current: "تشاهده الآن",
    view: "عرض",
    keys: {
      weight: "الوزن", gears: "التروس", brakes: "الفرامل", wheel: "مقاس العجلات", frame: "الإطار", fork: "الشوكة", tyre: "الإطارات",
      battery: "البطارية", motor: "المحرك", range: "المدى", material: "الخامة",
    } as Record<string, string>,

    tradeIn: "استبدل دراجتك القديمة",
    tradeMsg: (n: string) => `مرحباً، أرغب في استبدال دراجتي القديمة عند شراء ${n}.`,

    reviewsH: "التقييمات",
    review1: "تقييم واحد",
    reviewsN: (n: number) => `عدد التقييمات: ${n}`,
    outOf5: (a: string) => `${a} من 5`,
    verified: "مشترٍ موثّق",
    bought: (m: string) => `تاريخ الشراء ${m}`,
    allReviews: (n: number) => `عرض كل التقييمات (${n})`,

    faqH: "أسئلة وأجوبة",
  },
};
export type W3bText = typeof T.en;
