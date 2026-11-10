// Whether the rider competes in a sport, on every account (the booking app, 2026-11-10: "add a question and keep as a
// field in all accounts and force it on community members the next time they open or sign in the website, Do you
// compete in a professional/amateur capacity in a sport? yes or no and the answers if yes be" the Saudi sports
// federations and committees). customers.sport_competes (null = not answered) and sport_federations (the codes a yes
// competes under, one or more) - migration 20261110233000 in the booking app's repo. Read through customer_sport(p_id,
// p_token) -> (competes, federations, asked: a Community member who must still answer), saved through
// customer_set_sport(p_id, p_token, p_competes, p_federations, p_other): BAD_INPUT with the detail 'sport' (no answer),
// 'sport_feds' (a yes with no code, or one outside the lists) or 'sport_other' (Other with no text, or text outside 2-60
// characters). The same day the user added "an option called other that opens a text field to allow them to write their
// choice and add this choice later on to the list": the codes are the user's 74 below, the sports staff add to the list
// (sport_options, codes 'x_...', read through sport_option_list() -> (code, name_en, name_ar)) and 'other', in that
// order; customers.sport_other holds what a yes wrote under Other. A database without the functions yet (PGRST202) asks
// nobody and shows no card.
//
// The groups and federations in the user's order, [code, English, Arabic], copied word for word from the booking app's
// SPORT_GROUPS (app.src.html): a code is the database's (_sport_feds()) and is never renamed. Names are English and
// Arabic only, as the booking app's are; the other languages show the English.
export type SportFed = readonly [code: string, en: string, ar: string];
export type SportGroup = readonly [en: string, ar: string, feds: readonly SportFed[]];

