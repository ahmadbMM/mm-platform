// LearnForm's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template. The Arabic of the choices reads
// the same whoever is learning - the visitor, their child or another adult.
export const T = {
  en: {
    who: "Who is learning?", self: "Me", child: "My child", other: "Someone else",
    // Each learner's card, by its place in the list; the button under the list adds one.
    learner: (n: number) => `Learner ${n}`, remove: (n: number) => `Remove learner ${n}`, add: "Add another learner",
    childName: "Child's name", childNameHint: "First name is enough.", otherName: "Their full name",
    age: "Age", gender: "Gender", male: "Male", female: "Female",
    height: "Height (cm)", heightHint: "It helps us bring the right bike size.",
    level: "Riding so far", never: "Never ridden a bike", tried: "Tried, but can't ride yet", refresh: "Rode before - needs a refresher",
    details: "Your details", parentHint: "As the parent: your own name, mobile and email.",
    name: "Your full name", phone: "Mobile number", email: "Email", notes: "Anything we should know? (optional)",
    // How they heard of us: the booking app's answers, in its English (its heard_* texts).
    heard: "How did you hear about us?", heardPick: "Choose one",
    heardOpts: {
      instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", x: "X (Twitter)", facebook: "Facebook", youtube: "YouTube",
      whatsapp: "WhatsApp", google: "Google search", friend: "A friend or family", invited: "Invited by MicroMobility",
      passed_by: "Passed by the circuit", event: "An event or exhibition", hotel: "Hotel or tour", school: "School or university",
      work: "Work or my company", community: "A community ride", other: "Other",
    } as Record<string, string>,
    // The Privacy Notice's name is a link in the sentence: its place comes from the template.
    privacy: (link: string) => `I have read the ${link}`, privacyLink: "Privacy Notice",
    use: "We use these details to arrange the lesson, and to set up your Micromobility account if you don't have one yet.",
    send: "Sign up", sending: "Sending…", again: "Sign up more learners",
    // A learner's message names their card: "Learner 2: Enter the child's age, from 3 to 17."
    learnerError: (n: number, message: string) => `Learner ${n}: ${message}`,
    errors: {
      learner_who: "Choose who is learning.", learner_name: "Enter the child's name - letters only.", learner_name_other: "Enter their full name - letters only.",
      learner_age: "Enter an age from 12 to 99. Under 12? Choose My child.", learner_age_child: "Enter the child's age, from 3 to 17.", learner_age_other: "Enter their age, from 12 to 99.",
      learner_twice: "This learner is already on the list.", learners: "Check the list of learners: from 1 to 5, each one only once.",
      learner_gender: "Choose male or female.", learner_height: "Enter a height between 80 and 250 cm.", level: "Choose how much riding so far.",
      name: "Enter your first and last name - letters, spaces and periods only.", phone: "Check the mobile number, e.g. 05XXXXXXXX.",
      email: "Check the email address.", heard_from: "Please tell us how you heard about us.",
      notes: "Keep the note to 600 characters.", privacy: "Please confirm you have read the Privacy Notice.",
      throttled: "Too many sign-ups from this network - try again in a few minutes.",
      generic: "It could not be sent. Check the connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    who: "مَن سيتعلّم؟", self: "أنا", child: "طفلي", other: "شخص آخر",
    learner: (n: number) => `المتعلّم ${n}`, remove: (n: number) => `إزالة المتعلّم ${n}`, add: "إضافة متعلّم آخر",
    childName: "اسم الطفل", childNameHint: "يكفي الاسم الأول.", otherName: "الاسم الكامل",
    age: "العمر", gender: "الجنس", male: "ذكر", female: "أنثى",
    height: "الطول (سم)", heightHint: "يساعدنا على تجهيز دراجة بالمقاس المناسب.",
    level: "الخبرة في الركوب حتى الآن", never: "لا خبرة سابقة في ركوب الدراجة", tried: "محاولات سابقة دون إتقان الركوب بعد", refresh: "خبرة سابقة تحتاج إلى تنشيط",
    details: "بياناتك", parentHint: "بصفتك وليّ الأمر: اسمك ورقم جوالك وبريدك الإلكتروني.",
    name: "اسمك الكامل", phone: "رقم الجوال", email: "البريد الإلكتروني", notes: "أي تفاصيل تهمنا؟ (اختياري)",
    heard: "كيف عرفت عنا؟", heardPick: "اختر واحداً",
    heardOpts: {
      instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", x: "X (Twitter)", facebook: "Facebook", youtube: "YouTube",
      whatsapp: "WhatsApp", google: "بحث جوجل", friend: "صديق أو أحد الأقارب", invited: "بدعوة من مايكروموبيليتي",
      passed_by: "مررت بالحلبة", event: "فعالية أو معرض", hotel: "فندق أو جولة سياحية", school: "مدرسة أو جامعة",
      work: "العمل أو شركتي", community: "جولة مجتمعية", other: "غير ذلك",
    } as Record<string, string>,
    privacy: (link: string) => `قرأت ${link}`, privacyLink: "إشعار الخصوصية",
    use: "نستخدم هذه البيانات لترتيب الدرس، ولإنشاء حسابك في مايكروموبيليتي إن لم يكن لديك حساب بعد.",
    send: "سجّل الآن", sending: "جارٍ الإرسال…", again: "سجّل متعلّمين آخرين",
    learnerError: (n: number, message: string) => `المتعلّم ${n}: ${message}`,
    errors: {
      learner_who: "اختر مَن سيتعلّم.", learner_name: "أدخل اسم الطفل - حروف فقط.", learner_name_other: "أدخل الاسم الكامل - حروف فقط.",
      learner_age: "أدخل عمراً من 12 إلى 99. أصغر من 12 عاماً؟ اختر «طفلي».", learner_age_child: "أدخل عمر الطفل، من 3 إلى 17.", learner_age_other: "أدخل العمر، من 12 إلى 99.",
      learner_twice: "هذا المتعلّم مُضاف إلى القائمة من قبل.", learners: "راجع قائمة المتعلّمين: من 1 إلى 5، وكلٌّ منهم مرة واحدة فقط.",
      learner_gender: "حدّد الجنس: ذكر أو أنثى.", learner_height: "أدخل طولاً بين 80 و250 سم.", level: "اختر مستوى الخبرة في الركوب.",
      name: "أدخل اسمك الأول واسم العائلة - حروف ومسافات ونقاط فقط.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.",
      email: "تحقق من البريد الإلكتروني.", heard_from: "أخبرنا من فضلك كيف عرفت عنا.",
      notes: "اجعل الملاحظة في حدود 600 حرف.", privacy: "يرجى تأكيد قراءتك لإشعار الخصوصية.",
      throttled: "تسجيلات كثيرة من هذه الشبكة - حاول بعد دقائق.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.",
    } as Record<string, string>,
  },
};
