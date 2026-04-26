# Progress: Backorder

## What's Built (v1.0.0)
- [x] Cloudflare Worker API (Hono)
- [x] D1 Database Schema & Migrations
- [x] React Dashboard with Tailwind CSS
- [x] Automated GitHub Actions Deployments
- [x] Adaptive Rate-limiting / Backoff Logic
- [x] Reverse Proxy setup for `gnn.tr/backorder`
- [x] Security Hardening (PBKDF2, Secure Cookies)

## In Progress
- [ ] Operational testing of the notification systems (Telegram/Discord)

## Future Roadmap (Next Actions)
- [ ] **WHOIS Fallback:** Support for TLDs that don't have robust RDAP servers.
- [ ] **Bulk Import:** Add a "Bulk Add" feature for domain lists.
- [ ] **Domain Expiry Info:** Try to parse and display the expiration date from RDAP data.
- [ ] **Multi-User Support:** Allow multiple admin accounts with different permissions.
- [ ] **Mobile App:** Simple PWA (Progressive Web App) manifest for mobile usage.
