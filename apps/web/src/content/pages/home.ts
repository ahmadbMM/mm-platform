import { bi, type PageSchema } from "@/content/types";

// The Home page (Home.dc.html in the Claude Design launch package), section by section. Every
// default is the design's own words. Three things the design filled with invented examples -
// customer reviews, the "500+ bikes delivered"-style stats and the Google rating - start EMPTY:
// their sections stay hidden until staff enter real ones.
const img = (id: string, en: string, ar: string, def: string) => ({ id, type: "image" as const, label: bi(en, ar), def });
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) =>
  ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) =>
  ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const link = (id: string, en: string, ar: string, def: string) => ({ id, type: "link" as const, label: bi(en, ar), def });

export const homeSchema: PageSchema = {
  page: "home",
  label: bi("Home", "الرئيسية"),
  sections: [
    {
      id: "entry",
      label: bi("Welcome: riders or business", "الترحيب: درّاجون أو شركات"),
      hint: bi("The split screen at the top of the page.", "الشاشة المقسومة أعلى الصفحة."),
      fields: [
        txt("riderEyebrow", 60, "Riders: small label", "الدرّاجون: العبارة الصغيرة", "Retail • Experiences • Community", "متجر • تجارب • مجتمع"),
        txt("riderTitle", 40, "Riders: title", "الدرّاجون: العنوان", "For Riders", "للدرّاجين"),
        long("riderText", 180, "Riders: text", "الدرّاجون: النص", "Premium bikes, rentals, servicing, events and the Micromobility community.", "دراجات فاخرة، تأجير، صيانة، فعاليات ومجتمع مايكروموبيليتي."),
        txt("riderBtn", 30, "Riders: button", "الدرّاجون: الزر", "I'm a Customer", "أنا عميل"),
        img("riderImage", "Riders: photo", "الدرّاجون: الصورة", "/site/home/entry-riders.jpg"),
        txt("bizEyebrow", 60, "Business: small label", "الشركات: العبارة الصغيرة", "Corporate • Events • Fleets", "شركات • فعاليات • أساطيل"),
        txt("bizTitle", 40, "Business: title", "الشركات: العنوان", "Business", "الشركات"),
        long("bizText", 180, "Business: text", "الشركات: النص", "Fleet rentals, wellness programmes, activations, service plans and premium cycling experiences.", "تأجير أساطيل، برامج صحية، فعاليات، خطط صيانة وتجارب دراجات فاخرة."),
        txt("bizBtn", 30, "Business: button", "الشركات: الزر", "I'm a Business", "أنا شركة"),
        link("bizHref", "Business: link", "الشركات: الرابط", "/business"),
        img("bizImage", "Business: photo", "الشركات: الصورة", "/site/home/entry-biz.jpg"),
        txt("phoneTitle", 60, "On phones: title", "على الجوال: العنوان", "How will you ride?", "كيف ستركب اليوم؟"),
        long("phoneText", 160, "On phones: text", "على الجوال: النص", "Jeddah's home of cycling - for riders and for business.", "وجهة جدة للدراجات - للدرّاجين وللشركات."),
      ],
    },
    {
      id: "hero",
      label: bi("Hero", "الواجهة الرئيسية"),
      fields: [
        txt("eyebrow", 60, "Small label", "العبارة الصغيرة", "The flagship - DA54 MAX", "الطراز الرائد - DA54 MAX"),
        txt("title", 70, "Title", "العنوان", "Carbon speed, built for Jeddah.", "سرعة الكربون، صُنعت لجدة."),
        long("text", 220, "Text", "النص", "ALVAS X1 carbon, Shimano 105 R7100 and HELUX carbon wheels - hand-built, fitted and test-ridden at our Jeddah workshop.", "كربون ALVAS X1 ومجموعة شيمانو 105 R7100 وعجلات HELUX كربون - تُبنى وتُقاس وتُختبر يدوياً في ورشتنا بجدة."),
        img("image", "Bike photo (transparent background works best)", "صورة الدراجة (الخلفية الشفافة أفضل)", "/site/home/hero-bike.webp"),
        {
          id: "badges", type: "list", maxItems: 4, label: bi("Promises under the bike", "الوعود تحت الدراجة"),
          item: [txt("title", 40, "Title", "العنوان", "", ""), txt("sub", 80, "Line", "السطر", "", "")],
          def: [
            { title: bi("Hand-built", "مبنية يدوياً"), sub: bi("Assembled & tuned in Jeddah", "تُجمع وتُضبط في جدة") },
            { title: bi("Exclusive distributor", "موزع حصري"), sub: bi("Battle · Alvas · Camp · Strauss · Garmin authorised", "Battle · Alvas · Camp · Strauss · بائع Garmin معتمد") },
            { title: bi("Always supported", "دعم دائم"), sub: bi("Workshop & on-road help", "ورشة ومساعدة على الطريق") },
          ],
        },
        {
          id: "brands", type: "list", maxItems: 10, label: bi("Brands in the moving strip", "العلامات في الشريط المتحرك"),
          item: [txt("name", 30, "Brand", "العلامة", "", "")],
          def: ["Battle", "Alvas", "Camp", "Strauss", "Garmin"].map((n) => ({ name: bi(n, n) })),
        },
      ],
    },
    {
      id: "feature",
      label: bi("Featured bike", "الدراجة المميزة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "New arrival", "وصل حديثاً"),
        txt("title", 40, "Title", "العنوان", "ALVAS TT BGP", "ALVAS TT BGP"),
        long("text", 260, "Text", "النص", "The time-trial superbike - TT carbon frame in a colour-shift BGP finish, full Dura-Ace Di2, Profile Design ATTK IC cockpit and disc + tri-spoke carbon wheels.", "دراجة السباق ضد الساعة - إطار TT كربون بطلاء متحوّل الألوان، مجموعة دورا آيس Di2 كاملة، مقود Profile Design ATTK IC وعجلات كربون قرصية وثلاثية الأذرع."),
        img("image", "Photo", "الصورة", "/site/home/feature.jpg"),
        {
          id: "chips", type: "list", maxItems: 6, label: bi("Spec chips", "شارات المواصفات"),
          item: [txt("label", 40, "Chip", "الشارة", "", "")],
          def: [["Dura-Ace Di2 2×12", "دورا آيس Di2 ‏2×12"], ["ATTK IC cockpit", "مقود ATTK IC"], ["Disc + 3-spoke carbon", "عجلات قرصية وثلاثية"], ["Michelin Power Cup 28C", "ميشلان Power Cup 28C"]].map(([e, a]) => ({ label: bi(e, a) })),
        },
        txt("cta", 40, "Main button", "الزر الرئيسي", "Meet the TT BGP", "تعرّف على TT BGP"),
        link("ctaHref", "Main button link", "رابط الزر الرئيسي", "/store"),
        txt("cta2", 40, "Second button", "الزر الثاني", "Shop bikes", "تسوّق الدراجات"),
        link("cta2Href", "Second button link", "رابط الزر الثاني", "/store"),
      ],
    },
    {
      id: "story",
      label: bi("How a bike comes to life", "كيف تولد الدراجة"),
      fields: [
        txt("eyebrow", 60, "Small label", "العبارة الصغيرة", "From frame to first ride", "من الإطار إلى أول جولة"),
        txt("title", 80, "Title (read by screen readers)", "العنوان (لقارئ الشاشة)", "How a Micromobility bike comes to life.", "كيف تولد دراجة مايكروموبيليتي."),
        {
          id: "steps", type: "list", maxItems: 4, label: bi("Steps", "الخطوات"),
          item: [txt("title", 50, "Step title", "عنوان الخطوة", "", ""), long("text", 200, "Step text", "نص الخطوة", "", ""), img("image", "Step photo", "صورة الخطوة", "/site/home/story-1.jpg")],
          def: [
            { title: bi("Pick the frame", "اختر الإطار"), text: bi("Carbon, alloy, trail or city — sized to your height and confirmed on the fitting jig.", "كربون أو ألمنيوم، طريق أو جبلية — بمقاسك ومؤكّد على جهاز القياس."), image: { url: "/site/home/story-1.jpg" } },
            { title: bi("Paint and parts", "الطلاء والقطع"), text: bi("Colour, groupset, wheels and cockpit — chosen in the designer, priced live.", "اللون والمجموعة والعجلات والمقود في المصمم بأسعار مباشرة."), image: { url: "/site/home/story-2.jpg" } },
            { title: bi("Hand-built in Jeddah", "تُبنى يدوياً في جدة"), text: bi("Torqued, aligned and wheel-trued on the stand. Every fastener checked twice.", "عزم ومحاذاة وضبط عجلات على الحامل. كل مسمار يُفحص مرتين."), image: { url: "/site/home/story-3.jpg" } },
            { title: bi("First ride, together", "أول جولة، معاً"), text: bi("Get fitted, collect your bike, and roll onto the corniche.", "اضبط قياسك، استلم دراجتك، وانطلق إلى الكورنيش."), image: { url: "/site/home/story-4.jpg" } },
          ],
        },
      ],
    },
    {
      id: "community",
      label: bi("Community", "المجتمع"),
      fields: [
        txt("title", 60, "Title", "العنوان", "You'll never ride alone.", "لن تركب وحدك أبداً."),
        long("text", 200, "Text", "النص", "Free weekly community rides for every level - sunrise corniche loops and desert gravel routes.", "رحلات مجتمعية أسبوعية مجانية لكل المستويات - جولات شروق على الكورنيش ومسارات حصى صحراوية."),
        txt("button", 40, "Button", "الزر", "View the Gallery", "شاهد المعرض"),
        link("buttonHref", "Button link", "رابط الزر", "/gallery"),
        {
          id: "photos", type: "list", maxItems: 18, label: bi("Photo wall", "جدار الصور"),
          item: [img("image", "Photo", "الصورة", "/site/home/gallery-1.jpg")],
          def: Array.from({ length: 12 }, (_, i) => ({ image: { url: `/site/home/gallery-${i + 1}.jpg` } })),
        },
        {
          id: "stats", type: "list", maxItems: 4, label: bi("Numbers strip", "شريط الأرقام"),
          hint: bi("Hidden until filled in. Use real numbers only.", "مخفي حتى تعبئته. استخدم أرقاماً حقيقية فقط."),
          item: [txt("value", 12, "Number (e.g. 500+)", "الرقم (مثل ‎500+)", "", ""), txt("label", 50, "What it counts", "ما يعدّه", "", "")],
          def: [],
        },
      ],
    },
    {
      id: "reviews",
      label: bi("What riders say", "ماذا يقول الدرّاجون"),
      hint: bi("Hidden until at least one real review is added.", "مخفي حتى تُضاف مراجعة حقيقية واحدة على الأقل."),
      fields: [
        txt("title", 60, "Title", "العنوان", "What riders say.", "ماذا يقول الدرّاجون."),
        {
          id: "items", type: "list", maxItems: 12, label: bi("Reviews", "المراجعات"),
          item: [txt("name", 40, "Rider's name", "اسم الدرّاج", "", ""), txt("role", 50, "Who they are (e.g. Road rider)", "من هو (مثل درّاج طريق)", "", ""), long("quote", 280, "What they said", "ما قاله", "", "")],
          def: [],
        },
      ],
    },
    {
      id: "quiz",
      label: bi("Which bike fits you? (quiz)", "أي دراجة تناسبك؟ (اختبار)"),
      fields: [
        txt("title", 70, "Title", "العنوان", "Which bike fits your lifestyle?", "أي دراجة تناسب أسلوب حياتك؟"),
        long("text", 200, "Text", "النص", "Two quick questions - we'll match you with the right bike, right here.", "أجب عن سؤالين سريعين وسنرشدك إلى الدراجة المناسبة."),
        txt("q1", 50, "Question 1", "السؤال ١", "1 - Where will you ride?", "١ - أين ستركب؟"),
        txt("q2", 50, "Question 2", "السؤال ٢", "2 - What matters most?", "٢ - ما الأهم بالنسبة لك؟"),
        txt("aRoad", 30, "Answer: road", "إجابة: طريق", "Fast road rides", "طريق وسرعة"),
        txt("aCity", 30, "Answer: city", "إجابة: مدينة", "City & corniche", "المدينة والكورنيش"),
        txt("aTrail", 30, "Answer: trail", "إجابة: مسارات", "Trails & desert", "مسارات وصحراء"),
        txt("pSpeed", 20, "Answer: speed", "إجابة: السرعة", "Speed", "السرعة"),
        txt("pComfort", 20, "Answer: comfort", "إجابة: الراحة", "Comfort", "الراحة"),
        txt("pValue", 20, "Answer: value", "إجابة: القيمة", "Value", "القيمة"),
        txt("match", 30, "Result label", "عنوان النتيجة", "Your match", "دراجتك المناسبة"),
        txt("cta", 40, "Result button", "زر النتيجة", "See it in the Store", "شاهدها في المتجر"),
        link("ctaHref", "Result button link", "رابط زر النتيجة", "/store"),
        txt("retake", 20, "Retake", "إعادة", "Retake", "أعد الاختبار"),
        txt("roadName", 40, "Road bike: name", "دراجة الطريق: الاسم", "ALVAS DA54 AL", "ألفاس DA54 AL"),
        img("roadImage", "Road bike: photo", "دراجة الطريق: الصورة", "/site/home/hero-bike.webp"),
        { id: "roadPrice", type: "number", min: 0, max: 200000, step: 1, label: bi("Road bike: price (SAR, 0 hides it)", "دراجة الطريق: السعر (ر.س، ٠ يخفيه)"), def: 4783 },
        long("roadSpeed", 200, "Road bike: why, for speed", "دراجة الطريق: لماذا، للسرعة", "Race geometry and a stiff alloy frame - our fastest seller on the corniche.", "هندسة سباق وإطار ألمنيوم صلب - الأسرع مبيعاً على الكورنيش."),
        long("roadComfort", 200, "Road bike: why, for comfort", "دراجة الطريق: لماذا، للراحة", "We'll set it up with an endurance fit in store - fast, but easy on your back.", "نضبطها لك بوضعية مريحة في المتجر - سريعة ولطيفة على ظهرك."),
        long("roadValue", 200, "Road bike: why, for value", "دراجة الطريق: لماذا، للقيمة", "The most bike per riyal in our road range.", "أفضل دراجة مقابل الريال في فئة الطريق."),
        txt("cityName", 40, "City bike: name", "دراجة المدينة: الاسم", "Alvas TOURIST", "ألفاس TOURIST"),
        img("cityImage", "City bike: photo", "دراجة المدينة: الصورة", "/site/home/quiz-city.jpg"),
        { id: "cityPrice", type: "number", min: 0, max: 200000, step: 1, label: bi("City bike: price (SAR, 0 hides it)", "دراجة المدينة: السعر (ر.س، ٠ يخفيه)"), def: 1300 },
        long("citySpeed", 200, "City bike: why, for speed", "دراجة المدينة: لماذا، للسرعة", "Light hybrid wheels keep it quick between traffic lights.", "عجلات هجينة خفيفة تبقيها سريعة بين الإشارات."),
        long("cityComfort", 200, "City bike: why, for comfort", "دراجة المدينة: لماذا، للراحة", "Upright fit, wide saddle and forgiving tires - built for daily corniche loops.", "جلسة مستقيمة ومقعد عريض وإطارات مريحة - مصممة لجولات الكورنيش اليومية."),
        long("cityValue", 200, "City bike: why, for value", "دراجة المدينة: لماذا، للقيمة", "One bike for commutes, errands and evening rides - nothing extra to buy.", "دراجة واحدة للتنقل والمشاوير وجولات المساء - دون إضافات."),
        txt("trailName", 40, "Trail bike: name", "دراجة المسارات: الاسم", "ALVAS STROM M50", "ألفاس STROM M50"),
        img("trailImage", "Trail bike: photo", "دراجة المسارات: الصورة", "/site/home/quiz-trail.jpg"),
        { id: "trailPrice", type: "number", min: 0, max: 200000, step: 1, label: bi("Trail bike: price (SAR, 0 hides it)", "دراجة المسارات: السعر (ر.س، ٠ يخفيه)"), def: 1900 },
        long("trailSpeed", 200, "Trail bike: why, for speed", "دراجة المسارات: لماذا، للسرعة", "Deore 1×11 and fast-rolling rubber for quick desert gravel.", "ديور 1×11 وإطارات سريعة لمسارات الجرافل الصحراوية."),
        long("trailComfort", 200, "Trail bike: why, for comfort", "دراجة المسارات: لماذا، للراحة", "Front suspension soaks up rough tracks so you ride longer.", "تعليق أمامي يمتص المسارات الوعرة لتركب أطول."),
        long("trailValue", 200, "Trail bike: why, for value", "دراجة المسارات: لماذا، للقيمة", "A proper trail-ready build at an entry price.", "تجهيزة مسارات حقيقية بسعر مبدئي."),
      ],
    },
    {
      id: "split",
      label: bi("Experiences and business", "التجارب والشركات"),
      fields: [
        txt("rentTitle", 50, "Experiences: title", "التجارب: العنوان", "Ride with us.", "اركب معنا."),
        long("rentText", 160, "Experiences: text", "التجارب: النص", "Book a bike on the Jeddah Corniche Circuit, or join a Micromobility experience.", "احجز دراجة في حلبة كورنيش جدة، أو انضم لإحدى تجارب مايكروموبيليتي."),
        txt("rentBtn", 30, "Experiences: button", "التجارب: الزر", "Book a ride", "احجز جولة"),
        link("rentHref", "Experiences: link", "التجارب: الرابط", "https://micromobilityrentals.pages.dev/"),
        img("rentImage", "Experiences: photo", "التجارب: الصورة", "/site/home/split-rides.jpg"),
        txt("bizTitle", 50, "Business: title", "الشركات: العنوان", "For business.", "للشركات."),
        long("bizText", 160, "Business: text", "الشركات: النص", "Fleets, events, activations and maintenance contracts built around your brand.", "أساطيل وفعاليات وتفعيلات وعقود صيانة مبنية حول علامتك."),
        txt("bizBtn", 30, "Business: button", "الشركات: الزر", "Explore B2B", "استكشف قسم الشركات"),
        link("bizHref", "Business: link", "الشركات: الرابط", "/business"),
        img("bizImage", "Business: photo", "الشركات: الصورة", "/site/home/split-biz.jpg"),
      ],
    },
    {
      id: "visit",
      label: bi("Find us", "موقعنا"),
      fields: [
        txt("title", 50, "Title", "العنوان", "Find us in Jeddah.", "موقعنا في جدة."),
        long("text", 160, "Text", "النص", "Book a test ride, service your bike or join a ride.", "احجز تجربة قيادة، اصلح دراجتك أو انضم لرحلة."),
        txt("directions", 30, "Directions button", "زر الاتجاهات", "Get directions", "احصل على الاتجاهات"),
        { id: "rating", type: "number", min: 0, max: 5, step: 0.1, label: bi("Google rating (0 hides it)", "تقييم قوقل (٠ يخفيه)"), hint: bi("Only your real current rating.", "تقييمك الحقيقي الحالي فقط."), def: 0 },
        txt("ratingLabel", 30, "Rating label", "عنوان التقييم", "on Google", "على قوقل"),
        link("reviewsHref", "Google reviews link", "رابط تقييمات قوقل", "https://maps.app.goo.gl/zoJuVDraMQzDBD6f9"),
      ],
    },
  ],
};
