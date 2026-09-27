import type { ItemField, PageSchema, Section } from "@/content/types";
import type { SiteContent } from "@/lib/site";
import { dictOf } from "../i18n/dicts";
import { tr } from "../i18n/tx";
import * as core from "./content-core";
import type { Locale } from "./content-core";

// Reads a page's content in any of the site's languages (lib/content-core.ts does the reading;
// this gives it the site's dictionaries for the translated languages).
export type { Locale } from "./content-core";
export { asLocale, safeUrl } from "./content-core";

const translate: core.Translate = (locale, en) => tr(locale, dictOf(locale), en);

/** One field's value for this language, typed the way the page uses it. */
export const fieldValue = (field: ItemField, raw: unknown, locale: Locale) => core.fieldValue(field, raw, locale, translate);

/** The whole page as { section: { field: value } }, in one language. Keys in site_content are
 *  "<page>.<section>.<field>". */
export const resolvePage = <P extends PageSchema>(schema: P, content: SiteContent | null, locale: Locale) => core.resolvePage(schema, content, locale, translate);

export const resolveSection = <S extends Section>(page: string, s: S, content: SiteContent | null, locale: Locale) => core.resolveSection(page, s, content, locale, translate);
