import { bi, type PageSchema } from "@/content/types";

// The Ambassador Program (Ambassadors.dc.html). The rules section holds the numbers the
// database applies (migration 20260924180000 reads ambassadors.rules.* and
// ambassadors.redeem.items), so what the page says and what the code earns are one value.
// Texts may use {discount}, {rentalPts}, {eventPts}, {workshopPts}, {captainAt}, {eliteAt}.
// Left out of the design until they are real: store orders (the shop is still Salla, so its
// orders cannot count yet) and the share-card / QR poster downloads (the design's QR was not a
// real code).
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const num = (id: string, en: string, ar: string, def: number, min: number, max: number, hint?: [string, string]) =>
  ({ id, type: "number" as const, min, max, step: 1, label: bi(en, ar), def, ...(hint ? { hint: bi(...hint) } : {}) });
const PLACEHOLDERS: [string, string] = ["You can write {discount}, {rentalPts}, {eventPts}, {workshopPts}, {captainAt} or {eliteAt} - the page fills in the number.", "يمكنك كتابة {discount} أو {rentalPts} أو {eventPts} أو {workshopPts} أو {captainAt} أو {eliteAt} وتظهر القيمة مكانها."];

export const ambassadorsSchema: PageSchema = {
  page: "ambassadors",
  label: bi("Ambassadors", "السفراء"),
  sections: [
    {
      id: "rules",
      label: bi("Rules (the numbers the codes follow)", "القواعد (الأرقام التي تتبعها الأكواد)"),
      hint: bi("Changing the discount reprices every ambassador code at once. Points count from bookings and workshop requests made with a code.", "تغيير الخصم يطبّق على كل أكواد السفراء فوراً. تُحتسب النقاط من الحجوزات وطلبات الورشة التي استخدمت الكود."),
      fields: [
        num("discount", "Friend's discount (%)", "خصم الصديق (٪)", 10, 0, 50),
        num("rentalPts", "Points per ride booked", "نقاط كل حجز رحلة", 100, 0, 100000),
        num("eventPts", "Points per community event", "نقاط كل فعالية مجتمع", 50, 0, 100000),
        num("workshopPts", "Points per workshop service", "نقاط كل خدمة ورشة", 100, 0, 100000),
        num("captainAt", "Points for Captain", "نقاط مستوى قائد", 2000, 1, 10000000),
        num("eliteAt", "Points for Elite", "نقاط مستوى نخبة", 10000, 1, 10000000),
      ],
    },
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      hint: bi(...PLACEHOLDERS),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Ambassador Program", "برنامج السفراء"),
        txt("title", 70, "Title", "العنوان", "Your code. Your crew. Your points.", "كودك. مجتمعك. نقاطك."),
        long("text", 320, "Text", "النص",
          "Share your personal code - every time someone uses it for a ride, a bike service or an event, they get {discount}% off and you earn ambassador points to redeem for gear, perks and experiences.",
          "شارك كودك الخاص، وفي كل مرة يستخدمه أحد لحجز رحلة أو صيانة أو فعالية يحصل على خصم {discount}٪ وتكسب أنت نقاط سفير تستبدلها بقطع ومزايا وتجارب."),
        txt("applyBtn", 30, "Button: apply", "الزر: التقديم", "Apply now", "قدّم الآن"),
        txt("howBtn", 30, "Button: how it works", "الزر: كيف يعمل", "How it works", "كيف يعمل؟"),
        {
          id: "stats", type: "list", maxItems: 3, label: bi("Figures", "الأرقام"),
          item: [txt("value", 16, "Figure", "الرقم", "", ""), txt("label", 50, "Line under it", "السطر تحته", "", "")],
          def: [
            { value: bi("{discount}%", "{discount}٪"), label: bi("off for your friend, always", "خصم لصديقك، دائماً") },
            { value: bi("Rides + more", "رحلات والمزيد"), label: bi("rides · workshop · events", "رحلات · ورشة · فعاليات") },
            { value: bi("3 tiers", "٣ مستويات"), label: bi("perks that grow", "مزايا تتصاعد") },
          ],
        },
        txt("demoTitle", 30, "Example card: label", "بطاقة المثال: العنوان", "Live example", "مثال حي"),
        txt("demoCode", 20, "Example card: code", "بطاقة المثال: الكود", "SARA10", "SARA10"),
        long("demoNote", 140, "Example card: note", "بطاقة المثال: ملاحظة", "One code for rides, workshop services and community events.", "كود واحد للرحلات وخدمات الورشة وفعاليات المجتمع."),
      ],
    },
    {
      id: "how",
      label: bi("How it works", "كيف يعمل"),
      hint: bi(...PLACEHOLDERS),
      fields: [
        txt("title", 60, "Title", "العنوان", "How the program works", "كيف يعمل البرنامج"),
        {
          id: "steps", type: "list", maxItems: 4, label: bi("Steps", "الخطوات"),
          item: [txt("title", 40, "Step", "الخطوة", "", ""), long("text", 220, "Text", "النص", "", "")],
          def: [
            { title: bi("Apply", "قدّم"), text: bi("Tell us about your community and your riding. The team reviews it and activates your personal code.", "أخبرنا عن مجتمعك وركوبك. يراجع الفريق الطلب ويفعّل كودك الخاص.") },
            { title: bi("Share your code", "شارك كودك"), text: bi("One code for rides, workshop services and events. Your friend always gets {discount}% off.", "كود واحد للرحلات وخدمات الورشة والفعاليات. صديقك يحصل على {discount}٪ دائماً.") },
            { title: bi("Earn & redeem", "اكسب واستبدل"), text: bi("Points for every booking made with your code. Redeem them for gear, perks and experiences.", "نقاط عن كل حجز بكودك. استبدلها بقطع ومزايا وتجارب.") },
          ],
        },
        txt("earnTitle", 60, "Earning: title", "الكسب: العنوان", "How you earn", "كيف تكسب النقاط"),
        long("earnText", 220, "Earning: text", "الكسب: النص", "Points log automatically every time your code is used, and confirm when the ride or service is complete.", "تُحتسب نقاطك تلقائياً في كل مرة يُستخدم كودك، وتتأكد عند اكتمال الرحلة أو الخدمة."),
        txt("rentalLabel", 40, "Rides: label", "الرحلات: العنوان", "Ride bookings", "حجوزات الرحلات"),
        long("rentalNote", 140, "Rides: note", "الرحلات: ملاحظة", "For every ride booked with your code.", "عن كل رحلة تُحجز بكودك."),
        txt("workshopLabel", 40, "Workshop: label", "الورشة: العنوان", "Workshop services", "خدمات الورشة"),
        long("workshopNote", 140, "Workshop: note", "الورشة: ملاحظة", "For every service requested with your code.", "عن كل خدمة تُطلب بكودك."),
        txt("eventLabel", 40, "Events: label", "الفعاليات: العنوان", "Community events", "فعاليات المجتمع"),
        long("eventNote", 140, "Events: note", "الفعاليات: ملاحظة", "For every community event booked with your code.", "عن كل فعالية مجتمع تُحجز بكودك."),
      ],
    },
    {
      id: "tiers",
      label: bi("Tiers", "المستويات"),
      hint: bi("One perk per line. The points for each tier are in Rules.", "سطر لكل ميزة. نقاط كل مستوى في القواعد."),
      fields: [
        txt("title", 60, "Title", "العنوان", "Ambassador tiers", "مستويات السفراء"),
        txt("t1Name", 24, "Tier 1: name", "المستوى ١: الاسم", "Scout", "كشاف"),
        txt("t1Req", 40, "Tier 1: how to reach it", "المستوى ١: كيف تصل إليه", "On approval", "عند القبول"),
        long("t1Perks", 400, "Tier 1: perks", "المستوى ١: المزايا", "Your personal {discount}% code\nPoints on every booking made with it\nEarly event invites", "كودك الخاص بخصم {discount}٪\nنقاط على كل حجز بكودك\nدعوات مبكرة للفعاليات"),
        txt("t2Name", 24, "Tier 2: name", "المستوى ٢: الاسم", "Captain", "قائد"),
        long("t2Perks", 400, "Tier 2: perks", "المستوى ٢: المزايا", "Everything in Scout\nEarly access to drops\nFree annual tune-up\nExclusive ambassador kit", "كل مزايا مستوى كشاف\nوصول مبكر للإصدارات\nضبط سنوي مجاني\nأطقم سفراء حصرية"),
        txt("t3Name", 24, "Tier 3: name", "المستوى ٣: الاسم", "Elite", "نخبة"),
        long("t3Perks", 400, "Tier 3: perks", "المستوى ٣: المزايا", "Everything in Captain\nFree annual service + fitting\nA community ride led under your name\nSeed product to test & review", "كل مزايا مستوى قائد\nخدمة وقياس سنوي مجاني\nركبة تقودها باسمك من المتجر\nمنتجات للتجربة والمراجعة"),
      ],
    },
    {
      id: "redeem",
      label: bi("Rewards", "المكافآت"),
      hint: bi("What points buy. An ambassador asks from their card; the staff page hands it over.", "ما تشتريه النقاط. يطلبها السفير من بطاقته، ويسلّمها فريق المتجر."),
      fields: [
        txt("title", 50, "Title", "العنوان", "Redeem your points", "استبدل نقاطك"),
        {
          id: "items", type: "list", maxItems: 8, label: bi("Rewards", "المكافآت"),
          item: [txt("label", 60, "Reward", "المكافأة", "", ""), { id: "cost", type: "number", min: 1, max: 1000000, step: 1, label: bi("Points", "النقاط"), def: 500 }],
          def: [
            { label: bi("Basic workshop service", "خدمة ورشة أساسية"), cost: 500 },
            { label: bi("Store kit (cap + socks)", "طقم المتجر (كاب + جوارب)"), cost: 1000 },
            { label: bi("Full pro fitting", "قياس احترافي كامل"), cost: 1500 },
          ],
        },
      ],
    },
    {
      id: "board",
      label: bi("Leaderboard", "المتصدرون"),
      fields: [
        { id: "show", type: "toggle", label: bi("Show the leaderboard", "إظهار المتصدرين"), def: true },
        txt("title", 40, "Title", "العنوان", "Leaderboard", "المتصدرون"),
        long("text", 220, "Text ({season} is the quarter)", "النص ({season} هو الربع)", "Season {season} - the top ambassador wins the ambassador kit and a community ride named after them. Resets every quarter.", "موسم {season} - المتصدر يفوز بطقم السفراء وركبة مجتمع باسمه. يبدأ العد من جديد كل ربع."),
      ],
    },
    {
      id: "portal",
      label: bi("Ambassador card", "بطاقة السفير"),
      fields: [
        txt("title", 50, "Title", "العنوان", "Already an ambassador?", "سفير بالفعل؟"),
        long("text", 200, "Text", "النص", "Open your card with your code and the mobile number you applied with.", "افتح بطاقتك بكودك ورقم الجوال الذي قدّمت به."),
        long("share", 240, "WhatsApp message ({code} is the ambassador's code)", "رسالة واتساب ({code} هو كود السفير)",
          "Use my code {code} for {discount}% off your next ride or bike service at Micromobility: micromobility.sa",
          "استخدم كودي {code} واحصل على خصم {discount}٪ على رحلتك أو صيانة دراجتك القادمة في Micromobility: micromobility.sa"),
      ],
    },
    {
      id: "apply",
      label: bi("Application form", "نموذج التقديم"),
      fields: [
        txt("title", 60, "Title", "العنوان", "Apply to become an ambassador", "قدّم لتصبح سفيراً"),
        long("text", 240, "Text", "النص", "We look for real community leaders - ride captains, group starters, people others follow. Seats are limited.", "نبحث عن رياديين حقيقيين في مجتمع الدراجات - تقودون الركبات وتلهمون من حولكم. عدد المقاعد محدود."),
        txt("button", 30, "Button", "الزر", "Send my application", "أرسل طلبي"),
        long("note", 160, "Under the button", "تحت الزر", "The team reviews every application and sends your code on WhatsApp. Joining is free.", "يراجع الفريق كل طلب ويرسل كودك عبر واتساب. الانضمام مجاني."),
        txt("doneTitle", 60, "After sending: title", "بعد الإرسال: العنوان", "Application received", "تم استلام طلبك"),
        long("doneText", 200, "After sending: text", "بعد الإرسال: النص", "The team reviews it and messages you on WhatsApp with your code.", "يراجع الفريق طلبك ويرسل لك كودك عبر واتساب."),
      ],
    },
  ],
};
