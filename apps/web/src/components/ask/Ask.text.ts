// The Ask pages' own words (micromobility.sa/ask), in English and Arabic; every other language translates the
// English (src/i18n/tx), a sentence with values in it as its template. What staff write - a page's and a question's
// texts, the options - is never translated: it is shown as written (lib/ask.ts askText).
export const T = {
  en: {
    listTitle: "Have your say", nothing: "Nothing is open right now.",
    until: (date: string) => `Open until ${date}`, opens: (date: string) => `Opens ${date}`,
    tryLater: "Please try again in a moment.",
    none: "This page is not available.", signinTitle: "Sign in to see this page", notYours: "This page is not open to your account.", closedPage: "This page is closed.",
    closed: "Answers closed", preview: "Preview",
    signinToAnswer: "Sign in to answer", create: "Create account", close: "Close",
    yourAnswer: "Your answer", yourQuestion: "Your question", left: (n: number) => `${n} characters left`,
    send: "Send", sending: "Sending…", privacy: "Your name is never shown with an answer. MicroMobility's team can see who answered.",
    waiting: "Waiting for approval", rejected: "Not approved", answered: "Answered", remove: "Remove",
    up: (name: string) => `Move ${name} up`, down: (name: string) => `Move ${name} down`,
    pointsLeft: (n: number) => `${n} left`, fewer: (name: string) => `Fewer points for ${name}`, more: (name: string) => `More points for ${name}`,
    noAnswers: "No answers yet", oneAnswer: "1 answer", answers: (n: number) => `${n} answers`,
    average: (value: string) => `Average ${value}`, correct: "Correct answer",
    upvote: (n: number) => `Upvote (${n})`, votes: (n: number) => `Votes: ${n}`,
    screenBad: "This screen link is not valid", prev: "Previous question", next: "Next question",
    lowest: (value: string) => `Lowest ${value}`, highest: (value: string) => `Highest ${value}`, back: "Back", forward: "Next", step: (at: number, of: number) => `Question ${at} of ${of}`, fullScreen: "Full screen",
    // stage 2: a page staff pace, the quizzes, the form, the grid, the pin, reactions
    waitNext: "Waiting for the next question", answerSent: "Answer sent", sent: "Sent", required: "Required",
    right: "Correct", wrong: "Not correct", points: (n: string) => `${n} points`, secondsLeft: (n: number) => `${n} seconds left`,
    me: (score: string) => `Your score ${score}`, mePlace: (score: string, place: number, of: number) => `Your score ${score} · place ${place} of ${of}`,
    gotRight: (right: number, all: number) => `${right} of ${all} got it right`,
    axisX: "Across", axisY: "Upwards", pinAt: (x: number, y: number) => `${x}% across, ${y}% down`,
    react: { like: "Like", love: "Love", clap: "Clap", wow: "Wow", think: "Thinking" } as Record<string, string>,
    errors: {
      signin: "Your session has ended. Sign in again.", audience: "This page is not open to your account.", closed: "This question is no longer taking answers.",
      limit: "You have sent all your answers to this question.", answered: "You have already answered this question.",
      empty: "Type your answer first.", long: "That answer is too long.", link: "Links can't be sent.", invalid: "That answer does not fit the question.",
      late: "Time is up.", throttled: "Too many answers - try again in a few minutes.", generic: "It could not be sent. Check the connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    listTitle: "شاركنا رأيك", nothing: "لا يوجد شيء مفتوح حالياً.",
    until: (date: string) => `مفتوح حتى ${date}`, opens: (date: string) => `يفتح ${date}`,
    tryLater: "يرجى المحاولة مرة أخرى بعد قليل.",
    none: "هذه الصفحة غير متاحة.", signinTitle: "سجّل الدخول لعرض هذه الصفحة", notYours: "هذه الصفحة غير متاحة لحسابك.", closedPage: "هذه الصفحة مغلقة.",
    closed: "أُغلقت الإجابات", preview: "معاينة",
    signinToAnswer: "سجّل الدخول للإجابة", create: "إنشاء حساب", close: "إغلاق",
    yourAnswer: "إجابتك", yourQuestion: "سؤالك", left: (n: number) => `المتبقي ${n} حرفاً`,
    send: "إرسال", sending: "جارٍ الإرسال…", privacy: "لا يظهر اسمك مع أي إجابة أبداً. فريق MicroMobility يرى من أجاب.",
    waiting: "بانتظار الموافقة", rejected: "لم تتم الموافقة", answered: "تمت الإجابة", remove: "إزالة",
    up: (name: string) => `تحريك ${name} للأعلى`, down: (name: string) => `تحريك ${name} للأسفل`,
    pointsLeft: (n: number) => `المتبقي: ${n}`, fewer: (name: string) => `نقاط أقل لـ ${name}`, more: (name: string) => `نقاط أكثر لـ ${name}`,
    noAnswers: "لا توجد إجابات بعد", oneAnswer: "إجابة واحدة", answers: (n: number) => `الإجابات: ${n}`,
    average: (value: string) => `المتوسط ${value}`, correct: "الإجابة الصحيحة",
    upvote: (n: number) => `تأييد (${n})`, votes: (n: number) => `الأصوات: ${n}`,
    screenBad: "رابط الشاشة غير صالح", prev: "السؤال السابق", next: "السؤال التالي",
    lowest: (value: string) => `الأدنى ${value}`, highest: (value: string) => `الأعلى ${value}`, back: "رجوع", forward: "التالي", step: (at: number, of: number) => `السؤال ${at} من ${of}`, fullScreen: "ملء الشاشة",
    // المرحلة الثانية
    waitNext: "بانتظار السؤال التالي", answerSent: "تم إرسال الإجابة", sent: "تم الإرسال", required: "مطلوب",
    right: "صحيح", wrong: "غير صحيح", points: (n: string) => `النقاط: ${n}`, secondsLeft: (n: number) => `الثواني المتبقية: ${n}`,
    me: (score: string) => `نقاطك ${score}`, mePlace: (score: string, place: number, of: number) => `نقاطك ${score} · المركز ${place} من ${of}`,
    gotRight: (right: number, all: number) => `الإجابات الصحيحة: ${right} من ${all}`,
    axisX: "أفقياً", axisY: "للأعلى", pinAt: (x: number, y: number) => `${x}% أفقياً، ${y}% من الأعلى`,
    react: { like: "أعجبني", love: "أحببته", clap: "تصفيق", wow: "مذهل", think: "أفكّر" } as Record<string, string>,
    errors: {
      signin: "انتهت جلستك. سجّل الدخول مجدداً.", audience: "هذه الصفحة غير متاحة لحسابك.", closed: "لم يعد هذا السؤال يستقبل الإجابات.",
      limit: "أرسلت كل إجاباتك على هذا السؤال.", answered: "سبق أن أجبت عن هذا السؤال.",
      empty: "اكتب إجابتك أولاً.", long: "الإجابة طويلة جداً.", link: "لا يمكن إرسال الروابط.", invalid: "هذه الإجابة لا تناسب السؤال.",
      late: "انتهى الوقت.", throttled: "إجابات كثيرة - حاول بعد بضع دقائق.", generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.",
    } as Record<string, string>,
  },
};
/** The words in one language, as a component holds them. */
export type AskWords = (typeof T)["en"];
