import type { L } from "@/i18n/tx";

// The Tee Painting Workshop's badge words (lib/paint.ts; the user, 2026-11-24: a badge for the Tee Painting Workshop). The
// workshop is for community members' eyes alone (2026-11-23, lib/farm.ts farmForMembers), so the badge's words live here, on
// the server, as the Farmhouse Night's do (content/farm-words.ts farmBadge): this file is never imported by a browser
// component and is no *.text.ts, whose words go to every page's browser in its dictionary (src/i18n/extract.ts). A page
// hands them on only to one who holds the badge. Arabic names the session by its own title, ورشة الرسم على التيشيرت.

/** The Tee Painting Workshop badge on My Account (tee_painting, lib/ride-record.ts): its name, how it is earned and what it
 *  means, in the booking app's words (bdgTeePaint, D and A). Here, not in RideRecord.text.ts, because it names the workshop. */
export const paintBadge = (tx: L): [string, string, string] => [
  tx("Tee Painting Workshop", "ورشة الرسم على التيشيرت"),
  tx("Come to one of our tee painting workshops.", "احضر ورشة الرسم على التيشيرت معنا."),
  tx(
    "For joining a MicroMobility Tee Painting Workshop, drawing and colouring on MicroMobility T-shirts with the community. Given once our team checks you in.",
    "لحضورك ورشة الرسم على التيشيرت مع مايكروموبيليتي، رسم وتلوين على قمصان مايكروموبيليتي مع المجتمع. تُمنح بعد أن يسجّل فريقنا حضورك.",
  ),
];
