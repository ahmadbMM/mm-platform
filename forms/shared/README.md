# The account step the account forms share

`account.js` is the one place the account forms decide what a sign-in, a hand-over from the booking site and a
signed-in account's questions come to (the owner, 2026-10-25: "one shared sign-in and account step", so a fix
lands on every form at once). It has no page of its own; each form draws its boxes in its own words.

- `MMAccount.ident(raw)`: what `customer_login` takes for what was typed (an email in lower case; a mobile in E.164,
  +966 when it has no code, a Saudi 05X / 5X / 9665X number as +9665X; Arabic-Indic, Persian, Devanagari and Bengali
  digits read as 0-9).
- `MMAccount.signIn(rpc, raw, pwd)`: `customer_login`, then `customer_pwd_state`. `{row}`, or `{error}`: `id`, `pwd`,
  `locked`, `busy`, `network`, `wrong` (with `cc` when a number typed without its code is not a Saudi mobile) or
  `temp` (a temporary password, changed on the booking site first).
- `MMAccount.takeCode()` / `MMAccount.redeem(rpc, code)`: the booking site's `?code=` hand-over.
- `MMAccount.plan(me, keys)`: which questions a signed-in account is asked: what it holds (customer_community_me's
  names) is skipped unless staff flagged it (`me.flags` = customers.fix_fields). `{skip, ask, flagged}`.
- `MMAccount.draft(key, days)`: a half-filled form kept on the device (`load`, `save`, `clear`).

Who uses it:
- `forms/community` and `forms/defe` inline it (their `scripts/build.mjs`, through `emit.mjs`).
- The website's Learn to ride form imports `apps/web/src/lib/account-shared.ts`, which both builds write from this
  file (typed in `apps/web/src/lib/account-step.ts`). Learn to ride signs in through `/api/account` (its Turnstile
  check and the temporary-password step), and takes `ident` and `plan` from here.

Change `account.js`, then `npm run build` in `forms/community` **and** `forms/defe`, and commit the generated files:
CI rebuilds the forms and refuses a stale copy.
