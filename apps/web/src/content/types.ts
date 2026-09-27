// What a page lets staff change, declared once. The website renders from it; the staff page
// builds its editor from it (served at /api/site-schema). A value staff never touched reads as
// the default here - the design's own words and photos.
//
// Storage: every field is one row in public.site_content, keyed "<page>.<section>.<field>".
//   text / longtext -> {"en": "...", "ar": "..."}
//   image           -> {"url": "..."}             (a path under /site/ or an uploaded photo)
//   link            -> {"href": "..."}
//   number          -> 123.5
//   toggle          -> true / false
//   list            -> [{ <field id>: <value as above>, ... }, ...]

export type Bi = { en: string; ar: string };

type Base = {
  /** Field id, unique within its section (or list item). */
  id: string;
  label: Bi;
  /** Shown under the field in the staff editor. */
  hint?: Bi;
  /** Staff may clear it to leave it out: a value saved empty shows nothing instead of the
   *  default (a deleted row still shows the default). Text falls back to the other language
   *  before it counts as empty, for values like a registration number typed in one box. */
  optional?: boolean;
  /** One value in every language (a phone, a date, a registration number): the English box, else
   *  the Arabic one, so a value typed in only one box shows on both pages. */
  mono?: boolean;
  /** Written in English and Arabic only (legal text, like the Privacy Notice): every other language
   *  shows the English, with a note on the page. Never translated through src/i18n/tx, so it is not
   *  on the list of texts to translate. */
  enArOnly?: boolean;
};

export type TextField = Base & { type: "text" | "longtext"; max: number; def: Bi };
export type ImageField = Base & { type: "image"; def: string };
export type LinkField = Base & { type: "link"; def: string };
export type NumberField = Base & { type: "number"; def: number; min?: number; max?: number; step?: number };
export type ToggleField = Base & { type: "toggle"; def: boolean };
export type ItemField = TextField | ImageField | LinkField | NumberField | ToggleField;
export type ListField = Base & { type: "list"; item: readonly ItemField[]; def: readonly ItemValue[]; maxItems: number };
export type Field = ItemField | ListField;

export type ItemValue = Record<string, unknown>;

export type Section = { id: string; label: Bi; hint?: Bi; fields: readonly Field[] };
export type PageSchema = { page: string; label: Bi; sections: readonly Section[] };

export const bi = (en: string, ar: string): Bi => ({ en, ar });

// What a page reads once its schema is resolved (lib/content.ts resolvePage): each section's fields
// by id, each with the type its field gives it - text, image and link a string, number a number,
// toggle a boolean, a list an array of items typed the same way. A schema declared
// `as const satisfies PageSchema` (content/pages/bikes.ts, routes.ts) keeps its ids, so `c.hero.title`
// is a string the compiler knows about and a misspelt field is a build error; one declared as a
// plain PageSchema reads as { [section]: { [field]: value } }, checked at run time as before.
export type ResolvedValue<F extends Field> =
  F extends { type: "text" | "longtext" | "image" | "link" } ? string
  : F extends { type: "number" } ? number
  : F extends { type: "toggle" } ? boolean
  : F extends { type: "list"; item: infer I extends readonly ItemField[] } ? ResolvedItem<I>[]
  : never;
export type ResolvedItem<I extends readonly ItemField[]> = { [F in I[number] as F["id"]]: ResolvedValue<F> };
export type ResolvedSection<S extends Section> = { [F in S["fields"][number] as F["id"]]: ResolvedValue<F> };
export type ResolvedPage<P extends PageSchema> = { [S in P["sections"][number] as S["id"]]: ResolvedSection<S> };
