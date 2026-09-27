import { bi, type PageSchema } from "@/content/types";

// Bikes (micromobility.sa/bikes): the words around the bike catalogue. The catalogue itself -
// categories, models, specifications, photos - is edited in the staff page's Website > Bikes
// catalog and read by lib/catalog.ts; this page holds only the top and bottom of the page.
// Declared `as const`, with the field ids kept as they are written, so the pages read `c.hero.title`
// as a string the compiler checks (content/types.ts ResolvedPage).
const txt = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const bikesSchema = {
  page: "bikes",
  label: bi("Bikes", "الدراجات"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Bikes", "الدراجات"),
        txt("title", 60, "Title", "العنوان", "The bikes we ride.", "الدراجات التي نركبها."),
        long("text", 240, "Text", "النص", "Every bike here is one you can rent at our evening sessions on the Jeddah Corniche Circuit.", "كل دراجة هنا يمكنك استئجارها في جلساتنا المسائية على حلبة كورنيش جدة."),
      ],
    },
    {
      id: "cta",
      label: bi("Bottom of the page", "أسفل الصفحة"),
      fields: [
        txt("title", 60, "Title", "العنوان", "Want to ride one?", "تريد أن تجرب واحدة؟"),
        long("text", 200, "Text", "النص", "Rent any of them at our evening sessions - pick a date and your bike type.", "استأجر أي واحدة منها في جلساتنا المسائية - اختر التاريخ ونوع دراجتك."),
        txt("button", 30, "Button", "الزر", "See the rides", "شاهد الجولات"),
        { id: "href", type: "link", label: bi("Button link", "رابط الزر"), def: "/experiences" },
      ],
    },
  ],
} as const satisfies PageSchema;
