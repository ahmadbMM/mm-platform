// ChangePassword's own words, in English and Arabic - the booking app's own for its forced change
// (pwdMustTitle, pwdMustSub, pwdMustNew, pwdMustSave, pwdMustSame) and the sign-up's password rule (errPasswordLen,
// errPasswordCommon, errPasswordOld, fixPwHint); every other language translates the English (src/i18n/tx).
export const T = {
  en: {
    title: "Choose your own password",
    sub: "You signed in with a temporary password from our team. Choose your own password to continue.",
    pwd: "New password",
    hint: "At least 8 characters.",
    save: "Save password", saving: "Saving…", back: "Back",
    errors: {
      weak: "Use at least 8 characters.",
      common: "This password is too easy to guess. Choose another.",
      old: "Use at least 8 characters, with an upper-case letter and a number.",
      same: "Choose a password different from the temporary one.",
      expired: "Your sign-in has timed out. Please sign in again.",
      generic: "It could not be sent. Check the connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    title: "اختر كلمة مرورك الخاصة",
    sub: "سجّلت الدخول بكلمة مرور مؤقتة من فريقنا. اختر كلمة مرورك الخاصة للمتابعة.",
    pwd: "كلمة المرور الجديدة",
    hint: "8 أحرف على الأقل.",
    save: "حفظ كلمة المرور", saving: "جارٍ الحفظ…", back: "رجوع",
    errors: {
      weak: "استخدم 8 أحرف على الأقل.",
      common: "كلمة المرور هذه سهلة التخمين. اختر كلمة مرور أخرى.",
      old: "استخدم 8 أحرف على الأقل، منها حرف إنجليزي كبير (A-Z) ورقم.",
      same: "اختر كلمة مرور مختلفة عن كلمة المرور المؤقتة.",
      expired: "انتهت مهلة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.",
    } as Record<string, string>,
  },
};
