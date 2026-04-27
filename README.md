# 🚀 Backorder — Always-Free Domain Monitor

A professional-grade, full-stack domain availability monitor designed to run **100% free** on Cloudflare infrastructure. Get notified the second your dream domain becomes available!

> [!TIP]
> This system is explicitly optimized for **Privacy-Focused Browsers** (Firefox, Zen, Mullvad) by routing traffic through your own custom API domain.

---

## 🛠️ 10-Minute "Step-by-Step" Setup Guide

Follow these steps to deploy your own private monitoring system.

### Step 1: Cloudflare Database (D1) Setup
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** > **D1**.
3. Click **Create Database** > **Dashboard Database**.
4. Name it `backorder_d1` and click **Create**.
5. **Copy the ID** of your new database. You will need it in Step 2.

### Step 2: Deploy the Backend API
1. Open your terminal and clone the repo:
   ```bash
   git clone https://github.com/BigDesigner/Backorder-Always-Free-Domain-Monitor.git
   cd Backorder-Always-Free-Domain-Monitor/worker
   ```
2. Install dependencies: `npm install`
3. Open `wrangler.toml` and paste your **Database ID** from Step 1 into the `database_id` field.
4. Login to Cloudflare via terminal: `npx wrangler login`
5. Initialize the database: `npx wrangler d1 migrations apply backorder_d1 --remote`
6. Deploy the API: `npx wrangler deploy`

### Step 3: Configure Security & Notifications (Secrets)
Run these commands in the `/worker` folder to set your private settings:

```bash
# Admin Credentials (Mandatory)
npx wrangler secret put ADMIN_EMAIL     # Your login email
npx wrangler secret put ADMIN_PASSWORD  # Your login password

# Notifications (Optional but Recommended)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put DISCORD_WEBHOOK_URL
```

> [!IMPORTANT]
> To get a Telegram Chat ID, message `@userinfobot` on Telegram after creating your bot via `@BotFather`.

### Step 4: Deploy the Frontend (Dashboard)
Choose the option that fits your setup:

#### Option A: Cloudflare Pages (Recommended 🚀)
1. Go to **Workers & Pages** > **Pages** > **Connect to Git**.
2. Select this repository.
3. **Build Settings:**
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment Variables:** Add `VITE_API_BASE` with your Worker's URL.
5. Click **Save and Deploy**. Your dashboard is now live and auto-syncs with every git push!

#### Option B: Apache / cPanel / Shared Hosting
1. Go to the `/frontend` folder: `cd ../frontend`
2. Update the `VITE_API_BASE` in `.env.production` with your Worker's URL.
3. Build the project: `npm run build`
4. **Upload:** Take the contents of the `dist/` folder and upload them to your server's `public_html`.
5. *Note: Ensure your `.htaccess` file is uploaded to handle SPA routing.*

---

## 🚀 Automated Deployment (GitHub Actions)

If you want to automate your deployments every time you push code, add these to your **GitHub Repository Settings > Secrets and variables > Actions**:

### 🔐 Repository Secrets
| Secret Name | Description |
| :--- | :--- |
| `CLOUDFLARE_ACCOUNT_ID` | Found in your Cloudflare Dashboard (Overview page). |
| `CLOUDFLARE_API_TOKEN` | Create a token with `Edit Cloudflare Workers` and `Edit D1` permissions. |

### 📊 Repository Variables
| Variable Name | Description |
| :--- | :--- |
| `VITE_API_BASE` | Your deployed Worker's URL (e.g., `https://api.yourdomain.com`). |

---

## ✨ Why this system is better?

| Feature | Benefit |
| :--- | :--- |
| **Adaptive Backoff** | Automatically slows down if RDAP servers block you, then speeds back up. |
| **.tr Specialist** | Handles Turkish domains natively using specific IANA routing. |
| **Bulk Import** | Paste 100 domains at once; it handles the staggering for you. |
| **Safety Lock** | Destructive actions require a "Type to Confirm" pass-phrase. |
| **No Database Costs** | Uses Cloudflare D1 which is free for millions of rows. |

---

## 🧹 Maintenance & Best Practices

To keep the system running perfectly on the **Free Tier**:
* **Cron Trigger:** The system checks domains every hour by default. You can change this in `wrangler.toml` under `[triggers]`.
* **Database Purge:** Every 30 days, go to the **Settings** tab in your dashboard and click **Clean Events** to keep the database small and fast.
* **Password Change:** Simply update your `ADMIN_PASSWORD` secret in Cloudflare and redeploy. The system will automatically detect it and log everyone out for security.

---

## 📜 License
MIT License. Built with ❤️ for the always-free community.
