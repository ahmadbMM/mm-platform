// The unread number's one sentence (W3), apart from w3.text.ts because the badge is in the site's header on every
// page and should carry nothing else there. English and Arabic; every other language translates the English.
export const T = {
  en: { unread: (n: number) => `${n} unread` },
  ar: { unread: (n: number) => `${n} غير مقروءة` },
};
