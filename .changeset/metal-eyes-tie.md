---
"@retconned/kick-js": minor
---

Refactor authentication to a tokens + cookies session model.

`client.login()` now accepts a single credential object instead of the previous
two-option (`type: "login"` / `type: "tokens"`) union:

Breaking changes:

- The Puppeteer username/password/OTP flow and its `type`-discriminated
  `LoginOptions` are removed; credentials are supplied as tokens + cookie jar.
- `xsrfToken` is no longer a credential and no longer required — Kick's API is
  Bearer-authenticated (the old header turned out to be a leftover
  placeholder). When a jar happens
  to contain `XSRF-TOKEN`, it is still forwarded as `x-xsrf-token`.
- `AuthenticationSettings`, `bearerToken`, and `xsrfToken` types are gone;
  new type exports: `KickSession`, `CookieInput`, and `Bag`.
- `client.login()` now resolves to `void` (it previously always resolved to
  `true` or threw).
- Channel/VOD data is fetched via axios instead of an embedded browser.

New: `authExpired` event on 401 (session invalid/expired), `client.isAuthenticated`
getter, `HttpStatusError`/`isAuthExpiredError` exports, configurable per-request
`timeoutMs` (default 15000), Pusher ping/pong keepalive + jittered reconnect
backoff + inactivity watchdog (force-reconnects after 90 s of silence so silent
TCP deaths can't stall the bot), and `on()`/`once()` now return an unsubscribe
function. Runtime dependencies are still just `axios` and `ws`.

Fixes: re-login no longer stacks WebSocket connections; `destroy()` during a
pending initialization no longer leaks a socket; failed re-logins keep the
previous session *and* connection; empty messages are rejected client-side.
The `{ bag }` console-harvest login path works end-to-end again — it can never
contain the HttpOnly session cookies, and none are needed.

Authenticated requests now mirror a real captured browser call: added
`x-app-platform: web` and the `message_ref` idempotency field on `sendMessage`;
removed legacy headers the site never sends (`cluster`, `X-Client-Token`,
`Referrer-Policy`). `X_CLIENT_TOKEN` is no longer exported.
  