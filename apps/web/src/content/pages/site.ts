import { bi, type PageSchema } from "@/content/types";

// Site-wide content: what the header, footer and several pages share - contact details, hours,
// social links, the announcement bar and the legal line. Keys "site.<section>.<field>".
// Claims nobody has confirmed yet (payment methods, "Maroof verified", unused social accounts)
// start empty or off, and nothing is shown for them until staff fill them in.
export const siteSchema: PageSchema = {
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
        { id: "email", type: "text", max: 80, label: bi("Email", "البريد"), def: bi("info@micromobility.sa", "info@micromobility.sa") },
        { id: "phone", type: "text", max: 24, label: bi("Phone (with +966)", "الجوال (مع ‎+966)"), def: bi("+966566668818", "+966566668818") },
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
        { id: "instagram", type: "link", label: bi("Instagram", "إنستغرام"), def: "https://instagram.com/micromobilitysa" },
        { id: "whatsapp", type: "link", label: bi("WhatsApp", "واتساب"), def: "https://wa.me/966566668818" },
        { id: "x", type: "link", label: bi("X", "إكس"), def: "" },
        { id: "tiktok", type: "link", label: bi("TikTok", "تيك توك"), def: "" },
        { id: "snapchat", type: "link", label: bi("Snapchat", "سناب شات"), def: "" },
        { id: "youtube", type: "link", label: bi("YouTube", "يوتيوب"), def: "" },
      ],
    },
    {
      id: "legal",
      label: bi("Legal line", "السطر القانوني"),
      fields: [
        { id: "company", type: "text", max: 120, label: bi("Name on the © line", "الاسم في سطر الحقوق"), def: bi("MicroMobility", "مايكروموبيليتي") },
        { id: "vat", type: "text", max: 40, label: bi("VAT number", "الرقم الضريبي"), def: bi("312555068900003", "312555068900003") },
        { id: "cr", type: "text", max: 40, label: bi("Commercial registration", "السجل التجاري"), hint: bi("Shown only once filled in.", "يظهر فقط بعد تعبئته."), def: bi("", "") },
      ],
    },
  ],
};
