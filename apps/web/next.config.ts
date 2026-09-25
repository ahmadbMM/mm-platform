import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The shop is a hosted Salla store: it can live on its own domain, not inside a path of this
// one. What a path can do is forward, so micromobility.sa/store (and /en/store, /ar/store)
// opens it. Temporary (307) on purpose: the shop's address can change without browsers
// having cached the old one.
const STORE = "https://stepdragon.com.sa";

const config: NextConfig = {
  async redirects() {
    return [
      // Addresses carry no language any more (the visitor's is in ?lang= or the NEXT_LOCALE
      // cookie), so plain /store has to ask which shop to open; Arabic stays the default.
      { source: "/store", has: [{ type: "query", key: "lang", value: "en" }], destination: `${STORE}/en`, permanent: false },
      { source: "/store", has: [{ type: "cookie", key: "NEXT_LOCALE", value: "en" }], destination: `${STORE}/en`, permanent: false },
      { source: "/store", destination: `${STORE}/ar`, permanent: false },
      { source: "/ar/store", destination: `${STORE}/ar`, permanent: false },
      { source: "/en/store", destination: `${STORE}/en`, permanent: false },
    ];
  },
};

export default withNextIntl(config);
