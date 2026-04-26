# System Patterns: Backorder

## Architecture
The system uses a decoupled architecture to leverage the best of Cloudflare's ecosystem.

### Backend (Cloudflare Worker)
- **Framework:** Hono (TypeScript).
- **Storage:** Cloudflare D1 (SQLite).
- **Automation:** Cron Trigger (hourly by default).
- **Security:** PBKDF2 hashing, secure session cookies (HttpOnly, Secure, SameSite=None).

### Frontend (Cloudflare Pages)
- **Framework:** React + Vite + Tailwind CSS.
- **Routing:** SPA mode with base path `/backorder/`.
- **API Communication:** Communicates with Worker via CORS-enabled REST API.

### Infrastructure (The Proxy)
- **Pattern:** Reverse Proxy via Cloudflare Worker.
- **Goal:** Mask `pages.dev` and `workers.dev` under `gnn.tr/backorder` to avoid cross-origin cookie issues and provide a unified brand experience.

## Key Technical Decisions
- **Adaptive Backoff:** If RDAP returns 429, the interval for that domain increases (6h -> 12h -> 24h).
- **Automated CI/CD:** GitHub Actions handles building, D1 migrations, and deployment to both Worker and Pages.
- **Single Source of Truth:** D1 veritabanı stores domains, users, and audit logs.
