// Every phrase with a count in it, worded for each plural form the language has. English has one
// and other; Arabic has zero, one, two, few (3-10), many (11-99) and other (100 and up), and the
// noun changes with each (Intl.PluralRules("ar") picks the form). Pure (tested).

import type { Lang } from "./strings";

type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const en = {
  ridersBooked: { one: "1 rider booked", other: "{n} riders booked" },
  srRiders: { one: "1 rider rated the breakfast", other: "{n} riders rated the breakfast" },
  fbBanner: { one: "1 breakfast is waiting for your feedback.", other: "{n} breakfasts are waiting for your feedback." },
  datesRequested: { one: "Requested 1 date.", other: "Requested {n} dates." },
  datesCancelled: { one: "Cancelled 1 date.", other: "Cancelled {n} dates." },
  previewSummary: { one: "{ok} of 1 date can be requested.", other: "{ok} of {n} dates can be requested." },
  datesMonth: { one: "Up to 1 date a month", other: "Up to {n} dates a month" },
  days: { one: "1 day", other: "{n} days" },
  charsLeft: { one: "1 character left", other: "{n} characters left" },
  otherVenues: { one: "1 other venue has asked for this date.", other: "{n} other venues have asked for this date." },
} satisfies Record<string, Forms>;

export type PluralKey = keyof typeof en;

const ar: Record<PluralKey, Forms> = {
  ridersBooked: { zero: "لا يوجد درّاجون مسجّلون", one: "درّاج واحد مسجّل", two: "درّاجان مسجّلان", few: "{n} درّاجين مسجّلين", many: "{n} درّاجًا مسجّلًا", other: "{n} درّاج مسجّل" },
  srRiders: { one: "قيّم درّاج واحد الفطور", two: "قيّم درّاجان الفطور", few: "قيّم {n} درّاجين الفطور", many: "قيّم {n} درّاجًا الفطور", other: "قيّم {n} درّاج الفطور" },
  fbBanner: { one: "لديك موعد فطور واحد بانتظار ملاحظاتك.", two: "لديك موعدا فطور بانتظار ملاحظاتك.", few: "لديك {n} مواعيد فطور بانتظار ملاحظاتك.", many: "لديك {n} موعدًا للفطور بانتظار ملاحظاتك.", other: "لديك {n} موعد فطور بانتظار ملاحظاتك." },
  datesRequested: { one: "طلبت تاريخًا واحدًا.", two: "طلبت تاريخين.", few: "طلبت {n} تواريخ.", many: "طلبت {n} تاريخًا.", other: "طلبت {n} تاريخ." },
  datesCancelled: { one: "أُلغي تاريخ واحد.", two: "أُلغي تاريخان.", few: "أُلغيت {n} تواريخ.", many: "أُلغي {n} تاريخًا.", other: "أُلغي {n} تاريخ." },
  previewSummary: { one: "يمكن طلب {ok} من أصل تاريخ واحد.", two: "يمكن طلب {ok} من أصل تاريخين.", few: "يمكن طلب {ok} من أصل {n} تواريخ.", many: "يمكن طلب {ok} من أصل {n} تاريخًا.", other: "يمكن طلب {ok} من أصل {n} تاريخ." },
  datesMonth: { one: "حتى تاريخ واحد في الشهر", two: "حتى تاريخين في الشهر", few: "حتى {n} تواريخ في الشهر", many: "حتى {n} تاريخًا في الشهر", other: "حتى {n} تاريخ في الشهر" },
  days: { zero: "لا أيام", one: "يوم واحد", two: "يومان", few: "{n} أيام", many: "{n} يومًا", other: "{n} يوم" },
  charsLeft: { zero: "لم يتبقَّ أي حرف", one: "متبقٍ حرف واحد", two: "متبقٍ حرفان", few: "متبقٍ {n} أحرف", many: "متبقٍ {n} حرفًا", other: "متبقٍ {n} حرف" },
  otherVenues: { one: "طلب مكان آخر هذا التاريخ أيضًا.", two: "طلب مكانان آخران هذا التاريخ أيضًا.", few: "طلبت {n} أماكن أخرى هذا التاريخ أيضًا.", many: "طلب {n} مكانًا آخر هذا التاريخ أيضًا.", other: "طلب {n} مكان آخر هذا التاريخ أيضًا." },
};

export const PLURALS: Record<Lang, Record<PluralKey, Forms>> = { en, ar };

const rules: Partial<Record<Lang, Intl.PluralRules>> = {};
/** The plural form a count takes in a language ("one", "few", ...). */
export function pluralForm(lang: Lang, n: number): Intl.LDMLPluralRule {
  rules[lang] ??= new Intl.PluralRules(lang);
  return rules[lang]!.select(n);
}

/** The phrase for n in lang, with {n} written in Western digits and any other {name} filled. */
export function plural(lang: Lang, key: PluralKey, n: number, vars?: Record<string, string | number>): string {
  const forms = PLURALS[lang][key];
  let s = forms[pluralForm(lang, n)] ?? forms.other;
  const all: Record<string, string | number> = { ...vars, n: new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB").format(n) };
  for (const [k, v] of Object.entries(all)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
