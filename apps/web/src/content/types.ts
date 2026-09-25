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
};

export type TextField = Base & { type: "text" | "longtext"; max: number; def: Bi };
export type ImageField = Base & { type: "image"; def: string };
export type LinkField = Base & { type: "link"; def: string };
export type NumberField = Base & { type: "number"; def: number; min?: number; max?: number; step?: number };
export type ToggleField = Base & { type: "toggle"; def: boolean };
export type ItemField = TextField | ImageField | LinkField | NumberField | ToggleField;
export type ListField = Base & { type: "list"; item: ItemField[]; def: ItemValue[]; maxItems: number };
export type Field = ItemField | ListField;

export type ItemValue = Record<string, unknown>;

export type Section = { id: string; label: Bi; hint?: Bi; fields: Field[] };
export type PageSchema = { page: string; label: Bi; sections: Section[] };

export const bi = (en: string, ar: string): Bi => ({ en, ar });
