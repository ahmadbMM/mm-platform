import { bi, type PageSchema } from "@/content/types";
import { BOOKING_URL } from "@/lib/links";

// Events (Events.dc.html): the design's events, RSVPs, passes and "640 riders" were examples.
// Here the list is the booking system's own upcoming sessions (the same read as /experiences,
// named the way Experiences names them), each booked in the booking app, plus where we meet.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const eventsSchema: PageSchema = {
  page: "events",
  label: bi("Events", "الفعاليات"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      hint: bi("The sessions and their names come from the booking system and from Experiences > Next dates.", "الجلسات وأسماؤها من نظام الحجز ومن التجارب > المواعيد القادمة."),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Events", "الفعاليات"),
        txt("title", 60, "Title", "العنوان", "Ride with us.", "اركب معنا."),
        long("text", 240, "Text", "النص", "Every open ride and community session, soonest first. Book any of them in the booking app.", "كل الجولات والجلسات المجتمعية المتاحة، الأقرب أولاً. احجز أياً منها في تطبيق الحجز."),
        { id: "count", type: "number", min: 3, max: 30, step: 1, label: bi("How many sessions to show", "عدد الجلسات المعروضة"), def: 12 },
        { id: "bookHref", type: "link", label: bi("Booking link", "رابط الحجز"), def: BOOKING_URL },
        txt("rideTag", 30, "Tag: circuit ride", "الوسم: جولة الحلبة", "Circuit ride", "جولة الحلبة"),
        txt("communityTag", 30, "Tag: community event", "الوسم: فعالية مجتمعية", "Community event", "فعالية مجتمعية"),
      ],
    },
    {
      id: "host",
      label: bi("Private events", "الفعاليات الخاصة"),
      fields: [
        long("text", 240, "Text", "النص", "Want a private ride or event for your company or group? We plan and run it end to end.", "تريد جولة أو فعالية خاصة لشركتك أو مجموعتك؟ نخطط لها وننفذها بالكامل."),
        txt("button", 30, "Button", "الزر", "Business events", "فعاليات الشركات"),
        { id: "href", type: "link", label: bi("Button link", "رابط الزر"), def: "/business" },
      ],
    },
    {
      id: "places",
      label: bi("Where we meet", "أين نلتقي"),
      fields: [
        txt("title", 60, "Title", "العنوان", "Where we meet", "أين نلتقي"),
        {
          id: "items", type: "list", maxItems: 6, label: bi("Places", "الأماكن"),
          item: [txt("name", 50, "Name", "الاسم", "", ""), long("text", 160, "Text", "النص", "", ""), { id: "href", type: "link", label: bi("Map link", "رابط الخريطة"), def: "" }],
          def: [
            { name: bi("Jeddah Corniche Circuit", "حلبة كورنيش جدة"), text: bi("Our evening sessions and the JCC pop-up.", "جلساتنا المسائية ومتجر JCC المؤقت."), href: { href: "https://maps.app.goo.gl/RgRGuy6gDT4F6Lve8" } },
            { name: bi("The store", "المتجر"), text: bi("Thu Al-Nurayn St, Al Sharafeyah.", "شارع ذي النورين، الشرفية."), href: { href: "https://maps.app.goo.gl/zoJuVDraMQzDBD6f9" } },
          ],
        },
      ],
    },
  ],
};
