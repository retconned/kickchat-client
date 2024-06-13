# 🟢 KickChat Client

## **What is Kick Chat Client ?**

The KickChat Client is a small, TypeScript-based wrapper for [kick.com](https://kick.com)'s chat system. It uses WebSocket & unofficial API endpoints. and can automatically create new WS connections when the current ones reach their maximum capacity.

This client is designed to simplify the process of building chat bots and other chat-related applications for [kick.com](https://kick.com).

If you're looking to start building a chat bot or other chat-based applications, the KickChat Client is a great place to start. Its lightweight and has a basic handler logic makes it a good choice as a starter.

## 🟥 This is an experimental authentication branch, Still in development.

# Installation

1. Clone the repo

   ```sh
   git clone https://github.com/retconned/kickchat-client
   ```

2. Change directory to the project folder

   ```sh
   cd kickchat-client
   ```

3. Install dependencies using pnpm ([Get it here](https://pnpm.io/installation))

   ```sh
   pnpm install
   ```

4. Create a `.env` file in the root directory with the following content:

   ```sh
   cp .env.example .env
   ```

   - send a message using the website and grab necessary headers from the request in the network tab of your browser to match the axios request in codebase `../src/actions/sendMessage.ts` and fill your `.env` file with the values.

   ## 🟥 Authentication instructions

   - `USERNAME` & `PASSWORD` - Are your Kick username & password.
   - to get the OTP_SECRET, you need to login to your account and go https://kick.com/dashboard/settings/security and redo your 2FA setup. copy the code under the QR code and and fill your `.env` file with the value .

5. Run the app locally

   ```sh
   pnpm dev
   ```

# Chnagelog

### v0.3.0

- Added support for replying to messages.
- Improved project structure, cleaner code.

### v0.2.0

- Added support for sending messages.
- Added support for chat commands.

# R&D Notes

- Sending messages, replies, and reactions are now possible via unofficial v2 API endpoints & require x-csrf-token & Cookies & other headers.

- There is currently no official API documentations from the Kick team, and attempting to access the public endpoint will mostly result in cloudflare or authentication related errors.

# Future Todos

- Add role-based access control to the chat features (e.g. moderation actions, pinning messages, etc.)

- Implement replies & reactions.
