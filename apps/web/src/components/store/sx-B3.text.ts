// The cart, checkout and quote link's new words (build of 2026-11-18, builder B3), in English and Arabic; every other
// language translates the English (src/i18n/tx). The store's first words (Store.text.ts) and the store build's (w4, w5)
// are reused where they already say the thing. Amounts and dates come in already written.
export const T = {
  en: {
    // P14: the amount sits beside the words, never broken from its sign
    placePay: "Place order and pay",
    // SM10-B: the line's drawn buttons, read by their names
    saveOf: (s: string) => `Save for later: ${s}`,
    removeOf: (s: string) => `Remove: ${s}`,
    times: (n: number, p: string) => `${n} × ${p}`,

    // N34 buying for a company (a standard tax invoice)
    company: "Buying for a company",
    coName: "Company name",
    coVat: "VAT number",
    coCr: "CR number",
    coBuilding: "Building number",
    coStreet: "Street",
    coDistrict: "District",
    coCity: "City",
    coPostal: "Postal code",
    taxInvoice: "Tax invoice",
    buyerVat: "Buyer's VAT number",
    buyerCr: "Buyer's CR number",
    buyerAddress: "Buyer's address",

    // N07 the map pin of a Jeddah delivery
    pinIt: "Pin it on the map",
    pinned: "Location pinned",
    change: "Change",
    pinTitle: "Delivery location",
    locate: "Use my location",
    pinUse: "Use this location",
    pinHere: "The pin marks the door",

    // N13 the handover slot of "Collect fully built"
    handover: "Handover",
    handoverDay: "Handover day",
    handoverTime: "Time slot",
    anyTime: "Any time",

    // N15 handed over at one of the rider's own sessions
    atSession: "At my next session",
    atSessionOn: (d: string) => `At my session · ${d}`,
    session: "Session",

    // N17
    learning: "I'm still learning to ride",
    learnH: "Learn to ride with us",
    learnGo: "Apply for a lesson",

    // N23 the quote link
    quote: "Your quote",
    validUntil: (d: string) => `Valid until ${d}`,
    quoteUsed: (no: string) => `This quote was used for order ${no}.`,
    quoteExpired: "This quote has expired.",
    quoteVoid: "This quote is no longer valid.",
    askNew: "Ask for a new quote",
    askNewMsg: (q: string) => `Hello, my quote ${q} has expired. Could you send me a new one?`,

    // N20 a store gift card into the account's wallet
    giftWallet: "Add a gift card to your wallet",
    giftWalletGo: "Add to wallet",
    giftWalletDone: (a: string) => `${a} added to your wallet.`,

    // the checks and refusals these bring
    checks: {
      coName: "Enter the company's name.",
      coVat: "A VAT number has 15 digits and starts and ends with 3.",
      coCr: "A CR number has 10 digits.",
      coBuilding: "A building number has 4 digits.",
      coStreet: "Enter the street.",
      coDistrict: "Enter the district.",
      coCity: "Enter the city.",
      coPostal: "The postal code has 5 numbers.",
      company: "Check the company's details.",
      pin: "Pin a point in Jeddah, or take the pin off.",
      pin_out: "That point is outside Jeddah.",
      locate_off: "This device isn't sharing its location.",
      map_off: "The map didn't load.",
      handover: "That handover time was just taken. Pick another.",
      session: "That booking can't take it any more. Pick another way.",
      quote: "This quote can't be used.",
      quote_used: "This quote has already been used.",
      quote_expired: "This quote has expired.",
      quote_changed: "This quote has changed. Open its link again.",
      gift_wallet: "This gift card can't be added right now.",
    } as Record<string, string>,
  },
  ar: {
    placePay: "تأكيد الطلب والدفع",
    saveOf: (s: string) => `حفظ لوقت لاحق: ${s}`,
    removeOf: (s: string) => `إزالة: ${s}`,
    times: (n: number, p: string) => `${n} × ${p}`,

    company: "الشراء لشركة",
    coName: "اسم الشركة",
    coVat: "الرقم الضريبي",
    coCr: "رقم السجل التجاري",
    coBuilding: "رقم المبنى",
    coStreet: "الشارع",
    coDistrict: "الحي",
    coCity: "المدينة",
    coPostal: "الرمز البريدي",
    taxInvoice: "فاتورة ضريبية",
    buyerVat: "الرقم الضريبي للمشتري",
    buyerCr: "السجل التجاري للمشتري",
    buyerAddress: "عنوان المشتري",

    pinIt: "حدّد الموقع على الخريطة",
    pinned: "تم تحديد الموقع",
    change: "تغيير",
    pinTitle: "موقع التوصيل",
    locate: "استخدم موقعي",
    pinUse: "اعتمد هذا الموقع",
    pinHere: "الدبوس يحدد الباب",

    handover: "التسليم",
    handoverDay: "يوم التسليم",
    handoverTime: "الوقت",
    anyTime: "أي وقت",

    atSession: "في جلستي القادمة",
    atSessionOn: (d: string) => `في جلستي · ${d}`,
    session: "الجلسة",

    learning: "ما زلت أتعلّم ركوب الدراجة",
    learnH: "تعلّم الركوب معنا",
    learnGo: "قدّم على درس",

    quote: "عرض السعر",
    validUntil: (d: string) => `صالح حتى ${d}`,
    quoteUsed: (no: string) => `استُخدم عرض السعر هذا للطلب ${no}.`,
    quoteExpired: "انتهت صلاحية عرض السعر هذا.",
    quoteVoid: "لم يعد عرض السعر هذا صالحاً.",
    askNew: "اطلب عرض سعر جديد",
    askNewMsg: (q: string) => `مرحباً، انتهت صلاحية عرض السعر ${q}. هل يمكنكم إرسال عرض جديد؟`,

    giftWallet: "أضف بطاقة هدية إلى محفظتك",
    giftWalletGo: "أضف إلى المحفظة",
    giftWalletDone: (a: string) => `أُضيف ${a} إلى محفظتك.`,

    checks: {
      coName: "اكتب اسم الشركة.",
      coVat: "الرقم الضريبي 15 رقماً يبدأ بـ 3 وينتهي بـ 3.",
      coCr: "رقم السجل التجاري 10 أرقام.",
      coBuilding: "رقم المبنى 4 أرقام.",
      coStreet: "اكتب الشارع.",
      coDistrict: "اكتب الحي.",
      coCity: "اكتب المدينة.",
      coPostal: "الرمز البريدي 5 أرقام.",
      company: "راجع بيانات الشركة.",
      pin: "حدّد نقطة داخل جدة، أو أزل الدبوس.",
      pin_out: "هذه النقطة خارج جدة.",
      locate_off: "هذا الجهاز لا يشارك موقعه.",
      map_off: "تعذّر تحميل الخريطة.",
      handover: "حُجز موعد التسليم هذا للتو. اختر موعداً آخر.",
      session: "لم يعد هذا الحجز متاحاً للتسليم. اختر طريقة أخرى.",
      quote: "لا يمكن استخدام عرض السعر هذا.",
      quote_used: "استُخدم عرض السعر هذا من قبل.",
      quote_expired: "انتهت صلاحية عرض السعر هذا.",
      quote_changed: "تغيّر عرض السعر هذا. افتح رابطه من جديد.",
      gift_wallet: "لا يمكن إضافة بطاقة الهدية هذه الآن.",
    } as Record<string, string>,
  },
};
export type SxText = (typeof T)["en"];
