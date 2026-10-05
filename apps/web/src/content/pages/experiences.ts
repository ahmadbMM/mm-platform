import { bi, type PageSchema } from "@/content/types";
import { BOOKING_URL } from "@/lib/links";

// The Experiences page (Rentals.dc.html): booking in steps, one at a time (owner, 2026-09-25) -
// the event (the booking app's own event cards), then a date, then the ride with its prices and
// rules - and the last step opens the real booking app on that event and date (?ev=&session=).
// The events, dates and prices are read live from the booking system. Every rule stated in the defaults is the booking
// app's own: three riders per account on a circuit evening, one seat per member on a community
// ride, each rider's height setting the bike size, payment at the circuit booth, bikes handed out
// first come first served. The design's add-on prices and its "up to 10 bikes" were examples.
const txt = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const experiencesSchema = {
  page: "experiences",
  label: bi("Experiences", "التجارب"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Jeddah Corniche Circuit", "حلبة كورنيش جدة"),
        txt("title", 60, "Title", "العنوان", "Book your ride.", "احجز جولتك."),
        long("text", 240, "Text", "النص", "Pick an event and a date, add your riders and book. Pay at the circuit booth.", "اختر الفعالية والموعد، وأضف الركاب واحجز. الدفع عند الكشك في الحلبة."),
        { id: "image", type: "image", label: bi("Photo", "الصورة"), def: "/site/experiences/hero.jpg" },
        txt("bookBtn", 30, "Button", "الزر", "Start booking", "ابدأ الحجز"),
        { id: "bookHref", type: "link", label: bi("Booking app link", "رابط تطبيق الحجز"), hint: bi("Where the last step sends riders, with the event and date they picked.", "وجهة الخطوة الأخيرة، مع الفعالية والموعد المختارين."), def: BOOKING_URL },
      ],
    },
    {
      id: "steps",
      label: bi("The steps", "الخطوات"),
      fields: [
        txt("stepEvent", 20, "Step 1: name", "الخطوة ١: الاسم", "Event", "الفعالية"),
        txt("stepDate", 20, "Step 2: name", "الخطوة ٢: الاسم", "Date", "الموعد"),
        txt("stepBook", 20, "Step 3: name", "الخطوة ٣: الاسم", "Book", "الحجز"),
        txt("eventTitle", 50, "Step 1: title", "الخطوة ١: العنوان", "Pick your event", "اختر فعاليتك"),
        txt("dateTitle", 50, "Step 2: title", "الخطوة ٢: العنوان", "Pick a date", "اختر موعدك"),
        txt("bookTitle", 50, "Step 3: title", "الخطوة ٣: العنوان", "Your ride", "جولتك"),
        txt("continue", 40, "Button: continue to booking", "الزر: تابع إلى الحجز", "Continue to booking", "تابع إلى الحجز"),
        txt("back", 20, "Button: back", "الزر: رجوع", "Back", "رجوع"),
        long("noDates", 200, "No date open for an event", "لا مواعيد لفعالية", "No dates are open for this event right now - check back soon.", "لا توجد مواعيد متاحة لهذه الفعالية الآن - عُد قريباً."),
        long("handoff", 200, "Under the last button", "تحت الزر الأخير", "The booking app opens on this date: sign in, add your riders and confirm.", "يفتح تطبيق الحجز على هذا الموعد: سجّل الدخول وأضف الركاب وأكّد."),
      ],
    },
    {
      id: "events",
      label: bi("Event cards", "بطاقات الفعاليات"),
      hint: bi("The same events as the booking app. The National Day, T100, Events and Run for Her cards show only while they have dates. Their About texts also show in the booking app.", "الفعاليات نفسها كما في تطبيق الحجز. بطاقات اليوم الوطني وT100 والفعاليات ونركض لأجلها تظهر فقط عند وجود مواعيد. وتظهر نصوص «عن هذه الفعالية» في تطبيق الحجز أيضاً."),
      fields: [
        txt("jccTitle", 40, "Circuit: title", "الحلبة: العنوان", "Open Sports Day", "يوم الرياضة المفتوح"),
        txt("jccMeta", 60, "Circuit: line", "الحلبة: السطر", "Sun & Tue · 9-11pm", "الأحد والثلاثاء · 9-11 مساءً"),
        { id: "jccLogo", type: "image", label: bi("Circuit: logo", "الحلبة: الشعار"), def: "/site/experiences/jcc.png" },
        long("jccNote", 240, "Circuit: rules", "الحلبة: القواعد", "Up to 3 riders per account each evening. Bikes are handed out first come, first served - come early to get the bike type you chose.", "حتى 3 ركاب لكل حساب في كل أمسية. تُوزَّع الدراجات على أساس الأول فالأول - تعال مبكراً لتحصل على نوع الدراجة الذي اخترته."),
        // Each card's *About (2026-10-05), right after its rules: what the event is, in its About on
        // Experiences and in the booking app (lib/event-info.ts).
        long("jccAbout", 420,"Circuit: about this event", "الحلبة: عن هذه الفعالية", "Ride the Jeddah Corniche Circuit, the Formula 1 track, on Sunday and Tuesday evenings. Choose your bike type when you book, collect it at the booth and pay there. Every bike comes with a helmet. Up to 3 riders per account each evening; bikes go first come, first served.", "اركب على حلبة كورنيش جدة، مضمار الفورمولا 1، مساء الأحد والثلاثاء. اختر نوع دراجتك عند الحجز، واستلمها من الكشك وادفع هناك. تأتي كل دراجة مع خوذة. حتى 3 ركاب لكل حساب في الأمسية، والدراجات بأسبقية الحضور."),
        txt("commTitle", 40, "Community: title", "المجتمع: العنوان", "Micromobility Experiences", "تجارب مايكروموبيليتي"),
        txt("commMeta", 60, "Community: line", "المجتمع: السطر", "Community rides for Club members", "جولات مجتمعية لأعضاء النادي"),
        { id: "commLogo", type: "image", label: bi("Community: logo", "المجتمع: الشعار"), def: "/site/logo-dark.png" },
        long("commNote", 240, "Community: rules", "المجتمع: القواعد", "Members only, one rider per booking. The team approves the rider list before the ride.", "للأعضاء فقط، راكب واحد لكل حجز. يعتمد الفريق قائمة الركاب قبل الجولة."),
        long("commAbout", 420, "Community: about this event", "المجتمع: عن هذه الفعالية", "Our community’s own rides, for members: the Saturday Social Ride with breakfast after, Petromin’s Wednesdays and triathlon pool sessions. Each member books a place for themselves; on the Saturday ride our team confirms the list before the ride.", "جولات مجتمعنا الخاصة بالأعضاء: جولة السبت الاجتماعية مع فطور بعدها، وأربعاء بترومين، وجلسات السباحة للترايثلون. يحجز كل عضو مكانًا لنفسه، ويعتمد فريقنا قائمة جولة السبت قبل موعدها."),
        txt("sndTitle", 40, "National Day: title", "اليوم الوطني: العنوان", "Saudi National Day 96 Ride", "جولة اليوم الوطني السعودي 96"),
        txt("sndMeta", 60, "National Day: line", "اليوم الوطني: السطر", "Ride for the Kingdom", "نركب لأجل الوطن"),
        { id: "sndLogo", type: "image", label: bi("National Day: logo", "اليوم الوطني: الشعار"), def: "/site/experiences/snd96-logo.svg" },
        long("sndNote", 240, "National Day: rules", "اليوم الوطني: القواعد", "Open to every signed-in customer, at circuit prices; the waitlist opens when the bikes run out.", "متاحة لكل عميل مسجّل بأسعار الحلبة، وتبدأ قائمة الانتظار عند نفاد الدراجات."),
        long("sndAbout", 420, "National Day: about this event", "اليوم الوطني: عن هذه الفعالية", "A ride for the Kingdom on the Jeddah Corniche Circuit, open to every signed-in customer at circuit prices. When the bikes run out, the waitlist opens.", "جولة لأجل الوطن على حلبة كورنيش جدة، متاحة لكل عميل مسجّل بأسعار الحلبة. وعند نفاد الدراجات تُفتح قائمة الانتظار."),
        txt("wsTitle", 40, "T100: title", "T100: العنوان", "T100 Triathlon Prep", "T100 التحضير للترايثلون"),
        txt("wsMeta", 60, "T100: line", "T100: السطر", "In partnership with Saudi Triathlon Federation", "بالشراكة مع الاتحاد السعودي للترايثلون"),
        { id: "wsLogo", type: "image", label: bi("T100: logo", "T100: الشعار"), def: "/site/logo-dark.png" },
        long("wsNote", 240, "T100: rules", "T100: القواعد", "Open to every signed-in customer. One place per account, no bike needed, complimentary. The team approves the list.", "متاحة لكل عميل مسجّل. مقعد واحد لكل حساب، بلا دراجة، ومجاناً. يعتمد الفريق القائمة."),
        long("wsAbout", 420, "T100: about this event", "T100: عن هذه الفعالية", "T100 Triathlon Prep, in partnership with the Saudi Triathlon Federation. Open to everyone; one place per account, no bike needed, free. Our team confirms the list.", "التحضير للترايثلون T100 بالشراكة مع الاتحاد السعودي للترايثلون. متاحة للجميع؛ مكان واحد لكل حساب، بلا حاجة إلى دراجة، ومجانًا. ويعتمد فريقنا القائمة."),
        // Ticketed events (ride_kind 'event', 2026-09-28): the card shows while an event is on the books.
        txt("evTitle", 40, "Events: title", "الفعاليات: العنوان", "Events", "الفعاليات"),
        txt("evMeta", 60, "Events: line", "الفعاليات: السطر", "Talks, classes and festivals", "محاضرات ودورات ومهرجانات"),
        { id: "evLogo", type: "image", label: bi("Events: logo", "الفعاليات: الشعار"), def: "/site/logo-dark.png" },
        long("evNote", 240, "Events: rules", "الفعاليات: القواعد", "Seats, not bikes. Each event says who may book - everyone, or Club members - and what a seat costs. Up to 5 seats per booking; first come, first seated.", "مقاعد لا دراجات. كل فعالية تحدد من يحجز - الجميع أو أعضاء النادي - وسعر المقعد. حتى 5 مقاعد لكل حجز، والأسبقية لمن يحجز أولاً."),
        long("evAbout", 420, "Events: about this event", "الفعاليات: عن هذه الفعالية", "Talks, classes and festivals you book a seat for. Each event says who can book (everyone, or community members) and what a seat costs. Up to 5 seats per booking; first come, first seated.", "محاضرات ودورات ومهرجانات تحجز فيها مقعدًا. تحدد كل فعالية من يحق له الحجز (الجميع أو أعضاء المجتمع) وسعر المقعد. حتى 5 مقاعد في الحجز، والأسبقية لمن يحجز أولًا."),
        // Run for Her (ride_kind 'runher', 2026-10-05): a members' run at the Jeddah Yacht Club; the
        // card shows while a run is on the books, as the booking app's does (_runHerLive).
        txt("rhTitle", 40, "Run for Her: title", "نركض لأجلها: العنوان", "Run for Her", "نركض لأجلها"),
        txt("rhMeta", 60, "Run for Her: line", "نركض لأجلها: السطر", "3 or 5 km · Jeddah Yacht Club", "3 أو 5 كم · نادي جدة لليخوت"),
        // the partners' marks as the poster sets them (the owner picked "C, Blush" for the booking app's card)
        { id: "rhLogo", type: "image", label: bi("Run for Her: logo", "نركض لأجلها: الشعار"), def: "/site/runher-partners.webp" },
        long("rhNote", 240, "Run for Her: rules", "نركض لأجلها: القواعد", "For Club members aged 18 and over on race day. One place per account, complimentary. Places go first come, first served, then the waitlist opens. Pick 3 km or 5 km when you book.", "لأعضاء النادي ممن أتموا 18 عاماً يوم السباق. مكان واحد لكل حساب، ومجاناً. الأماكن بأسبقية التسجيل، ثم تُفتح قائمة الانتظار. اختر 3 كم أو 5 كم عند الحجز."),
        long("rhAbout", 420, "Run for Her: about this event", "نركض لأجلها: عن هذه الفعالية", "A morning run along the water at the Jeddah Yacht Club, in partnership with the Jeddah Yacht Club and Dr. Samir Abbas Hospital. Choose 3 km or 5 km when you book. For community members aged 18 and over; free, one place per account. 80 places, then a waitlist.", "جري صباحي على الواجهة البحرية في نادي جدة لليخوت، بالشراكة مع نادي جدة لليخوت ومستشفى الدكتور سمير عباس. اختر 3 كم أو 5 كم عند الحجز. لأعضاء المجتمع ممن أتموا 18 عامًا؛ مجانًا، ومكان واحد لكل حساب. 80 مكانًا، ثم قائمة انتظار."),
      ],
    },
    {
      id: "dates",
      label: bi("Dates", "المواعيد"),
      hint: bi("The dates come from the booking system: every open or full session from today on, except Petromin nights. A session with a name keeps it; the names below are for the rest. The Details texts also show in the booking app.", "المواعيد من نظام الحجز: كل جلسة مفتوحة أو ممتلئة من اليوم فصاعداً، عدا أمسيات بترومين. الجلسة التي لها اسم تحتفظ به، والأسماء أدناه لغيرها. وتظهر نصوص «التفاصيل» في تطبيق الحجز أيضاً."),
      fields: [
        { id: "count", type: "number", min: 3, max: 24, step: 1, label: bi("How many dates to show per event", "عدد المواعيد لكل فعالية"), def: 9 },
        txt("jccName", 50, "Name: circuit evening", "الاسم: أمسية الحلبة", "Evening Circuit Session", "جلسة الحلبة المسائية"),
        txt("satName", 50, "Name: Saturday ride", "الاسم: جولة السبت", "Saturday Social Ride", "جولة السبت الاجتماعية"),
        txt("swimName", 50, "Name: pool session", "الاسم: جلسة المسبح", "Triathlon Pool Session", "جلسة مسبح الترايثلون"),
        txt("workshopName", 50, "Name: triathlon workshop", "الاسم: ورشة الترايثلون", "T100 Triathlon Prep", "T100 التحضير للترايثلون"),
        txt("snd96Name", 50, "Name: National Day ride", "الاسم: جولة اليوم الوطني", "Saudi National Day Ride", "جولة اليوم الوطني السعودي"),
        txt("eventName", 50, "Name: event without a title", "الاسم: فعالية بلا عنوان", "Event", "فعالية"),
        txt("runHerName", 50, "Name: Run for Her", "الاسم: نركض لأجلها", "Run for Her", "نركض لأجلها"),
        // What each kind of date is, in its Details on Experiences and in the booking app (2026-10-05,
        // lib/event-info.ts): the National Day ride and the events say their card's About instead. This
        // site never lists Petromin nights, so aboutPetro is the booking app's alone.
        { ...long("aboutJcc", 420, "Details: circuit evening", "التفاصيل: أمسية الحلبة", "An evening on the circuit. Collect your bike from {collect}; the session runs {start} to {end}. Pay at the booth.", "أمسية على الحلبة. استلم دراجتك من {collect}، والجلسة من {start} إلى {end}. الدفع عند الكشك."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        { ...long("aboutSat", 420, "Details: Saturday ride", "التفاصيل: جولة السبت", "We gather at {gather} and set off at {start}. Choose your group: Beginners, 20 km to the Jeddah Yacht Club and back, or Intermediates, 40 km to just before the Marine Sciences roundabout and back. Breakfast together after the ride. Free; our team confirms the list before the ride.", "نتجمع في {gather} وننطلق في {start}. اختر مجموعتك: المبتدئون، 20 كم إلى نادي جدة لليخوت والعودة، أو المتوسطون، 40 كم إلى ما قبل دوار العلوم البحرية والعودة. فطور معًا بعد الجولة. مجانًا، ويعتمد فريقنا القائمة قبل الجولة."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        { ...long("aboutPetro", 420, "Details: Petromin night (booking app)", "التفاصيل: أمسية بترومين (تطبيق الحجز)", "Petromin’s Wednesday evening on the circuit. Collect your bike from {collect}; circuit prices; bikes go first come, first served.", "أمسية أربعاء بترومين على الحلبة. استلم دراجتك من {collect}، بأسعار الحلبة، والدراجات بأسبقية الحضور."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        { ...long("aboutSwim", 420, "Details: pool session", "التفاصيل: جلسة المسبح", "A triathlon swim session at the pool, {start} to {end}. No bike needed. Free; our team confirms the list.", "جلسة سباحة للترايثلون في المسبح، من {start} إلى {end}. لا حاجة إلى دراجة. مجانًا، ويعتمد فريقنا القائمة."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        { ...long("aboutWs", 420, "Details: T100", "التفاصيل: T100", "T100 Triathlon Prep, in partnership with the Saudi Triathlon Federation, {start} to {end}. Open to everyone; free; our team confirms the list.", "التحضير للترايثلون T100 بالشراكة مع الاتحاد السعودي للترايثلون، من {start} إلى {end}. متاحة للجميع، مجانًا، ويعتمد فريقنا القائمة."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        { ...long("aboutRun", 420, "Details: Run for Her", "التفاصيل: نركض لأجلها", "Meet at {gather}; the run starts at {start}. Choose 3 km or 5 km when you book. Free; 80 places, then a waitlist.", "التجمع في {gather}، وينطلق الجري في {start}. اختر 3 كم أو 5 كم عند الحجز. مجانًا؛ 80 مكانًا، ثم قائمة انتظار."), hint: bi("{gather}, {start}, {end} and {collect} are filled from each date.", "تُملأ {gather} و{start} و{end} و{collect} من كل موعد.") },
        txt("members", 30, "Tag: members only", "الوسم: للأعضاء فقط", "Members", "للأعضاء"),
        txt("everyone", 30, "Tag: open to everyone", "الوسم: للجميع", "Open to everyone", "للجميع"),
        txt("perSeat", 40, "Event: price per seat ({price})", "الفعالية: سعر المقعد ({price})", "{price} per seat", "{price} للمقعد"),
        txt("seats", 40, "Event: seats ({n})", "الفعالية: المقاعد ({n})", "{n} seats", "المقاعد: {n}"),
        txt("free", 30, "Tag: free", "الوسم: مجاني", "Complimentary", "مجاناً"),
        txt("full", 40, "Tag: full", "الوسم: ممتلئة", "Full · waitlist open", "ممتلئة · قائمة الانتظار متاحة"),
        txt("book", 30, "Button: book", "الزر: احجز", "Book", "احجز"),
        txt("waitlist", 40, "Button: waitlist", "الزر: قائمة الانتظار", "Join the waitlist", "انضم لقائمة الانتظار"),
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
      hint: bi("Shown on the last step of a paid ride. The prices are read from the booking system, so they always match what riders pay.", "تظهر في الخطوة الأخيرة للجولة المدفوعة. الأسعار تُقرأ من نظام الحجز فتطابق دائماً ما يدفعه الركاب."),
      fields: [
        txt("title", 60, "Title", "العنوان", "Bikes and prices", "الدراجات والأسعار"),
        long("text", 240, "Text", "النص", "Per bike, for the session. Pay at the booth at the circuit.", "لكل دراجة في الجلسة. الدفع عند الكشك في الحلبة."),
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
    {
      // Learn to ride (owner, 2026-09-28): a sign-up for lessons at /experiences/learn, received by
      // the staff page through learn_apply(); the team contacts each person with a lesson time. The
      // question (the teaser* fields) also sits on Home and on this page. The sign-up belongs to
      // Experiences: its address is under /experiences, so switching Experiences off (Website >
      // Pages) closes it too, and `on` closes just the lessons. `taking` (owner, 2026-10-04: "an
      // option to stop taking applications, show in the website that currently we are not taking
      // any") keeps the page and the question up but says sign-ups are closed, with the closed*
      // texts, in place of the form and of the question's button; customer_learn_apply refuses a
      // sign-up meanwhile (rentals migration 20261004201500).
      id: "learn",
      label: bi("Learn to ride", "تعلّم ركوب الدراجة"),
      hint: bi("The lessons sign-up at micromobility.sa/experiences/learn. Its question (the first four texts) also shows on Home and on the Experiences page.", "صفحة التسجيل في الدروس على micromobility.sa/experiences/learn. يظهر سؤالها (النصوص الأربعة الأولى) أيضاً في الصفحة الرئيسية وصفحة التجارب."),
      fields: [
        { id: "on", type: "toggle", label: bi("Offer lessons", "إتاحة الدروس"), hint: bi("Off hides the question on Home and Experiences and closes the sign-up page.", "الإيقاف يخفي السؤال من الصفحة الرئيسية وصفحة التجارب ويغلق صفحة التسجيل."), def: true },
        { id: "taking", type: "toggle", label: bi("Taking sign-ups", "استقبال طلبات التسجيل"), hint: bi("Off keeps the sign-up page and the question on Home and Experiences, but they say sign-ups are closed (the last two texts) instead of showing the form and the button, and nobody can sign up until it is on again.", "الإيقاف يُبقي صفحة التسجيل والسؤال في الصفحة الرئيسية وصفحة التجارب، لكنها تقول إن التسجيل مغلق (آخر نصّين) بدلاً من النموذج والزر، ولا يمكن لأحد التسجيل حتى يُعاد تشغيله."), def: true },
        txt("teaserEyebrow", 40, "Question: small label", "السؤال: العبارة الصغيرة", "Learn to ride", "تعلّم ركوب الدراجة"),
        txt("teaserTitle", 70, "Question: title", "السؤال: العنوان", "Never learned to ride? We'll teach you.", "لم تتعلّم ركوب الدراجة بعد؟ سنعلّمك."),
        long("teaserText", 200, "Question: text", "السؤال: النص", "Kids and adults welcome. Sign up, and we'll contact you with your lesson's date and time.", "للصغار والكبار. سجّل، وسنتواصل معك بموعد درسك ووقته."),
        txt("teaserBtn", 30, "Question: button", "السؤال: الزر", "Sign up for a lesson", "سجّل في درس"),
        txt("eyebrow", 40, "Sign-up page: small label", "صفحة التسجيل: العبارة الصغيرة", "Learn to ride", "تعلّم ركوب الدراجة"),
        txt("title", 60, "Sign-up page: title", "صفحة التسجيل: العنوان", "Learn to ride with us.", "تعلّم ركوب الدراجة معنا."),
        long("text", 300, "Sign-up page: text", "صفحة التسجيل: النص", "First time on a bike, or never quite got the hang of it? We'll teach you step by step. Tell us who is learning, and we'll get back to you with a lesson time.", "أول مرة تركب فيها دراجة، أو لم تتقن الركوب من قبل؟ سنعلّمك خطوة بخطوة. أخبرنا مَن سيتعلّم، وسنعود إليك بموعد الدرس."),
        { id: "image", type: "image", label: bi("Sign-up page: link preview photo", "صفحة التسجيل: صورة معاينة الرابط"), hint: bi("The picture a shared link to the sign-up page shows (WhatsApp, Instagram). The page itself has no photo.", "الصورة التي تظهر عند مشاركة رابط صفحة التسجيل (واتساب، إنستغرام). الصفحة نفسها بلا صورة."), def: "/site/experiences/hero.jpg" },
        txt("formTitle", 50, "Form: title", "النموذج: العنوان", "Sign up", "سجّل الآن"),
        long("formSub", 200, "Form: text under the title", "النموذج: النص تحت العنوان", "It takes a minute. We'll contact you with your lesson's date and time.", "لن يستغرق سوى دقيقة. سنتواصل معك بموعد درسك ووقته."),
        txt("doneTitle", 50, "After sending: title", "بعد الإرسال: العنوان", "You're signed up!", "تم تسجيلك!"),
        long("doneText", 240, "After sending: text", "بعد الإرسال: النص", "Thank you. We'll contact you soon with your lesson's date and time.", "شكراً لك. سنتواصل معك قريباً بموعد درسك ووقته."),
        txt("closedTitle", 60, "Not taking sign-ups: title", "التسجيل مغلق: العنوان", "Sign-ups are closed for now", "التسجيل مغلق حالياً"),
        long("closedText", 240, "Not taking sign-ups: text", "التسجيل مغلق: النص", "We're currently not taking any new sign-ups for lessons. Please check back soon.", "لا نستقبل حالياً أي طلبات جديدة للتسجيل في الدروس. يُرجى العودة لاحقاً."),
      ],
    },
  ],
} as const satisfies PageSchema;
