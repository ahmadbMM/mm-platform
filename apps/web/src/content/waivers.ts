import type { L } from "@/i18n/tx";

// The booking app's three waivers, word for word in English and Arabic (app.src.html waiverTitle,
// waiverBody, waiverAgree, swimWaiver* and activityWaiver*, as of its 1c230561 on 2026-10-04: the
// rider is also responsible for any damage they cause to other people or their property). Every
// other language translates the English (src/i18n/tx); the ten languages the booking app speaks
// take its own wording. Each waiver carries the version the booking app stamps on a row agreed
// under it (WAIVER_VERSION, SWIM_WAIVER_VERSION, ACTIVITY_WAIVER_VERSION): change a text only with
// the booking app's, and its version with it, so a row's waiver_version names the words the rider read.
export type WaiverKind = "ride" | "swim" | "activity";
export const WAIVER_VERSIONS: Readonly<Record<WaiverKind, string>> = { ride: "2026-10-v3", swim: "swim-2026-10-v3", activity: "activity-2026-10-v2" };

export type WaiverCopy = { title: string; body: string; agree: string };

/** A waiver's words in the page's language (the booking app's _waiverCopy): it names its own
 *  activity, so a swimmer never agrees to a "Ride waiver" on behalf of every "rider". */
export function waiverCopy(kind: WaiverKind, tx: L): WaiverCopy {
  if (kind === "swim") return {
    title: tx("Swim waiver", "إقرار السباحة"),
    body: tx(
      "You cannot book any swim or activity with MicroMobility until you have read and agreed to this waiver. Swimming carries risk. I confirm that I can swim unaided, and I take part entirely at my own risk: I alone am responsible for myself, my safety, any medical condition that affects my ability to swim, and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to follow the team’s and the venue’s instructions and to stay within the supervised area.",
      "لا يمكنك حجز أي جلسة سباحة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. السباحة تنطوي على مخاطر، وأؤكد قدرتي على السباحة دون مساعدة، وأشارك على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وأي حالة صحية تؤثر على قدرتي على السباحة وعن ممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بالالتزام بتعليمات الفريق وإدارة الموقع والبقاء ضمن المنطقة الخاضعة للإشراف.",
    ),
    agree: tx("I have read the waiver and agree on behalf of everyone on this booking", "قرأت الإقرار وأوافق نيابةً عن كل شخص في هذا الحجز"),
  };
  if (kind === "activity") return {
    title: tx("Activity waiver", "إقرار المشاركة"),
    body: tx(
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Every activity we run carries some risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to follow the team’s and the venue’s instructions.",
      "لا يمكنك حجز أي رحلة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. كل نشاط ننظّمه ينطوي على قدر من المخاطر، وأشارك فيه على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بالالتزام بتعليمات الفريق وإدارة الموقع.",
    ),
    agree: tx("I have read the waiver and agree on behalf of everyone on this booking", "قرأت الإقرار وأوافق نيابةً عن كل شخص في هذا الحجز"),
  };
  return {
    title: tx("Ride waiver", "إقرار الركوب"),
    body: tx(
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.",
      "لا يمكنك حجز أي رحلة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. ركوب الدراجة نشاط بدني ينطوي على مخاطر، وأشارك فيه على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بارتداء الخوذة والالتزام بتعليمات الفريق والمسار، وأتحمل مسؤولية أي ضرر يلحق بالدراجة المستأجرة نتيجة سوء الاستخدام، وتُعاد الدراجة بحالتها عند الاستلام.",
    ),
    agree: tx("I have read the waiver and agree on behalf of every rider on this booking", "قرأت الإقرار وأوافق نيابةً عن كل راكب في هذا الحجز"),
  };
}
