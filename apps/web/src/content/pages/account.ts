import { bi, type PageSchema } from "@/content/types";

// Account (Account.dc.html): sign in with the Micromobility account riders already book with.
// The design's WhatsApp codes, Strava, returns and pickups do not exist, so only the sign-in,
// the next rides, the Club card and shortcuts are here; everything else stays in the booking app.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });

export const accountSchema: PageSchema = {
  page: "account",
  label: bi("Account", "الحساب"),
  sections: [
    {
      id: "signin",
      label: bi("Sign in", "تسجيل الدخول"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "One account for everything", "حساب واحد لكل شيء"),
        txt("title", 40, "Title", "العنوان", "Welcome back", "أهلاً بعودتك"),
        long("text", 200, "Text", "النص", "Sign in with your Micromobility account - the one you book rides with.", "سجّل الدخول بحساب مايكروموبيليتي - الحساب نفسه الذي تحجز به جولاتك."),
        long("create", 160, "New here", "جديد هنا", "New here? Create your account in the booking app - it takes a minute.", "جديد هنا؟ أنشئ حسابك في تطبيق الحجز خلال دقيقة."),
        long("forgot", 200, "Forgot your password", "نسيت كلمة المرور", "Forgot your password? Staff at the Corniche Circuit booth can reset it for you.", "نسيت كلمة المرور؟ يمكن لفريقنا في كشك حلبة الكورنيش إعادة تعيينها لك."),
        long("oauth", 200, "Google or Apple accounts", "حسابات Google أو Apple", "Signed up with Google or Apple? Sign in on the booking app for now.", "سجّلت عبر Google أو Apple؟ سجّل الدخول من تطبيق الحجز حالياً."),
      ],
    },
    {
      id: "home",
      label: bi("Signed in", "بعد تسجيل الدخول"),
      hint: bi("{name} is the rider's first name.", "{name} هو الاسم الأول للراكب."),
      fields: [
        txt("hello", 60, "Greeting", "الترحيب", "Welcome back, {name}", "أهلاً بعودتك، {name}"),
        txt("ridesTitle", 40, "Rides: heading", "الجولات: العنوان", "Your next rides", "جولاتك القادمة"),
        long("noRides", 160, "No ride booked", "لا جولات محجوزة", "No rides booked yet - pick a date and book one.", "لا جولات محجوزة بعد - اختر موعداً واحجز."),
        txt("manage", 50, "Link: booking app", "الرابط: تطبيق الحجز", "Tickets and changes in the booking app", "التذاكر والتعديلات في تطبيق الحجز"),
        txt("clubTitle", 40, "Club card: heading", "بطاقة النادي: العنوان", "Your Club card", "بطاقة النادي"),
      ],
    },
  ],
};
