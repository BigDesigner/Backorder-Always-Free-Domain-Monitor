# ADR 0001: Initial Stack Selection

* **Status**: Accepted
* **Confidence**: Verified
* **Date**: 2026-05-20

## Context
The project requires a full-stack, professional-grade domain availability monitoring system that runs entirely on a free tier with minimal operational complexity. It must monitor domains, keep track of check events, support notifications via Telegram and Discord, and display the monitored domain list and check activity on a dynamic dashboard.

## Decision
We utilize the following technology stack:
1. **Backend**: Cloudflare Workers using the Hono framework (`hono` v4.12.18) and TypeScript. Cloudflare Workers provides free serverless execution.
2. **Frontend**: A React single-page application built with Vite (`vite` v8.0.11), styled using TailwindCSS (`tailwindcss` v3.4.10), and written in TypeScript.
3. **Database**: Cloudflare D1 (serverless SQLite-based SQL database) for storing domains, check events, and configurations. D1 has referential integrity constraints enabled.
4. **Tooling**: Wrangler CLI (`wrangler` v4.90.0) for database migrations, local development, secret management, and remote deployments.

## Consequences
- **Cost**: 100% free hosting under Cloudflare's free tiers for Workers, Pages, and D1.
- **Developer Experience**: TypeScript is used across both frontend and backend directories, sharing typing structures where applicable.
- **Portability**: The configuration resides in `wrangler.toml` and `.github/workflows/` files.
- **Performance**: Edge-native execution provides sub-millisecond route resolution.
- **Constraints**: SQLite-specific query limits and schema constraints apply. D1 referential integrity requires specific cascade delete flows.

## Evidence
- `frontend/package.json`
- `worker/package.json`
- `worker/wrangler.toml`
