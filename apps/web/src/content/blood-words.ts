import type { L } from "@/i18n/tx";

// The Blood Donation event's words (lib/blood.ts), in English and Arabic exactly as the booking app writes them (its
// LANG en/ar keys named beside each); every other language translates the English (src/i18n/tx), the eight more the
// booking app speaks in its own wording. They live here, on the server, and the event stays unnamed until a session
// exists: this file is never imported by a browser component and is no *.text.ts, whose words go to every page's browser
// in its dictionary (src/i18n/extract.ts); no field of the Website editor either, whose schema is public (api/site-schema).
// A page or a route hands them on only for a session or a booking on one. The event never says ride, rider or bike
// except in the free ride's own words (bldCause, bldReward*).

/** The kind's name in English: a session staff titled just this reads in the page's language (lib/rides.ts sessionName). */
export const BLOOD_NAME = "Micromobility Blood Donation";
/** The kind's name in the page's language (evBloodName), for lib/rides.ts kindNames' readers. */
export const bloodName = (tx: L): string => tx("Micromobility Blood Donation", "مايكروموبيليتي التبرع بالدم");

export { BLOOD_PLATE_SIZE, bloodPlate } from "./blood-plate";
/** The owner's picture of a donor's arm that fills the card (2026-11-04; the booking app's .bld-card-img). */
export const BLOOD_CARD = { src: "/site/blood-card.webp", width: 1200, height: 862 };

export function bloodWords(tx: L) {
  return {
    name: bloodName(tx),
    cause: tx("Give blood. Ride free.", "تبرّع بدمك واركب مجانًا."), // bldCause
    typesLine: tx("Different types. One purpose.", "فصائل مختلفة. هدف واحد."), // bldTypesLine
    types: ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"], // the card's tiles (BLOOD_TYPES, _btLabel)
    plateAlt: tx("MicroMobility, Health Services at the Ministry of Defense, Jeddah Corniche Circuit, Saudi Motorsport Company, Ministry of Sport", "مايكروموبيليتي، الخدمات الصحية بوزارة الدفاع، حلبة كورنيش جدة، شركة رياضة المحركات السعودية، وزارة الرياضة"), // bldPartnersAlt
    // the four short rules (bldSumAge, bldSumWeight, bldSumId, bldSumTips)
    rules: [
      tx("Age 18 or over", "العمر 18 سنة فأكثر"),
      tx("Weight 50 kg or more", "الوزن 50 كجم فأكثر"),
      tx("Bring your national ID or Iqama", "أحضر الهوية الوطنية أو الإقامة"),
      tx("Sleep well and eat a healthy meal two hours before", "نم جيدًا وتناول وجبة صحية قبل التبرع بساعتين"),
    ],
    infoTitle: tx("Before you donate", "قبل التبرع"), // bldInfoTitle
    infoPdf: tx("Download the poster (PDF)", "تنزيل الملصق (PDF)"), // bldInfoPdf
    language: tx("Language", "اللغة"),
    // the ticket: bldNumLabel, bldColDonor, and the free ride (bldRewardNote, bldRewardTitle, bldRewardTxt, bldRewardUsed)
    numLabel: tx("Donor number", "رقم المتبرع"),
    donor: tx("Donor", "المتبرع"),
    rewardNote: tx("Checked-in donors confirmed by our team get one free ride on any bike except Carbon, valid for one month, on circuit rides (Petromin nights for Community and Petromin accounts). Avoid hard exercise for 5 hours after donating, so ride another day.", "يحصل المتبرعون الذين سجلوا حضورهم وأكد فريقنا تبرعهم على ركوبة مجانية واحدة بأي دراجة عدا الكربون، صالحة لمدة شهر، في جلسات الحلبة (وليالي بترومين لحسابات المجتمع وبترومين). تجنب النشاط الشاق لمدة 5 ساعات بعد التبرع، فاركب في يوم آخر."),
    rewardTitle: tx("Your free ride", "ركوبتك المجانية"),
    rewardTxt: tx("Thank you for donating. Enter this code when you book. Valid until {0}.", "شكرًا لتبرعك. أدخل هذا الرمز عند الحجز. صالح حتى {0}."),
    rewardUsed: tx("Your free ride has been used. Thank you for donating.", "تم استخدام ركوبتك المجانية. شكرًا لتبرعك."),
    // the pop-up that asks for its agreement (bldWgKicker, bldWgSub; the agreement's own words are content/waivers.ts)
    gate: {
      kicker: tx("Agreement needed", "إقرار مطلوب"),
      sub: tx("You’re registered for this event. Read this agreement and agree to it to continue.", "أنت مسجّل في هذه الفعالية. اقرأ هذا الإقرار ووافق عليه للمتابعة."),
    },
    // the pop-up that asks to share the donor's details with partners and third parties, naming nobody, the owner, 2026-11-04 (bldShKicker, bldShTitle, bldShSub, bldShNote,
    // bldShAgree; the items are the booking app's: rshName, vlShPhone, authEmail, btTitle, birthDateLabel, nationalityLabel)
    share: {
      kicker: tx("Before you register", "قبل التسجيل"),
      title: tx("Sharing your details", "مشاركة بياناتك"),
      sub: tx("To register, agree that we share these details with our event partners and third parties:", "للتسجيل، وافق على مشاركة هذه البيانات مع شركائنا في الفعالية وأطراف ثالثة:"),
      note: tx("We share them only with our partners and third parties for this event, and nothing else about you.", "نشاركها فقط مع شركائنا وأطراف ثالثة لهذه الفعالية، ولا نشارك أي شيء آخر عنك."),
      agree: tx("I agree that MicroMobility shares my details with its partners and third parties for this event.", "أوافق على أن تشارك مايكروموبيليتي بياناتي مع شركائها وأطراف ثالثة لهذه الفعالية."),
      items: [
        tx("Full name", "الاسم الكامل"),
        tx("Mobile number", "رقم الجوال"),
        tx("Email address", "البريد الإلكتروني"),
        tx("Blood type", "فصيلة الدم"),
        tx("Birth date", "تاريخ الميلاد"),
        tx("Nationality", "الجنسية"),
      ],
    },
  };
}
export type BloodWords = ReturnType<typeof bloodWords>;
