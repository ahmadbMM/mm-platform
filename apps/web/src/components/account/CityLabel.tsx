"use client";

import { useCities } from "./fields";

// The city of residence on its menu row in the reader's alphabet (the booking app's cityLabel): the country's own list
// (public/cities/<iso2>.json) names it in Arabic too; until the list is in, and in every other language, it reads as
// stored.
export default function CityLabel({ city, country, locale }: { city: string; country: string; locale: string }) {
  const list = useCities(locale === "ar" ? country : "", locale);
  const name = list?.find((c) => c.value === city)?.label ?? city;
  return <bdi>{name}</bdi>;
}
