# @retconned/kick-js

## 0.8.0

### Minor Changes

- ab761a6: Refactor authentication to a tokens + cookies session model.
  
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

## 0.6.0

### Minor Changes

- 7328f54: adds ws reconnection logic, expands type exports, and fixes lingering type and bug issues across handlers and api

## 0.5.4

### Patch Changes

- 0741467: updates ws url version

## 0.5.3

### Patch Changes

- fda33e9: adds xsrf to sendMessage headers

## 0.5.2

### Patch Changes

- f0de3f0: fixes sendMessages and viewport issues

## 0.5.1

### Patch Changes

- ac3e959: fixes readme

## 0.5.0

### Minor Changes

- 3d46ec4: adds token auth, fixes sending messages

## 0.4.5

### Patch Changes

- 7ce0119: improves auth error handling

## 0.4.4

### Patch Changes

- 26bed3d: fixes div timeout

## 0.4.3

### Patch Changes

- cea93c2: adds polls, leaderboard, timeouts support, cloudflare error handling

## 0.4.2

### Patch Changes

- 6e9408c: fixes example code in readme

## 0.4.1

### Patch Changes

- 2c07d86: minor publishing misshap

## 0.4.0

### Minor Changes

- 59e5f76: authentication implementation

## 0.3.0

### Minor Changes

- d96ca4b: adds a vods data feature

## 0.2.0

### Minor Changes

- b59672c: missing type fix & updated readme

## 0.1.2

### Patch Changes

- 9106a7d: basic functionality implemented

## 0.1.1

### Patch Changes

- 66750c2: Initial release
