import { filled } from "./filled";
import type { BikeRow } from "./bikes";
import { fmtDate, speedsLabel, tFor, translateValue, type BikeLang } from "./bike-i18n";

export type Field = { label: string; value: string };
export type Group = { heading?: string; fields: Field[] };

/**
 * The page shows what staff filled in and nothing else: every candidate is pushed with its
 * raw value, the blanks are dropped, and a group with nothing left never renders its heading.
 * No placeholder dashes — a field exists on screen only because it exists on the record.
 */
export function buildGroups(row: BikeRow, lang: BikeLang, titleUsedBrandModel: boolean): Group[] {
  const t = tFor(lang);
  const tv = (v: string) => translateValue(v, t);

  const spec: Array<[string, unknown]> = [
    // Already the headline when the title was built from them — a spec row repeating it
    // would just be the same two words twice on one screen.
    [t("fBrand"), titleUsedBrandModel ? null : row.brand],
    [t("fModel"), titleUsedBrandModel ? null : row.model],
    [t("fFrame"), filled(row.frame_type) ? tv(row.frame_type!) : null],
    [t("fSize"), filled(row.size) ? tv(row.size!) : null],
    [t("fGroupset"), row.groupset],
    // A count of zero speeds or zero kilos is a broken import, not a specification.
    [t("fSpeeds"), Number(row.speeds) > 0 ? speedsLabel(Number(row.speeds), lang) : null],
    [t("fWheels"), row.wheel_size],
    [t("fBrakes"), row.brake_type],
    [t("fWeight"), Number(row.weight_kg) > 0 ? `${row.weight_kg} ${t("unitKg")}` : null],
    [t("fColour"), (row.color_names ?? []).filter(filled).join(" · ") || null],
  ];

  const service: Array<[string, unknown]> = [
    [t("fInService"), filled(row.in_service_date) ? fmtDate(row.in_service_date!, lang) : null],
    [t("fLastService"), filled(row.last_serviced_at) ? fmtDate(row.last_serviced_at!, lang) : null],
  ];

  const pick = (pairs: Array<[string, unknown]>): Field[] =>
    pairs.filter(([, v]) => filled(v)).map(([label, v]) => ({ label, value: String(v).trim() }));

  return ([
    { heading: t("specs"), fields: pick(spec) },
    { heading: t("service"), fields: pick(service) },
  ] as Group[]).filter((g) => g.fields.length > 0);
}
