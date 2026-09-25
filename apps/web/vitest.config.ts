import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// next-intl's middleware imports "next/server" with no file extension, which Node's own module
// loader refuses. Letting Vite load next-intl instead is what lets proxy.test.ts run the real proxy.
// "@" is src/, as tsconfig.json has it: the page schemas import through it, and the i18n check
// reads every schema.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { server: { deps: { inline: ["next-intl"] } } },
});
