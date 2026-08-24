import EventEmitter from "node:events";
import { buildSession, type KickSession } from "../auth/session";
import { getChannelClips } from "../core/clips";
import {
  getChannelData,
  getChannelLinks,
  getChannelVideos,
  getChatroomRules,
  getFollowersCount,
  getVideoData,
  KICK_API_BASE,
} from "../core/kick-api";
import { parseMessage } from "../core/message-handling";
import {
  createRequestContext,
  DEFAULT_TIMEOUT_MS,
  isAuthExpiredError,
  makeRequest,
  type RequestContext,
} from "../core/request-helper";
import { createReconnectingWebSocket } from "../core/websocket";
import {
  type ChannelLink,
  type ChannelVideo,
  type KickChannelInfo,
} from "../types/channels";
import {
  type ClientEvents,
  type ClientOptions,
  type KickClient,
  type Leaderboard,
  type LoginOptions,
  type Poll,
} from "../types/client";
import { type ClipFeed } from "../types/clips";

export const createClient = (
  channelName: string,
  options: ClientOptions = {},
): KickClient => {
  if (typeof channelName !== "string" || channelName.trim().length === 0) {
    throw new Error("createClient requires a non-empty channel name");
  }

  const emitter = new EventEmitter();

  const emitError = (error: unknown) => {
    if (emitter.listenerCount("error") > 0) {
      emitter.emit("error", error);
    } else {
      console.error("Unhandled client error:", error);
    }
  };

  const log = (message: string) => {
    if (mergedOptions.logger) {
      console.log(message);
    }
  };

  let channelInfo: KickChannelInfo | null = null;
  let wsHandle: { close: () => void } | null = null;

  let session: KickSession | null = null;
  let destroyed = false;
  let generation = 0;

  const defaultOptions: ClientOptions = {
    plainEmote: true,
    logger: false,
    readOnly: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const assertUsable = () => {
    if (destroyed) {
      throw new Error("Client has been destroyed");
    }
  };

  const requireSession = (): KickSession => {
    if (!session) {
      throw new Error("Authentication required. Please login first.");
    }
    return session;
  };

  const requireChannel = (): KickChannelInfo => {
    if (!channelInfo) {
      throw new Error("Channel info not available");
    }
    return channelInfo;
  };

  const withAuthGuard = async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      if (isAuthExpiredError(error)) {
        log("Session expired — please login again.");
        emitter.emit("authExpired");
      }
      throw error;
    }
  };

  const getRequestContext = (channelSlug: string): RequestContext =>
    createRequestContext(
      { session: requireSession(), channelSlug },
      mergedOptions.timeoutMs,
    );

  interface AuthedCall {
    slug: string;
    verb: "get" | "post" | "put" | "delete";
    url: string;
    data?: unknown;
  }

  interface ActionLabels {
    fail: string;
    error: string;
    success?: string;
  }

  const performAuthedAction = async <T>(
    call: AuthedCall,
    labels: ActionLabels,
  ): Promise<T> => {
    assertUsable();

    const request = getRequestContext(call.slug);

    try {
      const result = await withAuthGuard(() =>
        makeRequest<T>(call.verb, call.url, request, call.data),
      );

      if (labels.success) {
        log(labels.success);
      }
      return result;
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          labels.error,
          error instanceof Error ? error.message : error,
        );
      }
      throw new Error(
        `Failed to ${labels.fail}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const login = async (credentials: LoginOptions): Promise<void> => {
    assertUsable();

    if (mergedOptions.readOnly === true) {
      throw new Error("Read-only mode does not support authentication");
    }

    const previousSession = session;

    try {
      log("Starting authentication process ...");

      session = buildSession(credentials);

      log(
        `Credentials accepted (access token promoted${
          Object.keys(session.cookies).length > 0
            ? `, ${Object.keys(session.cookies).length} cookies`
            : ", no cookies"
        }), initializing client...`,
      );

      await initialize();
    } catch (error) {
      session = previousSession;
      if (mergedOptions.logger) {
        console.error(
          "Login failed:",
          error instanceof Error ? error.message : error,
        );
      }
      throw error;
    }
  };

  const initialize = async () => {
    const gen = generation;

    try {
      if (mergedOptions.readOnly === false && !session) {
        throw new Error("Authentication required. Please login first.");
      }

      log(`Fetching channel data for: ${channelName}`);

      const info = await getChannelData(channelName);

      if (gen !== generation) {
        log(`Initialization for: ${channelName} was superseded, aborting.`);
        return;
      }

      wsHandle?.close();

      channelInfo = info;

      log("Channel data received, establishing WebSocket connection...");

      wsHandle = createReconnectingWebSocket(channelInfo.chatroom.id, {
        channelId: channelInfo.id,
        onOpen: () => {
          log(`Connected to channel: ${channelName}`);
          emitter.emit("ready", getUser());
        },
        onMessage: (data) => {
          const parsedMessage = parseMessage(data.toString());
          if (!parsedMessage) {
            return;
          }

          if (
            parsedMessage.type === "ChatMessage" &&
            mergedOptions.plainEmote
          ) {
            parsedMessage.data.content = parsedMessage.data.content.replace(
              /\[emote:(\d+):(\w+)\]/g,
              (_, __, emoteName) => emoteName,
            );
          }

          emitter.emit(parsedMessage.type, parsedMessage.data);
        },
        onClose: () => {
          log(`Disconnected from channel: ${channelName}`);
          emitter.emit("disconnect");
        },
        onError: (error) => {
          emitError(error);
        },
      });
    } catch (error) {
      if (mergedOptions.logger) {
        console.error(
          "Error during initialization:",
          error instanceof Error ? error.message : error,
        );
      }
      throw error;
    }
  };

  if (mergedOptions.readOnly === true) {
    void initialize().catch((error) => {
      emitError(error);
    });
  }

  const on = <K extends keyof ClientEvents>(
    event: K,
    listener: ClientEvents[K],
  ) => {
    emitter.on(event, listener);
    return () => emitter.off(event, listener);
  };

  const once = <K extends keyof ClientEvents>(
    event: K,
    listener: ClientEvents[K],
  ) => {
    emitter.once(event, listener);
    return () => emitter.off(event, listener);
  };

  const getUser = () =>
    channelInfo
      ? {
          id: channelInfo.id,
          username: channelInfo.slug,
          tag: channelInfo.user.username,
        }
      : null;

  const vod = async (videoId: string) => {
    const videoInfo = await getVideoData(videoId);

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
    requireSession();
    const info = requireChannel();

    if (!messageContent.trim()) {
      throw new Error("Message content cannot be empty");
    }

    if (messageContent.length > 500) {
      throw new Error("Message content must be less than 500 characters");
    }

    await performAuthedAction<{ success: boolean }>(
      {
        slug: info.slug,
        verb: "post",
        url: `${KICK_API_BASE}/api/v2/messages/send/${info.chatroom.id}`,
        data: {
          content: messageContent,
          type: "message",
          message_ref: Date.now().toString(),
        },
      },
      {
        fail: "send message",
        error: "Error sending message:",
        success: "Message sent successfully",
      },
    );
  };

  const banUser = async (
    targetUser: string,
    durationInMinutes?: number,
    permanent: boolean = false,
  ) => {
    const info = requireChannel();

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

    await performAuthedAction<{ success: boolean }>(
      {
        slug: info.slug,
        verb: "post",
        url: `${KICK_API_BASE}/api/v2/channels/${info.id}/bans`,
        data: permanent
          ? { banned_username: targetUser, permanent: true }
          : {
              banned_username: targetUser,
              duration: durationInMinutes,
              permanent: false,
            },
      },
      {
        fail: `${permanent ? "ban" : "time out"} user ${targetUser}`,
        error: `Error ${permanent ? "banning" : "timing out"} user:`,
        success: `User ${targetUser} ${
          permanent ? "banned" : "timed out"
        } successfully`,
      },
    );
  };

  const unbanUser = async (targetUser: string) => {
    const info = requireChannel();

    if (!targetUser) {
      throw new Error("Specify a user to unban");
    }

    await performAuthedAction<{ success: boolean }>(
      {
        slug: info.slug,
        verb: "delete",
        url: `${KICK_API_BASE}/api/v2/channels/${info.id}/bans/${targetUser}`,
      },
      {
        fail: `unban user ${targetUser}`,
        error: "Error unbanning user:",
        success: `User ${targetUser} unbanned successfully`,
      },
    );
  };

  const deleteMessage = async (messageId: string) => {
    const info = requireChannel();

    if (!messageId) {
      throw new Error("Specify a messageId to delete");
    }

    await performAuthedAction<{ success: boolean }>(
      {
        slug: info.slug,
        verb: "delete",
        url: `${KICK_API_BASE}/api/v2/channels/${info.id}/messages/${messageId}`,
      },
      {
        fail: `delete message ${messageId}`,
        error: "Error deleting message:",
        success: `Message ${messageId} deleted successfully`,
      },
    );
  };

  const slowMode = async (mode: "on" | "off", durationInSeconds?: number) => {
    const info = requireChannel();

    if (mode === "on" && (!durationInSeconds || durationInSeconds < 1)) {
      throw new Error(
        "Invalid duration, must be greater than 0 if mode is 'on'",
      );
    }

    await performAuthedAction<{ success: boolean }>(
      {
        slug: info.slug,
        verb: "put",
        url: `${KICK_API_BASE}/api/v2/channels/${info.slug}/chatroom`,
        data:
          mode === "off"
            ? { slow_mode: false }
            : { slow_mode: true, message_interval: durationInSeconds },
      },
      {
        fail: `${mode === "off" ? "disable" : "enable"} slow mode`,
        error: `Error ${mode === "off" ? "disabling" : "enabling"} slow mode:`,
        success:
          mode === "off"
            ? "Slow mode disabled successfully"
            : `Slow mode enabled with ${durationInSeconds} second interval`,
      },
    );
  };

  const getPoll = (targetChannel?: string): Promise<Poll> => {
    const channel = targetChannel || channelName;

    if (!targetChannel) {
      requireChannel();
    }
    requireSession();

    return performAuthedAction<Poll>(
      {
        slug: channel,
        verb: "get",
        url: `${KICK_API_BASE}/api/v2/channels/${channel}/polls`,
      },
      {
        fail: `retrieve poll for channel ${channel}`,
        error: `Error retrieving poll for channel ${channel}:`,
        success: `Poll retrieved successfully for channel: ${channel}`,
      },
    );
  };

  const getLeaderboards = (targetChannel?: string): Promise<Leaderboard> => {
    const channel = targetChannel || channelName;

    if (!targetChannel) {
      requireChannel();
    }
    requireSession();

    return performAuthedAction<Leaderboard>(
      {
        slug: channel,
        verb: "get",
        url: `${KICK_API_BASE}/api/v2/channels/${channel}/leaderboards`,
      },
      {
        fail: `retrieve leaderboards for channel ${channel}`,
        error: `Error retrieving leaderboards for channel ${channel}:`,
        success: `Leaderboards retrieved successfully for channel: ${channel}`,
      },
    );
  };

  const resolveTargetChannel = (targetChannel?: string): string => {
    const channel = targetChannel || channelName;

    if (!targetChannel) {
      requireChannel();
    }

    return channel;
  };

  const getFollowers = (targetChannel?: string): Promise<number> => {
    assertUsable();
    return getFollowersCount(resolveTargetChannel(targetChannel));
  };

  const getRules = (targetChannel?: string): Promise<string> => {
    assertUsable();
    return getChatroomRules(resolveTargetChannel(targetChannel));
  };

  const getLinks = (targetChannel?: string): Promise<ChannelLink[]> => {
    assertUsable();
    return getChannelLinks(resolveTargetChannel(targetChannel));
  };

  const getVideos = (targetChannel?: string): Promise<ChannelVideo[]> => {
    assertUsable();
    return getChannelVideos(resolveTargetChannel(targetChannel));
  };

  const getClientClips = (
    targetChannel?: string,
    cursor?: string,
  ): Promise<ClipFeed> => {
    assertUsable();
    return getChannelClips(resolveTargetChannel(targetChannel), cursor);
  };

  const destroy = () => {
    destroyed = true;
    generation += 1;
    wsHandle?.close();
    wsHandle = null;
    emitter.removeAllListeners();
  };

  return {
    login,
    on,
    once,
    destroy,
    get user() {
      return getUser();
    },
    get isAuthenticated() {
      return session !== null;
    },
    vod,
    sendMessage,
    banUser,
    unbanUser,
    deleteMessage,
    slowMode,
    getPoll,
    getLeaderboards,
    getFollowers,
    getRules,
    getLinks,
    getVideos,
    getClips: getClientClips,
  };
};
