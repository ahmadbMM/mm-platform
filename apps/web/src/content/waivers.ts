import type { L } from "@/i18n/tx";
import { farmWaiverCopy } from "./farm-words";

// The booking app's three waivers, word for word in English and Arabic (app.src.html waiverTitle,
// waiverBody, waiverAgree, swimWaiver* and activityWaiver*, as of its 1c230561 on 2026-10-04: the
// rider is also responsible for any damage they cause to other people or their property). Every
// other language translates the English (src/i18n/tx); the ten languages the booking app speaks
// take its own wording. Each waiver carries the version the booking app stamps on a row agreed
// under it (WAIVER_VERSION, SWIM_WAIVER_VERSION, ACTIVITY_WAIVER_VERSION): change a text only with
// the booking app's, and its version with it, so a row's waiver_version names the words the rider read. The Blood
// Donation event (2026-11-03) is agreed under its own agreement (bldWaiverTitle, bldWaiverBody, bldWaiverAgree;
// BLD_WAIVER_VERSION; the owner: "there is no activity involved"), never the activity waiver's words: the hosts' medical
// team does the donation, so it releases MicroMobility and its staff only.
// Waivers for everyone on a booking (the booking app's 46689058, 2026-11-13: "update all waivers especially the nawar farm
// house session"): the ride, swim and activity waivers end with the sentence a booking for other people needs (the one who
// books accepts for each of them and may do so, and is the parent or legal guardian of every child on it, or has the
// guardian's permission, and supervises them), versions 2026-11-v4, swim-2026-11-v4 and activity-2026-11-v4; the database
// refuses an older one once its migration 20261114160000 runs. The Farm House Night has its own, farm-2026-11-v1, its words
// the server's with the rest of the night's (content/farm-words.ts farmWaiverCopy): the night is for members' eyes alone.
// The Blood Donation event's agreements are unchanged.
export type WaiverKind = "ride" | "swim" | "activity" | "blood" | "farm";
export const WAIVER_VERSIONS: Readonly<Record<WaiverKind, string>> = { ride: "2026-11-v4", swim: "swim-2026-11-v4", activity: "activity-2026-11-v4", blood: "blood-2026-11-v1", farm: "farm-2026-11-v1" };

export type WaiverCopy = { title: string; body: string; agree: string };

/** A visitor's own agreement on the Blood Donation event, and the version a row agreed under it carries (the booking app's
 *  bldVisWaiver*, BLD_VIS_WAIVER_VERSION; the owner, 2026-11-05: "make them their own wording"). */
export const BLOOD_VISITOR_VERSION = "blood-2026-11-v2";
export function bloodVisitorCopy(tx: L): WaiverCopy {
  return {
    title: tx("Visitor agreement", "إقرار الزائر"),
    body: tx(
      "You cannot register for this event until you have read and agreed to this. I am coming to this event as a visitor and will not give blood. I will follow the instructions of the event’s team and the venue’s. If I decide to donate at the event, I will tell the team first: the donation is then a medical procedure carried out by the event’s medical team, not by MicroMobility, and only that team decides whether I can donate. MicroMobility’s part is only to register me and to give checked-in visitors their free ride. I am responsible for my personal belongings. To the fullest extent permitted by law, MicroMobility and its staff are not responsible for any medical procedure or its effects, or for any injury, illness, loss, theft or damage at the event.",
      "لا يمكنك التسجيل في هذه الفعالية إلا بعد قراءة هذا الإقرار والموافقة عليه. سأحضر هذه الفعالية كزائر ولن أتبرع بالدم. وأتعهد باتباع تعليمات فريق الفعالية وتعليمات إدارة الموقع. وإذا قررت التبرع في الفعالية فسأُبلغ الفريق أولًا، ويكون التبرع عندئذٍ إجراءً طبيًا يقوم به الفريق الطبي للفعالية، وليس مايكروموبيليتي، والفريق الطبي وحده هو من يقرر ما إذا كان بإمكاني التبرع. ويقتصر دور مايكروموبيليتي على تسجيلي ومنح الزوار الذين سجّلوا حضورهم ركوبتهم المجانية. وأنا مسؤول عن ممتلكاتي الشخصية. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها أي مسؤولية عن أي إجراء طبي أو آثاره، أو عن أي إصابة أو مرض أو فقدان أو سرقة أو تلف في الفعالية.",
    ),
    agree: tx("I have read this and I agree", "قرأت هذا الإقرار وأوافق عليه"),
  };
}

/** A waiver's words in the page's language (the booking app's _waiverCopy): it names its own
 *  activity, so a swimmer never agrees to a "Ride waiver" on behalf of every "rider". */
