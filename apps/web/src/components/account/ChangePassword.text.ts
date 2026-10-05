// ChangePassword's own words, in English and Arabic - the booking app's own for its forced change
// (pwdMustTitle, pwdMustSub, pwdMustNew, pwdMustConfirm, pwdMustSave, pwdMustSame) and the sign-up's
// password rule; every other language translates the English (src/i18n/tx).
export const T = {
  en: {
    title: "Choose your own password",
    sub: "You signed in with a temporary password from our team. Choose your own password to continue.",
    pwd: "New password", pwd2: "Confirm new password",
    hint: "At least 8 characters, with an uppercase letter and a number.",
    save: "Save password", saving: "Saving…", back: "Back",
    errors: {
      weak: "Password must be at least 8 characters and include an uppercase letter and a number.",
      match: "Passwords do not match.",
      same: "Choose a password different from the temporary one.",
      expired: "Your sign-in has timed out. Please sign in again.",
      generic: "It could not be sent. Check the connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    title: "اختر كلمة مرورك الخاصة",
    sub: "سجّلت الدخول بكلمة مرور مؤقتة من فريقنا. اختر كلمة مرورك الخاصة للمتابعة.",
    pwd: "كلمة المرور الجديدة", pwd2: "تأكيد كلمة المرور الجديدة",
    hint: "8 أحرف على الأقل، وتحتوي على حرف كبير ورقم.",
    save: "حفظ كلمة المرور", saving: "جارٍ الحفظ…", back: "رجوع",
    errors: {
      weak: "يجب أن تكون كلمة المرور 8 أحرف على الأقل وتحتوي على حرف كبير ورقم.",
      match: "كلمتا المرور غير متطابقتين.",
      same: "اختر كلمة مرور مختلفة عن كلمة المرور المؤقتة.",
      expired: "انتهت مهلة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.",
    } as Record<string, string>,
  },
};