export const SPORT_GROUPS: readonly SportGroup[] = [
  ['Endurance, Cycling & Water Sports','التحمل والدراجات والرياضات المائية',[['cycling','Saudi Cycling Federation','الاتحاد السعودي للدراجات'],['triathlon','Saudi Triathlon Federation','الاتحاد السعودي للترايثلون'],['athletics','Saudi Athletics Federation','الاتحاد السعودي لألعاب القوى'],['swimming','Saudi Swimming Federation','الاتحاد السعودي للسباحة'],['rowing','Saudi Rowing Federation','الاتحاد السعودي للتجديف'],['canoe_kayak','Saudi Canoe and Kayak Federation','الاتحاد السعودي للكانوي والكاياك'],['sailing','Saudi Sailing Federation','الاتحاد السعودي للشراع'],['marine_diving','Saudi Marine Sports and Diving Federation','الاتحاد السعودي للرياضات البحرية والغوص'],['surfing','Saudi Surfing Federation','الاتحاد السعودي لركوب الأمواج'],['water_rescue','Saudi Water Rescue and Safety Federation','الاتحاد السعودي للإنقاذ والسلامة المائية']]],
  ['Team Sports','الرياضات الجماعية',[['football','Saudi Arabian Football Federation','الاتحاد السعودي لكرة القدم'],['basketball','Saudi Basketball Federation','الاتحاد السعودي لكرة السلة'],['volleyball','Saudi Volleyball Federation','الاتحاد السعودي للكرة الطائرة'],['handball','Saudi Handball Federation','الاتحاد السعودي لكرة اليد'],['rugby','Saudi Rugby Federation','الاتحاد السعودي للرجبي'],['hockey','Saudi Hockey Federation','الاتحاد السعودي للهوكي'],['cricket','Saudi Cricket Federation','الاتحاد السعودي للكريكيت'],['baseball_softball','Saudi Baseball and Softball Federation','الاتحاد السعودي للبيسبول والسوفتبول'],['dodgeball','Saudi Dodgeball Federation','الاتحاد السعودي لكرة المراوغة'],['lacrosse','Saudi Lacrosse Federation','الاتحاد السعودي للاكروس'],['american_football','Saudi American Football Federation','الاتحاد السعودي لكرة القدم الأمريكية']]],
  ['Racket Sports','رياضات المضرب',[['tennis','Saudi Tennis Federation','الاتحاد السعودي للتنس'],['table_tennis','Saudi Table Tennis Federation','الاتحاد السعودي لكرة الطاولة'],['badminton','Saudi Badminton Federation','الاتحاد السعودي للريشة الطائرة'],['squash','Saudi Squash Federation','الاتحاد السعودي للاسكواش'],['padel','Saudi Padel Committee','اللجنة السعودية للبادل']]],
  ['Combat Sports','الرياضات القتالية',[['boxing','Saudi Boxing Federation','الاتحاد السعودي للملاكمة'],['judo','Saudi Judo Federation','الاتحاد السعودي للجودو'],['karate','Saudi Karate Federation','الاتحاد السعودي للكاراتيه'],['taekwondo','Saudi Taekwondo Federation','الاتحاد السعودي للتايكوندو'],['wrestling','Saudi Wrestling Federation','الاتحاد السعودي للمصارعة'],['jiu_jitsu','Saudi Jiu-Jitsu Federation','الاتحاد السعودي للجوجيتسو'],['muay_thai','Saudi Muay Thai Federation','الاتحاد السعودي للمواي تاي'],['mma','Saudi Mixed Martial Arts Federation','الاتحاد السعودي للفنون القتالية المختلطة'],['kickboxing','Saudi Kickboxing Federation','الاتحاد السعودي للكيك بوكسينغ'],['sambo','Saudi Sambo Committee','اللجنة السعودية للسامبو'],['wushu','Saudi Wushu Committee','اللجنة السعودية للووشو'],['kurash','Saudi Kurash Committee','اللجنة السعودية للكوراش'],['kyokushin','Saudi Kyokushin Committee','اللجنة السعودية للكيوكوشن'],['aikido','Saudi Aikido Committee','اللجنة السعودية للأيكيدو']]],
  ['Strength, Gymnastics & Adventure Sports','القوة والجمباز ورياضات المغامرة',[['weightlifting','Saudi Weightlifting Federation','الاتحاد السعودي لرفع الأثقال'],['bodybuilding','Saudi Bodybuilding Federation','الاتحاد السعودي لبناء الأجسام'],['gymnastics','Saudi Gymnastics Federation','الاتحاد السعودي للجمباز'],['climbing_hiking','Saudi Climbing and Hiking Federation','الاتحاد السعودي للتسلق والهايكنج'],['adventure','Saudi Adventure Sports Federation','الاتحاد السعودي لرياضات المغامرة'],['powerlifting','Saudi Powerlifting Committee','اللجنة السعودية لرفع القوة']]],
  ['Individual & Precision Sports','الرياضات الفردية ورياضات الدقة',[['shooting','Saudi Shooting Federation','الاتحاد السعودي للرماية'],['archery','Saudi Archery Federation','الاتحاد السعودي للسهام'],['fencing','Saudi Fencing Federation','الاتحاد السعودي للمبارزة'],['golf','Saudi Golf Federation','الاتحاد السعودي للجولف'],['bowling','Saudi Bowling Federation','الاتحاد السعودي للبولينج'],['billiards_snooker','Saudi Billiards and Snooker Federation','الاتحاد السعودي للبلياردو والسنوكر'],['chess','Saudi Chess Federation','الاتحاد السعودي للشطرنج'],['modern_pentathlon','Saudi Modern Pentathlon Federation','الاتحاد السعودي للخماسي الحديث']]],
  ['Equestrian, Motorsports & Aviation','الفروسية ورياضة المحركات والطيران',[['equestrian','Saudi Equestrian Federation','الاتحاد السعودي للفروسية'],['polo','Saudi Polo Federation','الاتحاد السعودي للبولو'],['camel_racing','Saudi Camel Racing Federation','الاتحاد السعودي للهجن'],['auto_moto','Saudi Automobile and Motorcycle Federation','الاتحاد السعودي للسيارات والدراجات النارية'],['paragliding','Saudi Paragliding Federation','الاتحاد السعودي للطيران الشراعي'],['ballooning','Saudi Ballooning Federation','الاتحاد السعودي للمناطيد']]],
  ['Winter Sports','الرياضات الشتوية',[['snow_sports','Saudi Snow Sports Federation','الاتحاد السعودي للرياضات الثلجية'],['ice_sports','Saudi Ice Sports Federation','الاتحاد السعودي لرياضات الجليد']]],
  ['Paralympic & Disability Sports','الرياضات البارالمبية ورياضات ذوي الإعاقة',[['para_athletics','Saudi Paralympic Athletics Federation','الاتحاد السعودي لألعاب القوى البارالمبية'],['para_swimming','Saudi Paralympic Swimming Federation','الاتحاد السعودي للسباحة البارالمبية'],['boccia','Saudi Boccia Federation','الاتحاد السعودي للبوتشيا'],['wheelchair_seated','Saudi Wheelchair and Seated Sports Federation','الاتحاد السعودي لرياضات الكراسي المتحركة والجلوس'],['blind_sports','Saudi Blind Sports Federation','الاتحاد السعودي لرياضات المكفوفين'],['deaf_sports','Saudi Deaf Sports Federation','الاتحاد السعودي لرياضة الصم']]],
  ['Esports, Technology & Community Sports','الرياضات الإلكترونية والتقنية والمجتمعية',[['esports','Saudi Esports Federation','الاتحاد السعودي للرياضات الإلكترونية'],['rc_robotics','Saudi Wireless and Remote-Control Sports and Robotics Federation','الاتحاد السعودي للرياضات اللاسلكية والتحكم عن بعد والروبوت'],['cyber_drones','Saudi Federation for Cybersecurity, Programming and Drones','الاتحاد السعودي للأمن السيبراني والبرمجة والدرونز'],['sports_for_all','Saudi Sports for All Federation','الاتحاد السعودي للرياضة للجميع'],['yoga','Saudi Yoga Committee','اللجنة السعودية لليوغا'],['masters','Saudi Masters Sports Committee','اللجنة السعودية لرياضة الماسترز']]],
];

