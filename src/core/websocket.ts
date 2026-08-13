import { URLSearchParams } from "node:url";
import WebSocket from "ws";

const BASE_URL = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679";
const MAX_RECONNECT_DELAY = 30000;

export interface ReconnectingSocketOptions {
  onOpen?: () => void;
  onMessage?: (data: WebSocket.Data) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export const createWebSocket = (chatroomId: number): WebSocket => {
  const urlParams = new URLSearchParams({
    protocol: "7",
    client: "js",
    version: "8.4.0",
    flash: "false",
  });
  const url = `${BASE_URL}?${urlParams.toString()}`;

  const socket = new WebSocket(url);

  socket.on("open", () => {
    const connect = JSON.stringify({
      event: "pusher:subscribe",
      data: { auth: "", channel: `chatrooms.${chatroomId}.v2` },
    });
    socket.send(connect);
  });

  return socket;
};

export const createReconnectingWebSocket = (
  chatroomId: number,
  options: ReconnectingSocketOptions,
) => {
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (stopped) return;

    socket = createWebSocket(chatroomId);

    socket.on("open", () => {
      reconnectAttempts = 0;
      options.onOpen?.();
    });

    socket.on("message", (data) => {
      options.onMessage?.(data);
    });

    socket.on("close", () => {
      options.onClose?.();
      if (stopped) return;

      const delay = Math.min(
        1000 * 2 ** reconnectAttempts,
        MAX_RECONNECT_DELAY,
      );
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    });

    socket.on("error", (error) => {
      options.onError?.(error);
    });
  };

  connect();

  return {
    close: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    },
  };
};
