import { bi, type PageSchema } from "@/content/types";

// The Gallery (Gallery.dc.html): photos staff upload, each with an optional caption and tag; the
// tags become the filters. It starts with the community photos from Home's photo wall.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const gallerySchema: PageSchema = {
  page: "gallery",
  label: bi("Gallery", "المعرض"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Gallery", "المعرض"),
        txt("title", 60, "Title", "العنوان", "Moments from the road.", "لحظات من الطريق."),
        txt("all", 20, "Filter: all photos", "الفلتر: كل الصور", "All", "الكل"),
      ],
    },
    {
      id: "photos",
      label: bi("Photos", "الصور"),
      hint: bi("Photos with the same tag share a filter; filters show once there are two tags.", "الصور ذات الوسم نفسه تشترك في فلتر، وتظهر الفلاتر عند وجود وسمين."),
      fields: [
        {
          id: "items", type: "list", maxItems: 60, label: bi("Photos", "الصور"),
          item: [
            { id: "image", type: "image", label: bi("Photo", "الصورة"), def: "" },
            txt("caption", 80, "Caption", "التعليق", "", ""),
            txt("tag", 24, "Tag", "الوسم", "", ""),
          ],
          def: Array.from({ length: 12 }, (_, i) => ({ image: { url: `/site/home/gallery-${i + 1}.jpg` } })),
        },
      ],
    },
  ],
};
