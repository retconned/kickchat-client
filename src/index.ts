import { URLSearchParams } from "url";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

import { onMessage } from "./handlers/onMessage";
import { getChatroomId, runtimeChannelData } from "./utils/utils";

const baseUrl = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679";
const urlParams = new URLSearchParams({
  protocol: "7",
  client: "js",
  version: "7.4.0",
  flash: "false",
});
const url = `${baseUrl}?${urlParams.toString()}`;

// limit max channels per socket (depends on events per sec received )
const maxChannelsPerSocket = 10;
let activeSockets: WebSocket[] = [];

// Function to connect to channels on a given WebSocket connection
const connectToChannels = async (socket: WebSocket, channels: any[]) => {
  channels.forEach(async (channel) => {
    const connect = JSON.stringify({
      event: "pusher:subscribe",
      data: { auth: "", channel: `chatrooms.${channel}.v2` },
    });
    await socket.send(connect);
    const channelName = runtimeChannelData.get(channel);
    console.log(`connected to #${channelName}`);
  });
};

// Function to create a new WebSocket connection and connect to channels
const createNewSocket = async (channels: number[]) => {
  const socket = new WebSocket(url);
  const id = uuidv4();
  socket.on("open", () => {
    console.log(`Connected to socket server ${id}`);
    activeSockets.push(socket);
    connectToChannels(socket, channels);
  });
  socket.on("message", (data: WebSocket.Data) => {
    const messageEvent = data.toString();
    onMessage(messageEvent);
  });
  socket.on("close", () => {
    console.log("Disconnected from server");
    activeSockets = activeSockets.filter((s) => s !== socket);
  });
};

// Function to count the number of channels connected to the current socket
const countConnectedChannels = (socket: WebSocket): number => {
  let count = 0;
  socket.listeners("message").forEach((listener) => {
    const connectEvent = JSON.parse(listener.toString());
    if (connectEvent && connectEvent.event === "pusher:subscribe") {
      count++;
    }
  });
  return count;
};

// Function to handle connecting to channels on active WebSocket connections or create a new WebSocket if needed
const connectToDynamicChannels = async (channels: number[]) => {
  console.log(`Connecting to ${channels.length} channels...`);
  activeSockets.forEach((socket) => {
    const connectedChannelCount = countConnectedChannels(socket);
    console.log(
      `Socket ${socket.url} is connected to ${connectedChannelCount} channels`
    );
  });
  let connectedChannelCount = 0;
  activeSockets.forEach((socket) => {
    if (connectedChannelCount < maxChannelsPerSocket) {
      const channelsToConnect = channels.slice(
        connectedChannelCount,
        maxChannelsPerSocket - connectedChannelCount
      );
      connectToChannels(socket, channelsToConnect);
      connectedChannelCount += channelsToConnect.length;
    }
  });
  while (connectedChannelCount < channels.length) {
    const channelsToConnect = channels.slice(
      connectedChannelCount,
      connectedChannelCount + maxChannelsPerSocket
    );
    await createNewSocket(channelsToConnect);
    connectedChannelCount += channelsToConnect.length;
  }
};

const client = async (channels: string[]) => {
  const chatroomIds = await getChatroomId(channels);
  connectToDynamicChannels(chatroomIds);
};

client(["buddha", "xqc", "adinross"]);
