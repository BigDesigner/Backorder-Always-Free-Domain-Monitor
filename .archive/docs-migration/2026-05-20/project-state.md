# Project State: Backorder Monitor

This document provides critical technical context for AI agents working on this project.

## Technical Identity
- **Goal**: Always-free domain monitoring.
- **Tech Stack**: Cloudflare Workers, D1 (SQLite), React, Tailwind.
- **API Domain**: `api.gnn.tr` (Mandatory to bypass privacy browser blocks on `*.workers.dev`).

## Critical Implementation Details (Do Not Regress)

### 1. Privacy Browser Connectivity
Privacy-focused browsers (Firefox, Zen, Mullvad) block `workers.dev` subdomains as tracking/cross-site risks. 
- **Solution**: The API MUST be served through a custom domain (e.g., `api.gnn.tr`). 
- **CORS**: Ensure `worker/src/index.ts` has explicit CORS headers for all methods.

### 2. .tr RDAP Specifics
The default RDAP redirection (RIPE) often fails for `.tr` domains (Trabis).
- **Solution**: Explicitly route `.tr` to `rdap.iana.org` in `worker/src/rdap.ts`.
- **Fallbacks**: Always check for HTTP status codes (400 vs 404 vs 429) to decide on backoff.

### 3. D1 Quirks & Maintenance
- **ID Reset**: `DELETE FROM table` does not reset the auto-increment counter. Factory reset must also clear `sqlite_sequence`.
- **Cascade Deletes**: Foreign keys are used, but manual cleanup of `events` before `domains` in the delete handler is safer for D1 referential integrity.
- **Staggering**: Scheduler batch checks should have a `1200ms` delay between them to prevent mass rate-limiting from RDAP providers.

### 4. UI Design System
- **Minimalism**: Status indicators use colored text with dot indicators (`●`), NOT badges/pills.
- **Consistency**: Use `lib/ui.ts` for all class-name generation.

## Future Roadmap (Planned)
- [ ] Safety/Health Score indicator for check frequencies.
- [ ] Support for WHOIS fallback if RDAP is missing for specific TLDs.
- [ ] Multi-user support (low priority).
