# Setup (Always‑Free)

This guide deploys Backorder as:
- **Backend:** Cloudflare Workers + D1
- **Frontend:** Static build on Apache (WHM/cPanel / AlmaLinux 8)

---

## 0) Prerequisites (local machine)

Install:
- **Node.js 18+**
- A Cloudflare account

From the project root you will run commands in:
- `worker/` (backend)
- `frontend/` (UI)

---

## 1) Backend (Cloudflare Workers + D1)

### 1.1 Install deps
```bash
cd worker
npm install
```

### 1.2 Login to Cloudflare
```bash
npx wrangler login
```

### 1.3 Create a D1 database
```bash
npx wrangler d1 create backorder_d1
```

Wrangler will print a `database_id`. Put it into `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "backorder_d1"
database_id = "REPLACE_WITH_YOUR_D1_ID"
migrations_dir = "migrations"
```

### 1.4 Apply migrations (creates tables)
```bash
npx wrangler d1 migrations apply backorder_d1 --remote
```

> If your D1 console shows **Tables: 0**, migrations did not apply.

### 1.5 Set required secrets (admin login)

```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

Optional notifications:

**Discord**
```bash
npx wrangler secret put DISCORD_WEBHOOK_URL
```

**Telegram**
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

### 1.6 CORS origin (IMPORTANT)

Because the frontend is served from Apache and the API is on Workers, you must allow the UI origin.

Edit `worker/wrangler.toml` and set a variable:

```toml
[vars]
CORS_ORIGIN = "https://YOUR-FRONTEND-DOMAIN"
```

Example:
```toml
CORS_ORIGIN = "https://gnn.tr"
```

### 1.7 Deploy
```bash
npx wrangler deploy
```

You will get a URL like:
`https://your-worker-name.workers.dev`

---

## 2) Frontend (Apache / cPanel)

### 2.1 Set API base URL
Edit `frontend/.env.production`:

```env
VITE_API_BASE=https://YOUR-WORKER-URL
```

### 2.2 Build
```bash
cd ../frontend
npm install
npm run build
```

Output is in `frontend/dist/`.

### 2.3 Upload to Apache (WHM/cPanel)
Upload the **contents** of `dist/` to a folder like:

`public_html/backorder/`

Make sure `.htaccess` is present (SPA routing).

---

## 3) Using Backorder

- Open your UI URL (e.g., `https://yourdomain.com/backorder/`)
- Sign in with `ADMIN_EMAIL` + `ADMIN_PASSWORD`
- Add domains
- Use **Force** to check immediately
- Automatic checks run hourly via cron (24×/day)

---

## Notes

- **PBKDF2 iterations are fixed at 100,000** to match Cloudflare Workers WebCrypto limits.
- Discord notifications are sent when a domain becomes **available** (not for “registered”).
