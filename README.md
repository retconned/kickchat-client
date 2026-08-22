![Version](https://img.shields.io/npm/v/@retconned/kick-js?label=Version)
![License](https://img.shields.io/npm/l/@retconned/kick-js?label=License)

❇️ **@retconned/kick-js**

## **What is kick-js**

**kick-js** is a TypeScript-based library for [kick.com](https://kick.com)'s chat system. It provides a simple interface that allows developers to build chat bots and other chat-related applications.

### :construction: This library is still active for now as a selfbot library for Kick, but it will be fully updated to match their official documentation once they implement WebSocket support for messages. :construction:

## Features :rocket:

-   Supports reading & writing to Kick.com chat.
-   Moderation actions (ban, slowmode).
-   Written in TypeScript.

## Installation :package:

Install the @retconned/kick-js package using the following command:

```sh
npm install @retconned/kick-js
```

## Example code :computer:

```ts
import { createClient } from "@retconned/kick-js";
import "dotenv/config";

const client = createClient("xqc", { logger: true, readOnly: true });
// readOnly: true will make the client only read messages from the chat, and disable all other authenticated actions.
// no credentials are needed in read-only mode.

client.on("ready", () => {
    console.log(`Bot ready & logged into ${client.user?.tag}!`);
});

client.on("ChatMessage", async (message) => {
    console.log(`${message.sender.username}: ${message.content}`);
});

// get information about a vod
// your-video-id = vod uuid
const { title, duration, thumbnail, views } = await client.vod("your-video-id");

// get leaderboards for a channel
const leaderboards = await client.getLeaderboards();
// you can also pass in a kick-channel-name to get leaderboards for a different channel
// example: const leaderboards = await client.getLeaderboards("xqc");

// get polls for a channel
const polls = await client.getPoll();
// you can also pass in a kick-channel-name to get polls for a different channel
// example: const polls = await client.getPoll("xqc");
```

A complete runnable bot — command parsing, error handling and `authExpired`
recovery included — lives in [`examples/basic-bot.ts`](examples/basic-bot.ts).
Credentials are supplied via environment variables; see
[`examples/.env.example`](examples/.env.example) for the expected shape.

### Authenticating :closed_lock_with_key:

To send messages or use moderation actions, log in with your Kick **session
credentials** (access token + cookies). There are three ways to obtain them:

1. **Console snippet (easiest)** — open [kick.com](https://kick.com) in your browser while logged in,
   paste the snippet below into the DevTools Console and press Enter. It prints
   a credential "bag" as JSON and copies it to your clipboard
   ([also available as a file](examples/harvest-credentials.js)):

    <details>
    <summary><code>harvest-credentials.js</code> — click to expand</summary>

    ```js
    // harvest-credentials.js
    //
    // Paste this into the DevTools console of a logged-in kick.com tab.
    // It prints (and copies to your clipboard) a "bag" of auth artifacts in the
    // exact shape @retconned/kick-js expects for client.login({ bag }).
    //
    //   1. Open https://kick.com and make sure you are logged in.
    //   2. Open DevTools → Console, paste this file's contents, press Enter.
    //   3. The bag JSON is copied to your clipboard — paste it into your bot.

    (() => {
      const bag = {};

      // document.cookie (non-HttpOnly cookies) — values stay URI-encoded, the
      // library decodes only where needed (e.g. the XSRF token header).
      for (const part of document.cookie.split(";")) {
        const i = part.indexOf("=");
        if (i > 0) {
          const name = part.slice(0, i).trim();
          const value = part.slice(i + 1).trim();
          if (name && value) bag[name] = value;
        }
      }

      // localStorage entries with meaningful values
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (key && value && value.length > 10) {
          bag[`__ls_${key}`] = value;
        }
      }

      // sessionStorage entries with meaningful values
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        if (key && value && value.length > 10) {
          bag[`__ss_${key}`] = value;
        }
      }

      const json = JSON.stringify(bag, null, 2);
      console.log(json);

      if (typeof copy === "function") {
        copy(json);
        console.info(
          "%c Bag copied to clipboard! Use it as:\n" +
            'client.login({ bag: <paste here> });',
          "color:#53fc18;font-weight:bold",
        );
      } else {
        console.warn("copy() unavailable outside devtools — copy manually.");
      }
    })();
    ```

    </details>

    Log in with the harvested bag — straight from the clipboard, or via `.env`
    (see [`examples/.env.example`](examples/.env.example)):

    ```ts
    import "dotenv/config";
    client.login({ bag: JSON.parse(process.env.KICK_BAG!) });
    // ...or paste the JSON directly:
    // client.login({ bag: /* paste the harvested bag here */ });
    ```

    The library automatically picks the best token candidate from the bag — you don't need to know which value is which.

## Releasing :rocket:

Releases are handled automatically with [Changesets](https://github.com/changesets/changesets).

1.  Make your changes and run `pnpm changeset` to describe the change and its version bump (patch/minor/major). Commit the generated changeset file along with your code.
2.  Merge to `main`. The Release workflow validates the code (`pnpm checks`) and opens a **Release** pull request.
3.  Merge the Release PR. The workflow publishes the package to npm and tags the commit.

To release from your local machine instead, run `pnpm release:local` (runs checks, then versions and publishes).


## Disclaimer :warning:

@retconned/kick-js is not affiliated with or endorsed by [Kick.com](https://kick.com). It is an independent tool created to facilitate making moderation bots & other chat-related applications.
