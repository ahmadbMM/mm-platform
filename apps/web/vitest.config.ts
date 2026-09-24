import { defineConfig } from "vitest/config";

// next-intl's middleware imports "next/server" with no file extension, which Node's own module
// loader refuses. Letting Vite load next-intl instead is what lets proxy.test.ts run the real proxy.
export default defineConfig({
  test: { server: { deps: { inline: ["next-intl"] } } },
});
