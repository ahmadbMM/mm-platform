import { bi, type PageSchema, type ListField } from "@/content/types";

// The help centre (Help.dc.html): answers in four tabs, WhatsApp and a call, and - so a question
// can be asked here too - a message form that lands in the staff page's Messages. A tab with no
// answers is not shown. The design's delivery, returns and instalment answers were examples, not
// the business's policies, so those tabs start empty; the warranty answers are the company
// profile's own warranty policy.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const qa = (q: [string, string], a: [string, string]) => ({ q: bi(...q), a: bi(...a) });
const answers = (id: string, en: string, ar: string, def: ReturnType<typeof qa>[]): ListField => ({
  id, type: "list", maxItems: 12, label: bi(en, ar),
  item: [txt("q", 120, "Question", "السؤال", "", ""), long("a", 700, "Answer", "الإجابة", "", "")],
  def,
});

export const HELP_TOPICS = ["faq", "delivery", "returns", "warranty"] as const;

export const helpSchema: PageSchema = {
  page: "help",
  label: bi("Help centre", "مركز المساعدة"),
  sections: [
    {
      id: "intro",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Help centre", "مركز المساعدة"),
        txt("title", 60, "Title", "العنوان", "How can we help?", "كيف نقدر نخدمك؟"),
        long("text", 240, "Text", "النص",
          "Quick answers to common questions. Can't find yours? Send us a message below, or WhatsApp us.",
          "إجابات سريعة عن الأسئلة الشائعة. ما لقيت جوابك؟ أرسل لنا رسالة من الأسفل أو كلمنا واتساب."),
      ],
    },
    {
      id: "topics",
      label: bi("Questions and answers", "الأسئلة والإجابات"),
      hint: bi("A tab with no questions is hidden.", "التبويب بلا أسئلة لا يظهر."),
      fields: [
        txt("faqTab", 30, "Tab 1: name", "التبويب ١: الاسم", "FAQ", "أسئلة شائعة"),
        answers("faq", "Tab 1: questions", "التبويب ١: الأسئلة", [
          qa(["Where are you and what are your hours?", "وين موقعكم وأوقات العمل؟"],
            ["Thu Al-Nurayn St, Al Sharafeyah, Jeddah. Saturday to Thursday, 2pm to 10pm; closed on Friday.", "شارع ذي النورين، الشرفية، جدة. من السبت إلى الخميس، من 2 ظهراً حتى 10 مساءً، والجمعة مغلق."]),
          qa(["How do I book a bike service?", "كيف أحجز صيانة لدراجتي؟"],
            ["Request it on the Workshop page: pick the service and a day, and the team calls to confirm. Your reference number lets you follow your bike until it is ready.", "اطلبها من صفحة الورشة: اختر الخدمة واليوم، وسيتصل بك الفريق للتأكيد. وبرقم طلبك تتابع دراجتك حتى تجهز."]),
          qa(["How do I book a ride?", "كيف أحجز رحلة؟"],
            ["Choose a ride on the Experiences page and book your place online; you'll find it under My Bookings.", "اختر رحلة من صفحة التجارب واحجز مكانك أونلاين، وستجدها في «حجوزاتي»."]),
        ]),
        txt("deliveryTab", 30, "Tab 2: name", "التبويب ٢: الاسم", "Shipping & delivery", "الشحن والتوصيل"),
        answers("delivery", "Tab 2: questions", "التبويب ٢: الأسئلة", []),
        txt("returnsTab", 30, "Tab 3: name", "التبويب ٣: الاسم", "Returns & exchanges", "الإرجاع والاستبدال"),
        answers("returns", "Tab 3: questions", "التبويب ٣: الأسئلة", []),
        txt("warrantyTab", 30, "Tab 4: name", "التبويب ٤: الاسم", "Warranty", "الضمان"),
        answers("warranty", "Tab 4: questions", "التبويب ٤: الأسئلة", [
          qa(["What does the warranty cover?", "ماذا يشمل الضمان؟"],
            ["Manufacturing defects, with full after-sales support. Gear shifters are covered for two years, spare parts included; misuse and wheels are not covered. Terms and conditions apply.", "العيوب المصنعية مع دعم فني كامل بعد البيع. مبدلات السرعة مضمونة لمدة سنتين وتشمل قطع الغيار، ولا يشمل الضمان سوء الاستخدام والعجلات. تطبق الشروط والأحكام."]),
          qa(["Is maintenance included?", "هل الصيانة مشمولة؟"],
            ["Yes: two years of free maintenance. Spare parts are not included.", "نعم: صيانة مجانية لمدة سنتين، ولا تشمل قطع الغيار."]),
          qa(["Is there a replacement service?", "هل تتوفر خدمة استبدال؟"],
            ["Yes, a two-year replacement service for all the brands we sell. Terms and conditions apply.", "نعم، خدمة استبدال لمدة سنتين تشمل جميع العلامات التجارية التي نبيعها. تطبق الشروط والأحكام."]),
        ]),
      ],
    },
    {
      id: "contact",
      label: bi("Message form and contact", "نموذج الرسالة والتواصل"),
      fields: [
        txt("formTitle", 60, "Form title", "عنوان النموذج", "Send us a message", "أرسل لنا رسالة"),
        long("formText", 200, "Form text", "نص النموذج", "The team replies by phone or email within working hours.", "يرد الفريق بالاتصال أو بالبريد خلال ساعات العمل."),
        txt("button", 30, "Button", "الزر", "Send message", "أرسل الرسالة"),
        txt("doneTitle", 60, "After sending: title", "بعد الإرسال: العنوان", "Message sent", "تم إرسال رسالتك"),
        long("doneText", 200, "After sending: text", "بعد الإرسال: النص", "Thank you - we'll reply within working hours.", "شكراً لك - سنرد عليك خلال ساعات العمل."),
        txt("ctaTitle", 60, "Contact box: title", "صندوق التواصل: العنوان", "Still need a hand?", "محتاج مساعدة أكثر؟"),
        long("ctaText", 200, "Contact box: text", "صندوق التواصل: النص", "The store team in Jeddah replies Saturday to Thursday, 2pm to 10pm.", "فريق المتجر في جدة يرد من السبت إلى الخميس، من 2 ظهراً حتى 10 مساءً."),
      ],
    },
  ],
};
