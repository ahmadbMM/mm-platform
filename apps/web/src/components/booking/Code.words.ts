// The names of the kinds of code a booking used, on the ticket (TicketCard.tsx; the booking app's _codeTag, 2026-11-08: "when
// a code is used show it besides the booking and what type of code it is with a logo"): the ten languages the booking
// app speaks take its own words (codeKind* and satcF); Indonesian, Malay, German, Russian, Chinese and Japanese, which it
// does not speak, are written here. Change a name in every language at once.
import type { Locale } from "@/i18n/locales";
import type { CodeKind } from "@/lib/tickets";

export const CODE_WORDS: Record<Locale, Record<CodeKind, string>> = {
  en: { promo: "Promo code", rw: "Referral discount", rf: "Referral free ride", rb: "Referral bonus ride", bd: "Blood donation free ride", sat: "Ride code" },
  ar: { promo: "رمز خصم", rw: "خصم الإحالة", rf: "ركوبة مجانية من إحالة", rb: "ركوبة إحالة إضافية", bd: "ركوبة مجانية للتبرع بالدم", sat: "رمز الجولة" },
  fr: { promo: "Code promo", rw: "Réduction parrainage", rf: "Sortie gratuite parrainage", rb: "Sortie bonus parrainage", bd: "Sortie gratuite don de sang", sat: "Code de sortie" },
  es: { promo: "Código promocional", rw: "Descuento por referido", rf: "Paseo gratis por referido", rb: "Paseo extra por referido", bd: "Paseo gratis por donar sangre", sat: "Código de recorrido" },
  pt: { promo: "Código promocional", rw: "Desconto de indicação", rf: "Passeio grátis de indicação", rb: "Passeio bônus de indicação", bd: "Passeio grátis por doação de sangue", sat: "Código de passeio" },
  ur: { promo: "پرومو کوڈ", rw: "ریفرل رعایت", rf: "ریفرل مفت سواری", rb: "ریفرل بونس سواری", bd: "خون کے عطیے کی مفت سواری", sat: "رائیڈ کوڈ" },
  hi: { promo: "प्रोमो कोड", rw: "रेफ़रल छूट", rf: "रेफ़रल मुफ़्त राइड", rb: "रेफ़रल बोनस राइड", bd: "रक्तदान मुफ़्त राइड", sat: "राइड कोड" },
  tl: { promo: "Promo code", rw: "Referral na diskwento", rf: "Referral na libreng sakay", rb: "Referral na bonus na sakay", bd: "Libreng sakay sa pag-donate ng dugo", sat: "Ride code" },
  ne: { promo: "प्रोमो कोड", rw: "रेफरल छुट", rf: "रेफरल निःशुल्क सवारी", rb: "रेफरल बोनस सवारी", bd: "रक्तदानको निःशुल्क सवारी", sat: "राइड कोड" },
  bn: { promo: "প্রোমো কোড", rw: "রেফারেল ছাড়", rf: "রেফারেলের বিনামূল্যে রাইড", rb: "রেফারেলের বোনাস রাইড", bd: "রক্তদানের বিনামূল্যে রাইড", sat: "রাইড কোড" },
  id: { promo: "Kode promo", rw: "Diskon undangan teman", rf: "Perjalanan gratis dari undangan", rb: "Perjalanan bonus dari undangan", bd: "Perjalanan gratis donor darah", sat: "Kode perjalanan" },
  ms: { promo: "Kod promosi", rw: "Diskaun jemputan rakan", rf: "Kayuhan percuma jemputan", rb: "Kayuhan bonus jemputan", bd: "Kayuhan percuma derma darah", sat: "Kod kayuhan" },
  de: { promo: "Gutscheincode", rw: "Empfehlungsrabatt", rf: "Gratisfahrt (Empfehlung)", rb: "Bonusfahrt (Empfehlung)", bd: "Gratisfahrt (Blutspende)", sat: "Fahrtcode" },
  ru: { promo: "Промокод", rw: "Скидка по приглашению", rf: "Бесплатная поездка за приглашение", rb: "Бонусная поездка за приглашения", bd: "Бесплатная поездка за донорство крови", sat: "Код поездки" },
  zh: { promo: "优惠码", rw: "邀请折扣", rf: "邀请免费骑行", rb: "邀请奖励骑行", bd: "献血免费骑行", sat: "骑行码" },
  ja: { promo: "プロモコード", rw: "招待割引", rf: "招待の無料ライド", rb: "招待のボーナスライド", bd: "献血の無料ライド", sat: "ライドコード" },
};

export const codeWords = (locale: string): Record<CodeKind, string> => CODE_WORDS[locale as Locale] ?? CODE_WORDS.en;
