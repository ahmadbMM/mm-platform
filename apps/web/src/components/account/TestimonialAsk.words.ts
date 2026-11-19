// The one-time ask about an old 9 or 10 comment (the booking app's rider-testimonial.js, TST_T askT, askYes, askNo).
// In every language the site speaks: the ten the booking app speaks take its own words, word for word; Indonesian,
// Malay, German, Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Generated once
// from the booking app's files; change a text in every language at once.
import type { Locale } from "@/i18n/locales";

export type TmAskWords = { askT: string; askYes: string; askNo: string };

export const TM_ASK_WORDS: Record<Locale, TmAskWords> = {
  en: {"askT":"May we publish your words?","askYes":"Publish it","askNo":"No thanks"},
  ar: {"askT":"هل تسمح لنا بنشر كلماتك؟","askYes":"انشرها","askNo":"لا، شكراً"},
  fr: {"askT":"Pouvons-nous publier vos mots ?","askYes":"Publiez-le","askNo":"Non merci"},
  es: {"askT":"¿Podemos publicar tus palabras?","askYes":"Publícalo","askNo":"No, gracias"},
  pt: {"askT":"Podemos publicar as suas palavras?","askYes":"Publiquem","askNo":"Não, obrigado"},
  ur: {"askT":"کیا ہم آپ کے الفاظ شائع کر سکتے ہیں؟","askYes":"شائع کریں","askNo":"نہیں، شکریہ"},
  hi: {"askT":"क्या हम आपके शब्द प्रकाशित कर सकते हैं?","askYes":"प्रकाशित करें","askNo":"नहीं, धन्यवाद"},
  tl: {"askT":"Puwede ba naming ilathala ang mga salita mo?","askYes":"Ilathala ito","askNo":"Huwag na, salamat"},
  ne: {"askT":"के हामी तपाईंका शब्दहरू प्रकाशित गर्न सक्छौं?","askYes":"प्रकाशित गर्नुहोस्","askNo":"पर्दैन, धन्यवाद"},
  bn: {"askT":"আমরা কি আপনার কথাগুলো প্রকাশ করতে পারি?","askYes":"প্রকাশ করুন","askNo":"না, ধন্যবাদ"},
  de: {"askT":"Dürfen wir deine Worte veröffentlichen?","askYes":"Veröffentlichen","askNo":"Nein danke"},
  id: {"askT":"Bolehkah kami menerbitkan kata-kata Anda?","askYes":"Terbitkan","askNo":"Tidak, terima kasih"},
  ja: {"askT":"あなたの言葉を掲載してもよろしいですか？","askYes":"掲載する","askNo":"結構です"},
  ms: {"askT":"Bolehkah kami menerbitkan kata-kata anda?","askYes":"Terbitkan","askNo":"Tidak, terima kasih"},
  ru: {"askT":"Можно опубликовать ваши слова?","askYes":"Опубликовать","askNo":"Нет, спасибо"},
  zh: {"askT":"我们可以发布您的这段话吗？","askYes":"发布","askNo":"不用了，谢谢"},
};

export const tmAskWords = (locale: string): TmAskWords => TM_ASK_WORDS[locale as Locale] ?? TM_ASK_WORDS.en;
