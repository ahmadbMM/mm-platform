// MessageForm's own words, in English and Arabic; every other language translates the English
// (src/i18n/tx), a sentence with values in it as its template.
export const T = {
  en: {
    name: "Name", company: "Company", email: "Email", phone: "Mobile", message: "Message", sending: "Sending…",
    placeholderBiz: "What would you like to build with us?", placeholderHelp: "How can we help?", ref: "Reference", another: "Send another",
    errors: {
      name: "Enter your name - letters and spaces only.", email: "Check the email address.", phone: "Check the mobile number, e.g. 05XXXXXXXX.",
      contact: "Add an email or a mobile number so we can answer.", message: "Write your message.", throttled: "Too many messages from this network - try again in a few minutes.",
      generic: "It could not be sent. Check the connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    name: "الاسم", company: "الشركة", email: "البريد الإلكتروني", phone: "الجوال", message: "الرسالة", sending: "جارٍ الإرسال…",
    placeholderBiz: "ماذا تريد أن تبني معنا؟", placeholderHelp: "كيف نقدر نساعدك؟", ref: "رقم الرسالة", another: "رسالة أخرى",
    errors: {
      name: "أدخل اسمك - حروف ومسافات فقط.", email: "تحقق من البريد الإلكتروني.", phone: "تحقق من رقم الجوال، مثل 05XXXXXXXX.",
      contact: "أضف بريداً إلكترونياً أو رقم جوال لنرد عليك.", message: "اكتب رسالتك.", throttled: "رسائل كثيرة من هذه الشبكة - حاول بعد دقائق.",
      generic: "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.",
    } as Record<string, string>,
  },
};
