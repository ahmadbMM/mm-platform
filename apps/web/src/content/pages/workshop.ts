import { bi, type PageSchema } from "@/content/types";

// The Workshop page (Workshop.dc.html). A booking is a REQUEST (owner, 2026-09-24): the customer
// picks a service, a preferred day and time and how the bike gets to us; the staff page confirms.
// Left out on purpose: the design's named mechanics, turnaround / rating / review numbers and the
// annual plan price - invented examples, not the business's.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const workshopSchema: PageSchema = {
  page: "workshop",
  label: bi("Workshop", "الورشة"),
  sections: [
    {
      id: "intro",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "The workshop", "ورشتنا"),
        txt("title", 60, "Title", "العنوان", "Book a bike service.", "احجز صيانة دراجتك."),
        long("text", 240, "Text", "النص", "Certified technicians at our workshop - request a service online and bring your bike in, or sit down for a custom-build consultation.", "فنيون معتمدون في ورشتنا - اطلب صيانة أونلاين وأحضر دراجتك، أو اطلب استشارة بناء مخصص."),
        { id: "features", type: "list", maxItems: 5, label: bi("Promises", "الوعود"), item: [txt("label", 80, "Promise", "الوعد", "", "")],
          def: [["Certified technicians, genuine parts", "فنيون معتمدون وقطع أصلية"], ["Request online in under a minute", "اطلب أونلاين خلال دقيقة"], ["Follow your bike with your reference number", "تابع دراجتك برقم الطلب"]].map(([e, a]) => ({ label: bi(e, a) })) },
        { id: "image", type: "image", label: bi("Workshop photo", "صورة الورشة"), def: "/site/workshop/mechanic.jpg" },
        txt("locTitle", 60, "Photo caption", "عنوان الصورة", "Our workshop - Jeddah", "ورشتنا - جدة"),
      ],
    },
    {
      id: "services",
      label: bi("Services and prices", "الخدمات والأسعار"),
      fields: [
        {
          id: "items", type: "list", maxItems: 8, label: bi("Services", "الخدمات"),
          hint: bi("Price 0 shows as Free. One line per included item.", "السعر ٠ يظهر «مجاناً». سطر لكل عنصر مشمول."),
          item: [
            txt("name", 50, "Name", "الاسم", "", ""),
            txt("sub", 80, "Short line", "سطر قصير", "", ""),
            { id: "price", type: "number", min: 0, max: 100000, step: 1, label: bi("Price (SAR)", "السعر (ر.س)"), def: 0 },
            { id: "mins", type: "number", min: 0, max: 1440, step: 5, label: bi("Takes about (minutes)", "المدة التقريبية (دقائق)"), def: 60 },
            long("includes", 400, "What's included (one per line)", "ما يشمل (سطر لكل عنصر)", "", ""),
          ],
          def: [
            { name: bi("Full service", "صيانة شاملة"), sub: bi("Complete check + tune + lube", "فحص كامل + ضبط + تشحيم"), price: 349, mins: 180,
              includes: bi("20-point inspection\nBrake & gear adjustment\nWheel truing\nChain & drivetrain lube\nTorque check\nFull wash", "فحص 20 نقطة\nضبط الفرامل والنواقل\nموازنة العجلات\nتشحيم السلسلة\nشدّ العزم\nغسيل كامل") },
            { name: bi("Basic tune-up", "ضبط أساسي"), sub: bi("Brakes, shifting & tyres", "فرامل ونواقل وإطارات"), price: 149, mins: 60,
              includes: bi("Brake adjustment\nGear indexing\nTyre pressure check\nQuick safety check", "ضبط الفرامل\nضبط النواقل\nفحص ضغط الإطارات\nشدّ سريع") },
            { name: bi("Wheel true", "ضبط عجلة"), sub: bi("Single-wheel balancing", "موازنة العجلة الواحدة"), price: 89, mins: 45,
              includes: bi("Lateral & radial truing\nSpoke tension\nHub check", "موازنة جانبية وشعاعية\nشدّ الأسلاك\nفحص المحور") },
            { name: bi("Custom build consult", "استشارة بناء مخصص"), sub: bi("With the build technician - 30 min", "مع فني البناء - 30 دقيقة"), price: 0, mins: 30,
              includes: bi("Session with the build technician\nComponent selection\nWritten quote", "جلسة مع فني البناء\nاختيار المكونات\nعرض سعر مكتوب") },
          ],
        },
        {
          id: "symptoms", type: "list", maxItems: 6, label: bi("\"Not sure?\" answers", "إجابات «غير متأكد؟»"),
          hint: bi("Each points to a service by its number in the list above (1 = first).", "كل إجابة تشير إلى خدمة برقمها في القائمة أعلاه (١ = الأولى)."),
          item: [txt("label", 40, "Problem", "المشكلة", "", ""), { id: "service", type: "number", min: 1, max: 8, step: 1, label: bi("Suggests service no.", "تقترح الخدمة رقم"), def: 1 }],
          def: [
            { label: bi("Brakes squeal", "الفرامل تصرّ"), service: 2 }, { label: bi("Gears skip", "النواقل تتخطى"), service: 2 },
            { label: bi("Wheel wobble", "العجلة غير متزنة"), service: 3 }, { label: bi("Full check-up", "فحص شامل"), service: 1 },
          ],
        },
        {
          id: "parts", type: "list", maxItems: 8, label: bi("Optional parts", "قطع اختيارية"),
          item: [txt("label", 50, "Part", "القطعة", "", ""), { id: "price", type: "number", min: 0, max: 10000, step: 1, label: bi("Price (SAR)", "السعر (ر.س)"), def: 0 }],
          def: [
            { label: bi("New brake pads", "أقمشة فرامل جديدة"), price: 60 }, { label: bi("New chain", "سلسلة جديدة"), price: 90 },
            { label: bi("Bar tape", "شريط مقود"), price: 45 }, { label: bi("Inner tube", "أنبوب داخلي"), price: 25 },
          ],
        },
      ],
    },
    {
      id: "booking",
      label: bi("Booking options", "خيارات الحجز"),
      fields: [
        txt("formTitle", 40, "Form title", "عنوان النموذج", "Request a service", "اطلب صيانة"),
        long("formSub", 160, "Form line", "سطر النموذج", "Pick a service and a day - the team confirms by phone.", "اختر الخدمة واليوم - يؤكد الفريق الحجز بالجوال."),
        { id: "wait", type: "toggle", label: bi("Offer \"while you wait\"", "إتاحة «انتظار سريع»"), def: true },
        { id: "pickup", type: "toggle", label: bi("Offer pickup & delivery", "إتاحة الاستلام والتوصيل"), def: false },
        { id: "pickupFee", type: "number", min: 0, max: 1000, step: 1, label: bi("Pickup fee (SAR)", "رسوم الاستلام (ر.س)"), def: 50 },
        { id: "days", type: "number", min: 3, max: 30, step: 1, label: bi("Days ahead customers can pick", "عدد الأيام المتاحة للاختيار"), def: 7 },
        { id: "times", type: "list", maxItems: 8, label: bi("Times customers can pick", "الأوقات المتاحة للاختيار"),
          hint: bi("24-hour time, e.g. 17:00.", "بنظام ٢٤ ساعة، مثل 17:00."),
          item: [{ ...txt("time", 5, "Time", "الوقت", "", ""), mono: true }],
          def: ["15:00", "17:00", "19:00", "21:00"].map((x) => ({ time: bi(x, x) })) },
        txt("doneTitle", 60, "After sending: title", "بعد الإرسال: العنوان", "Request received", "تم استلام طلبك"),
        long("doneText", 200, "After sending: text", "بعد الإرسال: النص", "The team will call to confirm. Bring your bike 10 minutes before your time.", "سيتواصل معك الفريق للتأكيد. أحضر دراجتك قبل موعدك بـ ١٠ دقائق."),
      ],
    },
  ],
};
