import { bi, type PageSchema } from "@/content/types";

// The Journal (Journal.dc.html): articles staff write in the staff page. The design's articles
// were examples full of made-up specifics (a Friday ride, a café, models, rental credit), so the
// Journal starts with three short ones that say only what is true of the rides and the workshop.
// An article is plain text: a blank line starts a paragraph, "## " a heading, "- " a list item
// (lib/journal.ts). Its address is made from its English title.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

const post = (title: [string, string], tag: [string, string], cover: string, excerpt: [string, string], body: [string, string], cta: [string, string], ctaHref: string) =>
  ({ title: bi(...title), tag: bi(...tag), date: bi("2026-09-24", "2026-09-24"), cover: { url: cover }, excerpt: bi(...excerpt), body: bi(...body), cta: bi(...cta), ctaHref: { href: ctaHref }, show: true });

export const journalSchema: PageSchema = {
  page: "journal",
  label: bi("Journal", "المدونة"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Journal", "المدونة"),
        txt("title", 60, "Title", "العنوان", "Stories, guides and tips.", "قصص وأدلة ونصائح."),
        long("text", 240, "Text", "النص", "How to ride, look after your bike and make the most of Jeddah on two wheels.", "كيف تركب وتعتني بدراجتك وتستمتع بجدة على عجلتين."),
        txt("all", 20, "Filter: all", "الفلتر: الكل", "All", "الكل"),
        txt("readMore", 30, "Link: read", "الرابط: اقرأ", "Read the article", "اقرأ المقال"),
        txt("more", 40, "More articles heading", "عنوان المزيد", "More from the journal", "المزيد من المدونة"),
        txt("empty", 120, "When there is no article", "عند عدم وجود مقالات", "The first articles are on their way.", "المقالات الأولى في الطريق."),
      ],
    },
    {
      id: "posts",
      label: bi("Articles", "المقالات"),
      hint: bi("Write in plain text: a blank line starts a new paragraph, a line starting with ## is a heading, lines starting with - make a list. The date (YYYY-MM-DD) orders the articles, newest first.", "اكتب نصاً عادياً: السطر الفارغ يبدأ فقرة جديدة، والسطر الذي يبدأ بـ ## عنوان، والأسطر التي تبدأ بـ - قائمة. التاريخ (YYYY-MM-DD) يرتب المقالات، الأحدث أولاً."),
      fields: [
        {
          id: "items", type: "list", maxItems: 30, label: bi("Articles", "المقالات"),
          item: [
            txt("title", 90, "Title", "العنوان", "", ""),
            txt("tag", 24, "Tag", "الوسم", "", ""),
            { ...txt("date", 10, "Date (YYYY-MM-DD)", "التاريخ (YYYY-MM-DD)", "", ""), mono: true },
            { id: "cover", type: "image", label: bi("Cover photo", "صورة الغلاف"), def: "" },
            long("excerpt", 240, "Summary", "الملخص", "", ""),
            long("body", 8000, "Article", "المقال", "", ""),
            txt("cta", 40, "Button at the end (optional)", "زر في النهاية (اختياري)", "", ""),
            { id: "ctaHref", type: "link", label: bi("Button link", "رابط الزر"), def: "" },
            { id: "show", type: "toggle", label: bi("Published", "منشور"), def: true },
          ],
          def: [
            post(["How to book an evening session", "كيف تحجز جلسة مسائية"], ["Guides", "أدلة"], "/site/about/circuit.jpg",
              ["From picking a date to getting your bike at the circuit - the whole evening in a few steps.", "من اختيار الموعد إلى استلام دراجتك في الحلبة - الأمسية كاملة في خطوات قليلة."],
              [
                "Our evening sessions run on the Jeddah Corniche Circuit on Sundays and Tuesdays, 9-11pm. Booking takes a minute.\n\n## Before you go\n- Pick a date on the Experiences page and tap Book.\n- Sign in with your Micromobility account, or create one.\n- Add up to three riders, with each rider's height - the bike size is set from it.\n- Choose a bike type for each rider: Road, Hybrid, Mountain, Kids or Road Carbon.\n\n## On the night\nPayment is collected at the booth at the circuit - have your queue number ready. Bikes are handed out first come, first served, so come early to get the bike type you chose.\n\nA full night still takes bookings on its waitlist, and we move you up if a place opens.",
                "جلساتنا المسائية على حلبة كورنيش جدة يومي الأحد والثلاثاء من 9 إلى 11 مساءً. الحجز يأخذ دقيقة.\n\n## قبل أن تذهب\n- اختر موعداً من صفحة التجارب واضغط احجز.\n- سجّل الدخول بحساب مايكروموبيليتي، أو أنشئ حساباً.\n- أضف حتى ثلاثة ركاب مع طول كل راكب - يُحدَّد مقاس الدراجة منه.\n- اختر نوع الدراجة لكل راكب: طريق أو هجين أو جبلي أو أطفال أو طريق كربون.\n\n## في الأمسية\nالدفع يتم عند الكشك في الحلبة - جهّز رقم طابورك. تُوزَّع الدراجات على أساس الأول فالأول، فتعال مبكراً لتحصل على نوع الدراجة الذي اخترته.\n\nالأمسية الممتلئة تقبل الحجز في قائمة الانتظار، ونرفعك إذا توفر مكان.",
              ],
              ["See the dates", "شاهد المواعيد"], "/experiences#book"),
            post(["Chain care on the coast: a five-minute routine", "العناية بالسلسلة على الساحل: روتين خمس دقائق"], ["Maintenance", "صيانة"], "/site/workshop/mechanic.jpg",
              ["Sea air and dust wear a chain fast. A weekly wipe and a drop of lube go a long way.", "هواء البحر والغبار يستهلكان السلسلة بسرعة. مسح أسبوعي ونقطة زيت يصنعان الفرق."],
              [
                "Sea air and dust are hard on a chain. A few minutes a week keeps it quiet and makes it last.\n\n## Every week\n- Backpedal the chain through a dry cloth until the cloth comes away clean.\n- Put one drop of lube on each roller, on the inside of the chain.\n- Backpedal a few turns, then wipe off the excess - extra lube picks up more dust.\n\n## When to bring it in\nIf the chain squeaks or grinds after a clean, or the gears skip, the drivetrain needs a proper look. Request a service on the Workshop page and we'll confirm a day and time.",
                "هواء البحر والغبار قاسيان على السلسلة. دقائق قليلة كل أسبوع تبقيها هادئة وتطيل عمرها.\n\n## كل أسبوع\n- أدر الدواسات للخلف والسلسلة تمر في قماشة جافة حتى تخرج القماشة نظيفة.\n- ضع نقطة زيت واحدة على كل بكرة من الجهة الداخلية للسلسلة.\n- أدر الدواسات للخلف بضع لفات ثم امسح الزائد - الزيت الزائد يجمع مزيداً من الغبار.\n\n## متى تحضرها إلينا\nإذا بقيت السلسلة تصدر صريراً أو احتكاكاً بعد التنظيف، أو قفزت النواقل، فمجموعة الحركة تحتاج فحصاً حقيقياً. اطلب صيانة من صفحة الورشة ونؤكد لك اليوم والوقت.",
              ],
              ["Request a service", "اطلب صيانة"], "/workshop"),
            post(["Road, hybrid or mountain: which bike suits you?", "طريق أم هجينة أم جبلية: أي دراجة تناسبك؟"], ["Guides", "أدلة"], "/site/home/quiz-city.jpg",
              ["Where you ride matters more than what looks fastest. A quick guide to the three main types.", "المكان الذي تركب فيه أهم من الدراجة الأسرع شكلاً. دليل سريع لأنواع الدراجات الثلاثة."],
              [
                "The right bike is the one that suits where you actually ride.\n\n## Road\nLight and fast on smooth tarmac - made for longer rides along the coast and on the circuit.\n\n## Hybrid\nAn upright, comfortable position for city streets and relaxed rides. A good first bike for most riders.\n\n## Mountain\nWider tyres and suspension for gravel, sand and rough tracks.\n\n## Not sure yet?\nTry them first: Road, Hybrid and Mountain bikes are all in the rental fleet on our evening sessions at the Corniche Circuit. Or visit the store and we'll help you choose.",
                "الدراجة المناسبة هي التي تلائم المكان الذي تركب فيه فعلاً.\n\n## الطريق\nخفيفة وسريعة على الإسفلت الناعم - مصممة للمسافات الأطول على الساحل وفي الحلبة.\n\n## الهجينة\nوضعية جلوس معتدلة ومريحة لشوارع المدينة والجولات الهادئة. أول دراجة مناسبة لأغلب الراكبين.\n\n## الجبلية\nإطارات أعرض وتعليق للحصى والرمل والطرق الوعرة.\n\n## ما زلت محتاراً؟\nجرّبها أولاً: دراجات الطريق والهجينة والجبلية كلها ضمن أسطول التأجير في جلساتنا المسائية على حلبة الكورنيش. أو زر المتجر ونساعدك في الاختيار.",
              ],
              ["See the rides", "شاهد الجولات"], "/experiences"),
          ],
        },
      ],
    },
  ],
};
