import { bi, type PageSchema } from "@/content/types";

// About & Contact (About.dc.html). The story, the numbers, the vision, mission and values are the
// company profile's own (Profile - Micromobility.pdf, 2026); the design's timeline and team were
// placeholders ("[Year]", "[Name]"), and its test loop, trade-ins, parking and nutrition brands
// were examples, so they are left out. The contact details come from the site-wide content.
// "Join the team" sends an application that lands in the staff page's Messages (kind jobs).
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const link = (id: string, en: string, ar: string, def: string) => ({ id, type: "link" as const, label: bi(en, ar), def });
const img = (id: string, en: string, ar: string, def: string) => ({ id, type: "image" as const, label: bi(en, ar), def });

export const aboutSchema: PageSchema = {
  page: "about",
  label: bi("About & Contact", "من نحن والتواصل"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "About us", "من نحن"),
        txt("title", 60, "Title", "العنوان", "The home of cycling in Jeddah.", "بيت الدراجات في جدة."),
        long("text", 320, "Text", "النص",
          "Since 2016, Micromobility has been a Saudi company specialising in bicycles and modern mobility. Today we're a store, a workshop, a rental fleet and a riding community - building cycling culture on the Red Sea coast, one ride at a time.",
          "منذ 2016، مايكروموبيليتي شركة سعودية متخصصة في الدراجات ووسائل التنقل الحديثة. اليوم نحن متجر وورشة وأسطول تأجير ومجتمع ركوب - نبني ثقافة الدراجات على ساحل البحر الأحمر، رحلة برحلة."),
        {
          id: "numbers", type: "list", maxItems: 4, label: bi("Numbers", "الأرقام"),
          hint: bi("Only real numbers - leave the list empty rather than guess.", "أرقام حقيقية فقط - اترك القائمة فارغة بدل التخمين."),
          item: [txt("value", 12, "Number", "الرقم", "", ""), txt("label", 60, "What it counts", "ماذا يعني", "", "")],
          def: [
            { value: bi("2016", "2016"), label: bi("the year we started", "سنة البداية") },
            { value: bi("12", "12"), label: bi("cycling trips a year across the Kingdom", "رحلة دراجات سنوياً داخل المملكة") },
            { value: bi("2–3", "2–3"), label: bi("national and sporting events a year", "فعاليات وطنية ورياضية سنوياً") },
            { value: bi("2 years", "سنتان"), label: bi("of free maintenance (spare parts excluded)", "صيانة مجانية (لا تشمل قطع الغيار)") },
          ],
        },
      ],
    },
    {
      id: "story",
      label: bi("Vision, mission and values", "الرؤية والرسالة والقيم"),
      fields: [
        txt("visionTitle", 40, "Vision: title", "الرؤية: العنوان", "Our vision", "رؤيتنا"),
        long("vision", 300, "Vision: text", "الرؤية: النص",
          "To make Micromobility products a global standard of strength, precision and reliability, representing excellence and performance in the field of bicycles.",
          "أن تصبح منتجات مايكروموبيليتي معياراً عالمياً في القوة والدقة والموثوقية، لتمثل معياراً للتميز والأداء في مجال الدراجات."),
        txt("missionTitle", 40, "Mission: title", "الرسالة: العنوان", "Our mission", "رسالتنا"),
        long("mission", 300, "Mission: text", "الرسالة: النص",
          "Empowering customers to access safe transportation, with high-quality bicycle sales, rentals and maintenance, and an enjoyable, complete experience.",
          "تمكين العملاء من الوصول إلى وسائل تنقل آمنة، مع تقديم خدمات بيع وتأجير وصيانة الدراجات بجودة عالية وتجربة ممتعة ومتكاملة."),
        txt("valuesTitle", 40, "Values: heading", "القيم: العنوان", "Our core values", "قيمنا الأساسية"),
        {
          id: "values", type: "list", maxItems: 6, label: bi("Values", "القيم"),
          item: [txt("title", 40, "Value", "القيمة", "", ""), long("text", 160, "Text", "النص", "", "")],
          def: [
            { title: bi("Sustainability", "الاستدامة"), text: bi("Eco-friendly mobility that reduces emissions.", "نقل صديق للبيئة يقلل من الانبعاثات.") },
            { title: bi("Innovation", "الابتكار"), text: bi("Solutions built on the latest global technologies.", "تطوير حلول تعتمد على أحدث التقنيات العالمية.") },
            { title: bi("Health & fitness", "الرياضة والصحة"), text: bi("Encouraging daily movement and an active lifestyle.", "تشجيع الحركة والنشاط اليومي.") },
            { title: bi("Reliability", "الموثوقية"), text: bi("Safe, transparent and trustworthy service.", "تقديم خدمة آمنة وشفافة وموثوقة للمستخدمين.") },
            { title: bi("Flexibility", "المرونة"), text: bi("Easy access and use, anytime, anywhere.", "سهولة الوصول والاستخدام في أي وقت ومكان.") },
            { title: bi("Accessibility", "إتاحة الفرص"), text: bi("Innovative mobility within reach of every sports lover.", "تسهيل الوصول لحلول تنقل مبتكرة لجميع عشاق الرياضة.") },
          ],
        },
      ],
    },
    {
      id: "tour",
      label: bi("Where to find us", "أين تجدنا"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Where to find us", "أين تجدنا"),
        txt("title", 60, "Title", "العنوان", "What you'll find here.", "ماذا ستجد عندنا؟"),
        {
          id: "items", type: "list", maxItems: 4, label: bi("Places", "الأماكن"),
          item: [img("image", "Photo", "الصورة", ""), txt("name", 40, "Name", "الاسم", "", ""), long("text", 160, "Text", "النص", "", "")],
          def: [
            { image: { url: "/site/about/store.jpg" }, name: bi("The store", "المتجر"), text: bi("Battle and Alvas bikes, accessories, apparel and gear - Thu Al-Nurayn St, Al Sharafeyah.", "دراجات Battle وAlvas والإكسسوارات والملابس والمعدات - شارع ذي النورين، الشرفية.") },
            { image: { url: "/site/workshop/mechanic.jpg" }, name: bi("The workshop", "الورشة"), text: bi("Maintenance, repairs and custom builds, with genuine spare parts.", "صيانة وإصلاح وتخصيص بقطع غيار أصلية.") },
            { image: { url: "/site/about/circuit.jpg" }, name: bi("The JCC pop-up", "متجر JCC المؤقت"), text: bi("Bike rentals and evening rides at the Jeddah Corniche Circuit.", "تأجير الدراجات والجولات المسائية في حلبة كورنيش جدة.") },
          ],
        },
        txt("brandsTitle", 40, "Brands: heading", "العلامات: العنوان", "Brands we carry", "العلامات التي نمثلها"),
        {
          id: "brands", type: "list", maxItems: 12, label: bi("Brands", "العلامات"),
          item: [txt("name", 30, "Brand", "العلامة", "", "")],
          def: ["Battle", "Alvas", "EasyDo", "Garmin"].map((n) => ({ name: bi(n, n) })),
        },
      ],
    },
    {
      id: "links",
      label: bi("Ride with us", "اركب معنا"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Ride with us", "اركب معنا"),
        {
          id: "items", type: "list", maxItems: 3, label: bi("Cards", "البطاقات"),
          hint: bi("A card that opens a page that is switched off is not shown.", "البطاقة التي تفتح صفحة متوقفة لا تظهر."),
          item: [txt("title", 50, "Title", "العنوان", "", ""), long("text", 200, "Text", "النص", "", ""), txt("cta", 30, "Link text", "نص الرابط", "", ""), link("href", "Link", "الرابط", "")],
          def: [
            { title: bi("Rides & experiences", "الجولات والتجارب"), text: bi("Evening sessions on the Corniche Circuit, open to everyone, and community rides for Club members.", "جلسات مسائية على حلبة الكورنيش مفتوحة للجميع، وجولات مجتمعية لأعضاء النادي."), cta: bi("Book a ride", "احجز جولة"), href: { href: "/experiences" } },
            { title: bi("For business", "للشركات"), text: bi("Corporate rides, events and fleet programmes, planned and delivered end to end.", "رحلات الشركات والفعاليات وبرامج الأساطيل، نخطط لها وننفذها بالكامل."), cta: bi("Business", "للشركات"), href: { href: "/business" } },
            { title: bi("The Club", "النادي"), text: bi("Our community membership: ride credits, perks and member rides.", "عضوية مجتمعنا: رصيد ركوب ومزايا وجولات للأعضاء."), cta: bi("Join the Club", "انضم إلى النادي"), href: { href: "/club" } },
          ],
        },
      ],
    },
    {
      id: "faq",
      label: bi("Visitor questions", "أسئلة الزوار"),
      hint: bi("In an answer, {hours} is the opening hours from the contact details.", "في الإجابة، {hours} هي ساعات العمل من بيانات التواصل."),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Before you visit", "قبل زيارتك"),
        txt("title", 60, "Title", "العنوان", "Visitor questions", "أسئلة الزوار"),
        {
          id: "items", type: "list", maxItems: 8, label: bi("Questions", "الأسئلة"),
          item: [txt("q", 120, "Question", "السؤال", "", ""), long("a", 400, "Answer", "الإجابة", "", "")],
          def: [
            { q: bi("When is the store open?", "متى يفتح المتجر؟"), a: bi("We're open {hours}.", "نفتح {hours}.") },
            { q: bi("Where can I rent a bike?", "أين أستأجر دراجة؟"), a: bi("At the Jeddah Corniche Circuit: evening sessions on Sundays and Tuesdays, open to everyone. Pick a date and book on the Experiences page.", "في حلبة كورنيش جدة: جلسات مسائية يومي الأحد والثلاثاء مفتوحة للجميع. اختر موعدك واحجز من صفحة التجارب.") },
            { q: bi("Does my bike come with a warranty?", "هل تأتي دراجتي بضمان؟"), a: bi("Yes: two years of free maintenance (spare parts not included), a two-year warranty on gear shifters and a two-year replacement service for all the brands we sell. Terms and conditions apply.", "نعم: صيانة مجانية لمدة سنتين (لا تشمل قطع الغيار)، وضمان سنتين على مبدلات السرعة، وخدمة استبدال لمدة سنتين لجميع العلامات التي نبيعها. تطبق الشروط والأحكام.") },
            { q: bi("How do I book a service?", "كيف أحجز صيانة؟"), a: bi("Request it on the Workshop page: pick the service and a preferred day and time, and we confirm.", "اطلبها من صفحة الورشة: اختر الخدمة واليوم والوقت المفضل، ونؤكد لك الموعد.") },
          ],
        },
      ],
    },
    {
      id: "contact",
      label: bi("Contact", "التواصل"),
      hint: bi("The address, phone, email, hours and social links are the site-wide contact details (Site > Contact and hours).", "العنوان والجوال والبريد وساعات العمل وروابط التواصل من بيانات الموقع العامة (الموقع > التواصل والمواعيد)."),
      fields: [
        txt("title", 40, "Title", "العنوان", "Get in touch", "تواصل معنا"),
        txt("waBtn", 40, "Button: WhatsApp", "الزر: واتساب", "Message us on WhatsApp", "راسلنا على واتساب"),
        txt("messageBtn", 40, "Link: message form", "الرابط: نموذج الرسالة", "Send us a message", "أرسل لنا رسالة"),
        link("messageHref", "Message form link", "رابط نموذج الرسالة", "/help#message"),
        { id: "showMap", type: "toggle", label: bi("Show the map", "إظهار الخريطة"), def: true },
        { id: "mapQuery", type: "text", max: 120, label: bi("Map: place or coordinates", "الخريطة: المكان أو الإحداثيات"), hint: bi("What the map shows: a place name or \"latitude,longitude\" (the store is 21.5242616,39.1902854).", "ما تعرضه الخريطة: اسم مكان أو «خط العرض,خط الطول» (المتجر 21.5242616,39.1902854)."), def: bi("21.5242616,39.1902854", "21.5242616,39.1902854") },
      ],
    },
    {
      id: "jobs",
      label: bi("Join the team", "انضم للفريق"),
      hint: bi("Applications land in the staff page: Website > Messages, as Job applications.", "تصل الطلبات إلى صفحة الموظفين: الموقع > الرسائل، كطلبات توظيف."),
      fields: [
        txt("title", 40, "Title", "العنوان", "Join the team", "انضم للفريق"),
        long("noRoles", 200, "When no role is open", "عند عدم وجود وظائف", "No open roles right now - send us your details and we'll keep them for future openings.", "لا وظائف شاغرة حالياً - أرسل بياناتك ونحتفظ بها للفرص القادمة."),
        txt("rolesTitle", 60, "When roles are open", "عند وجود وظائف", "Open roles right now", "الوظائف الشاغرة حالياً"),
        {
          id: "roles", type: "list", maxItems: 8, label: bi("Open roles", "الوظائف الشاغرة"),
          hint: bi("Empty means no open roles. An applicant can also apply for any role.", "الفارغة تعني لا وظائف شاغرة. ويمكن للمتقدم التقديم على أي وظيفة."),
          item: [txt("title", 50, "Role", "الوظيفة", "", ""), long("text", 200, "Short description", "وصف قصير", "", "")],
          def: [],
        },
        txt("anyRole", 30, "Choice: any role", "الخيار: أي وظيفة", "Any role", "أي وظيفة"),
        long("placeholder", 200, "Message box hint", "تلميح مربع الرسالة", "Tell us about yourself - your experience and when you could start. Add a link to your CV or LinkedIn if you have one.", "عرّفنا بنفسك - خبرتك ومتى يمكنك البدء. أضف رابط سيرتك الذاتية أو حسابك في LinkedIn إن وُجد."),
        txt("button", 30, "Button", "الزر", "Send application", "أرسل طلبك"),
        txt("doneTitle", 60, "Sent: title", "بعد الإرسال: العنوان", "Application sent.", "تم إرسال طلبك."),
        long("doneText", 200, "Sent: text", "بعد الإرسال: النص", "Thank you. We'll be in touch if there's a fit.", "شكراً لك. سنتواصل معك إن وُجدت فرصة مناسبة."),
      ],
    },
  ],
};
