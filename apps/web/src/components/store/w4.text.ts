// The cart, checkout, the gift card page and the payment page's new words (store build 2026-11-15, chain w4), in
// English and Arabic; every other language translates the English (src/i18n/tx). Store.text.ts keeps the store's first
// words (Contact, Delivery, Address, the totals), which these pages still use. Amounts and dates come in already written.
export const T = {
  en: {
    // checkout as steps that close into a summary (O12-C)
    review: "Review",
    continue: "Continue",
    edit: "Edit",
    editOf: (s: string) => `Edit: ${s}`,
    stepOf: (n: number, m: number) => `Step ${n} of ${m}`,
    done: "Done",
    required: "required",
    phoneDriver: "Mobile for the driver",
    // a bike's ways, as its page names them (F27); "Ready" is the day pickup is ready (F28)
    pickupBuilt: "Collect fully built",
    jeddahBuilt: "Delivered ready to ride in Jeddah",
    ready: (d: string) => `Ready ${d}`,

    // scheduled Jeddah delivery (F78)
    slotDay: "Delivery day",
    slotTime: "Time",
    // the district check (F79)
    unserved: (d: string, way: string) => `We don't deliver to ${d} yet, so your order is set to ${way}.`,
    // the short address lookup (F76)
    find: "Find",
    finding: "Finding…",
    found: "Address filled in. Check it before you continue.",

    // a gift order (F58)
    isGift: "This is a gift",
    giftNote: "Gift note",

    // a gift card to pay with (F57)
    payGift: "Pay with a gift card",
    giftCode: "Gift card code",
    useCard: "Use card",
    giftLine: "Gift card",
    giftBal: (b: string, d: string) => `Balance ${b} · Valid until ${d}`,

    // a code (F67) and the starter set's saving (F31)
    haveCode: "Have a code?",
    codeLabel: "Promo code",
    applyCode: "Apply code",
    codeLine: (c: string) => `Code ${c}`,
    setLine: "Starter set",
    removeOf: (s: string) => `Remove: ${s}`,

    // inline checks as a field is left (F77), each saying what is wrong with it
    checks: {
      phone_chars: "Use numbers only, like 05X XXX XXXX.",
      phone_start: "A Saudi mobile starts with 05, like 05X XXX XXXX.",
      email_at: "An email address needs an @, like name@example.com.",
      email_domain: "Check the part after the @, like gmail.com.",
      email_space: "An email address can't have spaces.",
      short_letters: "The short address starts with 4 letters, like RCMA7933.",
      short_digits: "After the 4 letters come 4 numbers, like RCMA7933.",
      slot: "Choose a delivery day and time.",
      district_unserved: "We don't deliver to this district yet.",
      gift: "We couldn't find that gift card, or it has nothing left on it.",
      gift_expired: "This gift card has expired.",
      gift_on_gift: "A gift card can't pay for another gift card.",
      promo: "That code isn't valid.",
      promo_min: "Your order is under this code's minimum.",
      promo_used: "This code has been used up.",
      licence: "Codes can't be used right now.",
      lookup: "We couldn't find that short address. Check it, or fill in the address.",
      lookup_off: "Address lookup isn't available right now. Fill in the address.",
    } as Record<string, string>,
    phoneLen: (n: number) => `This number has ${n} digits. A Saudi mobile has 10, like 05X XXX XXXX.`,
    postalLen: (n: number) => `The postal code has 5 numbers, not ${n}.`,
    extraLen: (n: number) => `The additional number has 4 numbers, not ${n}.`,

    // the cart: complementary products (F66), saved for later (F68), express Apple Pay (F83)
    goesWith: "Goes with your bike",
    add: "Add",
    added: "Added",
    choose: "Choose",
    saveLater: "Save for later",
    laterH: (n: number) => `Saved for later (${n})`,
    toCart: "Move to cart",
    applePay: "Check out with Apple Pay",

    // the gift card page (F57)
    giftTitle: "Gift card",
    giftLead: "For bikes, gear and accessories from our Jeddah store.",
    amount: "Amount",
    valid: "Valid for 1 year from purchase",
    buyNow: "Buy now",

    // the payment page: decline recovery (F87), Tabby (F84), what the order took off
    tryApple: "Try Apple Pay",
    otherCard: "Use another card",
    tabby: "Pay in 4 with Tabby",
    tabbyParts: (p: string) => `4 payments of ${p}`,
    tabbyGo: "Continue with Tabby",
    tabbyErr: {
      tabby_off: "Paying with Tabby isn't available right now. Choose another way to pay.",
      tabby_rejected: "Tabby can't take this payment. Choose another way to pay.",
      cancel: "You left Tabby before paying. Nothing was charged.",
      fail: "Tabby didn't approve this payment. Nothing was charged. Choose another way to pay.",
      generic: "That didn't work. Please try again.",
    } as Record<string, string>,
    discount: "Discount",
    fromGift: "From your gift card",
  },
  ar: {
    review: "المراجعة",
    continue: "متابعة",
    edit: "تعديل",
    editOf: (s: string) => `تعديل: ${s}`,
    stepOf: (n: number, m: number) => `الخطوة ${n} من ${m}`,
    done: "مكتملة",
    required: "مطلوب",
    phoneDriver: "رقم الجوال للسائق",
    pickupBuilt: "استلمها مركّبة بالكامل",
    jeddahBuilt: "نوصلها داخل جدة جاهزة للركوب",
    ready: (d: string) => `جاهز للاستلام ${d}`,

    slotDay: "يوم التوصيل",
    slotTime: "الوقت",
    unserved: (d: string, way: string) => `لا نوصّل إلى ${d} بعد، لذا غيّرنا طريقة الاستلام إلى «${way}».`,
    find: "ابحث",
    finding: "جارٍ البحث…",
    found: "عبّأنا العنوان. راجعه قبل المتابعة.",

    isGift: "هذا الطلب هدية",
    giftNote: "رسالة الهدية",

    payGift: "ادفع ببطاقة هدية",
    giftCode: "رمز بطاقة الهدية",
    useCard: "استخدم البطاقة",
    giftLine: "بطاقة الهدية",
    giftBal: (b: string, d: string) => `الرصيد ${b} · صالحة حتى ${d}`,

    haveCode: "لديك رمز خصم؟",
    codeLabel: "رمز الخصم",
    applyCode: "تطبيق الرمز",
    codeLine: (c: string) => `الرمز ${c}`,
    setLine: "طقم البداية",
    removeOf: (s: string) => `حذف: ${s}`,

    checks: {
      phone_chars: "استخدم الأرقام فقط، مثل 05X XXX XXXX.",
      phone_start: "رقم الجوال السعودي يبدأ بـ 05، مثل 05X XXX XXXX.",
      email_at: "البريد الإلكتروني يحتاج إلى @، مثل name@example.com.",
      email_domain: "تحقّق من الجزء بعد @، مثل gmail.com.",
      email_space: "لا يحتوي البريد الإلكتروني على مسافات.",
      short_letters: "يبدأ العنوان المختصر بـ 4 حروف، مثل RCMA7933.",
      short_digits: "بعد الحروف الأربعة تأتي 4 أرقام، مثل RCMA7933.",
      slot: "اختر يوم التوصيل ووقته.",
      district_unserved: "لا نوصّل إلى هذا الحي بعد.",
      gift: "لم نجد بطاقة الهدية هذه، أو لم يبقَ فيها رصيد.",
      gift_expired: "انتهت صلاحية بطاقة الهدية هذه.",
      gift_on_gift: "لا يمكن الدفع ببطاقة هدية لشراء بطاقة هدية أخرى.",
      promo: "هذا الرمز غير صالح.",
      promo_min: "طلبك أقل من الحد الأدنى لهذا الرمز.",
      promo_used: "استُنفد هذا الرمز.",
      licence: "لا يمكن استخدام الرموز حالياً.",
      lookup: "لم نجد هذا العنوان المختصر. تحقّق منه، أو اكتب العنوان.",
      lookup_off: "البحث عن العنوان غير متاح حالياً. اكتب العنوان.",
    } as Record<string, string>,
    phoneLen: (n: number) => `في هذا الرقم ${n} أرقام، ورقم الجوال السعودي 10 أرقام، مثل 05X XXX XXXX.`,
    postalLen: (n: number) => `الرمز البريدي 5 أرقام، وليس ${n}.`,
    extraLen: (n: number) => `الرقم الإضافي 4 أرقام، وليس ${n}.`,

    goesWith: "يناسب دراجتك",
    add: "أضف",
    added: "تمت الإضافة",
    choose: "اختر",
    saveLater: "احفظه لوقت لاحق",
    laterH: (n: number) => `محفوظ لوقت لاحق (${n})`,
    toCart: "انقله إلى السلة",
    applePay: "ادفع باستخدام Apple Pay",

    giftTitle: "بطاقة هدية",
    giftLead: "للدراجات والمستلزمات والإكسسوارات من متجرنا في جدة.",
    amount: "القيمة",
    valid: "صالحة لمدة سنة من تاريخ الشراء",
    buyNow: "اشترِ الآن",

    tryApple: "جرّب Apple Pay",
    otherCard: "استخدم بطاقة أخرى",
    tabby: "قسّمها على 4 دفعات مع Tabby",
    tabbyParts: (p: string) => `4 دفعات، كل دفعة ${p}`,
    tabbyGo: "المتابعة مع Tabby",
    tabbyErr: {
      tabby_off: "الدفع عبر Tabby غير متاح حالياً. اختر طريقة دفع أخرى.",
      tabby_rejected: "لا يمكن إتمام هذا الدفع عبر Tabby. اختر طريقة دفع أخرى.",
      cancel: "غادرت Tabby قبل الدفع، ولم يُخصم أي مبلغ.",
      fail: "لم توافق Tabby على هذا الدفع، ولم يُخصم أي مبلغ. اختر طريقة دفع أخرى.",
      generic: "لم تنجح العملية. حاول مرة أخرى من فضلك.",
    } as Record<string, string>,
    discount: "الخصم",
    fromGift: "من بطاقة الهدية",
  },
};

export type W4Text = typeof T.en;
