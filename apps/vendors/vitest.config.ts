import { defineConfig } from "vitest/config";

// Worker tests run the Worker's fetch handler directly with a stubbed fetch (never the real
// database); the date helpers are plain functions. Node's own Request/Response are enough.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
