import type { L } from "@/i18n/tx";

// The Farm House Night's words (lib/farm.ts), in English and Arabic exactly as the booking app writes them (its LANG en/ar
// keys named beside each); every other language translates the English (src/i18n/tx), the eight more the booking app
// speaks in its own wording. The night is for community members' eyes alone (the user, 2026-11-13: "put it under
// micromobility experiences card not to public"), so its words live here, on the server, as the Blood Donation event's do
// (content/blood-words.ts): this file is never imported by a browser component and is no *.text.ts, whose words go to
// every page's browser in its dictionary (src/i18n/extract.ts); no field of the Website editor either, whose schema is
// public (api/site-schema). A page hands them on only with a farm date it shows a community member, or a booking on one.
// (The ticket's two time words, Arrival and Dinner, are the ticket's own: components/booking/tickets.text.ts.) Its waiver
// too (farmWaiverCopy), which content/waivers.ts waiverCopy hands on for a farm night.

/** The kind's name in English: a session staff titled just this reads in the page's language (lib/rides.ts sessionName). */
export const FARM_NAME = "Farm House Night";
/** The kind's name in the page's language (evFarmName), for lib/rides.ts kindNames' readers. */
export const farmName = (tx: L): string => tx("Farm House Night", "ليلة المزرعة");

export function farmWords(tx: L) {
  return {
    name: farmName(tx),
    arrive: tx("Arrival", "الوصول"), // fhArrive: the first of its two times
    dinner: tx("Dinner", "العشاء"), // fhDinner: the second
    line: tx("Members and their families", "للأعضاء وعائلاتهم"), // fhFamLine: its card's foot line
    who: tx("Community members and their families", "أعضاء المجتمع وعائلاتهم"), // fhWho: who may book it, in its Details
    // infoDtFarm: what its Details say, {gather} its arrival and {start} its dinner (lib/event-info.ts dateText)
    about: tx(
      "An evening at the farm for community members and their families. Arrive from {gather}, enjoy the farm with the community, and stay for dinner at {start}. Add each family member to your booking by name. Our team confirms every request, as for the Saturday ride.",
      "أمسية في المزرعة لأعضاء المجتمع وعائلاتهم. الوصول من {gather}، استمتع بالمزرعة مع المجتمع، وابقَ لتناول العشاء في {start}. أضف كل فرد من عائلتك إلى حجزك باسمه. يؤكّد فريقنا كل طلب، كما في جولة السبت.",
    ),
  };
}
export type FarmWords = ReturnType<typeof farmWords>;

/** The Farm House Night's own waiver (the booking app's fhWaiverTitle, fhWaiverBody, fhWaiverAgree; FARM_WAIVER_VERSION
 *  farm-2026-11-v1, content/waivers.ts WAIVER_VERSIONS.farm; the user, 2026-11-13: "update all waivers especially the
 *  nawar farm house session"): the farm's ground, water and outdoors, its animals, the food and drink, damage by anyone on
 *  the booking, and the family a member brings, each child kept with them and supervised; agreed for oneself and for
 *  everyone on the booking. Here, not among the other waivers' words, for the same reason as the rest of the farm's: the
 *  waiver pop-up (api/account/pending-waiver) hands it to the signed-in booker of a farm night alone. */
export function farmWaiverCopy(tx: L): { title: string; body: string; agree: string } {
  return {
    title: tx("Farm House Night waiver", "إقرار ليلة المزرعة"),
    body: tx(
      "You cannot book the Farm House Night until you have read and agreed to this waiver. An evening on a farm carries some risk: uneven ground, plants and water, the outdoors and its insects, and animals that can bite, kick or scratch. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I will approach, touch or feed the animals only where the farm allows it, and wash my hands afterwards. Food and drink are served at the farm: I will tell the team about any allergy or dietary need before eating, and I eat and drink at my own risk. I am responsible for any damage that I or anyone on my booking causes to other people, the animals or the farm. When I book for my family, I accept this waiver on behalf of each of them as well as myself, and I confirm that I am entitled to do so. I am the parent or legal guardian of every child on my booking, or have their guardian’s permission to bring them, and I will keep them with me and supervise them at all times. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me, to anyone on my booking or to our belongings, including any injury, illness, allergic reaction, loss, theft or damage, however it is caused, during the evening or in connection with it. I agree to follow the team’s and the farm’s instructions and rules.",
      "لا يمكنك حجز ليلة المزرعة إلا بعد قراءة هذا الإقرار والموافقة عليه. الأمسية في المزرعة تنطوي على قدر من المخاطر: أرض غير مستوية، ونباتات ومياه، والأجواء المفتوحة وحشراتها، وحيوانات قد تعضّ أو ترفس أو تخدش. أشارك على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. ولن أقترب من الحيوانات أو ألمسها أو أطعمها إلا حيث تسمح المزرعة بذلك، وسأغسل يديّ بعدها. ويُقدَّم الطعام والشراب في المزرعة: سأبلغ الفريق بأي حساسية أو احتياج غذائي قبل الأكل، وآكل وأشرب على مسؤوليتي. وأنا مسؤول عن أي ضرر ألحقه أنا أو أي شخص في حجزي بالآخرين أو بالحيوانات أو بالمزرعة. وعندما أحجز لعائلتي، فإنني أقبل هذا الإقرار نيابةً عن كل واحد منهم إضافةً إلى نفسي، وأؤكد أنني مخوّل بذلك. وأنا وليّ أمر كل طفل في حجزي أو الوصي النظامي عليه، أو لديّ إذن وليّ أمره بإحضاره، وسأبقيه معي وأشرف عليه طوال الوقت. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لأي شخص في حجزي أو لممتلكاتنا، بما في ذلك أي إصابة أو مرض أو تحسّس أو فقدان أو سرقة أو تلف، أيًّا كان سببه، خلال الأمسية أو بسببها. وأتعهد بالالتزام بتعليمات الفريق والمزرعة وقواعدهما.",
    ),
    agree: tx("I have read the waiver and agree for myself and on behalf of everyone on this booking", "قرأت الإقرار وأوافق عن نفسي ونيابةً عن كل شخص في هذا الحجز"),
  };
}
