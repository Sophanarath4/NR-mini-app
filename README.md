# FordTech Academy — Telegram + Gemini starter

A Ford-inspired single-page learning app with a Telegram-first login screen and Gemini AI chat UI. This starter includes a Node.js server that validates Telegram Login Widget signatures and proxies Gemini API requests without exposing the Gemini key in the browser.

## Requirements
- Node.js 18 or newer
- A Telegram bot created with `@BotFather`
- A Google Gemini API key from Google AI Studio
- HTTPS for public deployment (Telegram Login Widget does not work on a plain local file)

## Setup
1. Create a bot with `@BotFather`; copy the bot token and exact bot username.
2. In BotFather, configure the allowed website domain for Telegram Login Widget (your deployed HTTPS domain; no path).
3. Copy `.env.example` to `.env` and fill `TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` and a strong random `JWT_SECRET` (at least 32 characters).
4. Set `ADMIN_TELEGRAM_IDS` to comma-separated numeric Telegram user IDs that should have Admin access. Leave empty if no admins are configured.
5. Run `npm install`, then `npm start`.
6. Open `http://localhost:3000` for local development. For real users, deploy behind HTTPS and configure the domain with BotFather.

## Security notes
- The server verifies Telegram's HMAC signature and rejects login data older than 10 minutes.
- The browser never receives the Telegram bot token or Gemini API key.
- Gemini calls require a signed session token issued after Telegram verification.
- The app's lesson/admin data is still stored in the browser's localStorage. To make lesson changes, users, audit logs, and role permissions shared and tamper-resistant, add a persistent database and server-side authorization for every protected API route. Do not treat browser-only Admin UI as production authorization.
- This starter is a foundation, not a full production identity/account system. Review rate limits, deployment secrets, HTTPS, monitoring, and database design before public launch.
