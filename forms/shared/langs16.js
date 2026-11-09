/* The website's sixteen languages, as the forms list them (forms/shared, read by each form's build): the booking app's
   ten as its shared.js names them, and the six only the website speaks. Gregorian dates and Latin digits in all. */
var LANGS16 = [
 { "code": "en", "short": "EN", "label": "English", "locale": "en-GB-u-ca-gregory" },
 { "code": "ar", "short": "عربي", "label": "العربية", "locale": "ar-u-ca-gregory-nu-latn", "rtl": true },
 { "code": "id", "short": "ID", "label": "Bahasa Indonesia", "locale": "id-ID-u-ca-gregory" },
 { "code": "ms", "short": "MS", "label": "Bahasa Melayu", "locale": "ms-MY-u-ca-gregory" },
 { "code": "de", "short": "DE", "label": "Deutsch", "locale": "de-DE-u-ca-gregory" },
 { "code": "es", "short": "ES", "label": "Español", "locale": "es-ES-u-ca-gregory" },
 { "code": "fr", "short": "FR", "label": "Français", "locale": "fr-FR-u-ca-gregory" },
 { "code": "pt", "short": "PT", "label": "Português", "locale": "pt-BR-u-ca-gregory" },
 { "code": "tl", "short": "TL", "label": "Tagalog", "locale": "fil-PH-u-ca-gregory" },
 { "code": "ru", "short": "RU", "label": "Русский", "locale": "ru-RU-u-ca-gregory" },
 { "code": "ur", "short": "اردو", "label": "اردو", "locale": "ur-PK-u-ca-gregory-nu-latn", "rtl": true },
 { "code": "hi", "short": "HI", "label": "हिन्दी", "locale": "hi-IN-u-ca-gregory-nu-latn" },
 { "code": "ne", "short": "NE", "label": "नेपाली", "locale": "ne-NP-u-ca-gregory-nu-latn" },
 { "code": "bn", "short": "BN", "label": "বাংলা", "locale": "bn-BD-u-ca-gregory-nu-latn" },
 { "code": "zh", "short": "中文", "label": "简体中文", "locale": "zh-CN-u-ca-gregory" },
 { "code": "ja", "short": "日本語", "label": "日本語", "locale": "ja-JP-u-ca-gregory" }
];
/* Lays the sixteen languages and the extra strings over a form's synced SHARED (call after shared.js and site-t-extra.js). */
function mmLangs16(SH) {
  SH.LANGS = LANGS16;
  for (var l in SITE_T_EXTRA) SH.SITE_T[l] = Object.assign({}, SITE_T_EXTRA[l], SH.SITE_T[l] || {});
  return SH;
}
