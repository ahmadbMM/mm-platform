// The store build's site-wide words (2026-11-15, chain w1): the footer's Policies column, its SBC badge and legal line,
// the Returns and Complaints pages, the store in the header's search and the /bikes catalogue's link to the store. English
// and Arabic by hand; every other language translates the English (src/i18n/tx). A text with the same English as one the
// site already shows ("Terms & Conditions", "Returns & exchanges") is already translated everywhere.
export const T = {
  en: {
    // the footer
    policies: "Policies",
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    returns: "Returns + Exchanges",
    complaints: "Complaints",
    sbc: "Verified e-store: Saudi Business Center",
    ecr: "E-store CR No.",

    // the Returns page
    returnsTitle: "Returns & exchanges",
    returnsDesc: "How to return or exchange something you bought from Micromobility: the days you have, the condition it must be in and how your money comes back.",
    askReturn: "Ask about a return on WhatsApp",

    // the Complaints page
    complaintsDesc: "How to make a complaint to Micromobility, and how soon we answer it.",
    complaintsLead: "Something not right with an order, a ride or a service? Tell us and we will put it right.",
    answerIn1: "We answer every complaint within 1 working day, in Arabic or English.",
    answerInN: (n: number) => `We answer every complaint within ${n} working days, in Arabic or English.`,
    answerAny: "We answer every complaint in Arabic or English.",
    howTo: "How to complain",
    byWhatsApp: "Message us on WhatsApp",
    byPhone: "Call us",
    byVisit: "Visit the showroom",
    directions: "Directions",
    giveRef: "Give us your order number or booking reference, and tell us what went wrong.",

    // the header's search
    products: "Products",

    // the /bikes catalogue
    seeInStore: "See it in the store",
  },
  ar: {
    policies: "السياسات",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    returns: "الإرجاع والاستبدال",
    complaints: "الشكاوى",
    sbc: "متجر إلكتروني موثّق: المركز السعودي للأعمال",
    ecr: "سجل المتجر الإلكتروني",

    returnsTitle: "الإرجاع والاستبدال",
    returnsDesc: "كيف ترجع أو تستبدل منتجاً اشتريته من مايكروموبيليتي: المدة المتاحة لك، وحالة المنتج المطلوبة، وكيف يعود إليك المبلغ.",
    askReturn: "اسألنا عن الإرجاع عبر واتساب",

    complaintsDesc: "كيف تقدّم شكوى إلى مايكروموبيليتي، ومتى نرد عليها.",
    complaintsLead: "هل في طلبك أو رحلتك أو الخدمة ما لم يكن كما يجب؟ أخبرنا وسنصلحه لك.",
    answerIn1: "نرد على كل شكوى خلال يوم عمل واحد، بالعربية أو الإنجليزية.",
    answerInN: (n: number) => `نرد على كل شكوى خلال ${n === 2 ? "يومي عمل" : n <= 10 ? `${n} أيام عمل` : `${n} يوم عمل`}، بالعربية أو الإنجليزية.`,
    answerAny: "نرد على كل شكوى بالعربية أو الإنجليزية.",
    howTo: "كيف تقدّم شكوى",
    byWhatsApp: "راسلنا عبر واتساب",
    byPhone: "اتصل بنا",
    byVisit: "زُر صالة العرض",
    directions: "الاتجاهات",
    giveRef: "أرسل لنا رقم طلبك أو رقم حجزك، وأخبرنا بما حدث.",

    products: "المنتجات",

    seeInStore: "شاهدها في المتجر",
  },
};
export type W1Text = typeof T.en;
