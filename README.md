# Backorder — Always‑Free Domain Monitor (Cloudflare Worker + D1) + Apache Frontend

A modern full‑stack **backorder** system (domain availability monitor + notifications) designed to run on **always‑free** services:
- **Backend:** Cloudflare Workers (free) + **D1** (free SQLite DB) + **Cron triggers**
- **Frontend:** React + Vite + Tailwind (static) served by **WHM/cPanel / AlmaLinux 8 / Apache**

It checks domains up to **24× per day (hourly)** by default and will **automatically back off** if RDAP endpoints respond with rate limits.

✅ 10/10 UI dashboard (responsive, dark mode, modern cards)  
✅ Domain list, status, history, next check ETA  
✅ Add/remove/enable domains  
✅ Activity timeline + export  
✅ Notifications: Telegram + Discord webhook (both free)  
✅ Auth: admin login (PBKDF2) + sessions stored in D1  
✅ Safe polling: hourly by default + adaptive rate-limit backoff  
✅ 1‑command deploy for Worker; static build for Apache

---

## Architecture

**Browser (Apache static)** → calls → **Cloudflare Worker API** → **D1**  
Worker cron runs hourly and checks due domains via RDAP (default uses `https://rdap.org/domain/<domain>`).

> Note: true “drop catching” is a competitive registrar‑side feature. This system provides a **fast safe signal** and optional notification/webhook to trigger your own registrar action.

---

## 1) Backend (Cloudflare Worker + D1)

### Prereqs
- Node.js 18+
- Cloudflare account (free)
- Wrangler CLI

```bash
cd worker
npm install
```

### Create D1 + apply migrations
```bash
npx wrangler d1 create backorder_d1
# copy the returned database_id into wrangler.toml

npx wrangler d1 migrations apply backorder_d1 --local
npx wrangler d1 migrations apply backorder_d1
```

### Configure secrets
Set these Worker secrets (no quotes):
```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
# Optional notification config:
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put DISCORD_WEBHOOK_URL
# Optional:
npx wrangler secret put RDAP_BASE
```

Defaults:
- RDAP_BASE (optional): `https://rdap.org/domain/`

### Deploy
```bash
npx wrangler deploy
```

### Cron schedule
By default it runs hourly (24×/day). You can change it in `wrangler.toml`.

---

## 2) Frontend (Apache / WHM / cPanel compatible)

### Build
```bash
cd frontend
npm install
npm run build
```

It outputs `frontend/dist/` — upload **contents** of `dist` to your Apache public directory (e.g. `public_html/backorder/`).

### Apache SPA routing
If you serve from a subfolder like `/backorder/`, use the provided `.htaccess` in that folder.

You must set the API base URL in:
- `frontend/.env.production` (build time)
or edit `dist/assets/*.js` after build (not recommended).

---

## Safety & Rate‑Limit Behavior

- Default check interval: **60 minutes**
- If RDAP returns **429**, the system enters **adaptive backoff**:
  - increases next check delay (6h → 12h → 24h max) per domain
  - records the event in timeline

You can also globally lower checks by setting interval per domain in UI.

---

## API (high level)

- `POST /api/login`
- `POST /api/logout`
- `GET  /api/me`
- `GET  /api/domains`
- `POST /api/domains`
- `PATCH /api/domains/:id`
- `DELETE /api/domains/:id`
- `GET  /api/events`
- `GET  /api/health`

---

## Repo layout

```
worker/      Cloudflare Worker + D1 (TypeScript)
frontend/    React + Vite + Tailwind (static)
docs/        Screens, ops notes, hardening
.github/     Optional GitHub Actions deploy
```

---

## License
MIT
