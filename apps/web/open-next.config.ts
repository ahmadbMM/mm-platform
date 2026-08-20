import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// Add r2IncrementalCache once the R2 bucket exists (Phase 2 media work):
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
export default defineCloudflareConfig();
