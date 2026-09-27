import { bi, type PageSchema } from "@/content/types";

// The help centre (Help.dc.html): answers in four tabs, WhatsApp and a call, and - so a question
// can be asked here too - a message form that lands in the staff page's Messages. A tab with no
// answers is not shown. The warranty answers are the company profile's own warranty policy. The
// shipping answers are what the online store itself states (free delivery to every region, store
// pickup, orders reviewed and confirmed before they are prepared), and the returns answers follow
// the Ministry of Commerce's rules (7 days to return, 15 to exchange, unused, with the invoice) -
// written 2026-09-25 for the owner to confirm; staff change them in Website > Help.
const txt = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const qa = (q: [string, string], a: [string, string]) => ({ q: bi(...q), a: bi(...a) });
const answers = <I extends string>(id: I, en: string, ar: string, def: ReturnType<typeof qa>[]) => ({
  id, type: "list" as const, maxItems: 12, label: bi(en, ar),
  item: [txt("q", 120, "Question", "السؤال", "", ""), long("a", 700, "Answer", "الإجابة", "", "")],
  def,
});

export const HELP_TOPICS = ["faq", "delivery", "returns", "warranty"] as const;

export const helpSchema = {
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
        answers("delivery", "Tab 2: questions", "التبويب ٢: الأسئلة", [
          qa(["Do you deliver across Saudi Arabia?", "هل توصلون إلى جميع مناطق المملكة؟"],
            ["Yes. Orders from our online store ship free of charge to every region of the Kingdom.", "نعم، طلبات متجرنا الإلكتروني تُشحن مجاناً إلى جميع مناطق المملكة."]),
          qa(["How long does delivery take?", "كم يستغرق التوصيل؟"],
            ["We review and confirm every order as soon as it arrives, then prepare it for shipping. Delivery time depends on your city; message us on WhatsApp for an estimate.", "نراجع كل طلب ونؤكده فور وصوله ثم نجهّزه للشحن. تختلف مدة التوصيل حسب مدينتك، وراسلنا على واتساب لمعرفة المدة المتوقعة."]),
          qa(["Can I collect my order from the store?", "هل يمكنني استلام طلبي من المتجر؟"],
            ["Yes. Choose store pickup at checkout and collect your order from our Jeddah store on Thu Al-Nurayn St, Al Sharafeyah, Saturday to Thursday from 2pm to 10pm.", "نعم. اختر الاستلام من المتجر عند إتمام الطلب، واستلم طلبك من متجرنا في جدة، شارع ذي النورين، الشرفية، من السبت إلى الخميس، من 2 ظهراً حتى 10 مساءً."]),
          qa(["How do I follow my order?", "كيف أتابع طلبي؟"],
            ["Message us on WhatsApp with your order number and the team will tell you where it is.", "راسلنا على واتساب برقم طلبك وسيخبرك الفريق بحالته."]),
        ]),
        txt("returnsTab", 30, "Tab 3: name", "التبويب ٣: الاسم", "Returns & exchanges", "الإرجاع والاستبدال"),
        answers("returns", "Tab 3: questions", "التبويب ٣: الأسئلة", [
          qa(["Can I return or exchange something I bought?", "هل يمكنني إرجاع منتج اشتريته أو استبداله؟"],
            ["Yes. You can return a product within 7 days, or exchange it within 15 days, of receiving it, as long as it is unused, in its original packaging and with its invoice.", "نعم. يمكنك إرجاع المنتج خلال 7 أيام، أو استبداله خلال 15 يوماً، من تاريخ استلامه، بشرط أن يكون غير مستخدم وفي تغليفه الأصلي ومعه الفاتورة."]),
          qa(["Is there anything that can't be returned?", "هل توجد منتجات لا يمكن إرجاعها؟"],
            ["Items made or adjusted especially for you can't be returned unless they are faulty.", "لا يمكن إرجاع المنتجات المصنوعة أو المعدّلة خصيصاً لك ما لم يكن فيها عيب."]),
          qa(["How do I start a return or an exchange?", "كيف أبدأ الإرجاع أو الاستبدال؟"],
            ["Message us on WhatsApp or call us with your order number and we'll arrange it with you. You can also bring the product to our Jeddah store.", "راسلنا على واتساب أو اتصل بنا برقم طلبك وسنرتب ذلك معك، ويمكنك أيضاً إحضار المنتج إلى متجرنا في جدة."]),
          qa(["How is my money refunded?", "كيف يُعاد المبلغ؟"],
            ["Once we have received and checked the product, the refund goes back the way you paid.", "بعد استلامنا المنتج وفحصه، يُعاد المبلغ بطريقة الدفع نفسها التي استخدمتها."]),
          qa(["What if the product is faulty?", "ماذا لو كان في المنتج عيب؟"],
            ["Manufacturing faults are covered by our two-year warranty: see the Warranty tab, or contact us and we'll put it right.", "العيوب المصنعية يشملها ضماننا لمدة سنتين: راجع تبويب الضمان، أو تواصل معنا وسنعالجها لك."]),
        ]),
        txt("warrantyTab", 30, "Tab 4: name", "التبويب ٤: الاسم", "Warranty", "الضمان"),
        answers("warranty", "Tab 4: questions", "التبويب ٤: الأسئلة", [
          qa(["What does the warranty cover?", "ماذا يشمل الضمان؟"],
            ["Manufacturing defects, with full after-sales support. Shift levers are covered for two years, spare parts included; misuse and wheels are not covered. Terms and conditions apply.", "العيوب المصنعية مع دعم فني كامل بعد البيع. أذرع تبديل السرعات مضمونة لمدة سنتين وتشمل قطع الغيار، ولا يشمل الضمان سوء الاستخدام والعجلات. تطبق الشروط والأحكام."]),
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
} as const satisfies PageSchema;
