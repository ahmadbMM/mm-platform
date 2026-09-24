import { bi, type PageSchema } from "@/content/types";

// The business page (B2B.dc.html): what Micromobility does for companies, the clients and
// partners, and an enquiry form that lands in the staff page's Messages. Service photos are the
// brand's own where the design used stock. Partners add Battle and Alvas from the company
// profile. The design's "24/7 fleet support" is left out until it is a promise staff make.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
// List defaults are written the way they are stored: an image is { url }.
const logo = (en: string, url = "") => (url ? { name: bi(en, en), logo: { url } } : { name: bi(en, en) });

export const businessSchema: PageSchema = {
  page: "business",
  label: bi("For business", "للشركات"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Business Solutions", "حلول الشركات"),
        txt("title", 80, "Title", "العنوان", "Corporate cycling, built around your brand.", "دراجات للشركات، مبنية حول علامتك."),
        long("text", 260, "Text", "النص",
          "Fleets, events, hotel partnerships, wellness programmes, F1 activations, university programmes and full maintenance support - in and around Jeddah.",
          "أساطيل، فعاليات، شراكات فنادق، برامج صحية، تفعيلات فورمولا 1، برامج جامعات ودعم صيانة كامل - في جدة وما حولها."),
      ],
    },
    {
      id: "services",
      label: bi("Services", "الخدمات"),
      fields: [
        {
          id: "items", type: "list", maxItems: 6, label: bi("Services (each one is a tab)", "الخدمات (كل خدمة تبويب)"),
          hint: bi("One point per line. The enquiry form notes which service the visitor was reading.", "سطر لكل نقطة. يسجل النموذج الخدمة التي كان الزائر يقرأ عنها."),
          item: [
            txt("tab", 30, "Tab", "التبويب", "", ""),
            { id: "image", type: "image", label: bi("Photo", "الصورة"), def: "" },
            txt("title", 70, "Title", "العنوان", "", ""),
            long("text", 320, "Text", "النص", "", ""),
            long("points", 320, "Points (one per line)", "النقاط (سطر لكل نقطة)", "", ""),
          ],
          def: [
            { tab: bi("Fleet Programmes", "برامج الأساطيل"), image: { url: "/site/home/gallery-11.jpg" },
              title: bi("Premium fleets, fully managed.", "أساطيل فاخرة بإدارة كاملة."),
              text: bi("Bikes for hotels, compounds, universities and delivery teams - with rental systems, branding and service plans included.", "دراجات للفنادق والمجمعات والجامعات وفرق التوصيل - مع أنظمة تأجير وعلامة تجارية وخطط صيانة."),
              points: bi("Branded bikes & stations\nRental & tracking system\nScheduled fleet servicing\nFlexible lease or purchase", "دراجات ومحطات بعلامتك\nنظام تأجير وتتبع\nصيانة دورية للأسطول\nتأجير أو شراء مرن") },
            { tab: bi("Events & Activations", "الفعاليات والتفعيلات"), image: { url: "/site/home/entry-riders.jpg" },
              title: bi("Rides your guests remember.", "رحلات لا ينساها ضيوفك."),
              text: bi("Corporate rides, branded activations, F1-season experiences and race support - planned and delivered end to end.", "رحلات شركات وتفعيلات علامات وتجارب موسم الفورمولا 1 ودعم سباقات - تخطيط وتنفيذ كامل."),
              points: bi("Corporate & wellness rides\nBrand activations\nRace and event support\nGuides, mechanics & logistics", "رحلات شركات وصحة\nتفعيلات علامات تجارية\nدعم السباقات والفعاليات\nمرشدون وميكانيكيون ولوجستيات") },
            { tab: bi("Maintenance", "الصيانة"), image: { url: "/site/workshop/mechanic.jpg" },
              title: bi("Your fleet, always ready.", "أسطولك جاهز دائماً."),
              text: bi("Workshop servicing, on-site mobile support and long-term care contracts that keep every bike on the road.", "صيانة في الورشة ودعم متنقل في موقعك وعقود رعاية طويلة المدى تُبقي كل دراجة على الطريق."),
              points: bi("Workshop & mobile technicians\nSLA-based care contracts\nParts stock management\nMonthly fleet reports", "ورشة وفنيون متنقلون\nعقود صيانة باتفاقيات مستوى خدمة\nإدارة مخزون القطع\nتقارير شهرية للأسطول") },
          ],
        },
      ],
    },
    {
      id: "highlights",
      label: bi("Highlights", "أبرز النقاط"),
      fields: [
        {
          id: "items", type: "list", maxItems: 4, label: bi("Highlights", "أبرز النقاط"),
          item: [txt("value", 24, "Big word", "الكلمة الكبيرة", "", ""), txt("label", 60, "Line under it", "السطر تحتها", "", "")],
          def: [
            { value: bi("Fleets", "أساطيل"), label: bi("Supplied, managed & maintained", "توريد وإدارة وصيانة") },
            { value: bi("Events", "فعاليات"), label: bi("Rides & brand activations", "رحلات وتفعيلات للعلامات") },
            { value: bi("Contracts", "عقود"), label: bi("SLA-backed maintenance", "صيانة باتفاقيات مستوى خدمة") },
          ],
        },
      ],
    },
    {
      id: "logos",
      label: bi("Clients and partners", "العملاء والشركاء"),
      hint: bi("A logo, or only the name when there is no logo.", "شعار، أو الاسم فقط عند عدم وجود شعار."),
      fields: [
        txt("clientsTitle", 40, "Clients: heading", "العملاء: العنوان", "Clients we've helped", "عملاء ساعدناهم"),
        {
          id: "clients", type: "list", maxItems: 16, label: bi("Clients", "العملاء"),
          item: [txt("name", 40, "Name", "الاسم", "", ""), { id: "logo", type: "image", label: bi("Logo", "الشعار"), def: "" }],
          def: [logo("Land Rover", "/site/business/land-rover.png"), logo("Škoda", "/site/business/skoda.png"), logo("King Abdulaziz University", "/site/business/kau.png"),
            logo("Hijrah Ride", "/site/business/hijrah-ride.png"), logo("Sela", "/site/business/sela.png"), logo("Tamer Group", "/site/business/tamer.png"), logo("Twina", "/site/business/twina.jpg")],
        },
        txt("partnersTitle", 40, "Partners: heading", "الشركاء: العنوان", "Our partners", "شركاؤنا"),
        {
          id: "partners", type: "list", maxItems: 16, label: bi("Partners", "الشركاء"),
          item: [txt("name", 40, "Name", "الاسم", "", ""), { id: "logo", type: "image", label: bi("Logo", "الشعار"), def: "" }],
          def: [logo("Battle"), logo("Alvas"), logo("EasyDo", "/site/business/easydo.png"), logo("Garmin", "/site/business/garmin.svg"),
            logo("Donen", "/site/business/donen.png"), logo("PMT"), logo("DCC")],
        },
      ],
    },
    {
      id: "form",
      label: bi("Enquiry form", "نموذج الطلب"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Start a conversation", "ابدأ معنا"),
        txt("title", 60, "Title", "العنوان", "Tell us about your project.", "أخبرنا عن مشروعك."),
        long("text", 160, "Text", "النص", "Our business team replies within one working day.", "يرد عليك فريق الشركات خلال يوم عمل واحد."),
        txt("button", 30, "Button", "الزر", "Send Inquiry", "أرسل الطلب"),
        txt("doneTitle", 60, "After sending: title", "بعد الإرسال: العنوان", "Inquiry received", "تم استلام طلبك"),
        long("doneText", 160, "After sending: text", "بعد الإرسال: النص", "We'll be in touch within one working day.", "سنتواصل معك خلال يوم عمل واحد."),
      ],
    },
  ],
};
