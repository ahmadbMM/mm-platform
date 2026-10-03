"use client";

// The page's language and the dictionary its browser components need, handed down from the
// layout: useL() is L("English", "العربية") in the page's language.
import { createContext, useContext, useMemo } from "react";
import { localize, makeL, type Dict, type L } from "./tx";

const Ctx = createContext<{ locale: string; dict: Dict | null }>({ locale: "en", dict: null });

export function TxProvider({ locale, dict, children }: { locale: string; dict: Dict | null; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useL(): L {
  const { locale, dict } = useContext(Ctx);
  return useMemo(() => makeL(locale, dict), [locale, dict]);
}

export function useLocalize<T>(T: { en: T; ar: T }): T {
  const { locale, dict } = useContext(Ctx);
  return useMemo(() => localize(T, locale, dict), [T, locale, dict]);
}

/** The page's language code, for a component with its own words in every language. */
export function useTxLocale(): string {
  return useContext(Ctx).locale;
}
