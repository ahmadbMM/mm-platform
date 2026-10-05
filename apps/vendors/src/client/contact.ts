// MicroMobility's own contact, as the website's footer gives it (apps/web SiteFooter and the
// site.contact defaults in apps/web/src/content/pages/site.ts): the email, the phone and its WhatsApp.

export const MM_EMAIL = "info@micromobility.sa";
export const MM_PHONE = "+966566668818";
/** The phone as people read it. */
export const MM_PHONE_TEXT = "+966 56 666 8818";
const MM_WA = "966566668818";

/** A WhatsApp chat with MicroMobility, the message typed in. */
export const waLink = (text: string) => `https://wa.me/${MM_WA}?text=${encodeURIComponent(text)}`;

/** An email to MicroMobility with its subject and body filled in. */
export const mailLink = (subject: string, body: string) =>
  `mailto:${MM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
