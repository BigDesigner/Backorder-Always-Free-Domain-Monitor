# Backorder — Always‑Free Domain Monitor (Cloudflare Worker + D1) + Apache Frontend

A modern full‑stack **backorder** system (domain availability monitor + notifications) designed to run on **always‑free** services:
- **Backend:** Cloudflare Workers (free) + **D1** (free SQLite DB) + **Cron triggers**
- **Frontend:** React + Vite + Tailwind (static) served by **WHM/cPanel / AlmaLinux 8 / Apache**

It checks domains up to **24× per day (hourly)** by default and will **automatically back off** if RDAP endpoints respond with rate limits.

### Key Features
✅ **Bulk Import:** Add dozens of domains at once (comma/newline separated).  
✅ **Privacy Browser Ready:** Optimized for Firefox, Zen, and Mullvad browsers.  
✅ **Database Maintenance:** One-click event cleanup and full factory reset (resets ID counters).  
✅ **Premium UI:** Text-only status indicators with dot markers for a modern look.  
✅ **Safe Staggering:** 1.2s delay between checks to prevent RDAP bans.  
✅ **.tr Specialist:** Explicit routing for Turkish domains via IANA to avoid RIPE errors.  
✅ **Auth:** Secure session management (PBKDF2 + D1 sessions).  

---

## Architecture

**Browser (Apache static)** → calls → **Cloudflare Worker API** (via `api.gnn.tr`) → **D1**  
Worker cron runs hourly and checks due domains via RDAP.

> **Privacy Note:** Privacy-focused browsers block `*.workers.dev` by default. This project uses a custom domain `api.gnn.tr` to ensure 100% connectivity.

---

## Maintenance & Housekeeping

Found in the **Settings** tab:
- **Clean Events (>30 days):** Keeps your D1 storage lean (stays under 500MB free limit).
- **Factory Reset:** Purges everything and resets the `sqlite_sequence` so IDs start from 1.

---

## 1) Backend (Cloudflare Worker + D1)

### Setup
1. `cd worker && npm install`
2. `npx wrangler d1 create backorder_d1` (Copy ID to `wrangler.toml`)
3. `npx wrangler d1 migrations apply backorder_d1`
4. Deploy: `npx wrangler deploy`

### Secrets
```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put DISCORD_WEBHOOK_URL
```

---

## 2) Frontend (Apache)

1. `cd frontend && npm install`
2. Update `API_BASE` in `src/lib/api.ts` to your custom domain.
3. `npm run build`
4. Upload `dist/` contents to your server.

---

## License
MIT
