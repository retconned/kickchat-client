import { URLSearchParams } from "node:url";
import WebSocket from "ws";

const DEFAULT_BASE_URL = "wss://ws-us2.pusher.com/app";
const DEFAULT_APP_KEY = "32cbd69e4b950bf97679";
const MAX_RECONNECT_DELAY = 30000;

export interface ReconnectingSocketOptions {
  onOpen?: () => void;
  onMessage?: (data: WebSocket.Data) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  appKey?: string;
  baseUrl?: string;
  inactivityTimeoutMs?: number;
  /** Numeric Kick channel ID; subscribes to `channel.{id}` for
   * channel-level events (follows, stream status, kicks, leaderboards). */
  channelId?: number;
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 90000;
const WATCHDOG_INTERVAL_MS = 5000;

export const reconnectDelay = (attempt: number): number => {
  const base = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY);
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_RECONNECT_DELAY));
};

const createSocketUrl = (appKey: string, baseUrl: string): string => {
  const urlParams = new URLSearchParams({
    protocol: "7",
    client: "js",
    version: "8.4.0",
    flash: "false",
  });
  return `${baseUrl}/${appKey}?${urlParams.toString()}`;
};

export const createWebSocket = (
  chatroomId: number,
  appKey: string = DEFAULT_APP_KEY,
  baseUrl: string = DEFAULT_BASE_URL,
  channelId: number | null = null,
): WebSocket => {
  const socket = new WebSocket(createSocketUrl(appKey, baseUrl));

  socket.on("open", () => {
    const channels = [`chatrooms.${chatroomId}.v2`];
    if (channelId !== null) {
      channels.push(`channel.${channelId}`);
    }

    for (const channel of channels) {
      const connect = JSON.stringify({
        event: "pusher:subscribe",
        data: { auth: "", channel },
      });
      socket.send(connect);
    }
  });

  return socket;
};

export const createReconnectingWebSocket = (
  chatroomId: number,
  options: ReconnectingSocketOptions,
) => {
  const appKey = options.appKey ?? DEFAULT_APP_KEY;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const channelId = options.channelId ?? null;
  const inactivityTimeoutMs =
    options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;

  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let lastActivityAt = Date.now();

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const startWatchdog = () => {
    const interval = Math.min(
      WATCHDOG_INTERVAL_MS,
      Math.max(Math.floor(inactivityTimeoutMs / 3), 1),
    );
    watchdogTimer = setInterval(() => {
      if (stopped || !socket) return;
      if (Date.now() - lastActivityAt <= inactivityTimeoutMs) return;

      options.onError?.(
        new Error(
          `No messages received for ${inactivityTimeoutMs}ms — forcing reconnect`,
        ),
      );
      socket.close();
    }, interval);
  };

  const stopWatchdog = () => {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    clearReconnectTimer();
    const delay = reconnectDelay(reconnectAttempts);
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  const handleMessage = (data: WebSocket.Data) => {
    lastActivityAt = Date.now();

    const text = data.toString();

    if (text.startsWith('{"event":"pusher:')) {
      try {
        const event = JSON.parse(text) as { event?: string };

        if (event.event === "pusher:ping") {
          socket?.send(JSON.stringify({ event: "pusher:pong", data: {} }));
          return;
        }
      } catch {}
    }

    options.onMessage?.(data);
  };

  const connect = () => {
    if (stopped) return;

    lastActivityAt = Date.now();

    socket = createWebSocket(chatroomId, appKey, baseUrl, channelId);

    socket.on("open", () => {
      lastActivityAt = Date.now();
      reconnectAttempts = 0;
      options.onOpen?.();
    });

    socket.on("message", handleMessage);

    socket.on("close", () => {
      options.onClose?.();
      scheduleReconnect();
    });

    socket.on("error", (error) => {
      options.onError?.(error);
    });
  };

  connect();
  startWatchdog();

  return {
    close: () => {
      if (stopped) return;
      stopped = true;
      clearReconnectTimer();
      stopWatchdog();
      if (socket) {
        socket.removeAllListeners();
        socket.on("error", () => {});
        socket.close();
        socket = null;
      }
    },
  };
};
