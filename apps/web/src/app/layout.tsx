import type { ReactNode } from "react";

// The root layout passes its children straight through: every page's document - <html lang dir>, the
// fonts, the providers - is the language layout's (app/[locale]/layout.tsx). It exists so that the
// not-found page beside it (app/not-found.tsx) sits above that layout and can answer an address the
// language layout refuses, with a document of its own.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