export function waiverCopy(kind: WaiverKind, tx: L): WaiverCopy {
  if (kind === "farm") return farmWaiverCopy(tx);
  if (kind === "blood") return {
    title: tx("Donor agreement", "إقرار المتبرع"),
    body: tx(
      "You cannot register for this event until you have read and agreed to this. Giving blood is voluntary, and I can withdraw at any time without giving a reason. The donation is a medical procedure carried out by the event’s medical team, not by MicroMobility. Only the medical team decides whether I can donate, so registering does not guarantee that I will. I will answer their health questions truthfully and follow their instructions and the venue’s, including resting after I donate and avoiding hard exercise for 5 hours. MicroMobility’s part is only to register me and to give confirmed donors their free ride. I am responsible for my personal belongings. To the fullest extent permitted by law, MicroMobility and its staff are not responsible for the medical procedure or its effects, or for any injury, illness, loss, theft or damage at the event.",
      "لا يمكنك التسجيل في هذه الفعالية إلا بعد قراءة هذا الإقرار والموافقة عليه. التبرع بالدم عمل تطوعي، ويمكنني الانسحاب في أي وقت دون إبداء أي سبب. والتبرع إجراء طبي يقوم به الفريق الطبي للفعالية، وليس مايكروموبيليتي. والفريق الطبي وحده هو من يقرر ما إذا كان بإمكاني التبرع، ولذلك فإن التسجيل لا يضمن قبول تبرعي. وأتعهد بالإجابة بصدق عن أسئلته الصحية وباتباع تعليماته وتعليمات إدارة الموقع، بما في ذلك أخذ قسط من الراحة بعد التبرع وتجنب النشاط البدني الشاق لمدة 5 ساعات. ويقتصر دور مايكروموبيليتي على تسجيلي ومنح المتبرعين المؤكَّدين ركوبتهم المجانية. وأنا مسؤول عن ممتلكاتي الشخصية. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها أي مسؤولية عن الإجراء الطبي أو آثاره، أو عن أي إصابة أو مرض أو فقدان أو سرقة أو تلف في الفعالية.",
    ),
    agree: tx("I have read this and I agree", "قرأت هذا الإقرار وأوافق عليه"),
  };
  if (kind === "swim") return {
    title: tx("Swim waiver", "إقرار السباحة"),
    body: tx(
      "You cannot book any swim or activity with MicroMobility until you have read and agreed to this waiver. Swimming carries risk. I confirm that I can swim unaided, and I take part entirely at my own risk: I alone am responsible for myself, my safety, any medical condition that affects my ability to swim, and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to follow the team’s and the venue’s instructions and to stay within the supervised area. When I book for other people, I accept this waiver on behalf of each of them as well as myself, and I confirm that I am entitled to do so. I am the parent or legal guardian of every child on my booking, or have their guardian’s permission to bring them, and I will supervise them at all times.",
      "لا يمكنك حجز أي جلسة سباحة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. السباحة تنطوي على مخاطر، وأؤكد قدرتي على السباحة دون مساعدة، وأشارك على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وأي حالة صحية تؤثر على قدرتي على السباحة وعن ممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بالالتزام بتعليمات الفريق وإدارة الموقع والبقاء ضمن المنطقة الخاضعة للإشراف. وعندما أحجز لأشخاص آخرين، فإنني أقبل هذا الإقرار نيابةً عن كل واحد منهم إضافةً إلى نفسي، وأؤكد أنني مخوّل بذلك. وأنا وليّ أمر كل طفل في حجزي أو الوصي النظامي عليه، أو لديّ إذن وليّ أمره بإحضاره، وسأشرف عليه طوال الوقت.",
    ),
    agree: tx("I have read the waiver and agree on behalf of everyone on this booking", "قرأت الإقرار وأوافق نيابةً عن كل شخص في هذا الحجز"),
  };
  if (kind === "activity") return {
    title: tx("Activity waiver", "إقرار المشاركة"),
    body: tx(
      "You cannot book any activity with MicroMobility until you have read and agreed to this waiver. Every activity we run carries some risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to follow the team’s and the venue’s instructions. When I book for other people, I accept this waiver on behalf of each of them as well as myself, and I confirm that I am entitled to do so. I am the parent or legal guardian of every child on my booking, or have their guardian’s permission to bring them, and I will supervise them at all times.",
      "لا يمكنك حجز أي نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. كل نشاط ننظّمه ينطوي على قدر من المخاطر، وأشارك فيه على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بالالتزام بتعليمات الفريق وإدارة الموقع. وعندما أحجز لأشخاص آخرين، فإنني أقبل هذا الإقرار نيابةً عن كل واحد منهم إضافةً إلى نفسي، وأؤكد أنني مخوّل بذلك. وأنا وليّ أمر كل طفل في حجزي أو الوصي النظامي عليه، أو لديّ إذن وليّ أمره بإحضاره، وسأشرف عليه طوال الوقت.",
    ),
    agree: tx("I have read the waiver and agree on behalf of everyone on this booking", "قرأت الإقرار وأوافق نيابةً عن كل شخص في هذا الحجز"),
  };
  return {
    title: tx("Ride waiver", "إقرار الركوب"),
    body: tx(
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received. When I book for other people, I accept this waiver on behalf of each of them as well as myself, and I confirm that I am entitled to do so. I am the parent or legal guardian of every child on my booking, or have their guardian’s permission to bring them, and I will supervise them at all times.",
      "لا يمكنك حجز أي رحلة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. ركوب الدراجة نشاط بدني ينطوي على مخاطر، وأشارك فيه على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بارتداء الخوذة والالتزام بتعليمات الفريق والمسار، وأتحمل مسؤولية أي ضرر يلحق بالدراجة المستأجرة نتيجة سوء الاستخدام، وتُعاد الدراجة بحالتها عند الاستلام. وعندما أحجز لأشخاص آخرين، فإنني أقبل هذا الإقرار نيابةً عن كل واحد منهم إضافةً إلى نفسي، وأؤكد أنني مخوّل بذلك. وأنا وليّ أمر كل طفل في حجزي أو الوصي النظامي عليه، أو لديّ إذن وليّ أمره بإحضاره، وسأشرف عليه طوال الوقت.",
    ),
    agree: tx("I have read the waiver and agree on behalf of every rider on this booking", "قرأت الإقرار وأوافق نيابةً عن كل راكب في هذا الحجز"),
  };
}
