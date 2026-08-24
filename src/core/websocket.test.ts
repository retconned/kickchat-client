import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { type WebSocket as ServerSocket, WebSocketServer } from "ws";

import { createReconnectingWebSocket, reconnectDelay } from "./websocket";

interface TestServer {
  port: number;
  wss: WebSocketServer;
}

const servers: TestServer[] = [];

const startServer = async (
  onConnection?: (socket: ServerSocket) => void,
): Promise<TestServer> => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", resolve));
  const port = (wss.address() as { port: number }).port;
  wss.on("connection", (socket) => onConnection?.(socket));

  const server = { port, wss };
  servers.push(server);
  return server;
};

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const { wss } of servers) {
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
  }
});

describe("reconnectDelay", () => {
  it("stays within ±25% of the exponential base and respects the cap", () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const base = Math.min(1000 * 2 ** attempt, 30000);
      for (let i = 0; i < 50; i += 1) {
        const delay = reconnectDelay(attempt);
        expect(delay).toBeGreaterThanOrEqual(Math.round(base * 0.75));
        expect(delay).toBeLessThanOrEqual(
          Math.min(Math.ceil((base * 5) / 4), 30000),
        );
      }
    }
  });

  it("never exceeds the max delay", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(reconnectDelay(attempt)).toBeLessThanOrEqual(30000);
    }
  });
});

const waitFor = async (
  condition: () => boolean,
  timeoutMs = 5000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe("createReconnectingWebSocket", () => {
  it("connects and subscribes to the chatroom channel", async () => {
    const received: string[] = [];
    const server = await startServer((socket) => {
      socket.on("message", (data) => received.push(data.toString()));
    });

    const handle = createReconnectingWebSocket(51082, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
    });

    await waitFor(() => received.length > 0);
    expect(received[0]).toContain('"chatrooms.51082.v2"');

    handle.close();
  });

  it("also subscribes to the channel feed when a channelId is given", async () => {
    const received: string[] = [];
    const server = await startServer((socket) => {
      socket.on("message", (data) => received.push(data.toString()));
    });

    const handle = createReconnectingWebSocket(51082, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
      channelId: 1234,
    });

    await waitFor(() => received.length >= 2);
    expect(received[0]).toContain('"chatrooms.51082.v2"');
    expect(received[1]).toContain('"channel.1234"');

    handle.close();
  });

  it("forwards chat frames and answers pings with pongs", async () => {
    let client: ServerSocket | undefined;
    const pongs: string[] = [];
    const server = await startServer((socket) => {
      client = socket;
      socket.on("message", (data) => {
        if (data.toString().includes("pusher:pong")) {
          pongs.push(data.toString());
        }
      });
    });

    const messages: string[] = [];
    const handle = createReconnectingWebSocket(1, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
      onMessage: (data) => messages.push(data.toString()),
    });

    await waitFor(() => client !== undefined);

    client?.send(JSON.stringify({ event: "pusher:ping", data: {} }));
    client?.send('{"event":"App\\Events\\ChatMessageEvent","data":"{}"}');

    await waitFor(() => pongs.length > 0 && messages.length > 0);
    expect(pongs[0]).toContain("pusher:pong");
    expect(messages[0]).toContain("ChatMessageEvent");

    handle.close();
  });

  it("reconnects after a connection drop", async () => {
    let connections = 0;
    const server = await startServer(() => {
      connections += 1;
      // Terminate the first client shortly after it subscribes.
      setTimeout(() => {
        for (const client of server.wss.clients) {
          client.terminate();
        }
      }, 50);
    });

    const handle = createReconnectingWebSocket(2, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
    });

    await waitFor(() => connections >= 2);
    expect(connections).toBeGreaterThanOrEqual(2);

    handle.close();
  });

  it("force-reconnects when the connection goes silent (watchdog)", async () => {
    let connections = 0;
    const errors: Error[] = [];
    // A server that accepts connections but never sends anything.
    const server = await startServer(() => {
      connections += 1;
    });

    const handle = createReconnectingWebSocket(3, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
      inactivityTimeoutMs: 150,
      onError: (error) => errors.push(error),
    });

    await waitFor(() => connections >= 2, 8000);

    expect(connections).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.message.includes("forcing reconnect"))).toBe(
      true,
    );

    handle.close();
  });

  it("close() stops all activity — no further reconnects", async () => {
    let connections = 0;
    const server = await startServer(() => {
      connections += 1;
    });

    const handle = createReconnectingWebSocket(4, {
      baseUrl: `ws://127.0.0.1:${server.port}`,
    });

    await waitFor(() => connections >= 1);
    handle.close();

    // Kill the connection post-close; nothing should reconnect.
    for (const client of server.wss.clients) {
      client.terminate();
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(connections).toBe(1);
  });
});
