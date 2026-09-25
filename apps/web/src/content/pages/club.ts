import { bi, type PageSchema } from "@/content/types";
import { BOOKING_URL } from "@/lib/links";

// The Micromobility Club (Club.dc.html). The Club is the existing Community membership: joining
// is the community application (micromobility.sa/community/registration) that the staff page
// already approves, and a member's card reads their real rides (club_card, migration
// 20260924180000, which applies the numbers in the rules section). Left out of the design until
// they are real: the member count, the demo leaderboard and challenges, "refer a friend"
// credits and "2x credits on events" (nothing counts them yet).
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const num = (id: string, en: string, ar: string, def: number, min: number, max: number) => ({ id, type: "number" as const, min, max, step: 1, label: bi(en, ar), def });

export const COMMUNITY_FORM_URL = "https://micromobility.sa/community/registration";

export const clubSchema: PageSchema = {
  page: "club",
  label: bi("The Club", "النادي"),
  sections: [
    {
      id: "rules",
      label: bi("Rules (the numbers cards follow)", "القواعد (الأرقام التي تتبعها البطاقات)"),
      hint: bi("Credits count from a member's real rides: paid rides, completed community rides and ratings.", "يُحتسب الرصيد من رحلات العضو الفعلية: الرحلات المدفوعة ورحلات المجتمع المكتملة والتقييمات."),
      fields: [
        num("perTen", "Credits per SAR 10 of paid rides", "رصيد لكل ١٠ ر.س من الرحلات المدفوعة", 1, 0, 100),
        num("groupRidePts", "Credits per completed community ride", "رصيد لكل رحلة مجتمع مكتملة", 200, 0, 100000),
        num("reviewPts", "Credits per ride rated", "رصيد لكل رحلة مقيّمة", 50, 0, 100000),
        num("proAt", "Credits for Pro", "رصيد مستوى محترف", 150, 1, 10000000),
        num("legendAt", "Credits for Legend", "رصيد مستوى أسطورة", 500, 1, 10000000),
      ],
    },
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "The Micromobility Club", "نادي مايكروموبيليتي"),
        txt("title", 50, "Title", "العنوان", "Ride with us.", "اركب معنا."),
        long("text", 320, "Text", "النص",
          "Membership by application. Member rides from the store, priority in the workshop, early access to ALVAS drops, and ride credits on every ride. It's about belonging - not discounts.",
          "العضوية بطلب انضمام يراجعه الفريق. ركبات جماعية للأعضاء، أولوية في الورشة، وصول مبكر لإصدارات ألفاس، ورصيد ركوب على كل رحلة. المسألة انتماء، لا خصومات."),
        txt("applyBtn", 30, "Button: apply", "الزر: التقديم", "Apply to join", "قدّم طلب انضمام"),
        { id: "applyHref", type: "link", label: bi("Button: apply - link", "الزر: التقديم - الرابط"), hint: bi("The community application form.", "نموذج طلب الانضمام للمجتمع."), def: COMMUNITY_FORM_URL },
        txt("ridesBtn", 30, "Button: rides", "الزر: الركبات", "See the rides", "شاهد الركبات"),
        { id: "ridesHref", type: "link", label: bi("Button: rides - link", "الزر: الركبات - الرابط"), def: BOOKING_URL },
        {
          id: "stats", type: "list", maxItems: 3, label: bi("Figures", "الأرقام"),
          item: [txt("value", 16, "Figure", "الرقم", "", ""), txt("label", 40, "Line under it", "السطر تحته", "", "")],
          def: [
            { value: bi("Apply", "بطلب"), label: bi("to join", "الانضمام") },
            { value: bi("Every Sat", "كل سبت"), label: bi("member ride", "ركبة جماعية") },
            { value: bi("3 tiers", "٣ مستويات"), label: bi("growing perks", "مزايا متصاعدة") },
          ],
        },
        long("marquee", 400, "Moving strip (one per line)", "الشريط المتحرك (سطر لكل عبارة)", "BATTLE\nALVAS\nCAMP\nSTRAUSS\nEST. JEDDAH\nRIDE EVERY SATURDAY\nمجتمع الدراجات في جدة", "BATTLE\nALVAS\nCAMP\nSTRAUSS\nEST. JEDDAH\nRIDE EVERY SATURDAY\nمجتمع الدراجات في جدة"),
      ],
    },
    {
      id: "card",
      label: bi("Membership card", "بطاقة العضوية"),
      fields: [
        txt("title", 40, "Title", "العنوان", "Your card", "بطاقتك"),
        long("text", 200, "Text", "النص", "Open your membership card with the email and mobile number of your Micromobility account.", "افتح بطاقة عضويتك بالبريد الإلكتروني ورقم الجوال المسجلين في حسابك."),
        long("notMember", 200, "Not a member yet", "ليس عضواً بعد", "This account is not a Club member yet - apply to join and the team reviews it.", "هذا الحساب ليس عضواً في النادي بعد - قدّم طلب انضمام وسيراجعه الفريق."),
      ],
    },
    {
      id: "earn",
      label: bi("How members earn", "كيف يكسب الأعضاء"),
      fields: [
        txt("title", 50, "Title", "العنوان", "How you earn credits", "كيف تكسب الرصيد"),
        txt("paidLabel", 50, "Paid rides", "الرحلات المدفوعة", "Every paid ride", "كل رحلة مدفوعة"),
        txt("groupLabel", 50, "Community rides", "رحلات المجتمع", "Complete a community ride", "أكمل ركبة جماعية"),
        txt("reviewLabel", 50, "Ratings", "التقييمات", "Rate your ride", "قيّم رحلتك"),
        long("note", 200, "Note", "ملاحظة", "Credits are for experiences - event entry and exclusive kit, handed over in store - not just money off.", "الرصيد للتجارب: دخول فعاليات وأطقم حصرية تُسلَّم في المتجر، لا مجرد خصومات."),
      ],
    },
    {
      id: "tiers",
      label: bi("Tiers", "المستويات"),
      hint: bi("One perk per line. The credits for each tier are in Rules.", "سطر لكل ميزة. رصيد كل مستوى في القواعد."),
      fields: [
        txt("eyebrow", 30, "Small label", "العبارة الصغيرة", "Three tiers", "ثلاث مستويات"),
        txt("title", 60, "Title", "العنوان", "The more you ride, the more you get", "كلما ركبت أكثر، حصلت على أكثر"),
        txt("t1Name", 20, "Tier 1: name", "المستوى ١: الاسم", "Rider", "راكب"),
        txt("t1Req", 30, "Tier 1: how to reach it", "المستوى ١: كيف تصل إليه", "By application", "بطلب انضمام"),
        long("t1Perks", 400, "Tier 1: perks", "المستوى ١: المزايا", "Ride credits on every ride\nSaturday club rides\nClinics & riding tips\nA birthday reward", "رصيد ركوب على كل رحلة\nركبات النادي كل سبت\nورش ونصائح ركوب\nمكافأة في عيد ميلادك"),
        txt("t2Name", 20, "Tier 2: name", "المستوى ٢: الاسم", "Pro", "محترف"),
        long("t2Perks", 400, "Tier 2: perks", "المستوى ٢: المزايا", "Everything in Rider\nFree annual tune-up\nEarly access to ALVAS drops", "كل مزايا مستوى راكب\nضبط سنوي مجاني\nوصول مبكر لإصدارات ألفاس"),
        txt("t3Name", 20, "Tier 3: name", "المستوى ٣: الاسم", "Legend", "أسطورة"),
        long("t3Perks", 400, "Tier 3: perks", "المستوى ٣: المزايا", "Everything in Pro\nPriority workshop lane\nAnnual pro fitting\nGuest passes for group rides\nYour name on the store wall", "كل مزايا مستوى محترف\nمسار أولوية في الورشة\nقياس احترافي سنوي\nتصريح ضيف للركبات\nاسمك على جدار المتجر"),
      ],
    },
    {
      id: "perks",
      label: bi("Member perks", "مزايا الأعضاء"),
      fields: [
        txt("title", 40, "Title", "العنوان", "Member perks", "مزايا الأعضاء"),
        long("text", 200, "Text", "النص", "Benefits that make you part of the community - not just a coupon.", "مزايا تجعلك جزءاً من المجتمع - لا مجرد كوبونات خصم."),
        {
          id: "items", type: "list", maxItems: 8, label: bi("Perks", "المزايا"),
          item: [txt("title", 40, "Perk", "الميزة", "", ""), long("text", 200, "Text", "النص", "", "")],
          def: [
            { title: bi("Member rides", "ركبات الأعضاء"), text: bi("A group ride every Saturday - all levels.", "ركبة جماعية كل سبت - كل المستويات.") },
            { title: bi("Priority workshop", "أولوية الورشة"), text: bi("Book your service ahead of the queue; Legends get a priority lane.", "احجز صيانتك قبل الجميع، ومسار أولوية لأعضاء مستوى أسطورة.") },
            { title: bi("Pro fitting", "قياس احترافي"), text: bi("A free annual fitting for Legends - dial the bike to your body.", "قياس سنوي مجاني لأعضاء مستوى أسطورة - اضبط دراجتك على جسمك.") },
            { title: bi("Early access", "وصول مبكر"), text: bi("Get the newest ALVAS drops and accessories before they hit the store.", "اقتنِ أحدث إصدارات ألفاس والإكسسوارات قبل نزولها للمتجر.") },
            { title: bi("Skills clinics", "ورش المهارات"), text: bi("Members-only sessions: maintenance, riding skills and reading your data.", "جلسات حصرية للأعضاء: صيانة ومهارات ركوب وقراءة البيانات.") },
          ],
        },
      ],
    },
    {
      id: "rides",
      label: bi("Upcoming club rides", "ركبات النادي القادمة"),
      hint: bi("The rides listed are the open community rides in the booking system.", "الركبات المعروضة هي رحلات المجتمع المفتوحة في نظام الحجز."),
      fields: [
        txt("eyebrow", 30, "Small label", "العبارة الصغيرة", "Members only", "حصري للأعضاء"),
        txt("title", 50, "Title", "العنوان", "Upcoming club rides", "ركبات النادي القادمة"),
        txt("allLabel", 30, "Link text", "نص الرابط", "Book a ride", "احجز رحلة"),
        { id: "allHref", type: "link", label: bi("Link", "الرابط"), def: BOOKING_URL },
        long("empty", 160, "When none are open", "عند عدم وجود ركبات", "The next rides open soon - follow us for the dates.", "تُفتح الركبات القادمة قريباً - تابعنا لمعرفة المواعيد."),
      ],
    },
    {
      id: "faq",
      label: bi("Questions", "الأسئلة"),
      fields: [
        txt("title", 40, "Title", "العنوان", "Common questions", "أسئلة شائعة"),
        {
          id: "items", type: "list", maxItems: 8, label: bi("Questions", "الأسئلة"),
          item: [txt("q", 120, "Question", "السؤال", "", ""), long("a", 600, "Answer", "الإجابة", "", "")],
          def: [
            { q: bi("How do I join?", "كيف أنضم؟"), a: bi("Send the application form and the team reviews it. Once approved you're a Rider, and you move up automatically as you earn ride credits.", "أرسل نموذج الطلب ويراجعه الفريق. بعد الموافقة تصبح عضواً في مستوى راكب، وترتقي تلقائياً كلما جمعت رصيد ركوب.") },
            { q: bi("How do tiers work?", "كيف أرتقي في المستويات؟"), a: bi("Automatically, by ride credits: {proAt} to reach Pro, {legendAt} for Legend. You earn them from paid rides, completed community rides and rating your rides.", "تلقائياً حسب رصيد الركوب: {proAt} للوصول إلى مستوى محترف، و{legendAt} إلى مستوى أسطورة. تكسبه من الرحلات المدفوعة ورحلات المجتمع المكتملة وتقييم رحلاتك.") },
            { q: bi("What can I do with credits?", "ماذا أفعل بالرصيد؟"), a: bi("Use them for experiences - event entry and exclusive kit, handed over in store. The idea is to reward riding, not to wait for discounts.", "استخدمه في تجارب: دخول فعاليات وأطقم حصرية تُسلَّم في المتجر. الفكرة أن نكافئ الركوب، لا أن ننتظر الخصومات.") },
            { q: bi("Where do the club rides start?", "من أين تنطلق ركبات النادي؟"), a: bi("Each ride's meeting point is on its booking. See the dates and reserve your place in the booking app.", "نقطة التجمع لكل ركبة موجودة في حجزها. شاهد المواعيد واحجز مكانك في تطبيق الحجز.") },
          ],
        },
      ],
    },
  ],
};
