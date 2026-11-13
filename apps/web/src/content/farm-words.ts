import type { L } from "@/i18n/tx";

// The Farm House Night's words (lib/farm.ts), in English and Arabic exactly as the booking app writes them (its LANG en/ar
// keys named beside each); every other language translates the English (src/i18n/tx), the eight more the booking app
// speaks in its own wording. The night is for community members' eyes alone (the user, 2026-11-13: "put it under
// micromobility experiences card not to public"), so its words live here, on the server, as the Blood Donation event's do
// (content/blood-words.ts): this file is never imported by a browser component and is no *.text.ts, whose words go to
// every page's browser in its dictionary (src/i18n/extract.ts); no field of the Website editor either, whose schema is
// public (api/site-schema). A page hands them on only with a farm date it shows a community member, or a booking on one.
// (The ticket's two time words, Arrival and Dinner, are the ticket's own: components/booking/tickets.text.ts.)

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
