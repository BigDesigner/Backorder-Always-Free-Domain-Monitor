# ADR 0002: Deployment Topology and Custom Domain Routing

* **Status**: Accepted
* **Confidence**: Verified
* **Date**: 2026-05-20

## Context
Deploying the frontend on Cloudflare Pages and the API on a default Cloudflare Worker domain (`*.workers.dev`) causes connectivity issues in privacy-focused browsers (such as Firefox, Zen, and Mullvad) because these browsers block default `workers.dev` subdomains as cross-site tracking risk. 

In addition, deployment must be fully automated on git pushes to trigger frontend compilation and backend worker deployment with D1 database migration steps.

## Decision
1. **Frontend Deployment**: Deployed to Cloudflare Pages (e.g., using GitHub Actions or direct Git integration) which provides the SPA hosting.
2. **Backend API Routing**: Deployed to Cloudflare Workers, but configured with a **Custom Domain** proxy mapping (e.g., `api.gnn.tr`) instead of using the raw `workers.dev` address. 
3. **CI/CD Pipelines**:
   - Frontend: Automated via [.github/workflows/deploy-frontend.yml](file:///c:/Users/bigde/.antigravity/backorder_alwaysfree_cf_worker_apache/.github/workflows/deploy-frontend.yml) on push to paths under `frontend/**`. Builds using `npm run build` and deploys using `cloudflare/wrangler-action`.
   - Backend: Automated via [.github/workflows/deploy-worker.yml](file:///c:/Users/bigde/.antigravity/backorder_alwaysfree_cf_worker_apache/.github/workflows/deploy-worker.yml). It applies D1 database migrations remote first and then deploys the worker using `wrangler`.

## Consequences
- **Privacy Compatibility**: Bypasses browser-level tracking blocks, allowing Firefox, Zen, and Mullvad users to access the dashboard.
- **Wrangler Action Secrets**: Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets to be set in GitHub Actions.
- **Frontend Environment Variables**: Requires `VITE_API_BASE` repository variable to be set to point the frontend to the deployed Worker's custom API URL.
- **CORS Handling**: Deep CORS configuration is required on the backend to accept requests from the Pages custom domain.

## Evidence
- `README.md`
- `.antigravity/project-state.md`
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-worker.yml`
