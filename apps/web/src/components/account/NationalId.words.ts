// The ID or Iqama number card's words in every language the site speaks (NationalIdCard.tsx), kept as
// the blood type's are (BloodType.words.ts): the ten languages the booking app speaks take its own
// wording word for word (nidTitle, nidSub, nidPh, errNatId, saveBtn, accountSaved: English and Arabic
// in app.src.html, the others in its i18n/<code>.json, 2026-10-14). Indonesian, Malay, German, Russian,
// Chinese and Japanese, which the booking app does not speak, follow src/i18n/TRANSLATING.md. Change a
// text here in every language at once.
import type { Locale } from "@/i18n/locales";

export type NationalIdWords = { title: string; sub: string; ph: string; err: string; save: string; saved: string };

export const NATIONAL_ID_WORDS: Record<Locale, NationalIdWords> = {
  en: { title: "ID or Iqama number", sub: "Asked for blood donation events. Only you and our team can see it.", ph: "10 digits", err: "Enter your 10-digit ID or Iqama number.", save: "Save", saved: "Saved." },
  ar: { title: "رقم الهوية أو الإقامة", sub: "يُطلب في فعاليات التبرع بالدم. لا يراه إلا أنت وفريقنا.", ph: "10 أرقام", err: "أدخل رقم الهوية أو الإقامة المكوّن من 10 أرقام.", save: "حفظ", saved: "تم الحفظ." },
  id: { title: "Nomor KTP atau Iqama", sub: "Diminta untuk acara donor darah. Hanya Anda dan tim kami yang dapat melihatnya.", ph: "10 digit", err: "Masukkan nomor KTP atau Iqama Anda yang 10 digit.", save: "Simpan", saved: "Tersimpan." },
  ms: { title: "Nombor ID atau Iqama", sub: "Diminta untuk acara derma darah. Hanya anda dan pasukan kami yang boleh melihatnya.", ph: "10 digit", err: "Masukkan nombor ID atau Iqama anda yang 10 digit.", save: "Simpan", saved: "Disimpan." },
  de: { title: "Ausweis- oder Iqama-Nummer", sub: "Wird für Blutspendeaktionen benötigt. Nur du und unser Team können sie sehen.", ph: "10 Ziffern", err: "Gib deine 10-stellige Ausweis- oder Iqama-Nummer ein.", save: "Speichern", saved: "Gespeichert." },
  es: { title: "Número de identidad o Iqama", sub: "Se pide para los eventos de donación de sangre. Solo tú y nuestro equipo pueden verlo.", ph: "10 dígitos", err: "Escribe tu número de identidad o Iqama de 10 dígitos.", save: "Guardar", saved: "Guardado." },
  fr: { title: "Numéro d’identité ou d’Iqama", sub: "Demandé pour les collectes de sang. Seuls vous et notre équipe pouvez le voir.", ph: "10 chiffres", err: "Saisissez votre numéro d’identité ou d’Iqama à 10 chiffres.", save: "Enregistrer", saved: "Enregistré." },
  pt: { title: "Número de identidade ou Iqama", sub: "Pedido nos eventos de doação de sangue. Só você e a nossa equipe podem ver.", ph: "10 dígitos", err: "Digite seu número de identidade ou Iqama de 10 dígitos.", save: "Salvar", saved: "Salvo." },
  tl: { title: "ID o Iqama number", sub: "Hinihingi para sa mga blood donation event. Ikaw at ang aming team lang ang makakakita nito.", ph: "10 digit", err: "Ilagay ang iyong 10-digit na ID o Iqama number.", save: "I-save", saved: "Na-save." },
  ru: { title: "Номер удостоверения личности или икамы", sub: "Нужен для акций по сдаче крови. Его видите только вы и наша команда.", ph: "10 цифр", err: "Введите 10-значный номер удостоверения личности или икамы.", save: "Сохранить", saved: "Сохранено." },
  ur: { title: "شناختی کارڈ یا اقامہ نمبر", sub: "خون کے عطیے کی تقریبات کے لیے پوچھا جاتا ہے۔ اسے صرف آپ اور ہماری ٹیم دیکھ سکتی ہے۔", ph: "10 ہندسے", err: "اپنا 10 ہندسوں کا شناختی کارڈ یا اقامہ نمبر درج کریں۔", save: "محفوظ کریں", saved: "محفوظ ہو گیا۔" },
  hi: { title: "आईडी या इक़ामा नंबर", sub: "रक्तदान कार्यक्रमों के लिए पूछा जाता है। इसे केवल आप और हमारी टीम देख सकती है।", ph: "10 अंक", err: "अपना 10 अंकों का आईडी या इक़ामा नंबर दर्ज करें।", save: "सहेजें", saved: "सहेजा गया।" },
  ne: { title: "परिचयपत्र वा इकामा नम्बर", sub: "रक्तदान कार्यक्रमहरूका लागि सोधिन्छ। यो तपाईं र हाम्रो टोलीले मात्र देख्न सक्छ।", ph: "10 अङ्क", err: "आफ्नो 10 अङ्कको परिचयपत्र वा इकामा नम्बर लेख्नुहोस्।", save: "सेभ", saved: "सुरक्षित भयो।" },
  bn: { title: "আইডি বা ইকামা নম্বর", sub: "রক্তদান অনুষ্ঠানের জন্য চাওয়া হয়। শুধু আপনি এবং আমাদের টিম এটি দেখতে পারে।", ph: "10 অঙ্ক", err: "আপনার 10 অঙ্কের আইডি বা ইকামা নম্বর লিখুন।", save: "সংরক্ষণ করুন", saved: "সেভ হয়েছে।" },
  zh: { title: "身份证或居留证（Iqama）号码", sub: "献血活动需要提供。只有您和我们的团队可以看到。", ph: "10 位数字", err: "请输入您的 10 位身份证或居留证（Iqama）号码。", save: "保存", saved: "已保存。" },
  ja: { title: "IDまたはイカマ番号", sub: "献血イベントのためにお伺いしています。ご本人と当チームだけが見られます。", ph: "10桁", err: "10桁のIDまたはイカマ番号を入力してください。", save: "保存", saved: "保存しました。" },
};

export const nationalIdWords = (locale: string): NationalIdWords => NATIONAL_ID_WORDS[locale as Locale] ?? NATIONAL_ID_WORDS.en;
