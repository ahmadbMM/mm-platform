// What this Worker is given by Cloudflare beyond OpenNext's own bindings (wrangler.jsonc).
interface SignInLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

declare global {
  interface CloudflareEnv {
    /** Sign-in tries per connection (wrangler.jsonc "ratelimits"). */
    LOGIN_LIMIT?: SignInLimiter;
    /** Cloudflare Turnstile's secret key (a Worker secret); the sign-in check is on once it is set. */
    TURNSTILE_SECRET_KEY?: string;
  }
}

export {};
