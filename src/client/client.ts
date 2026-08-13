import EventEmitter from "node:events";
import { authentication, getChannelData, getVideoData } from "../core/kickApi";
import { parseMessage } from "../core/messageHandling";
import { createHeaders, makeRequest } from "../core/requestHelper";
import { createReconnectingWebSocket } from "../core/websocket";
import { type KickChannelInfo } from "../types/channels";
import {
  type ClientOptions,
  type KickClient,
  type Leaderboard,
  type LoginOptions,
  type Poll,
} from "../types/client";
import { type MessageData } from "../types/events";
import { type VideoInfo } from "../types/video";
import { decodeXsrfToken, validateCredentials } from "../utils/utils";

export const createClient = (
  channelName: string,
  options: ClientOptions = {},
): KickClient => {
  const emitter = new EventEmitter();
  emitter.on("error", () => {});
  let channelInfo: KickChannelInfo | null = null;
  let videoInfo: VideoInfo | null = null;
  let wsHandle: { close: () => void } | null = null;

  let clientToken: string | null = null;
  let clientCookies: string | null = null;
  let clientBearerToken: string | null = null;
  let isLoggedIn = false;

  const defaultOptions: ClientOptions = {
    plainEmote: true,
    logger: false,
    readOnly: false,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const getHeaders = (channelSlug: string) => {
    const bearerToken = clientBearerToken;
    const xsrfToken = clientToken;
    const cookies = clientCookies;

    if (!isLoggedIn) {
      throw new Error("Authentication required. Please login first.");
    }
    if (!bearerToken) {
      throw new Error("Missing bearer token");
    }
    if (!xsrfToken) {
      throw new Error("Missing XSRF token");
    }
    if (!cookies) {
      throw new Error("Missing cookies");
    }

    return createHeaders({ bearerToken, xsrfToken, cookies, channelSlug });
  };

  const login = async (options: LoginOptions) => {
    if (mergedOptions.readOnly === true) {
      throw new Error("Read-only mode does not support authentication");
    }

    const { type, credentials } = options;

    try {
      switch (type) {
        case "login": {
          if (!credentials) {
            throw new Error("Credentials are required for login");
          }
          validateCredentials(options);

          if (mergedOptions.logger) {
            console.log("Starting authentication process with login ...");
          }

          const { bearerToken, xsrfToken, cookies, isAuthenticated } =
            await authentication({
              username: credentials.username,
              password: credentials.password,
              otp_secret: credentials.otp_secret,
            });

          if (mergedOptions.logger) {
            console.log("Authentication tokens received, validating...");
          }

          clientBearerToken = bearerToken;
          clientToken = xsrfToken;
          clientCookies = cookies;
          isLoggedIn = isAuthenticated;

          if (!isAuthenticated) {
            throw new Error("Authentication failed");
          }

          if (mergedOptions.logger) {
            console.log("Authentication successful, initializing client...");
          }

          await initialize();
          break;
        }

        case "tokens":
          if (!credentials) {
            throw new Error("Tokens are required for login");
          }

          if (mergedOptions.logger) {
            console.log("Starting authentication process with tokens ...");
          }

          clientBearerToken = credentials.bearerToken;
          clientToken = credentials.xsrfToken;
          clientCookies = credentials.cookies;

          isLoggedIn = true;

          await initialize();
          break;
        default:
          throw new Error("Invalid authentication type");
      }

      return true;
    } catch (error) {
      console.error(
        "Login failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  };

  const initialize = async () => {
    try {
      if (mergedOptions.readOnly === false && !isLoggedIn) {
        throw new Error("Authentication required. Please login first.");
      }

      if (mergedOptions.logger) {
        console.log(`Fetching channel data for: ${channelName}`);
      }

      channelInfo = await getChannelData(channelName);
      if (!channelInfo) {
        throw new Error("Unable to fetch channel data");
      }

      if (mergedOptions.logger) {
        console.log(
          "Channel data received, establishing WebSocket connection...",
        );
      }

      wsHandle = createReconnectingWebSocket(channelInfo.chatroom.id, {
        onOpen: () => {
          if (mergedOptions.logger) {
            console.log(`Connected to channel: ${channelName}`);
          }
          emitter.emit("ready", getUser());
        },
        onMessage: (data) => {
          const parsedMessage = parseMessage(data.toString());
          if (parsedMessage) {
            switch (parsedMessage.type) {
              case "ChatMessage":
                if (mergedOptions.plainEmote) {
                  const messageData = parsedMessage.data as MessageData;
                  messageData.content = messageData.content.replace(
                    /\[emote:(\d+):(\w+)\]/g,
                    (_, __, emoteName) => emoteName,
                  );
                }
                break;
              case "Subscription":
              case "GiftedSubscriptions":
              case "StreamHost":
              case "MessageDeleted":
              case "UserBanned":
              case "UserUnbanned":
              case "PinnedMessageCreated":
              case "PinnedMessageDeleted":
              case "PollUpdate":
              case "PollDelete":
                break;
            }
            emitter.emit(parsedMessage.type, parsedMessage.data);
          }
        },
        onClose: () => {
          if (mergedOptions.logger) {
            console.log(`Disconnected from channel: ${channelName}`);
          }
          emitter.emit("disconnect");
        },
        onError: (error) => {
          console.error(
            "WebSocket error:",
            error instanceof Error ? error.message : error,
          );
          emitter.emit("error", error);
        },
      });
    } catch (error) {
      console.error(
        "Error during initialization:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  };

  if (mergedOptions.readOnly === true) {
    void initialize().catch((error) => {
      emitter.emit("error", error);
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: event listeners accept arbitrary payloads.
  const on = (event: string, listener: (...args: any[]) => void) => {
    emitter.on(event, listener);
  };

  const getUser = () =>
    channelInfo
      ? {
          id: channelInfo.id,
          username: channelInfo.slug,
          tag: channelInfo.user.username,
        }
      : null;

  const vod = async (video_id: string) => {
    videoInfo = await getVideoData(video_id);

    if (!videoInfo) {
      throw new Error("Unable to fetch video data");
    }

    if (!videoInfo.livestream) {
      throw new Error("Unable to fetch livestream data");
    }

    return {
      id: videoInfo.id,
      title: videoInfo.livestream.session_title,
      thumbnail: videoInfo.livestream.thumbnail,
      duration: videoInfo.livestream.duration,
      live_stream_id: videoInfo.live_stream_id,
      start_time: videoInfo.livestream.start_time,
      created_at: videoInfo.created_at,
      updated_at: videoInfo.updated_at,
      uuid: videoInfo.uuid,
      views: videoInfo.views,
      stream: videoInfo.source,
      language: videoInfo.livestream.language,
      livestream: videoInfo.livestream,
      channel: videoInfo.livestream.channel,
    };
  };

  const sendMessage = async (messageContent: string) => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }

    if (!isLoggedIn) {
      throw new Error("Authentication required. Please login first.");
    }

    if (messageContent.length > 500) {
      throw new Error("Message content must be less than 500 characters");
    }

    const bearerToken = clientBearerToken;
    const xsrfToken = clientToken;
    const cookies = clientCookies;

    if (!bearerToken) {
      throw new Error("Bearer token missing");
    }
    if (!xsrfToken) {
      throw new Error("XSRF token missing");
    }
    if (!cookies) {
      throw new Error("Cookies missing");
    }

    try {
      const response = await fetch(
        `https://kick.com/api/v2/messages/send/${channelInfo.chatroom.id}`,
        {
          headers: {
            accept: "application/json",
            "accept-language": "en-US,en;q=0.9",
            authorization: `Bearer ${bearerToken}`,
            "x-xsrf-token": decodeXsrfToken(xsrfToken),
            "cache-control": "max-age=0",
            cluster: "v2",
            "content-type": "application/json",
            priority: "u=1, i",
            "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
            "sec-ch-ua-arch": '"arm"',
            "sec-ch-ua-bitness": '"64"',
            "sec-ch-ua-full-version": '"132.0.6834.111"',
            "sec-ch-ua-full-version-list":
              '"Not A(Brand";v="8.0.0.0", "Chromium";v="132.0.6834.111"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-model": '""',
            "sec-ch-ua-platform": '"macOS"',
            "sec-ch-ua-platform-version": '"15.0.1"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            cookie: cookies,
            Referer: `https://kick.com/${channelInfo.slug}`,
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: JSON.stringify({ content: messageContent, type: "message" }),
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send message: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const banUser = async (
    targetUser: string,
    durationInMinutes?: number,
    permanent: boolean = false,
  ) => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }

    if (!targetUser) {
      throw new Error("Specify a user to ban");
    }

    if (!permanent) {
      if (!durationInMinutes) {
        throw new Error("Specify a duration in minutes");
      }

      if (durationInMinutes < 1) {
        throw new Error("Duration must be more than 0 minutes");
      }
    }

    const headers = getHeaders(channelInfo.slug);

    try {
      const data = permanent
        ? { banned_username: targetUser, permanent: true }
        : {
            banned_username: targetUser,
            duration: durationInMinutes,
            permanent: false,
          };

      await makeRequest<{ success: boolean }>(
        "post",
        `https://kick.com/api/v2/channels/${channelInfo.id}/bans`,
        headers,
        data,
      );

      if (mergedOptions.logger) {
        console.log(
          `User ${targetUser} ${permanent ? "banned" : "timed out"} successfully`,
        );
      }
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          `Error ${permanent ? "banning" : "timing out"} user:`,
          error instanceof Error ? error.message : error,
        );
      }
      throw new Error(
        `Failed to ${permanent ? "ban" : "time out"} user ${targetUser}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const unbanUser = async (targetUser: string) => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }

    if (!targetUser) {
      throw new Error("Specify a user to unban");
    }

    const headers = getHeaders(channelInfo.slug);

    try {
      await makeRequest<{ success: boolean }>(
        "delete",
        `https://kick.com/api/v2/channels/${channelInfo.id}/bans/${targetUser}`,
        headers,
      );

      if (mergedOptions.logger) {
        console.log(`User ${targetUser} unbanned successfully`);
      }
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          "Error unbanning user:",
          error instanceof Error ? error.message : error,
        );
      }
      throw new Error(
        `Failed to unban user ${targetUser}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }

    if (!messageId) {
      throw new Error("Specify a messageId to delete");
    }

    const headers = getHeaders(channelInfo.slug);

    try {
      await makeRequest<{ success: boolean }>(
        "delete",
        `https://kick.com/api/v2/channels/${channelInfo.id}/messages/${messageId}`,
        headers,
      );

      if (mergedOptions.logger) {
        console.log(`Message ${messageId} deleted successfully`);
      }
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          "Error deleting message:",
          error instanceof Error ? error.message : error,
        );
      }
      throw new Error(
        `Failed to delete message ${messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const slowMode = async (mode: "on" | "off", durationInSeconds?: number) => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }

    if (mode !== "on" && mode !== "off") {
      throw new Error("Invalid mode, must be either 'on' or 'off'");
    }

    if (mode === "on" && (!durationInSeconds || durationInSeconds < 1)) {
      throw new Error(
        "Invalid duration, must be greater than 0 if mode is 'on'",
      );
    }

    const headers = getHeaders(channelInfo.slug);

    try {
      const data =
        mode === "off"
          ? { slow_mode: false }
          : { slow_mode: true, message_interval: durationInSeconds };

      await makeRequest<{ success: boolean }>(
        "put",
        `https://kick.com/api/v2/channels/${channelInfo.slug}/chatroom`,
        headers,
        data,
      );

      if (mergedOptions.logger) {
        console.log(
          mode === "off"
            ? "Slow mode disabled successfully"
            : `Slow mode enabled with ${durationInSeconds} second interval`,
        );
      }
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          `Error ${mode === "off" ? "disabling" : "enabling"} slow mode:`,
          error instanceof Error ? error.message : error,
        );
      }
      throw new Error(
        `Failed to ${mode === "off" ? "disable" : "enable"} slow mode: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const getPoll = async (targetChannel?: string) => {
    const channel = targetChannel || channelName;

    if (!targetChannel && !channelInfo) {
      throw new Error("Channel info not available");
    }

    const headers = getHeaders(channel);

    try {
      const result = await makeRequest<Poll>(
        "get",
        `https://kick.com/api/v2/channels/${channel}/polls`,
        headers,
      );

      if (mergedOptions.logger) {
        console.log(`Poll retrieved successfully for channel: ${channel}`);
      }
      return result;
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          `Error retrieving poll for channel ${channel}:`,
          error instanceof Error ? error.message : error,
        );
      }
      return null;
    }
  };

  const getLeaderboards = async (targetChannel?: string) => {
    const channel = targetChannel || channelName;

    if (!targetChannel && !channelInfo) {
      throw new Error("Channel info not available");
    }

    const headers = getHeaders(channel);

    try {
      const result = await makeRequest<Leaderboard>(
        "get",
        `https://kick.com/api/v2/channels/${channel}/leaderboards`,
        headers,
      );

      if (mergedOptions.logger) {
        console.log(
          `Leaderboards retrieved successfully for channel: ${channel}`,
        );
      }
      return result;
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          `Error retrieving leaderboards for channel ${channel}:`,
          error instanceof Error ? error.message : error,
        );
      }
      return null;
    }
  };

  const destroy = () => {
    wsHandle?.close();
    wsHandle = null;
  };

  return {
    login,
    on,
    destroy,
    get user() {
      return getUser();
    },
    vod,
    sendMessage,
    banUser,
    unbanUser,
    deleteMessage,
    slowMode,
    getPoll,
    getLeaderboards,
  };
};
