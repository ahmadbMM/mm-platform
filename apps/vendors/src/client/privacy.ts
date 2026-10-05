// The privacy notice for venue logins (#privacy, linked from the footer, open signed in or out).
//
// DRAFT - PENDING OWNER APPROVAL (2026-10-04). Written from what the portal and its database
// (rentals migrations 20261003150000 ... 20261004130000) actually hold. The retention periods marked
// "proposed" are suggestions for the owner to confirm or change. Until the owner approves it the page
// says it is a draft, and nobody is asked to accept it (no acceptance gate, on purpose).

import { app } from "./app";
import { MM_EMAIL } from "./contact";
import { clear, h } from "./dom";
import type { Lang } from "./strings";

export const PRIVACY_STATUS = "draft" as const;
export const PRIVACY_VERSION = "2026-10-04-draft";

type Section = { title: string; items: string[] };
type Notice = { title: string; draft: string; intro: string; sections: Section[]; back: string };

const NOTICE: Record<Lang, Notice> = {
  en: {
    title: "Privacy notice for venue logins",
    draft: "Draft: this notice is waiting for MicroMobility's approval and may change.",
    intro: "MicroMobility runs this portal so cafés and restaurants can host the breakfast after our Saturday social ride. This notice explains what personal data the portal keeps about the people who sign in for a venue, why, for how long, and your rights under Saudi Arabia's Personal Data Protection Law (PDPL).",
    sections: [
      { title: "What we keep", items: [
        "The venue's contact person: name, mobile number and email, as the venue or MicroMobility entered them.",
        "Your login: your email or mobile number, your name, your role (owner, manager or viewer), whether the login is active, and when you last signed in. Your password is stored only as a one-way hash that nobody can read.",
        "Your signed-in devices: when each sign-in started and was last used, when it expires, and the browser's description (user agent). The sign-in token itself is kept only as a hash.",
        "Failed sign-in attempts: a count per login, used to pause sign-in after repeated failures.",
        "What you do in the portal: the dates you request or cancel (with the reason you give), your notes, your feedback after a breakfast, and an audit record of who changed each booking and when.",
      ] },
      { title: "Why we use it", items: [
        "To run the breakfast programme with your venue: dates, confirmations, cancellations and the ride's breakfast stop.",
        "To contact the venue about its bookings, including on the day of a breakfast.",
        "To keep the portal secure: sign-in, sign-out, password changes and stopping repeated failed attempts.",
        "Our basis is the agreement between your venue and MicroMobility, and our legitimate interest in keeping the service secure.",
      ] },
      { title: "Who sees it", items: [
        "MicroMobility staff who manage venues.",
        "Our service providers, only to run the portal: Supabase (the database) and Cloudflare (the portal's hosting).",
        "Riders see your venue's name, map link and offer for riders, never your personal contact details or login.",
        "We do not sell personal data.",
      ] },
      { title: "How long we keep it", items: [
        "Sign-in sessions end after 30 days, or after 14 days without use, and are then deleted when you next sign in or sooner.",
        "Failed sign-in counts reset after a successful sign-in, and after a day without failures.",
        "Logins, contact details and booking records: while your venue works with MicroMobility, then for up to 2 years for our records (proposed, to be confirmed).",
      ] },
      { title: "Your rights", items: [
        "Under the PDPL you may ask to be told how your data is used, to get a copy of it, to have it corrected or completed, and to have it deleted when we no longer need it.",
        "You may also withdraw consent where we rely on it, and complain to the Saudi Data and AI Authority (SDAIA).",
        `To use any of these rights, email ${MM_EMAIL}. We answer within 30 days.`,
      ] },
    ],
    back: "Back to the portal",
  },
  ar: {
    title: "إشعار الخصوصية لحسابات المنشآت",
    draft: "مسودة: هذا الإشعار بانتظار اعتماد مايكروموبيليتي وقد يتغيّر.",
    intro: "تدير مايكروموبيليتي هذه البوابة لتستضيف المقاهي والمطاعم فطور ما بعد جولة السبت الاجتماعية. يوضّح هذا الإشعار البيانات الشخصية التي تحفظها البوابة عن الأشخاص الذين يسجّلون الدخول باسم منشأة، وسبب ذلك، ومدته، وحقوقك بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية.",
    sections: [
      { title: "ما نحفظه", items: [
        "بيانات مسؤول التواصل في المنشأة: الاسم ورقم الجوال والبريد الإلكتروني كما أدخلتها المنشأة أو مايكروموبيليتي.",
        "حسابك: بريدك أو رقم جوالك، واسمك، ودورك (مالك أو مدير أو مُطّلع)، وحالة الحساب، وآخر تسجيل دخول. تُحفظ كلمة المرور بصيغة مشفّرة باتجاه واحد لا يمكن لأحد قراءتها.",
        "أجهزتك المسجّل دخولها: وقت بدء كل تسجيل دخول وآخر استخدام له وموعد انتهائه، ووصف المتصفح. ويُحفظ رمز الدخول نفسه بصيغة مشفّرة فقط.",
        "محاولات الدخول الفاشلة: عددها لكل حساب، لإيقاف الدخول مؤقتًا بعد تكرار الفشل.",
        "ما تقوم به في البوابة: التواريخ التي تطلبها أو تلغيها (مع السبب الذي تذكره)، وملاحظاتك، وتقييمك بعد الفطور، وسجل يبيّن من غيّر كل حجز ومتى.",
      ] },
      { title: "لماذا نستخدمها", items: [
        "لإدارة برنامج الفطور مع منشأتك: التواريخ والتأكيدات والإلغاءات ومحطة الفطور في الجولة.",
        "للتواصل مع المنشأة بشأن حجوزاتها، بما في ذلك يوم الفطور.",
        "لحماية البوابة: تسجيل الدخول والخروج وتغيير كلمة المرور ومنع المحاولات الفاشلة المتكررة.",
        "أساس ذلك الاتفاق بين منشأتك ومايكروموبيليتي، ومصلحتنا المشروعة في حماية الخدمة.",
      ] },
      { title: "من يطّلع عليها", items: [
        "موظفو مايكروموبيليتي المسؤولون عن المنشآت.",
        "مزوّدو خدماتنا لتشغيل البوابة فقط: Supabase (قاعدة البيانات) وCloudflare (استضافة البوابة).",
        "يرى الدرّاجون اسم منشأتك ورابط موقعها وعرضها لهم، ولا يرون بيانات التواصل الشخصية أو بيانات الدخول.",
        "لا نبيع البيانات الشخصية.",
      ] },
      { title: "مدة الحفظ", items: [
        "تنتهي جلسات الدخول بعد 30 يومًا، أو بعد 14 يومًا دون استخدام، ثم تُحذف.",
        "يُصفَّر عدد المحاولات الفاشلة بعد دخول ناجح، وبعد يوم دون محاولات فاشلة.",
        "الحسابات وبيانات التواصل وسجلات الحجز: طوال تعاون منشأتك مع مايكروموبيليتي، ثم حتى سنتين لسجلاتنا (مقترح، بانتظار التأكيد).",
      ] },
      { title: "حقوقك", items: [
        "بموجب النظام يحق لك أن تعرف كيف تُستخدم بياناتك، وأن تحصل على نسخة منها، وأن تطلب تصحيحها أو استكمالها، وأن تطلب حذفها متى انتهت الحاجة إليها.",
        "ويحق لك سحب موافقتك حيث نعتمد عليها، وتقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).",
        `لممارسة أي من هذه الحقوق راسلنا على ${MM_EMAIL}، ونرد خلال 30 يومًا.`,
      ] },
    ],
    back: "العودة إلى البوابة",
  },
};

/** Draws the notice into main; signedOut: the way back is the sign-in page. */
export function renderPrivacy(main: HTMLElement, signedOut: boolean): void {
  const n = NOTICE[app.lang];
  clear(main);
  main.append(h("article", { class: "card privacy", "aria-labelledby": "privacy-title", "data-version": PRIVACY_VERSION },
    h("h1", { id: "privacy-title" }, n.title),
    PRIVACY_STATUS === "draft" ? h("p", { class: "note note-warn", role: "note" }, h("span", {}, n.draft)) : null,
    h("p", { class: "lede" }, n.intro),
    ...n.sections.flatMap((s) => [h("h2", {}, s.title), h("ul", { class: "privacy-list" }, ...s.items.map((x) => h("li", {}, x)))]),
    h("p", {}, h("a", { href: signedOut ? "#" : "#calendar", class: "btn btn-ghost btn-small" }, h("span", {}, n.back)))));
}
