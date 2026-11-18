// Members book first on Experiences and Events (lib/members-first.ts; the booking app's mfMark, mfStatus and mfEveryone,
// 2026-11-18) in every language the site speaks: a member's mark on the date ("Members first"), what everyone else reads
// where its places are said ("Members book first", also the Details row's name) and under its time ("Everyone from {0}",
// {0} the day and time, as lib/tickets.ts revealWhen says them). The ten languages the booking app speaks take its own words
// word for word (English and Arabic in app.src.html, the others in its i18n/<code>.json). Indonesian, Malay, German,
// Russian, Chinese and Japanese, which it does not speak, follow src/i18n/TRANSLATING.md. Change a text here in every
// language at once.
import type { Locale } from "@/i18n/locales";

export type MembersFirstWords = { mark: string; status: string; everyone: string };

export const MEMBERS_FIRST_WORDS: Record<Locale, MembersFirstWords> = {
  en: { mark: "Members first", status: "Members book first", everyone: "Everyone from {0}" },
  ar: { mark: "للأعضاء أولًا", status: "الحجز للأعضاء أولًا", everyone: "للجميع من {0}" },
  id: { mark: "Anggota duluan", status: "Anggota memesan lebih dulu", everyone: "Untuk semua mulai {0}" },
  ms: { mark: "Ahli dahulu", status: "Ahli menempah dahulu", everyone: "Untuk semua mulai {0}" },
  de: { mark: "Mitglieder zuerst", status: "Mitglieder buchen zuerst", everyone: "Für alle ab {0}" },
  es: { mark: "Primero los miembros", status: "Los miembros reservan primero", everyone: "Para todos desde {0}" },
  fr: { mark: "Membres en priorité", status: "Les membres réservent en premier", everyone: "Ouvert à tous dès {0}" },
  pt: { mark: "Membros primeiro", status: "Os membros reservam primeiro", everyone: "Para todos a partir de {0}" },
  tl: { mark: "Mga miyembro muna", status: "Mga miyembro muna ang nagbu-book", everyone: "Para sa lahat mula {0}" },
  ru: { mark: "Сначала участники", status: "Сначала бронируют участники", everyone: "Для всех с {0}" },
  ur: { mark: "پہلے اراکین", status: "پہلے اراکین بک کرتے ہیں", everyone: "{0} سے سب کے لیے" },
  hi: { mark: "पहले सदस्य", status: "पहले सदस्य बुक करते हैं", everyone: "{0} से सभी के लिए" },
  ne: { mark: "पहिले सदस्य", status: "पहिले सदस्यले बुक गर्छन्", everyone: "{0} देखि सबैका लागि" },
  bn: { mark: "আগে সদস্যরা", status: "আগে সদস্যরা বুক করেন", everyone: "{0} থেকে সবার জন্য" },
  zh: { mark: "会员优先", status: "会员优先预订", everyone: "{0} 起向所有人开放" },
  ja: { mark: "メンバー優先", status: "メンバー先行予約", everyone: "{0}から一般受付" },
};

export const membersFirstWords = (locale: string): MembersFirstWords => MEMBERS_FIRST_WORDS[locale as Locale] ?? MEMBERS_FIRST_WORDS.en;
