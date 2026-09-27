import { bi, type PageSchema } from "@/content/types";
import { BOOKING_URL, COMMUNITY, NAV_LINKS, STORE_CART_URL, STORE_URL } from "@/lib/links";

// Site-wide content: what the header, footer and several pages share - contact details, hours,
// social links, the announcement bar and the legal line. Keys "site.<section>.<field>".
// The footer is the design's own (SiteFooter.dc.html), every part of it staff-editable: its
// payment marks, trust line, link columns and social accounts start as the design has them
// (owner, 2026-09-25: "add everything as it is in the design"); staff remove what does not apply.
export const siteSchema = {
  page: "site",
  label: bi("Whole site", "الموقع كاملاً"),
  sections: [
    {
      id: "contact",
      label: bi("Contact and hours", "التواصل والمواعيد"),
      fields: [
        { id: "address", type: "text", max: 120, label: bi("Store address", "عنوان المتجر"), def: bi("Thu Al-Nurayn St, Al Sharafeyah, Jeddah 23218", "شارع ذي النورين، الشرفية، جدة 23218") },
        { id: "mapsHref", type: "link", label: bi("Store directions link", "رابط اتجاهات المتجر"), def: "https://maps.app.goo.gl/zoJuVDraMQzDBD6f9" },
        { id: "jccName", type: "text", max: 80, label: bi("Second branch name", "اسم الفرع الثاني"), def: bi("Micromobility JCC Pop-up", "متجر مايكروموبيليتي المؤقت في JCC") },
        { id: "jccAddress", type: "text", max: 120, label: bi("Second branch address", "عنوان الفرع الثاني"), def: bi("Jeddah Corniche Circuit", "حلبة كورنيش جدة") },
        { id: "jccHref", type: "link", label: bi("Second branch directions link", "رابط اتجاهات الفرع الثاني"), def: "https://maps.app.goo.gl/RgRGuy6gDT4F6Lve8" },
        { id: "email", type: "text", max: 80, mono: true, label: bi("Email", "البريد"), def: bi("info@micromobility.sa", "info@micromobility.sa") },
        { id: "phone", type: "text", max: 24, mono: true, label: bi("Phone (with +966)", "الجوال (مع ‎+966)"), def: bi("+966566668818", "+966566668818") },
        { id: "hoursText", type: "text", max: 80, label: bi("Opening hours, as shown", "ساعات العمل كما تظهر"), def: bi("Sat–Thu 2pm–10pm · Fri closed", "السبت–الخميس ٢م–١٠م · الجمعة مغلق") },
        { id: "openHour", type: "number", min: 0, max: 23, step: 1, label: bi("Opens at (hour, 0–23)", "يفتح الساعة (٠–٢٣)"), hint: bi("Used for the live open / closed sign.", "يُستخدم لإشارة مفتوح / مغلق الحية."), def: 14 },
        { id: "closeHour", type: "number", min: 1, max: 24, step: 1, label: bi("Closes at (hour, 1–24)", "يغلق الساعة (١–٢٤)"), def: 22 },
        { id: "fridayClosed", type: "toggle", label: bi("Closed on Fridays", "مغلق يوم الجمعة"), def: true },
      ],
    },
    {
      id: "announce",
      label: bi("Announcement bar", "شريط الإعلانات"),
      hint: bi("The messages rotate in the bar under the header.", "تتناوب الرسائل في الشريط تحت الترويسة."),
      fields: [
        {
          id: "messages", type: "list", maxItems: 6, label: bi("Messages", "الرسائل"),
          item: [
            { id: "text", type: "text", max: 120, label: bi("Message", "الرسالة"), def: bi("", "") },
            { id: "cta", type: "text", max: 40, label: bi("Link text", "نص الرابط"), def: bi("", "") },
            { id: "href", type: "link", label: bi("Link", "الرابط"), def: "" },
          ],
          def: [
            { text: bi("Exclusive KSA distributor of Battle · Alvas · Camp · Strauss - Garmin authorised seller", "الموزع الحصري في السعودية لـ Battle · Alvas · Camp · Strauss - بائع معتمد لـ Garmin"), cta: bi("Visit the store", "إلى المتجر"), href: { href: "/store" } },
            { text: bi("New: ALVAS TT BGP time-trial superbike - now in store", "جديد: دراجة ALVAS TT BGP لسباق ضد الساعة - الآن في المتجر"), cta: bi("Shop now", "تسوّق الآن"), href: { href: "/store" } },
          ],
        },
      ],
    },
    {
      id: "social",
      label: bi("Social links", "روابط التواصل الاجتماعي"),
      hint: bi("Leave a link empty to hide it.", "اترك الرابط فارغاً لإخفائه."),
      fields: [
        { id: "instagram", type: "link", optional: true, label: bi("Instagram", "إنستغرام"), def: "https://instagram.com/micromobilitysa" },
        { id: "whatsapp", type: "link", optional: true, label: bi("WhatsApp", "واتساب"), def: "https://wa.me/966566668818" },
        { id: "x", type: "link", optional: true, label: bi("X", "إكس"), def: "https://x.com/micromobilitysa" },
        { id: "tiktok", type: "link", optional: true, label: bi("TikTok", "تيك توك"), def: "https://tiktok.com/@micromobilitysa" },
        { id: "snapchat", type: "link", optional: true, label: bi("Snapchat", "سناب شات"), def: "https://snapchat.com/add/micromobilitysa" },
        { id: "youtube", type: "link", optional: true, label: bi("YouTube", "يوتيوب"), def: "https://youtube.com/@micromobilitysa" },
        { id: "facebook", type: "link", optional: true, label: bi("Facebook", "فيسبوك"), def: "https://facebook.com/micromobilitysa" },
        { id: "telegram", type: "link", optional: true, label: bi("Telegram", "تيليجرام"), def: "https://t.me/micromobilitysa" },
      ],
    },
    {
      // The addresses the whole site links to that are not its own pages (lib/links.ts has the same
      // as fallbacks). The shop opens at /store, which adds /en or /ar for the visitor's language.
      id: "links",
      label: bi("Other addresses", "العناوين الأخرى"),
      fields: [
        { id: "booking", type: "link", label: bi("Booking app", "تطبيق الحجز"), hint: bi("Where Book, the account icon and My Bookings go.", "وجهة أزرار الحجز وأيقونة الحساب وحجوزاتي."), def: BOOKING_URL },
        { id: "store", type: "link", label: bi("Online store", "المتجر الإلكتروني"), hint: bi("micromobility.sa/store opens it, in English or Arabic.", "يفتحه micromobility.sa/store بالإنجليزية أو العربية."), def: STORE_URL },
        { id: "cart", type: "link", label: bi("Store cart", "سلة المتجر"), hint: bi("The header's cart icon.", "أيقونة السلة في الترويسة."), def: STORE_CART_URL },
      ],
    },
    {
      // The header's words for each section. A page that is switched off is left out whatever its name.
      id: "menu",
      label: bi("Header menu", "قائمة الترويسة"),
      fields: [...NAV_LINKS, COMMUNITY].map((l) => ({ id: l.key, type: "text" as const, max: 24, label: bi(l.en, l.ar), def: bi(l.en, l.ar) })),
    },
    {
      id: "legal",
      label: bi("Legal line", "السطر القانوني"),
      fields: [
        { id: "company", type: "text", max: 120, label: bi("Name on the © line", "الاسم في سطر الحقوق"), def: bi("MicroMobility", "مايكروموبيليتي") },
        { id: "vat", type: "text", max: 40, mono: true, label: bi("VAT number", "الرقم الضريبي"), def: bi("312555068900003", "312555068900003") },
        { id: "cr", type: "text", max: 40, optional: true, mono: true, label: bi("Commercial registration", "السجل التجاري"), hint: bi("As on the registration certificate. Empty hides it.", "كما في شهادة التسجيل. الفارغ يخفيه."), def: bi("1009107240", "1009107240") },
        // From the company's registration, VAT and national-address certificates (owner, 2026-09-25).
        { id: "legalName", type: "text", max: 120, label: bi("Legal name", "الاسم النظامي"), def: bi("Micromobility Company Ltd.", "شركة التنقل الدقيق المحدودة") },
        { id: "unified", type: "text", max: 40, mono: true, label: bi("Unified number", "الرقم الموحد"), def: bi("7041881512", "7041881512") },
        { id: "address", type: "text", max: 160, label: bi("Registered address", "العنوان المسجل"), def: bi("7933 Ibn Anuq Al Fedha St, Al Mansurah, Riyadh 12692 (additional no. 2987)", "7933 شارع ابن عنق الفضة، حي المنصورة، الرياض 12692 (الرقم الإضافي 2987)") },
        { id: "shortAddress", type: "text", max: 20, mono: true, label: bi("National short address", "العنوان المختصر"), def: bi("RCMA7933", "RCMA7933") },
      ],
    },
    {
      id: "footer",
      label: bi("Footer", "التذييل"),
      hint: bi("A link to a page that is switched off is not shown.", "الرابط إلى صفحة متوقفة لا يظهر."),
      fields: [
        {
          id: "payments", type: "list", maxItems: 8, label: bi("Payment marks", "شعارات الدفع"),
          item: [{ id: "name", type: "text", max: 30, label: bi("Name", "الاسم"), def: bi("", "") }, { id: "logo", type: "image", label: bi("Logo", "الشعار"), def: "" }],
          def: [["Visa", "visa"], ["Mastercard", "mastercard"], ["mada", "mada"], ["tabby", "tabby"]].map(([n, f]) => ({ name: bi(n, n), logo: { url: `/site/payments/${f}.svg` } })),
        },
        { id: "showroom", type: "toggle", label: bi("Show \"Prepay at Showroom\"", "إظهار «الدفع المسبق في المعرض»"), def: true },
        {
          id: "trust", type: "list", maxItems: 6, label: bi("Trust line", "سطر الثقة"),
          item: [{ id: "text", type: "text", max: 40, label: bi("Text", "النص"), def: bi("", "") }],
          def: [["Maroof verified", "موثّق في معروف"], ["VAT reg. 15%", "رقم ضريبي 15%"], ["Secure SSL checkout", "دفع آمن SSL"], ["7-day returns", "إرجاع خلال 7 أيام"]].map(([e, a]) => ({ text: bi(e, a) })),
        },
        { id: "shopTitle", type: "text", max: 30, label: bi("Column 1: title", "العمود ١: العنوان"), def: bi("Shop", "تسوّق") },
        {
          id: "shop", type: "list", maxItems: 10, label: bi("Column 1: links", "العمود ١: الروابط"),
          item: [{ id: "label", type: "text", max: 40, label: bi("Text", "النص"), def: bi("", "") }, { id: "href", type: "link", label: bi("Link", "الرابط"), def: "" }],
          def: [
            [["Store", "المتجر"], "/store"], [["Find your size", "أوجد مقاسك"], "/#fit-quiz"],
            [["Experiences", "التجارب"], "/experiences"], [["Book a Service", "حجز صيانة"], "/workshop"],
            [["Track Your Order", "تتبع الطلب"], "/help#delivery"],
          ].map(([[e, a], h]) => ({ label: bi(e as string, a as string), href: { href: h as string } })),
        },
        { id: "exploreTitle", type: "text", max: 30, label: bi("Column 2: title", "العمود ٢: العنوان"), def: bi("Explore", "استكشف") },
        {
          id: "explore", type: "list", maxItems: 10, label: bi("Column 2: links", "العمود ٢: الروابط"),
          item: [{ id: "label", type: "text", max: 40, label: bi("Text", "النص"), def: bi("", "") }, { id: "href", type: "link", label: bi("Link", "الرابط"), def: "" }],
          def: [
            [["Gallery", "المعرض"], "/gallery"], [["Ambassadors Program", "برنامج السفراء"], "/ambassadors"], [["Micromobility Club", "نادي مايكروموبيليتي"], "/club"],
            [["For Business", "للشركات"], "/business"], [["Events", "الفعاليات"], "/events"], [["Routes", "المسارات"], "/routes"], [["Journal", "المدونة"], "/journal"],
          ].map(([[e, a], h]) => ({ label: bi(e as string, a as string), href: { href: h as string } })),
        },
        { id: "companyTitle", type: "text", max: 30, label: bi("Column 3: title", "العمود ٣: العنوان"), def: bi("Company", "الشركة") },
        {
          id: "company", type: "list", maxItems: 10, label: bi("Column 3: links", "العمود ٣: الروابط"),
          item: [{ id: "label", type: "text", max: 40, label: bi("Text", "النص"), def: bi("", "") }, { id: "href", type: "link", label: bi("Link", "الرابط"), def: "" }],
          def: [
            [["About Us", "من نحن"], "/about"], [["My Account", "حسابي"], "/account"], [["Help Center", "مركز المساعدة"], "/help"],
            [["Returns + Exchanges", "الإرجاع والاستبدال"], "/help#returns"], [["Shipping", "الشحن"], "/help#delivery"],
            [["Privacy Policy", "سياسة الخصوصية"], "/privacy"], [["Terms & Conditions", "الشروط والأحكام"], "/terms"],
          ].map(([[e, a], h]) => ({ label: bi(e as string, a as string), href: { href: h as string } })),
        },
      ],
    },
  ],
} as const satisfies PageSchema;
