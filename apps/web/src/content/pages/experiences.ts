import { bi, type PageSchema } from "@/content/types";
import { BOOKING_URL } from "@/lib/links";

// The Experiences page (Rentals.dc.html). The design books inside the page; here the rides are
// booked in the real booking app (owner, 2026-09-24), so the page shows what can be booked - the
// kinds of ride, the bike prices and the next dates, both read live from the booking system - and
// every Book button opens the booking app. Every rule stated in the defaults is the booking
// app's own: three riders per account on a circuit evening, one seat per member on a community
// ride, each rider's height setting the bike size, payment at the circuit booth, bikes handed out
// first come first served. The design's add-on prices and its "up to 10 bikes" were examples.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const experiencesSchema: PageSchema = {
  page: "experiences",
  label: bi("Experiences", "التجارب"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Jeddah Corniche Circuit", "حلبة كورنيش جدة"),
        txt("title", 60, "Title", "العنوان", "Book your ride.", "احجز جولتك."),
        long("text", 240, "Text", "النص", "Evening sessions on the Corniche Circuit, open to everyone, and community rides for Club members. Pick a date, book in a minute and pay at the circuit booth.", "جلسات مسائية على حلبة الكورنيش مفتوحة للجميع، وجولات مجتمعية لأعضاء النادي. اختر موعدك واحجز خلال دقيقة وادفع عند الكشك في الحلبة."),
        { id: "image", type: "image", label: bi("Photo", "الصورة"), def: "/site/experiences/hero.jpg" },
        txt("bookBtn", 30, "Button: book", "الزر: الحجز", "Book a ride", "احجز جولة"),
        { id: "bookHref", type: "link", label: bi("Booking link", "رابط الحجز"), hint: bi("Where every Book button on this page goes.", "وجهة كل أزرار الحجز في هذه الصفحة."), def: BOOKING_URL },
        txt("datesBtn", 30, "Button: dates", "الزر: المواعيد", "See the dates", "شاهد المواعيد"),
      ],
    },
    {
      id: "rides",
      label: bi("Kinds of ride", "أنواع الجولات"),
      hint: bi("In a price line, {from} is the lowest bike price, read from the booking system.", "في سطر السعر، {from} هو أقل سعر دراجة من نظام الحجز."),
      fields: [
        txt("title", 60, "Title", "العنوان", "Pick your ride", "اختر جولتك"),
        {
          id: "items", type: "list", maxItems: 6, label: bi("Rides", "الجولات"),
          item: [
            txt("kind", 30, "Small label", "العبارة الصغيرة", "", ""),
            txt("name", 50, "Name", "الاسم", "", ""),
            txt("when", 50, "When", "الموعد", "", ""),
            txt("price", 60, "Price line", "سطر السعر", "", ""),
            long("note", 240, "Note", "ملاحظة", "", ""),
          ],
          def: [
            {
              kind: bi("Circuit ride", "جولة الحلبة"), name: bi("Evening Circuit Session", "جلسة الحلبة المسائية"), when: bi("Sun & Tue · 9-11pm", "الأحد والثلاثاء · 9-11 مساءً"),
              price: bi("From SAR {from} · open to all", "من {from} ر.س · مفتوحة للجميع"),
              note: bi("Up to 3 riders per account each evening. Bikes are handed out first come, first served - come early to get the bike type you chose.", "حتى 3 ركاب لكل حساب في كل أمسية. تُوزَّع الدراجات على أساس الأول فالأول - تعال مبكراً لتحصل على نوع الدراجة الذي اخترته."),
            },
            {
              kind: bi("Community event", "فعالية مجتمعية"), name: bi("Saturday Social Ride", "جولة السبت الاجتماعية"), when: bi("Saturday mornings", "صباح السبت"),
              price: bi("Members · complimentary", "للأعضاء · مجاناً"),
              note: bi("Members only, one rider per booking. The team approves the rider list; breakfast after the ride.", "للأعضاء فقط، راكب واحد لكل حجز. يعتمد الفريق قائمة الركاب، وفطور بعد الجولة."),
            },
            {
              kind: bi("Community event", "فعالية مجتمعية"), name: bi("Triathlon Pool Session", "جلسة مسبح الترايثلون"), when: bi("Thursdays · 6-7pm", "الخميس · 6-7 مساءً"),
              price: bi("Members · complimentary", "للأعضاء · مجاناً"),
              note: bi("Members only. No bike needed - you must be able to swim unaided. The team approves the list.", "للأعضاء فقط. لا تحتاج دراجة، ويجب أن تجيد السباحة دون مساعدة. يعتمد الفريق القائمة."),
            },
          ],
        },
      ],
    },
    {
      id: "dates",
      label: bi("Next dates", "المواعيد القادمة"),
      hint: bi("The dates come from the booking system: every open or full session from today on, except Petromin nights. A session with a name keeps it; the names below are for the rest.", "المواعيد من نظام الحجز: كل جلسة مفتوحة أو ممتلئة من اليوم فصاعداً، عدا أمسيات بترومين. الجلسة التي لها اسم تحتفظ به، والأسماء أدناه لغيرها."),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Next sessions", "الجلسات القادمة"),
        txt("title", 60, "Title", "العنوان", "Pick a date", "اختر موعدك"),
        { id: "count", type: "number", min: 3, max: 24, step: 1, label: bi("How many dates to show", "عدد المواعيد المعروضة"), def: 9 },
        txt("jccName", 50, "Name: circuit evening", "الاسم: أمسية الحلبة", "Evening Circuit Session", "جلسة الحلبة المسائية"),
        txt("satName", 50, "Name: Saturday ride", "الاسم: جولة السبت", "Saturday Social Ride", "جولة السبت الاجتماعية"),
        txt("swimName", 50, "Name: pool session", "الاسم: جلسة المسبح", "Triathlon Pool Session", "جلسة مسبح الترايثلون"),
        txt("workshopName", 50, "Name: triathlon workshop", "الاسم: ورشة الترايثلون", "T100 Triathlon Prep", "T100 التحضير للترايثلون"),
        txt("snd96Name", 50, "Name: National Day ride", "الاسم: جولة اليوم الوطني", "Saudi National Day Ride", "جولة اليوم الوطني السعودي"),
        txt("members", 30, "Tag: members only", "الوسم: للأعضاء فقط", "Members", "للأعضاء"),
        txt("free", 30, "Tag: free", "الوسم: مجاني", "Complimentary", "مجاناً"),
        txt("full", 40, "Tag: full", "الوسم: ممتلئة", "Full · waitlist open", "ممتلئة · قائمة الانتظار متاحة"),
        txt("book", 30, "Button: book", "الزر: احجز", "Book", "احجز"),
        txt("waitlist", 30, "Button: waitlist", "الزر: قائمة الانتظار", "Join waitlist", "انضم لقائمة الانتظار"),
        txt("gather", 30, "Word: gathering", "كلمة: التجمع", "Gathering", "التجمع"),
        txt("start", 30, "Word: start", "كلمة: الانطلاق", "Start", "الانطلاق"),
        long("empty", 200, "When no date is open", "عند عدم وجود مواعيد", "No dates are open right now - check back soon.", "لا توجد مواعيد متاحة الآن - عُد قريباً."),
        long("membersNote", 200, "Members note", "ملاحظة الأعضاء", "Rides marked Members are for Club members.", "الجولات المعلَّمة «للأعضاء» مخصصة لأعضاء النادي."),
        txt("clubLink", 40, "Link text: the Club", "نص الرابط: النادي", "Join the Club", "انضم إلى النادي"),
      ],
    },
    {
      id: "prices",
      label: bi("Bikes and prices", "الدراجات والأسعار"),
      hint: bi("The prices are read from the booking system, so they always match what riders pay. Change them there, not here.", "الأسعار تُقرأ من نظام الحجز فتطابق دائماً ما يدفعه الركاب. تُعدَّل هناك لا هنا."),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "The fleet", "الأسطول"),
        txt("title", 60, "Title", "العنوان", "Bikes and prices", "الدراجات والأسعار"),
        long("text", 240, "Text", "النص", "Per bike, for one evening session on the circuit.", "لكل دراجة في جلسة مسائية واحدة على الحلبة."),
        long("codeNote", 160, "Promo code note", "ملاحظة رمز الخصم", "Have a promo or ambassador code? Enter it when you book.", "لديك رمز خصم أو رمز سفير؟ أدخله عند الحجز."),
      ],
    },
    {
      id: "good",
      label: bi("Good to know", "معلومات مفيدة"),
      fields: [
        txt("title", 60, "Title", "العنوان", "Good to know", "معلومات مفيدة"),
        {
          id: "items", type: "list", maxItems: 8, label: bi("Points", "النقاط"),
          item: [txt("title", 60, "Title", "العنوان", "", ""), long("text", 240, "Text", "النص", "", "")],
          def: [
            { title: bi("Your account", "حسابك"), text: bi("Book with your Micromobility account. New here? Create one in the booking app - it takes a minute.", "احجز بحساب مايكروموبيليتي. جديد هنا؟ أنشئ حسابك في تطبيق الحجز خلال دقيقة.") },
            { title: bi("Pay at the booth", "الدفع عند الكشك"), text: bi("Payment is collected at the booth at the Corniche Circuit. Have your queue number ready when you arrive.", "الدفع يتم عند الكشك في حلبة الكورنيش. جهّز رقم طابورك عند وصولك.") },
            { title: bi("Your height, your size", "طولك يحدد مقاسك"), text: bi("Enter each rider's height when you book and the bike size is set for you. Kids' bikes too.", "أدخل طول كل راكب عند الحجز ويُحدَّد مقاس الدراجة تلقائياً. ودراجات الأطفال متوفرة أيضاً.") },
            { title: bi("Come early", "تعال مبكراً"), text: bi("Bikes are handed out first come, first served, so the earlier you arrive, the more likely you ride the type you chose.", "تُوزَّع الدراجات على أساس الأول فالأول، فكلما وصلت أبكر زادت فرصتك في نوع الدراجة الذي اخترته.") },
          ],
        },
        txt("directions", 30, "Button: directions", "الزر: الاتجاهات", "Directions", "الاتجاهات"),
      ],
    },
  ],
};
