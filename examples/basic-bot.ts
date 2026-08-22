import { createClient, type MessageData } from "@retconned/kick-js";
import "dotenv/config";

const client = createClient("xqc", { logger: true, readOnly: false });

client.login({
  bag: JSON.parse(process.env.KICK_BAG!),
});

client.on("ready", () => {
    console.log(`Bot ready & logged into ${client.user?.tag}!`);
});

// Authenticated actions are async and can reject (e.g. 403 when Cloudflare
// blocks a request or you lack permissions) — always handle rejections or an
// unhandled one will take down the whole process.
const reply = (content: string) =>
    client.sendMessage(content).catch((error: unknown) => {
        console.error(
            "sendMessage failed:",
            error instanceof Error ? error.message : error,
        );
    });

client.on("ChatMessage", (message: MessageData) => {
    console.log(`${message.sender.username}: ${message.content}`);

    if (message.content.startsWith("!ping")) {
        reply("pong!");
        return;
    }

    if (message.content.startsWith("!slowmode")) {
        const [, action, rawDuration] = message.content.split(" ");
        const duration = Number.parseInt(rawDuration ?? "", 10);

        if (action === "on") {
            if (!Number.isFinite(duration)) {
                reply("usage: !slowmode on <seconds>");
                return;
            }
            client.slowMode("on", duration).catch((error: unknown) => {
                console.error(
                    "slowMode failed:",
                    error instanceof Error ? error.message : error,
                );
            });
        } else if (action === "off") {
            client.slowMode("off").catch((error: unknown) => {
                console.error(
                    "slowMode failed:",
                    error instanceof Error ? error.message : error,
                );
            });
        }
    }
});

client.on("Subscription", (subscription) => {
    console.log(`New subscription 💰 : ${subscription.username}`);
});

// Emitted on websocket failures and unexpected errors.
client.on("error", (error) => {
    console.error("Client error:", error);
});

// Emitted when Kick answers 401 — the session is dead, harvest fresh
// credentials (see harvest-credentials.js) and call client.login() again.
client.on("authExpired", () => {
    console.warn(
        "Session expired — refresh credentials and call client.login() again.",
    );
});

// get information about a vod
const { title, duration, thumbnail, views } = await client.vod("your-video-id");
console.log(`VOD info: ${title} (${duration}s, ${views} views) - ${thumbnail}`);

// to get the current poll in a channel in the channel the bot is in
const poll = await client.getPoll();
console.log("Current poll:", poll?.data.title);
// or you can pass a specific channel to get the poll in that channel.
// example: const poll = await client.getPoll("xqc");

// get leaderboards for the channel the bot is in
const leaderboards = await client.getLeaderboards();
console.log("Top gifters:", leaderboards?.gifts);
// or you can pass a specific channel to get the leaderboards in that channel.
// example: const leaderboards = await client.getLeaderboards("xqc");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        client.destroy();
        process.exit(0);
    });
}
