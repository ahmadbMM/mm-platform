import type { Bi, Field, ItemField, ItemValue, PageSchema, Section } from "@/content/types";
import type { SiteContent } from "@/lib/site";

// Reads a page's content: what staff saved in site_content, else the schema's default. Every
// value is checked against its field's type, so a malformed row can never break a page - it
// reads as the default instead.
//
// This is the part that needs no dictionaries: a translated language's text comes from the
// `translate` it is given. lib/content.ts gives it the site's dictionaries; code that only ever
// reads English (the sitemap) uses this directly and does not carry fourteen languages' worth of
// text into its bundle.

/** The English of a text in a translated language (src/i18n/tx), or the English itself. */
export type Translate = (locale: Locale, en: string) => string;
const untranslated: Translate = (_l, en) => en;

export type { Locale } from "../i18n/locales";
import { LOCALE_CODES, type Locale } from "../i18n/locales";

const isBi = (v: unknown): v is Bi =>
  !!v && typeof v === "object" && typeof (v as Bi).en === "string" && typeof (v as Bi).ar === "string";

/** One field's value for this language, typed the way the page uses it. */
export function fieldValue(field: ItemField, raw: unknown, locale: Locale, translate: Translate = untranslated): string | number | boolean {
  switch (field.type) {
    case "text":
    case "longtext": {
      if (field.mono) {
        const m = isBi(raw) ? raw.en.trim() || raw.ar.trim() : "";
        if (m) return m;
        return field.optional && isBi(raw) ? "" : field.def.en || field.def.ar;
      }
      if (locale !== "en" && locale !== "ar") {
        // A translated language: a version staff wrote for it, else the English translated
        // (src/i18n/tx), else the English itself.
        const own = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[locale] : undefined;
        if (typeof own === "string" && own.trim()) return own.trim();
        return translate(locale, fieldValue(field, raw, "en") as string);
      }
      const v = isBi(raw) ? raw[locale].trim() : "";
      if (v) return v;
      if (field.optional && isBi(raw)) return raw[locale === "ar" ? "en" : "ar"].trim();
      return field.def[locale];
    }
    case "image": {
      const u = raw && typeof raw === "object" ? (raw as { url?: unknown }).url : undefined;
      return typeof u === "string" && safeUrl(u) ? u : field.def;
    }
    case "link": {
      const h = raw && typeof raw === "object" ? (raw as { href?: unknown }).href : undefined;
      if (field.optional && h === "") return "";
      return typeof h === "string" && safeUrl(h) ? h : field.def;
    }
    case "number": {
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : NaN;
      if (Number.isNaN(n)) return field.def;
      if (field.min !== undefined && n < field.min) return field.def;
      if (field.max !== undefined && n > field.max) return field.def;
      return n;
    }
    case "toggle":
      return typeof raw === "boolean" ? raw : field.def;
  }
}

/** Only site paths, https and the usual contact schemes reach an href or src. */
export function safeUrl(u: string): boolean {
  return /^\/(?!\/)/.test(u) || /^https:\/\//i.test(u) || /^(mailto|tel):/i.test(u);
}

type Resolved = Record<string, unknown>;

function resolveItem(fields: ItemField[], raw: ItemValue | undefined, locale: Locale, translate: Translate): Resolved {
  const out: Resolved = {};
  for (const f of fields) out[f.id] = fieldValue(f, raw ? raw[f.id] : undefined, locale, translate);
  return out;
}

function resolveField(field: Field, raw: unknown, locale: Locale, translate: Translate): unknown {
  if (field.type !== "list") return fieldValue(field, raw, locale, translate);
  const items = Array.isArray(raw) ? (raw as ItemValue[]).filter((x) => x && typeof x === "object") : field.def;
  return items.slice(0, field.maxItems).map((it) => resolveItem(field.item, it, locale, translate));
}

/**
 * The whole page as { section: { field: value } }, in one language. Keys in site_content are
 * "<page>.<section>.<field>".
 */
export function resolvePage(schema: PageSchema, content: SiteContent | null, locale: Locale, translate: Translate = untranslated): Record<string, Resolved> {
  const out: Record<string, Resolved> = {};
  for (const s of schema.sections) out[s.id] = resolveSection(schema.page, s, content, locale, translate);
  return out;
}

export function resolveSection(page: string, s: Section, content: SiteContent | null, locale: Locale, translate: Translate = untranslated): Resolved {
  const sec: Resolved = {};
  for (const f of s.fields) sec[f.id] = resolveField(f, content?.[`${page}.${s.id}.${f.id}`], locale, translate);
  return sec;
}

export const asLocale = (l: string): Locale => ((LOCALE_CODES as readonly string[]).includes(l) ? (l as Locale) : "en");
