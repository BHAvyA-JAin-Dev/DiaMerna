# DiaMerna

**Maternal Wellness & Gestational Diabetes Assistant**

A privacy-first, AI-powered web app designed for pregnant women managing gestational diabetes. Track glucose, medications, sleep, hydration, symptoms, and baby development — all with real-time AI coaching.

> **Live demo:** [https://diamerna.vercel.app](https://diamerna.vercel.app)

---

## Features

| Feature | Description |
|---------|-------------|
| **🩸 Glucose Tracking** | Log blood sugar readings with meal context (fasting, post-meal). Color-coded timeline chart. |
| **📊 Smart Dashboard** | Weekly health score, goal progress, AI-generated daily insights based on your actual data. |
| **🤖 AI Chat Coach** | Ask DiaMerna anything about GD, diet, pregnancy. Powered by OpenRouter AI (configurable model). |
| **💊 Medication Log** | Track daily prenatal vitamins, insulin, blood pressure meds with check-off reminders. |
| **💧 Hydration & Sleep** | Log water intake, sleep duration, and stress levels. |
| **👶 Baby Tracker** | Kicking counter, contraction timer, pregnancy week calculator. |
| **📋 Symptom Checker** | Select symptoms + temperature → AI analyzes urgency and gives guidance. |
| **📄 Doctor Report** | One-click AI-generated summary of your health data, ready to print or save as PDF. |
| **☁️ Dropbox Backup** | One-tap OAuth to back up reports and data to your Dropbox. |
| **🌙 Dark Theme** | Soft cyberpunk dark UI with three accent themes (Pink, Mint, Lavender). |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript (no framework), HTML5, CSS3 |
| **Backend** | Node.js (Express for Vercel, built-in http for local) |
| **Database** | SQLite via `better-sqlite3` (local) or `sql.js` (Vercel) |
| **Auth** | JWT tokens + bcrypt password hashing + secure PIN for password reset |
| **AI** | OpenRouter API (configurable model) |
| **Deployment** | Vercel (serverless), or any Node.js host |
| **Cloud Storage** | Dropbox API (OAuth 2.0) |

---

## Architecture

```
diamerna/
├── api/                    # Express app for Vercel deployment
│   └── index.js           # All API routes, auth, DB init, static files
├── dev/                    # Frontend & local dev server root
│   ├── index.html          # Single-page app
│   ├── css/style.css       # Full theme + responsive layout
│   └── js/
│       ├── config.js       # App configuration (set your AI key here)
│       ├── app.js          # Bootstrap & Store.push patches
│       ├── modules/        # Feature modules (IIFE pattern)
│       │   ├── auth.js           # Auth overlay, OAuth, cloud connect
│       │   ├── dashboard.js       # Home dashboard stats, goals, AI insight
│       │   ├── glucose-logger.js  # Blood sugar tracking + chart
│       │   ├── health-tracker.js  # Sleep, hydration, meds, stress
│       │   ├── baby-tracker.js    # Kicks, contractions, pregnancy week
│       │   ├── calorie-analyzer.js# Meal nutrition analyzer
│       │   ├── ai-chat.js         # AI chat coach interface
│       │   ├── sidebar.js         # Sidebar navigation
│       │   ├── swipe-nav.js       # Touch swipe section switching
│       │   ├── onboarding.js      # First-run setup wizard
│       │   ├── more-menu.js       # Symptom checker, reports, export
│       │   ├── theme-switcher.js  # Accent theme toggle
│       │   └── calorie-analyzer.js
│       └── utils/
│           ├── constants.js       # Shared constants (meds, foods, etc.)
│           ├── helpers.js         # Utility functions (pregnancy week, stats, etc.)
│           └── storage.js         # localStorage wrapper (Store API)
├── serve.js                # Local development server (http, better-sqlite3)
├── db.js                   # sql.js compatibility layer for Vercel
├── vercel.json             # Vercel deployment config
├── package.json
├── .env.example            # Environment variables template
└── github/                 # Public GitHub copy (placeholder keys)
```

### Data Flow

1. **Client-side store (localStorage):** All user health data (glucose, sleep, meds, goals, profile) lives in the browser. No server-side storage of health data.
2. **Server-side DB (SQLite):** Only stores user accounts (email, hashed password, hashed PIN) and cloud storage tokens.
3. **AI requests** go through a server-side proxy (`/api/chat`) to avoid CORS issues and keep the API key server-side.
4. **Dropbox OAuth** uses server-side env vars — credentials are never exposed to the client.

---

## Setup (Local Development)

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and Install
```bash
git clone https://github.com/BHAvyA-JAin-Dev/DiaMerna.git
cd DiaMerna
npm install
```

### 2. Get an AI API Key
- Go to [OpenRouter.ai](https://openrouter.ai/keys) (free signup)
- Create a key
- Open `dev/js/config.js` and replace:
  ```js
  Cfg.API_KEY = 'sk-or-v1-your-key-here';
  ```

### 3. (Optional) Set Up Dropbox Backup
1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Create an app with "App folder" access type
3. Under OAuth 2, add redirect URI: `http://localhost:5500/api/oauth/callback`
4. Copy App key and App secret
5. Set environment variables:

**Windows (PowerShell):**
```powershell
$env:DROPBOX_CLIENT_ID = "your_app_key"
$env:DROPBOX_CLIENT_SECRET = "your_app_secret"
```

**macOS / Linux:**
```bash
export DROPBOX_CLIENT_ID="your_app_key"
export DROPBOX_CLIENT_SECRET="your_app_secret"
```

### 4. Run
```bash
node serve.js
```
Open [http://localhost:5500](http://localhost:5500)

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. In **Settings → Environment Variables**, add:
   - `DROPBOX_CLIENT_ID` — your Dropbox app key
   - `DROPBOX_CLIENT_SECRET` — your Dropbox app secret
   - `JWT_SECRET` — any random string (for token signing)
   - `OAUTH_REDIRECT_URI` — `https://your-app.vercel.app/api/oauth/callback`
5. Deploy — Vercel auto-detects `vercel.json`

> **Note:** On Vercel free tier, SQLite data is stored in `/tmp/` and may be lost on cold starts. For production, replace with a persistent database.

---

## Security

- **No user health data is sent to the server** — all glucose logs, sleep, meds, and personal data stay in your browser's localStorage.
- **Passwords are bcrypt-hashed** — never stored in plain text.
- **PINs are bcrypt-hashed** — used for password reset verification.
- **API keys are env vars** — never exposed to the client (the AI proxy runs server-side).
- **OAuth tokens** are stored encrypted in the server DB, never logged.

### Before pushing to public GitHub:
1. Replace `API_KEY` in `dev/js/config.js` with a placeholder
2. Remove real values from `.env.example`
3. Never commit `.env` files
4. The `github/` folder has sanitized configs for public reference

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DROPBOX_CLIENT_ID` | For cloud backup | Dropbox OAuth app key |
| `DROPBOX_CLIENT_SECRET` | For cloud backup | Dropbox OAuth app secret |
| `OAUTH_REDIRECT_URI` | For Vercel | OAuth callback URL (default: `http://localhost:5500/api/oauth/callback`) |
| `JWT_SECRET` | Optional | Secret for JWT signing (auto-generated if not set) |
| `ADMIN_EMAIL` | For admin panel | Owner login email for `/admin` dashboard |
| `ADMIN_PASSWORD` | For admin panel | Owner login password for `/admin` dashboard |
| `VERCEL` | Auto-set | Vercel environment flag |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Create account (email, password, name, 4-6 digit PIN) |
| POST | `/api/login` | Login (rate-limited: 10 attempts per 15 min) |
| POST | `/api/forgot-password` | Reset password using PIN verification |
| GET | `/api/me` | Get current user profile + cloud connections |
| POST | `/api/cloud/connect` | Save cloud storage tokens |
| POST | `/api/oauth/start` | Start Dropbox OAuth flow |
| GET | `/api/oauth/callback` | Dropbox OAuth callback |
| GET | `/api/oauth/env-status` | Check which OAuth providers are configured |
| POST | `/api/cloud/upload` | Upload file to connected cloud storage |
| GET | `/api/files` | List uploaded files |
| POST | `/api/admin/login` | Admin login (email + password from env vars) |
| GET | `/api/admin/stats` | Get total users and Dropbox connection count (admin only) |
| POST | `/api/chat` | Proxy to OpenRouter AI API |

---

## Rate Limiting

Login is rate-limited to **10 failed attempts per email+IP combination** within a 15-minute window. The counter resets on successful login.

---

## Tech Notes

- **No frontend framework** — pure vanilla JS keeps the bundle tiny and dependencies minimal.
- **IIFE module pattern** — each feature is self-contained, no build step required.
- **SQLite via sql.js on Vercel** — pure WASM SQLite, works in serverless environments.
- **Touch-friendly** — swipe navigation between sections.
- **Responsive** — works on mobile and desktop.

---

## License

ISC — use freely, modify, and share.

---

## Disclaimer

DiaMerna is an AI-assisted wellness tracker, **not a medical device**. Always consult your healthcare provider for medical decisions. In case of emergency, call 911 or your local emergency services.