/** The user's 74 codes, in the list's order. */
export const SPORT_CODES: readonly string[] = SPORT_GROUPS.flatMap((g) => g[2].map((f) => f[0]));
/** The answer that opens a text box. */
export const SP_OTHER = "other";

/** A sport staff added to the list (sport_option_list): its code ('x_...') and names. */
export type SportOption = { code: string; en: string; ar: string | null };
const X_CODE = /^x_[a-z0-9_]{1,40}$/;

/** sport_option_list's rows as the pages hold them (anything that is not one is left out). */
export function spOptionsOf(rows: unknown): SportOption[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const o = r && typeof r === "object" ? (r as Record<string, unknown>) : null;
    if (!o || typeof o.code !== "string" || !X_CODE.test(o.code) || typeof o.name_en !== "string" || !o.name_en.trim()) return [];
    return [{ code: o.code, en: o.name_en.trim(), ar: typeof o.name_ar === "string" && o.name_ar.trim() ? o.name_ar.trim() : null }];
  });
}

/** A code an answer may hold, as far as the page can tell without the added list: the user's, an added one's shape, or Other. */
export const spKnown = (code: unknown): code is string =>
  typeof code === "string" && (SPORT_CODES.includes(code) || code === SP_OTHER || X_CODE.test(code));

/** A code's name in the page's language: Arabic on the Arabic page (an added sport's English when it has no Arabic),
 *  English everywhere else. Other is the caller's word. */
export const spName = (code: string, locale: string, added: readonly SportOption[] = []): string => {
  for (const g of SPORT_GROUPS) {
    const f = g[2].find((x) => x[0] === code);
    if (f) return locale === "ar" ? f[2] : f[1];
  }
  const o = added.find((x) => x.code === code);
  if (o) return (locale === "ar" && o.ar) || o.en;
  return code;
};
export const spGroupName = (g: SportGroup, locale: string) => (locale === "ar" ? g[1] : g[0]);

/** A yes's codes as the database keeps them: each once, in its order (the user's list, the added ones, Other last);
 *  anything not a code dropped. Without the added list, an added code keeps its place among the added ones. */
export const spClean = (feds: unknown, added?: readonly SportOption[]): string[] => {
  const on = new Set(Array.isArray(feds) ? feds.filter(spKnown) : []);
  const mid = added ? added.map((o) => o.code) : [...on].filter((c) => X_CODE.test(c));
  return [...SPORT_CODES, ...mid, SP_OTHER].filter((c) => on.has(c));
};

/** What a rider wrote under Other, as the database takes it: spaces tidied, 2 to 60 characters, no markup; null when it is not. */
export function spOtherClean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  const n = [...s].length;
  return n >= 2 && n <= 60 && !/[<>"`{}\\]/.test(s) ? s : null;
}

/** An answer as the pages hold it: competes null while not answered; feds and other only with a yes. */
export type SportAnswer = { competes: boolean | null; feds: string[]; other: string };

/** customer_sport's row as the pages hold it (null for anything that is not a row). */
export function spOf(row: unknown): (SportAnswer & { asked: boolean }) | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const competes = r.competes === true ? true : r.competes === false ? false : null;
  const feds = competes ? spClean(r.federations) : [];
  return { competes, feds, other: feds.includes(SP_OTHER) && typeof r.other === "string" ? r.other : "", asked: r.asked === true };
}

/** What is wrong with an answer before it is sent: "pick" (neither yes nor no), "feds" (a yes with nothing picked),
 *  "other" (Other with no text, or text the database would refuse); null when it can go. */
export function spProblem(a: SportAnswer): "pick" | "feds" | "other" | null {
  if (a.competes === null) return "pick";
  if (!a.competes) return null;
  if (!a.feds.length) return "feds";
  return a.feds.includes(SP_OTHER) && !spOtherClean(a.other) ? "other" : null;
}

/** The database's refusal of an answer (BAD_INPUT): which part it refused, or null for anything else. */
export function spRefusal(e: { details?: unknown; message?: unknown } | null | undefined): "pick" | "feds" | "other" | null {
  const d = String(e?.details ?? ""), m = String(e?.message ?? "");
  const code = /^sport(_feds|_other)?$/.test(d) ? d : (/\bsport(_feds|_other)?\b/.exec(m)?.[0] ?? "");
  return code === "sport" ? "pick" : code === "sport_feds" ? "feds" : code === "sport_other" ? "other" : null;
}
