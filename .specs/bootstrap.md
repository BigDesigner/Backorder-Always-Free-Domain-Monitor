# Bootstrap Specifications

This document outlines the development setup, dependencies, commands, and CI/CD pipelines for the Backorder Domain Monitor project.

## 🛠️ Environment Prerequisites
- **Node.js**: Version 22 (as verified by GHA workflow files `node-version: "22"`). [Verified]
- **Package Manager**: `npm` (packages and lockfiles are in subdirectories `frontend` and `worker`). [Verified]
- **Wrangler CLI**: For database setup and workers deployment (v4.x). [Verified]

---

## 🚀 Local Development Setup

### 1. Database Setup
A Cloudflare D1 database named `backorder_d1` is required.
1. Create the database in Cloudflare D1. [Verified]
2. Configure the database ID inside `worker/wrangler.toml` under `database_id`. [Verified]
3. Apply local database migrations:
   ```bash
   cd worker
   npm run migrate:local
   # Runs: wrangler d1 migrations apply backorder_d1 --local
   ```
   [Verified]

### 2. Backend API Setup
1. Go to the worker directory: `cd worker`
2. Install backend dependencies: `npm install` [Verified]
3. Create local secrets using Wrangler:
   ```bash
   npx wrangler secret put ADMIN_EMAIL
   npx wrangler secret put ADMIN_PASSWORD
   ```
   [Verified]
4. Start the local worker API server:
   ```bash
   npm run dev
   # Runs: wrangler dev
   ```
   [Verified]

### 3. Frontend Dashboard Setup
1. Go to the frontend directory: `cd frontend`
2. Install frontend dependencies: `npm install` [Verified]
3. Set the development environment API url in `.env` (or copy `.env.production` to `.env` and set `VITE_API_BASE=http://localhost:8787`). [Inferred]
4. Start the Vite dev server:
   ```bash
   npm run dev
   # Runs: vite
   ```
   [Verified]

---

## 📦 Build and Deployment Commands

### Backend Worker Deployment
To manually apply migrations and deploy the worker to production:
- Apply migrations remote:
  ```bash
  cd worker
  npm run migrate:remote
  # Runs: wrangler d1 migrations apply backorder_d1
  ```
- Deploy:
  ```bash
  npm run deploy
  # Runs: wrangler deploy
  ```
  [Verified]

### Frontend Pages Deployment
To build the frontend production assets:
```bash
cd frontend
npm run build
# Runs: tsc -p tsconfig.json --noEmit && vite build
```
[Verified]
- **Option A (Cloudflare Pages)**: Point Pages directory to `frontend` and output directory to `dist`. Set environment variable `VITE_API_BASE` to the Worker's URL. [Verified]
- **Option B (Apache/Shared Hosting)**: Update `VITE_API_BASE` in `frontend/.env.production`, run `npm run build`, and upload the `dist/` contents to `public_html`. Ensure `.htaccess` handles routing. [Verified]

---

## 🤖 CI/CD Pipelines

### 1. Deploy Cloudflare Pages (Frontend)
- **Workflow file**: [.github/workflows/deploy-frontend.yml](file:///.github/workflows/deploy-frontend.yml)
- **Triggers**: On push to `frontend/**` or `.github/workflows/deploy-frontend.yml`.
- **Jobs**:
  - `deploy`: Runs on `ubuntu-latest`. Installs Node 22, installs dependencies via `npm ci` in `frontend/`, builds the frontend with `npm run build` using `VITE_API_BASE` set from action variable `${{ vars.VITE_API_BASE }}`, and deploys via `cloudflare/wrangler-action@v3` to `backorder-frontend` Pages project.
  [Verified]

### 2. Deploy Cloudflare Worker
- **Workflow file**: [.github/workflows/deploy-worker.yml](file:///.github/workflows/deploy-worker.yml)
- **Triggers**: On push to `worker/**` or `.github/workflows/deploy-worker.yml`, or via manual dispatch.
- **Jobs**:
  - `deploy`: Runs on `ubuntu-latest`. Installs Node 22, installs dependencies via `npm ci` in `worker/`, applies D1 remote migrations, and deploys the worker via `wrangler deploy`.
  [Verified]

---

## 🔍 Validation Commands

The following commands are recommended for code quality checks:

| Command | Working Directory | Purpose | Required Tool | Notes |
|---|---|---|---|---|
| `npm run typecheck` | `worker` | Validate TypeScript types compile cleanly | npm, typescript | Runs `tsc -p tsconfig.json --noEmit` |
| `npm run lint` | `worker` | Lint worker source files | npm, eslint | Runs `eslint .` |
| `npm run build` | `frontend` | Compile frontend typescript and build asset bundles | npm, typescript, vite | Runs `tsc -p tsconfig.json --noEmit && vite build` |
