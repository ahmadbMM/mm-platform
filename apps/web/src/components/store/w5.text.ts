// The store build's words for after the order (2026-11-15, chain w5): an order's page (out for delivery today, the
// simplified tax invoice, refunds, the gift cards it bought, returns, reviews, a workshop booking) and My Account's
// order list. English and Arabic by hand; every other language translates the English (src/i18n/tx). Amounts come in
// already written (sar). Words the store already has stay in Store.text.ts and are reused from there.
export const T = {
  en: {
    // where an order is (F96) and what a gift card alone does (F57)
    statusOut: "Out for delivery",
    statusOutToday: "Out for delivery today",
    giftReady: "Ready to use",
    wayDigital: "Gift card code on this page",
    slotOn: (d: string) => `Delivery on ${d}`,
    events: {
      return_requested: "Return requested", exchange_requested: "Exchange requested",
      return_approved: "Return approved", exchange_approved: "Exchange approved",
      return_refused: "Return declined", exchange_refused: "Exchange declined",
    } as Record<string, string>,

    // the simplified tax invoice (L06)
    taxInvoice: "Simplified tax invoice",
    issued: "Date of issue",
    supplied: "Supplied",
    discount: "Discount",
    discBundle: "Bundle price",
    discCode: (c: string) => `Code ${c}`,
    totalVat: "Total incl. VAT",
    vatRow: "VAT 15%",
    paidGift: "Paid with a gift card",
    qrLabel: "The invoice's ZATCA QR code",

    // refunds under the invoice (X09)
    refundsH: "Refunds",
    refundTo: { card: "Refund to your card", wallet: "Refund to your wallet", gift: "Refund to your gift card", other: "Refund" } as Record<string, string>,
    refundState: { pending: "On its way", done: "Refunded" } as Record<string, string>,

    // the gift cards an order bought (F57)
    giftCardsH: "Your gift cards",
    giftCard: "Gift card",
    giftValid: (d: string) => `Valid until ${d}`,
    giftState: { void: "Cancelled", expired: "Expired", spent: "Fully used" } as Record<string, string>,
    printGift: "Print gift card",

    // a return or an exchange (F93)
    returnBtn: "Return an item",
    returnTitle: "Return or exchange",
    kindReturn: "Return",
    kindExchange: "Exchange",
    kindLabel: "What would you like?",
    whichItems: "Which items?",
    why: "Why?",
    reasons: {
      wrong_size: "Wrong size", changed_mind: "Changed my mind", damaged: "Arrived damaged", not_as_described: "Not as described", other: "Something else",
    } as Record<string, string>,
    sendRequest: "Send request",
    sending: "Sending…",
    requestSent: "We have your request.",
    reqReturn: (d: string) => `Return requested on ${d}`,
    reqExchange: (d: string) => `Exchange requested on ${d}`,
    reqState: { open: "Received", approved: "Approved", refused: "Declined" } as Record<string, string>,
    errs: {
      return_window: "This order can no longer be returned or exchanged.",
      return_open: "There is already a request open for this order.",
      return_items: "Choose the items and a reason.",
      not_found: "We couldn't find this order. Open it again from Track order.",
      busy: "Too many tries. Wait a minute and try again.",
      network: "No connection. Check your internet and try again.",
      generic: "Something went wrong. Please try again.",
    } as Record<string, string>,

    // a review of what was bought (F94)
    reviewH: "How was it?",
    stars: (n: number) => `${n} out of 5`,
    reviewBox: "Your review",
    reviewSend: "Send review",
    reviewThanks: "Thank you for your review.",

    // the workshop (F51)
    bookService: "Book a Service",
  },
  ar: {
    statusOut: "خرج للتوصيل",
    statusOutToday: "خرج للتوصيل اليوم",
    giftReady: "جاهزة للاستخدام",
    wayDigital: "رمز بطاقة الهدية في هذه الصفحة",
    slotOn: (d: string) => `التوصيل يوم ${d}`,
    events: {
      return_requested: "طُلب الإرجاع", exchange_requested: "طُلب الاستبدال",
      return_approved: "قُبل الإرجاع", exchange_approved: "قُبل الاستبدال",
      return_refused: "رُفض الإرجاع", exchange_refused: "رُفض الاستبدال",
    } as Record<string, string>,

    taxInvoice: "فاتورة ضريبية مبسطة",
    issued: "تاريخ الإصدار",
    supplied: "التوريد",
    discount: "الخصم",
    discBundle: "سعر المجموعة",
    discCode: (c: string) => `الرمز ${c}`,
    totalVat: "الإجمالي شامل الضريبة",
    vatRow: "ضريبة القيمة المضافة 15%",
    paidGift: "مدفوع ببطاقة هدية",
    qrLabel: "رمز الاستجابة السريعة للفاتورة (هيئة الزكاة والضريبة والجمارك)",

    refundsH: "المبالغ المستردة",
    refundTo: { card: "استرداد إلى بطاقتك", wallet: "استرداد إلى محفظتك", gift: "استرداد إلى بطاقة الهدية", other: "استرداد" } as Record<string, string>,
    refundState: { pending: "في الطريق", done: "تم الاسترداد" } as Record<string, string>,

    giftCardsH: "بطاقات الهدية",
    giftCard: "بطاقة هدية",
    giftValid: (d: string) => `صالحة حتى ${d}`,
    giftState: { void: "ملغاة", expired: "منتهية", spent: "استُخدمت بالكامل" } as Record<string, string>,
    printGift: "اطبع بطاقة الهدية",

    returnBtn: "إرجاع منتج",
    returnTitle: "إرجاع أو استبدال",
    kindReturn: "إرجاع",
    kindExchange: "استبدال",
    kindLabel: "ماذا تريد؟",
    whichItems: "أي المنتجات؟",
    why: "ما السبب؟",
    reasons: {
      wrong_size: "المقاس غير مناسب", changed_mind: "غيّرت رأيي", damaged: "وصل تالفاً", not_as_described: "لا يطابق الوصف", other: "سبب آخر",
    } as Record<string, string>,
    sendRequest: "أرسل الطلب",
    sending: "جارٍ الإرسال…",
    requestSent: "وصلنا طلبك.",
    reqReturn: (d: string) => `طُلب الإرجاع في ${d}`,
    reqExchange: (d: string) => `طُلب الاستبدال في ${d}`,
    reqState: { open: "مستلم", approved: "مقبول", refused: "مرفوض" } as Record<string, string>,
    errs: {
      return_window: "لم يعد بالإمكان إرجاع هذا الطلب أو استبداله.",
      return_open: "يوجد طلب مفتوح لهذا الطلب بالفعل.",
      return_items: "اختر المنتجات والسبب.",
      not_found: "لم نجد هذا الطلب. افتحه مجدداً من «تتبّع طلبك».",
      busy: "محاولات كثيرة. انتظر دقيقة ثم حاول مجدداً.",
      network: "لا يوجد اتصال. تحقّق من الإنترنت وحاول مجدداً.",
      generic: "حدث خطأ. حاول مرة أخرى.",
    } as Record<string, string>,

    reviewH: "ما رأيك؟",
    stars: (n: number) => `${n} من 5`,
    reviewBox: "رأيك",
    reviewSend: "أرسل التقييم",
    reviewThanks: "شكراً لتقييمك.",

    bookService: "حجز صيانة",
  },
};

export type W5Text = typeof T.en;
