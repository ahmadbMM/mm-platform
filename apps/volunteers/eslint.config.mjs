import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", ".wrangler/**", "node_modules/**", "static/vendor/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } }, // sync-cert.mjs reads argv and RENTALS_DIR
  },
  {
    files: ["static/sw.js"], // the service worker: its own global, and the URL it opens
    languageOptions: { sourceType: "script", globals: { self: "readonly", URL: "readonly" } },
  },
);
