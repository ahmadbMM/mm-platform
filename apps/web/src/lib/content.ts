import type { ItemField, PageSchema, Section } from "@/content/types";
import type { SiteContent } from "@/lib/site";
import { dictOf } from "../i18n/dicts";
import { tr } from "../i18n/tx";
import * as core from "./content-core";
import { bizOf, bizWords } from "./biz";
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
export const resolvePage = <P extends PageSchema>(schema: P, content: SiteContent | null, locale: Locale) => {
  const page = core.resolvePage(schema, content, locale, translate);
  return schema.page === "site" ? (withBiz(page as unknown as Record<string, Record<string, unknown>>, content, locale) as unknown as typeof page) : page;
};

/**
 * The store's address, its opening hours and the VAT number as the booking app's Settings > Business
 * has them (site_content 'biz.public', lib/biz.ts), on every page that shows them (the footer, About,
 * Workshop, the search): the same three lines the booking app's own footer reads (_bizFoot). A value
 * staff typed into the website's own editor (Website > Whole site) still wins - it was set for this
 * site on purpose - and with neither, the site's built-in words.
 */
function withBiz(page: Record<string, Record<string, unknown>>, content: SiteContent | null, locale: Locale) {
  if (!content || !content["biz.public"]) return page;
  const biz = bizOf(content);
  const own = (k: string) => content[k] !== undefined && content[k] !== null;
  const contact = { ...page.contact }, legal = { ...page.legal };
  const addr = bizWords(biz.addr, locale), hours = bizWords(biz.hours, locale);
  if (addr && !own("site.contact.address")) contact.address = addr;
  if (hours && !own("site.contact.hoursText")) contact.hoursText = hours;
  if (biz.vatNo && !own("site.legal.vat")) legal.vat = biz.vatNo;
  return { ...page, contact, legal };
}

export const resolveSection = <S extends Section>(page: string, s: S, content: SiteContent | null, locale: Locale) => core.resolveSection(page, s, content, locale, translate);
