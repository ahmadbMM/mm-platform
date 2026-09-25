// SignIn's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: { id: "Email or mobile number", pwd: "Password", go: "Sign in", busy: "Signing in…", show: "Show", hide: "Hide",
    errors: { wrong: "That email or mobile and password don't match.", locked: "Too many tries - wait 15 minutes and try again.", missing: "Enter your email or mobile number and your password.", generic: "It could not sign you in. Check the connection and try again.", slow: "Too many tries from this connection - wait a minute and try again.", check: "Please complete the check below, then try again." } as Record<string, string> },
  ar: { id: "البريد الإلكتروني أو رقم الجوال", pwd: "كلمة المرور", go: "تسجيل الدخول", busy: "جارٍ تسجيل الدخول…", show: "إظهار", hide: "إخفاء",
    errors: { wrong: "البريد أو الجوال وكلمة المرور غير متطابقين.", locked: "محاولات كثيرة - انتظر 15 دقيقة وحاول مجدداً.", missing: "أدخل بريدك الإلكتروني أو رقم جوالك وكلمة المرور.", generic: "تعذّر تسجيل الدخول. تحقق من الاتصال وحاول مجدداً.", slow: "محاولات كثيرة من هذا الاتصال - انتظر دقيقة وحاول مجدداً.", check: "يرجى إكمال التحقق أدناه ثم المحاولة مجدداً." } as Record<string, string> },
};
